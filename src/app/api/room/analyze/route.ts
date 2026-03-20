import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { analyzeImage } from "@/lib/api/claude";
import type { FurnitureConstraints, SpaceStructure } from "@/lib/types";

interface AnalyzeRequestBody {
  scheme_id?: string;
}

interface RoomAnalysisRow {
  id: string;
  scheme_id: string;
  photo_url: string;
  floor_plan_url: string | null;
  constraints_json: Record<string, unknown> | null;
}

interface FloorPlanParsedResult {
  rooms?: Array<{
    name?: string;
    width_mm?: number;
    depth_mm?: number;
  }>;
  total_area_sqm?: number;
}

const ROOM_ANALYSIS_PROMPT = `
你是一个专业的室内空间分析师。分析这张室内照片，输出JSON格式的空间结构数据。

要求：
1. 识别每面可见墙面的类型：solid_wall / window / door / opening
2. 估算每面墙宽度（毫米）
3. 判断拍摄方向
4. 给出置信度(0-1)

严格输出JSON：
{
  "walls": [
    {"id": "wall_1", "type": "solid_wall", "estimated_width_mm": 3600, "label": "沙发背景墙"}
  ],
  "shooting_direction": "从入户方向朝客厅拍摄",
  "confidence": 0.75
}
`.trim();

const FLOOR_PLAN_PROMPT = `
你是户型图解读专家。提取标注的尺寸数据。
输出JSON：
{
  "rooms": [{"name": "客厅", "width_mm": 6000, "depth_mm": 4500}],
  "total_area_sqm": 120
}
`.trim();

function createServiceRoleClient() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!supabaseUrl || !serviceRoleKey) {
    throw new Error("缺少 Supabase service role 环境变量。");
  }

  return createClient(supabaseUrl, serviceRoleKey, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
    },
  });
}

function extractJson(text: string) {
  const fencedMatch = text.match(/```json\s*([\s\S]*?)\s*```/i);
  const candidate = (fencedMatch?.[1] ?? text).trim();
  const firstBrace = candidate.indexOf("{");
  const lastBrace = candidate.lastIndexOf("}");

  if (firstBrace < 0 || lastBrace < 0 || lastBrace <= firstBrace) {
    throw new Error("模型未返回合法 JSON。");
  }

  return JSON.parse(candidate.slice(firstBrace, lastBrace + 1)) as Record<
    string,
    unknown
  >;
}

function ensureNumber(value: unknown, fallback: number | null = null) {
  if (typeof value === "number" && Number.isFinite(value)) {
    return value;
  }

  return fallback;
}

function isWallType(
  value: unknown,
): value is SpaceStructure["walls"][number]["type"] {
  return (
    value === "solid_wall" ||
    value === "window" ||
    value === "door" ||
    value === "opening"
  );
}

function normalizeStructure(payload: Record<string, unknown>): SpaceStructure {
  const walls = Array.isArray(payload.walls) ? payload.walls : [];
  const normalizedWalls = walls
    .map((wall, index) => {
      if (!wall || typeof wall !== "object") {
        return null;
      }

      const source = wall as Record<string, unknown>;
      const wallType: SpaceStructure["walls"][number]["type"] = isWallType(source.type)
        ? source.type
        : "solid_wall";

      const label = typeof source.label === "string" ? source.label : undefined;

      return {
        id: typeof source.id === "string" ? source.id : `wall_${index + 1}`,
        type: wallType,
        estimated_width_mm: ensureNumber(source.estimated_width_mm, 3200) ?? 3200,
        ...(label ? { label } : {}),
      };
    })
    .filter((item): item is NonNullable<typeof item> => item !== null);

  return {
    walls: normalizedWalls,
    shooting_direction:
      typeof payload.shooting_direction === "string"
        ? payload.shooting_direction
        : "室内视角",
    confidence: ensureNumber(payload.confidence, 0.6) ?? 0.6,
  };
}

