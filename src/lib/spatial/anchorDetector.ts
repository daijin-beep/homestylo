import "server-only";

import { analyzeImage } from "@/lib/api/claude";
import { createServiceRoleClient } from "@/lib/supabase/admin";
import type {
  AnchorDetectionResult,
  ExistingFurniture,
  SemanticAnchor,
  SpatialAnalysis,
  Vec2px,
} from "@/lib/types";
import { extractJson } from "@/lib/utils/jsonExtractor";

const SYSTEM_PROMPT =
  "You analyze indoor room photos for spatial calibration. Return strict JSON only.";

const ANCHOR_DETECTION_PROMPT = `Analyze this indoor room photo. Perform two tasks:

TASK 1: Detect scale reference objects (in priority order):
1. Interior door: Mark the four corner pixel coordinates of the door frame. Standard Chinese interior door height is 2050mm, width 800mm.
2. Ceiling-floor distance: If both ceiling line and floor line are visible, mark their y-coordinates. Standard Chinese residential ceiling height is 2700mm.
3. Floor tiles: If tile seams are visible, mark four corners of one complete tile. Common sizes: 800x800mm or 600x600mm.

For each detected anchor, provide pixel coordinates of the bounding box and a confidence score (0-1).

TASK 2: Identify room features:
- Wall color (e.g., "warm beige", "cool white", "light gray")
- Floor material (e.g., "oak hardwood", "gray tile", "marble", "carpet")
- Primary lighting direction (e.g., "natural light from right window", "overhead ceiling light")
- Existing furniture: list each piece with category, approximate pixel position (x,y as 0-1 normalized), and estimated width in pixels
- Shooting direction (e.g., "from entrance looking into living room")

Output strict JSON only:
{
  "anchors": [
    {
      "type": "door",
      "pixelBounds": { "topLeft": {"x": 120, "y": 80}, "bottomRight": {"x": 210, "y": 580} },
      "knownSizeMm": 2050,
      "measureDirection": "vertical",
      "confidence": 0.9
    }
  ],
  "roomFeatures": {
    "wallColor": "warm beige",
    "floorMaterial": "oak hardwood",
    "lightingDirection": "natural light from large right-side window",
    "existingFurniture": [
      { "id": "existing_1", "category": "sofa", "position": {"x": 0.5, "y": 0.6}, "estimated_width_mm": 2200, "estimated_depth_mm": 900 }
    ],
    "shootingDirection": "from entrance looking into living room"
  }
}

If you cannot detect any anchor, set "anchors" to an empty array. Do not guess.`;

type AnchorType = SemanticAnchor["type"];

interface RawAnchorPayload {
  anchors?: unknown[];
  roomFeatures?: Record<string, unknown>;
}

const DEFAULT_KNOWN_SIZES: Record<AnchorType, number> = {
  door: 2050,
  ceiling_height: 2700,
  floor_tile: 800,
  window: 1200,
  baseboard: 100,
};

