import "server-only";

import { analyzeImage } from "@/lib/api/claude";
import { FLUX_PROMPTS, PRODUCT_ROLE_CATEGORIES, STYLE_DEFINITIONS } from "@/lib/constants";
import type { StyleType } from "@/lib/types";

export interface PromptContext {
  roomType: string;
  style: string;
  furniture: Array<{
    name: string;
    category: string;
    widthMm: number;
    depthMm: number;
  }>;
  roomWidthMm: number;
  roomDepthMm: number | null;
  aestheticKeywords?: string[];
}

export interface RouteFPromptParams {
  furnitureDescription: string;
  category: string;
  roomDescription: string;
  lightingDirection: string;
  stylePreference?: string;
}

const STYLE_ALIASES: Record<string, StyleType> = {
  midcentury: "midcentury",
  cream_french: "cream_french",
  wabi_sabi: "wabi_sabi",
  song: "song",
  dopamine: "dopamine",
};

const CATEGORY_PRIORITY: Record<string, number> = (() => {
  const priority: Record<string, number> = {};
  let index = 0;

  for (const role of ["primary", "secondary", "accessory"] as const) {
    for (const category of PRODUCT_ROLE_CATEGORIES[role]) {
      priority[category] = index;
      index += 1;
    }
  }

  return priority;
})();

const PRODUCT_DESCRIPTION_SYSTEM_PROMPT =
  "You describe furniture product images for downstream AI rendering. Respond with a single plain paragraph only.";

function normalizeStyle(style: string): StyleType {
  return STYLE_ALIASES[style] ?? "dopamine";
}

function formatMeters(valueMm: number | null) {
  if (typeof valueMm !== "number" || !Number.isFinite(valueMm) || valueMm <= 0) {
    return null;
  }

  return (valueMm / 1000).toFixed(1);
}

function normalizeRoomType(roomType: string) {
  if (roomType === "bedroom") {
    return "bedroom";
  }

  if (roomType === "dining_room") {
    return "dining room";
  }

  return "living room";
}