function buildConstraintsFromStructure(
  structure: SpaceStructure,
  floorPlan: FloorPlanParsedResult | null,
  existingConstraints: Record<string, unknown> | null,
) {
  const solidWalls = structure.walls
    .filter((wall) => wall.type === "solid_wall")
    .sort((a, b) => b.estimated_width_mm - a.estimated_width_mm);

  const estimatedSofaWall = solidWalls[0]?.estimated_width_mm ?? 3200;
  const estimatedTvWall = solidWalls[1]?.estimated_width_mm ?? estimatedSofaWall;
  const floorPlanDepth = floorPlan?.rooms?.[0]?.depth_mm ?? null;

  const manualSofaWidth = ensureNumber(existingConstraints?.sofa_wall_width_mm);
  const manualTvWidth = ensureNumber(existingConstraints?.tv_wall_width_mm);
  const manualDepth = ensureNumber(existingConstraints?.room_depth_mm);

  const sofaWallWidth = manualSofaWidth ?? estimatedSofaWall;
  const tvWallWidth = manualTvWidth ?? estimatedTvWall;
  const roomDepth = manualDepth ?? floorPlanDepth;

  const constraints: FurnitureConstraints = {
    sofa_wall_width_mm: sofaWallWidth,
    tv_wall_width_mm: tvWallWidth,
    room_depth_mm: roomDepth,
    max_sofa_width_mm: Math.round(sofaWallWidth * 0.75),
    max_tv_cabinet_width_mm: Math.round(tvWallWidth * 0.75),
  };

  const precisionMode =
    manualSofaWidth || floorPlan?.rooms?.[0]?.width_mm || floorPlan?.rooms?.[0]?.depth_mm
      ? "precision"
      : "simple";

  return { constraints, precisionMode };
}

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as AnalyzeRequestBody;
    const schemeId = body.scheme_id;

    if (!schemeId) {
      return NextResponse.json(
        { success: false, error: "缺少 scheme_id。" },
        { status: 400 },
      );
    }

    const supabase = createServiceRoleClient();
    const { data: roomAnalysis, error: roomAnalysisError } = await supabase
      .from("room_analysis")
      .select("id, scheme_id, photo_url, floor_plan_url, constraints_json")
      .eq("scheme_id", schemeId)
      .single<RoomAnalysisRow>();

    if (roomAnalysisError || !roomAnalysis) {
      return NextResponse.json(
        { success: false, error: "未找到空间分析记录。" },
        { status: 404 },
      );
    }

    const { data: roomPhotoSignedData, error: roomPhotoSignedError } = await supabase.storage
      .from("room-photos")
      .createSignedUrl(roomAnalysis.photo_url, 3600);

    if (roomPhotoSignedError || !roomPhotoSignedData?.signedUrl) {
      throw new Error("房间照片签名 URL 生成失败。");
    }

    const roomText = await analyzeImage(
      roomPhotoSignedData.signedUrl,
      ROOM_ANALYSIS_PROMPT,
      "请直接输出 JSON，不要添加额外解释。",
    );
    const structure = normalizeStructure(extractJson(roomText));

    let floorPlanResult: FloorPlanParsedResult | null = null;
    if (roomAnalysis.floor_plan_url) {
      const { data: floorPlanSignedData, error: floorPlanSignedError } = await supabase.storage
        .from("room-photos")
        .createSignedUrl(roomAnalysis.floor_plan_url, 3600);

      if (!floorPlanSignedError && floorPlanSignedData?.signedUrl) {
        const floorPlanText = await analyzeImage(
          floorPlanSignedData.signedUrl,
          FLOOR_PLAN_PROMPT,
          "请只返回 JSON。",
        );
        const parsedFloorPlan = extractJson(floorPlanText) as FloorPlanParsedResult;
        floorPlanResult = parsedFloorPlan;
      }
    }

    const { constraints, precisionMode } = buildConstraintsFromStructure(
      structure,
      floorPlanResult,
      roomAnalysis.constraints_json,
    );

    const structureWithFloorPlan = floorPlanResult
      ? { ...structure, floor_plan: floorPlanResult }
      : structure;

    const { error: updateError } = await supabase
      .from("room_analysis")
      .update({
        structure_json: structureWithFloorPlan,
        constraints_json: constraints,
        user_confirmed: true,
      })
      .eq("id", roomAnalysis.id);

    if (updateError) {
      throw new Error(updateError.message);
    }

    return NextResponse.json({
      success: true,
      structure: structureWithFloorPlan,
      constraints,
      precision_mode: precisionMode,
    });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "空间分析失败，请稍后重试。";
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
}
