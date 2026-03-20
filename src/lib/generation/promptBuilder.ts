import "server-only";

import { FLUX_PROMPTS, PRODUCT_ROLE_CATEGORIES } from "@/lib/constants";
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

export function buildFluxPrompt(context: PromptContext): string {
  const style = normalizeStyle(context.style);
  const roomType = normalizeRoomType(context.roomType);
  const basePrompt = FLUX_PROMPTS[style];
  const roomWidth = formatMeters(context.roomWidthMm);
  const roomDepth = formatMeters(context.roomDepthMm);
  const roomDescription = roomDepth
    ? `room approximately ${roomWidth ?? "3.6"}m × ${roomDepth}m`
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