function normalizeText(value: string) {
  return value
    .replace(/```[\s\S]*?```/g, " ")
    .replace(/[`"'']/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function buildFurnitureDescription(context: PromptContext) {
  const prioritized = [...context.furniture]
    .sort((a, b) => {
      const aPriority = CATEGORY_PRIORITY[a.category] ?? 99;
      const bPriority = CATEGORY_PRIORITY[b.category] ?? 99;
      if (aPriority === bPriority) {
        return b.widthMm - a.widthMm;
      }
      return aPriority - bPriority;
    })
    .slice(0, 6);

  if (prioritized.length === 0) {
    return "";
  }

  const segments = prioritized.map((item) => {
    const widthM = (item.widthMm / 1000).toFixed(2);
    const depthM = (item.depthMm / 1000).toFixed(2);
    return `${item.name}, ${widthM}m wide, ${depthM}m deep`;
  });

  return `furniture layout includes ${segments.join("; ")}`;
}

function normalizeWordCount(text: string, maxWords: number) {
  const words = text.split(/\s+/).filter(Boolean);

  if (words.length <= maxWords) {
    return words.join(" ");
  }

  return words.slice(0, maxWords).join(" ");
}

function buildStyleHint(stylePreference?: string) {
  if (!stylePreference?.trim()) {
    return "";
  }

  const rawStyle = stylePreference.trim();
  const normalized = STYLE_ALIASES[rawStyle];
  if (normalized) {
    return STYLE_DEFINITIONS[normalized].fluxKeywords.join(", ");
  }

  return rawStyle;
}

function categoryToPhrase(category: string) {
  return category.replaceAll("_", " ");
}

function fallbackProductDescription(productName: string, category: string) {
  return normalizeWordCount(
    `A realistic ${productName} ${categoryToPhrase(category)} with clear material textures, clean edges, balanced proportions, and furniture details suitable for photorealistic interior rendering.`,
    40,
  );
}

export function buildFluxPrompt(context: PromptContext): string {
  const style = normalizeStyle(context.style);
  const roomType = normalizeRoomType(context.roomType);
  const basePrompt = FLUX_PROMPTS[style];
  const roomWidth = formatMeters(context.roomWidthMm);
  const roomDepth = formatMeters(context.roomDepthMm);
  const roomDescription = roomDepth
    ? `room approximately ${roomWidth ?? "3.6"}m x ${roomDepth}m`
    : `room approximately ${roomWidth ?? "3.6"}m wide`;
  const furnitureDescription = buildFurnitureDescription(context);

  const suffix =
    "interior photography, eye-level perspective, natural daylight from windows, 8K resolution, photorealistic, architectural digest quality, no text, no watermark, no people";

  const aestheticKeywords =
    context.aestheticKeywords && context.aestheticKeywords.length > 0
      ? `aesthetic keywords: ${context.aestheticKeywords.join(", ")}`
      : "";

  return [
    basePrompt,
    `room type: ${roomType}`,
    roomDescription,
    furnitureDescription,
    aestheticKeywords,
    suffix,
  ]
    .filter(Boolean)
    .join(", ");
}

export function buildNegativePrompt(): string {
  return "distorted proportions, unrealistic scale, cartoon, anime, sketch, blurry, low quality, text, watermark, signature, people, oversaturated colors, floating furniture, impossible geometry";
}

export function buildRouteFPrompt(params: RouteFPromptParams): string {
  const roomDescription = normalizeText(params.roomDescription);
  const lightingDirection = normalizeText(params.lightingDirection);
  const furnitureDescription = normalizeWordCount(
    normalizeText(params.furnitureDescription) || `a realistic ${categoryToPhrase(params.category)}`,
    40,
  );
  const styleHint = buildStyleHint(params.stylePreference);

  return [
    furnitureDescription,
    roomDescription,
    lightingDirection ? `${lightingDirection}, matching the existing room lighting` : "",
    styleHint ? `subtle style influence: ${styleHint}` : "",
    "photorealistic furniture rendering inside the masked area only",
    "accurate perspective and scale",
    "natural contact shadows and ambient occlusion",
    "no people, no text, no watermark",
  ]
    .filter(Boolean)
    .join(", ");
}

export function buildInpaintPrompt(
  roomDescription: string,
  lightingDirection: string,
): string {
  return [
    roomDescription,
    lightingDirection,
    "realistic shadows and reflections on furniture edges",
    "photorealistic interior photography",
    "soft ambient lighting",
    "8k",
  ]
    .filter(Boolean)
    .join(", ");
}

export function buildSceneRegenerationPrompt(
  roomDescription: string,
  lightingDirection: string,
  stylePreference?: string,
  furnitureDescriptions?: string[],
): string {
  const normalizedStyle =
    stylePreference && stylePreference.trim()
      ? normalizeStyle(stylePreference.trim())
      : null;
  const stylePrompt = normalizedStyle ? FLUX_PROMPTS[normalizedStyle] : "";
  const styleKeywords = normalizedStyle
    ? STYLE_DEFINITIONS[normalizedStyle].fluxKeywords.join(", ")
    : "";
  const furnitureLine =
    furnitureDescriptions && furnitureDescriptions.length > 0
      ? `placed furniture: ${furnitureDescriptions.join("; ")}`
      : "";

  return [
    roomDescription,
    lightingDirection,
    stylePrompt,
    styleKeywords ? `style materials and mood: ${styleKeywords}` : "",
    furnitureLine,
    "continuous wall and flooring materials",
    "natural shadows beneath furniture",
    "soft ambient occlusion where furniture meets floor",
    "consistent room lighting across all surfaces",
    "clean architectural perspective",
    "photorealistic interior photography",
    "seamless furniture-to-environment integration",
    "no people, no text, no watermark",
  ]
    .filter(Boolean)
    .join(", ");
}

export async function describeProductImage(
  imageUrl: string,
  productName: string,
  category: string,
): Promise<string> {
  const userPrompt = `
Describe this furniture product image for AI rendering.
Product: ${productName} (Category: ${category})

Provide a concise visual description covering:
- Color and material (e.g., "dark gray linen fabric", "walnut solid wood")
- Shape and form (e.g., "L-shaped sectional", "round pedestal")
- Style (e.g., "mid-century modern", "Scandinavian minimalist")
- Notable features (e.g., "tapered wooden legs", "tufted cushions", "chrome frame")

Output a single paragraph, 20-40 words. Use only visual attributes.
Do not mention brand names, prices, or dimensions.
`.trim();

  try {
    const response = await analyzeImage(
      imageUrl,
      PRODUCT_DESCRIPTION_SYSTEM_PROMPT,
      userPrompt,
    );
    const normalized = normalizeWordCount(normalizeText(response), 40);
    return normalized || fallbackProductDescription(productName, category);
  } catch (error) {
    console.error("[promptBuilder] describeProductImage failed", {
      imageUrl,
      productName,
      category,
      error: error instanceof Error ? error.message : String(error),
    });
    return fallbackProductDescription(productName, category);
  }
}
