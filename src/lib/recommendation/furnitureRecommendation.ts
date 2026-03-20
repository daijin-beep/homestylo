import { PRODUCT_CATEGORY_DEFINITIONS } from "@/lib/constants";
import type { ProductRole, RoomType } from "@/lib/types";
import {
  getMaxRecommendedSize,
  type RoomDimensions,
} from "@/lib/validation/dimensionValidator";

export interface RecommendationSchemeInput {
  id: string;
  room_type: RoomType;
  style: string | null;
  aesthetic_preferences: {
    style?: string | null;
    moodboards?: string[];
    colors?: string[];
  } | null;
}

export interface RecommendationRoomInput {
  sofa_wall_width_mm?: number | null;
  tv_wall_width_mm?: number | null;
  room_depth_mm?: number | null;
}

export interface ProductCandidate {
  id: string;
  name: string;
  category: string;
  style: string;
  price_min: number;
  price_max: number;
  width_mm: number;
  depth_mm: number;
  height_mm: number;
  image_url: string;
  source_url: string | null;
  brand: string | null;
  tags: string[] | null;
  is_hero: boolean;
}

export interface ScoredRecommendation {
  product: ProductCandidate;
  score: number;
  reason: string;
}

export interface FurnitureRecommendationResult {
  roomType: RoomType;
  style: string;
  requestedCategories: string[];
  groupedRecommendations: Record<string, ScoredRecommendation[]>;
  flatRecommendations: ScoredRecommendation[];
  roomDimensions: RoomDimensions;
}

const ROOM_TYPE_CATEGORIES: Record<RoomType, string[]> = {
  living_room: ["sofa", "coffee_table", "tv_cabinet", "rug", "floor_lamp", "side_table"],
  bedroom: ["bed", "side_table", "rug", "floor_lamp", "curtain"],
  dining_room: ["dining_table", "side_table", "rug", "floor_lamp", "painting"],
};

function ensureNumber(value: unknown, fallback: number) {
  if (typeof value === "number" && Number.isFinite(value) && value > 0) {
    return value;
  }

  return fallback;
}

function ensureNullableNumber(value: unknown) {
  if (typeof value === "number" && Number.isFinite(value) && value > 0) {
    return value;
  }

  return null;
}

function normalizeStyle(style: string | null | undefined) {
  if (!style || !style.trim()) {
    return "dopamine";
  }

  return style.trim();
}

function normalizeRoomDimensions(rawRoom: RecommendationRoomInput | null | undefined) {
  const sofaWallWidth = ensureNumber(rawRoom?.sofa_wall_width_mm, 3600);
  const tvWallWidth = ensureNumber(rawRoom?.tv_wall_width_mm, sofaWallWidth);

  return {
    sofaWallWidthMm: sofaWallWidth,
    tvWallWidthMm: tvWallWidth,
    roomDepthMm: ensureNullableNumber(rawRoom?.room_depth_mm),
    ceilingHeightMm: null,
  } satisfies RoomDimensions;
}

function collectTasteKeywords(scheme: RecommendationSchemeInput) {
  const style = normalizeStyle(scheme.style ?? scheme.aesthetic_preferences?.style);
  const moodboards = Array.isArray(scheme.aesthetic_preferences?.moodboards)
    ? scheme.aesthetic_preferences?.moodboards
    : [];
  const colors = Array.isArray(scheme.aesthetic_preferences?.colors)
    ? scheme.aesthetic_preferences?.colors
    : [];

  return [style, ...moodboards, ...colors]
    .map((keyword) => keyword.toLowerCase().trim())
    .filter(Boolean);
}

function getCategoryRole(category: string): ProductRole {
  const mapped = PRODUCT_CATEGORY_DEFINITIONS[
    category as keyof typeof PRODUCT_CATEGORY_DEFINITIONS
  ];

  if (!mapped) {
    return "accessory";
  }

  return mapped.role;
}

function buildRoomTypeCategories(roomType: RoomType) {
  return ROOM_TYPE_CATEGORIES[roomType] ?? ROOM_TYPE_CATEGORIES.living_room;
}

function scoreCandidate(
  candidate: ProductCandidate,
  style: string,
  room: RoomDimensions,
  keywords: string[],
) {
  let score = 50;
  const reasons: string[] = [];

  if (candidate.style === style) {
    score += 24;
    reasons.push("风格高度匹配");
  } else if (candidate.style === "universal") {
    score += 10;
    reasons.push("通用风格，兼容性强");
  } else {
    score -= 18;
  }

  if (candidate.is_hero) {
    score += 8;
    reasons.push("优先推荐款");
  }

  const sizeRecommendation = getMaxRecommendedSize(room, candidate.category);
  if (candidate.width_mm <= sizeRecommendation.maxWidthMm) {
    score += 14;
    reasons.push("宽度满足空间约束");
  } else {
    const overflowRatio = candidate.width_mm / sizeRecommendation.maxWidthMm;
    score -= Math.min(40, Math.round((overflowRatio - 1) * 60));
  }

  if (candidate.depth_mm <= sizeRecommendation.maxDepthMm) {
    score += 10;
    reasons.push("进深不挤占动线");
  } else {
    const overflowRatio = candidate.depth_mm / sizeRecommendation.maxDepthMm;
    score -= Math.min(28, Math.round((overflowRatio - 1) * 40));
  }

  const candidateTags = Array.isArray(candidate.tags)
    ? candidate.tags.map((tag) => tag.toLowerCase())
    : [];
  const keywordHits = keywords.filter((keyword) =>
    candidateTags.some((tag) => tag.includes(keyword) || keyword.includes(tag)),
  );

  if (keywordHits.length > 0) {
    score += Math.min(12, keywordHits.length * 4);
    reasons.push("审美偏好命中");
  }

  return {
    score,
    reason: reasons.length > 0 ? reasons.join("，") : "基础匹配推荐",
  };
}

export function buildFurnitureRecommendations(
  scheme: RecommendationSchemeInput,
  room: RecommendationRoomInput | null | undefined,
  products: ProductCandidate[],
  limitPerCategory = 3,
): FurnitureRecommendationResult {
  const normalizedStyle = normalizeStyle(
    scheme.style ?? scheme.aesthetic_preferences?.style,
  );
  const categories = buildRoomTypeCategories(scheme.room_type);
  const roomDimensions = normalizeRoomDimensions(room);
  const tasteKeywords = collectTasteKeywords(scheme);
  const groupedRecommendations: Record<string, ScoredRecommendation[]> = {};

  for (const category of categories) {
    const pool = products.filter((product) => product.category === category);
    if (pool.length === 0) {
      groupedRecommendations[category] = [];
      continue;
    }

    const scored = pool
      .map((product) => {
        const evaluation = scoreCandidate(
          product,
          normalizedStyle,
          roomDimensions,
          tasteKeywords,
        );

        return {
          product,
          score: evaluation.score,
          reason: evaluation.reason,
        } satisfies ScoredRecommendation;
      })
      .sort((a, b) => {
        if (b.score === a.score) {
          return a.product.price_min - b.product.price_min;
        }
        return b.score - a.score;
      })
      .slice(0, limitPerCategory);

    groupedRecommendations[category] = scored;
  }

  const flatRecommendations = categories.flatMap((category) =>
    groupedRecommendations[category] ?? [],
  );

  return {
    roomType: scheme.room_type,
    style: normalizedStyle,
    requestedCategories: categories,
    groupedRecommendations,
    flatRecommendations,
    roomDimensions,
  };
}

export function getRoleByCategory(category: string): ProductRole {
  return getCategoryRole(category);
}
