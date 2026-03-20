import "server-only";

import { analyzeImage } from "@/lib/api/claude";

export interface DetectedHotspot {
  productId: string;
  label: string;
  x: number;
  y: number;
  width: number;
  height: number;
  confidence: number;
}

export interface HotspotDetectionResult {
  hotspots: DetectedHotspot[];
  processingTimeMs: number;
}

interface InputFurniture {
  id: string;
  name: string;
  category: string;
}

const HOTSPOT_SYSTEM_PROMPT = `
你是一个家具位置标注专家。给你一张室内效果图和一个家具清单，
你需要标注每件家具在图中的位置。
输出JSON数组，每个元素包含：
- id: 家具ID（从输入清单中匹配）
- label: 家具名称
- x, y: 家具中心点的相对坐标（0-1，左上角为原点）
- width, height: 家具占图的相对宽高（0-1）
- confidence: 你对这个标注的置信度（0-1）

只输出JSON，不要其他文字。如果某件家具在图中找不到，不要包含它。
`.trim();

function clamp(value: number, min: number, max: number) {
  if (value < min) {
    return min;
  }

  if (value > max) {
    return max;
  }

  return value;
}

function extractJsonText(raw: string) {
  const fenced = raw.match(/```json\s*([\s\S]*?)\s*```/i);
  if (fenced?.[1]) {
    return fenced[1].trim();
  }

  const firstBracket = raw.indexOf("[");
  const lastBracket = raw.lastIndexOf("]");
  if (firstBracket >= 0 && lastBracket > firstBracket) {
    return raw.slice(firstBracket, lastBracket + 1).trim();
  }

  return raw.trim();
}

function parseHotspots(raw: string, furnitureMap: Map<string, InputFurniture>) {
  const text = extractJsonText(raw);
  const parsed = JSON.parse(text) as unknown;
  if (!Array.isArray(parsed)) {
    return [] as DetectedHotspot[];
  }

  const hotspots: DetectedHotspot[] = [];
  for (const item of parsed) {
    if (!item || typeof item !== "object") {
      continue;
    }

    const record = item as Record<string, unknown>;
    const id = typeof record.id === "string" ? record.id : null;
    if (!id || !furnitureMap.has(id)) {
      continue;
    }

    const sourceFurniture = furnitureMap.get(id);
    const label =
      typeof record.label === "string" && record.label.trim()
        ? record.label.trim()
        : sourceFurniture?.name ?? id;

    const x = typeof record.x === "number" ? record.x : NaN;
    const y = typeof record.y === "number" ? record.y : NaN;
    const width = typeof record.width === "number" ? record.width : NaN;
    const height = typeof record.height === "number" ? record.height : NaN;
    const confidence =
      typeof record.confidence === "number" ? record.confidence : 0;

    if (![x, y, width, height].every((value) => Number.isFinite(value))) {
      continue;
    }

    if (confidence < 0.3) {
      continue;
    }

    hotspots.push({
      productId: id,
      label,
      x: clamp(x, 0, 1),
      y: clamp(y, 0, 1),
      width: clamp(width, 0, 1),
      height: clamp(height, 0, 1),
      confidence: clamp(confidence, 0, 1),
    });
  }

  return hotspots;
}

export async function detectHotspots(
  imageUrl: string,
  furniture: InputFurniture[],
): Promise<HotspotDetectionResult> {
  const startedAt = Date.now();
  const furnitureMap = new Map(furniture.map((item) => [item.id, item]));
  const userPrompt = [
    "请标注以下家具在图中的位置：",
    ...furniture.map((item) => `- ${item.id}: ${item.name} (${item.category})`),
  ].join("\n");

  try {
    const responseText = await analyzeImage(
      imageUrl,
      HOTSPOT_SYSTEM_PROMPT,
      userPrompt,
    );

    const hotspots = parseHotspots(responseText, furnitureMap);
    return {
      hotspots,
      processingTimeMs: Date.now() - startedAt,
    };
  } catch {
    return {
      hotspots: [],
      processingTimeMs: Date.now() - startedAt,
    };
  }
}