function ensureNullableString(value: unknown) {
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

function ensureNumber(value: unknown, fallback: number) {
  if (typeof value === "number" && Number.isFinite(value)) {
    return value;
  }

  if (typeof value === "string") {
    const parsed = Number(value);
    if (Number.isFinite(parsed)) {
      return parsed;
    }
  }

  return fallback;
}

function clamp(value: number, min: number, max: number) {
  return Math.min(Math.max(value, min), max);
}

function normalizePoint(value: unknown, fallback: Vec2px): Vec2px {
  if (!value || typeof value !== "object") {
    return fallback;
  }

  const record = value as Record<string, unknown>;
  return {
    x: Math.round(ensureNumber(record.x, fallback.x)),
    y: Math.round(ensureNumber(record.y, fallback.y)),
  };
}

function normalizeAnchorType(value: unknown): AnchorType | null {
  switch (value) {
    case "door":
    case "ceiling_height":
    case "floor_tile":
    case "window":
    case "baseboard":
      return value;
    case "ceiling":
      return "ceiling_height";
    default:
      return null;
  }
}

function normalizeAnchor(value: unknown): SemanticAnchor | null {
  if (!value || typeof value !== "object") {
    return null;
  }

  const record = value as Record<string, unknown>;
  const type = normalizeAnchorType(record.type);
  if (!type) {
    return null;
  }

  const pixelBoundsSource =
    record.pixelBounds && typeof record.pixelBounds === "object"
      ? (record.pixelBounds as Record<string, unknown>)
      : {};

  return {
    type,
    pixelBounds: {
      topLeft: normalizePoint(pixelBoundsSource.topLeft, { x: 0, y: 0 }),
      bottomRight: normalizePoint(pixelBoundsSource.bottomRight, { x: 1, y: 1 }),
    },
    knownSizeMm: Math.max(
      ensureNumber(record.knownSizeMm, DEFAULT_KNOWN_SIZES[type]),
      1,
    ),
    measureDirection:
      record.measureDirection === "horizontal" ? "horizontal" : "vertical",
    confidence: clamp(ensureNumber(record.confidence, 0), 0, 1),
  };
}

function normalizeExistingFurniture(value: unknown): ExistingFurniture[] {
  if (!Array.isArray(value)) {
    return [];
  }

  return value
    .map((entry, index) => {
      if (!entry || typeof entry !== "object") {
        return null;
      }

      const record = entry as Record<string, unknown>;
      const position =
        record.position && typeof record.position === "object"
          ? (record.position as Record<string, unknown>)
          : {};

      return {
        id:
          typeof record.id === "string" && record.id.trim()
            ? record.id.trim()
            : `existing_${index + 1}`,
        category: ensureNullableString(record.category) ?? "unknown",
        estimated_width_mm: Math.max(ensureNumber(record.estimated_width_mm, 1000), 1),
        estimated_depth_mm: Math.max(ensureNumber(record.estimated_depth_mm, 500), 1),
        position: {
          x: clamp(ensureNumber(position.x, 0.5), 0, 1),
          y: clamp(ensureNumber(position.y, 0.5), 0, 1),
        },
      } satisfies ExistingFurniture;
    })
    .filter((item): item is ExistingFurniture => item !== null);
}

function mergeRoomFeaturesIntoSpatialAnalysis(
  existing: SpatialAnalysis | null,
  detection: AnchorDetectionResult,
): SpatialAnalysis {
  const roomFeatures = detection.roomFeatures;

  return {
    walls: existing?.walls ?? [],
    floor_material: roomFeatures.floorMaterial ?? existing?.floor_material ?? null,
    wall_color: roomFeatures.wallColor ?? existing?.wall_color ?? null,
    lighting_direction:
      roomFeatures.lightingDirection ?? existing?.lighting_direction ?? null,
    shooting_direction:
      roomFeatures.shootingDirection ?? existing?.shooting_direction ?? null,
    camera_view: existing?.camera_view ?? null,
    available_spaces: existing?.available_spaces ?? [],
    existing_furniture:
      roomFeatures.existingFurniture.length > 0
        ? roomFeatures.existingFurniture
        : existing?.existing_furniture ?? [],
    confidence: Math.max(
      existing?.confidence ?? 0.3,
      detection.bestAnchor ? detection.bestAnchor.confidence : 0.35,
    ),
  };
}

export function selectBestAnchor(anchors: SemanticAnchor[]) {
  return [...anchors].sort((left, right) => right.confidence - left.confidence)[0] ?? null;
}

export async function detectSemanticAnchors(
  imageUrl: string,
): Promise<AnchorDetectionResult> {
  const rawText = await analyzeImage(
    imageUrl,
    SYSTEM_PROMPT,
    ANCHOR_DETECTION_PROMPT,
  );
  const parsed = extractJson<RawAnchorPayload>(rawText);
  const anchors = (parsed.anchors ?? [])
    .map((entry) => normalizeAnchor(entry))
    .filter((anchor): anchor is SemanticAnchor => anchor !== null)
    .sort((left, right) => right.confidence - left.confidence);
  const roomFeatures = parsed.roomFeatures ?? {};

  return {
    anchors,
    bestAnchor: anchors[0] ?? null,
    roomFeatures: {
      wallColor: ensureNullableString(roomFeatures.wallColor),
      floorMaterial: ensureNullableString(roomFeatures.floorMaterial),
      lightingDirection: ensureNullableString(roomFeatures.lightingDirection),
      existingFurniture: normalizeExistingFurniture(roomFeatures.existingFurniture),
      shootingDirection: ensureNullableString(roomFeatures.shootingDirection),
    },
  };
}

export async function detectAndStoreRoomAnchors(
  roomId: string,
  imageUrl: string,
): Promise<AnchorDetectionResult> {
  const supabase = createServiceRoleClient();
  const { data: room, error: roomError } = await supabase
    .from("rooms")
    .select("id, spatial_analysis")
    .eq("id", roomId)
    .maybeSingle<{ id: string; spatial_analysis: SpatialAnalysis | null }>();

  if (roomError || !room) {
    throw new Error(roomError?.message ?? "Room not found for anchor detection.");
  }

  const detection = await detectSemanticAnchors(imageUrl);
  const mergedSpatialAnalysis = mergeRoomFeaturesIntoSpatialAnalysis(
    room.spatial_analysis,
    detection,
  );

  const { error: updateError } = await supabase
    .from("rooms")
    .update({
      anchor_detection: detection,
      spatial_analysis: mergedSpatialAnalysis,
      updated_at: new Date().toISOString(),
    })
    .eq("id", roomId);

  if (updateError) {
    throw new Error(updateError.message);
  }

  return detection;
}

export function mergeAnchorDetectionIntoSpatialAnalysis(
  existing: SpatialAnalysis | null,
  detection: AnchorDetectionResult,
) {
  return mergeRoomFeaturesIntoSpatialAnalysis(existing, detection);
}
