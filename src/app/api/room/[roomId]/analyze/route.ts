import { NextRequest, NextResponse } from "next/server";
import { analyzeImage } from "@/lib/api/claude";
import { getOwnedRoomRecord } from "@/lib/room/ownership";
import { createClient } from "@/lib/supabase/server";
import type {
  AvailableSpace,
  CameraView,
  ExistingFurniture,
  SpatialAnalysis,
  WallInfo,
} from "@/lib/types";
import { extractJson } from "@/lib/utils/jsonExtractor";

interface FloorPlanParsedResult {
  rooms?: Array<{
    name?: string;
    width_mm?: number;
    depth_mm?: number;
  }>;
  total_area_sqm?: number;
}

const V4_ROOM_ANALYSIS_PROMPT = `You are a professional interior space analyst. Analyze this room photo and output JSON with the following structure.

Requirements:
1. Identify each visible wall: type (solid_wall/window/door/opening), estimated width in mm
2. Identify floor material (hardwood/tile/carpet/concrete/laminate/other)
3. Identify wall color (warm_gray/cool_white/beige/cream/custom description)
4. Identify lighting direction (natural light from left/right/front window, overhead lighting, etc.)
5. Identify available spaces where furniture could be placed, with approximate dimensions
6. Identify any existing furniture already in the room
7. Shooting direction and confidence score
8. Also estimate the camera viewing angle for this photo

Output strict JSON only:
{
  "walls": [
    {"id": "wall_1", "type": "solid_wall", "estimated_width_mm": 3600, "label": "main wall"}
  ],
  "floor_material": "hardwood",
  "wall_color": "warm gray",
  "lighting_direction": "natural light from right window",
  "available_spaces": [
    {"id": "space_1", "label": "main seating area", "width_mm": 3000, "depth_mm": 2000, "position": {"x": 0.3, "y": 0.6}}
  ],
  "existing_furniture": [
    {"id": "existing_1", "category": "tv_cabinet", "estimated_width_mm": 1200, "estimated_depth_mm": 400, "position": {"x": 0.5, "y": 0.4}}
  ],
  "camera_view": {
    "horizontal_angle": 30,
    "vertical_angle": 15,
    "direction": "left"
  },
  "shooting_direction": "from entrance looking into living room",
  "confidence": 0.75
}`.trim();

const V4_FLOOR_PLAN_PROMPT = `You are a floor plan expert. Extract dimensions from this floor plan image.
Output JSON only:
{
  "rooms": [{"name": "living room", "width_mm": 6000, "depth_mm": 4500}],
  "total_area_sqm": 120
}`.trim();

const DEFAULT_SPATIAL_ANALYSIS: SpatialAnalysis = {
  walls: [],
  floor_material: null,
  wall_color: null,
  lighting_direction: null,
  camera_view: null,
  available_spaces: [],
  existing_furniture: [],
  confidence: 0.3,
};

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

function ensureNullableString(value: unknown) {
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

function isWallType(value: unknown): value is WallInfo["type"] {
  return value === "solid_wall" || value === "window" || value === "door" || value === "opening";
}

function normalizePosition(value: unknown) {
  if (!value || typeof value !== "object") {
    return { x: 0.5, y: 0.5 };
  }

  const source = value as Record<string, unknown>;
  return {
    x: Math.min(Math.max(ensureNumber(source.x, 0.5), 0), 1),
    y: Math.min(Math.max(ensureNumber(source.y, 0.5), 0), 1),
  };
}

function normalizeCameraView(value: unknown): CameraView | null {
  if (!value || typeof value !== "object") {
    return null;
  }

  const source = value as Record<string, unknown>;
  const direction =
    source.direction === "left" || source.direction === "right" || source.direction === "center"
      ? source.direction
      : "center";

  return {
    horizontal_angle: Math.round(Math.min(Math.max(ensureNumber(source.horizontal_angle, 0), 0), 90)),
    vertical_angle: Math.round(Math.min(Math.max(ensureNumber(source.vertical_angle, 0), 0), 45)),
    direction,
  };
}

function normalizeWalls(payload: Record<string, unknown>) {
  const rawWalls = Array.isArray(payload.walls) ? payload.walls : [];

  return rawWalls
    .map((wall, index) => {
      if (!wall || typeof wall !== "object") {
        return null;
      }

      const source = wall as Record<string, unknown>;
      const label = ensureNullableString(source.label);
      return {
        id: typeof source.id === "string" ? source.id : `wall_${index + 1}`,
        type: isWallType(source.type) ? source.type : "solid_wall",
        estimated_width_mm: Math.max(ensureNumber(source.estimated_width_mm, 3000), 600),
        ...(label ? { label } : {}),
      } satisfies WallInfo;
    })
    .filter((wall): wall is WallInfo => wall !== null);
}

function normalizeAvailableSpaces(payload: Record<string, unknown>) {
  const rawSpaces = Array.isArray(payload.available_spaces) ? payload.available_spaces : [];

  return rawSpaces
    .map((space, index) => {
      if (!space || typeof space !== "object") {
        return null;
      }

      const source = space as Record<string, unknown>;
      return {
        id: typeof source.id === "string" ? source.id : `space_${index + 1}`,
        label: ensureNullableString(source.label) ?? `available space ${index + 1}`,
        width_mm: Math.max(ensureNumber(source.width_mm, 1800), 400),
        depth_mm: Math.max(ensureNumber(source.depth_mm, 1200), 300),
        position: normalizePosition(source.position),
      } satisfies AvailableSpace;
    })
    .filter((space): space is AvailableSpace => space !== null);
}

function normalizeExistingFurniture(payload: Record<string, unknown>) {
  const rawFurniture = Array.isArray(payload.existing_furniture) ? payload.existing_furniture : [];

  return rawFurniture
    .map((item, index) => {
      if (!item || typeof item !== "object") {
        return null;
      }

      const source = item as Record<string, unknown>;
      return {
        id: typeof source.id === "string" ? source.id : `existing_${index + 1}`,
        category: ensureNullableString(source.category) ?? "unknown",
        estimated_width_mm: Math.max(ensureNumber(source.estimated_width_mm, 1000), 200),
        estimated_depth_mm: Math.max(ensureNumber(source.estimated_depth_mm, 500), 150),
        position: normalizePosition(source.position),
      } satisfies ExistingFurniture;
    })
    .filter((item): item is ExistingFurniture => item !== null);
}

function normalizeSpatialAnalysis(payload: Record<string, unknown>): SpatialAnalysis {
  return {
    walls: normalizeWalls(payload),
    floor_material: ensureNullableString(payload.floor_material),
    wall_color: ensureNullableString(payload.wall_color),
    lighting_direction: ensureNullableString(payload.lighting_direction),
    camera_view: normalizeCameraView(payload.camera_view),
    available_spaces: normalizeAvailableSpaces(payload),
    existing_furniture: normalizeExistingFurniture(payload),
    confidence: Math.min(Math.max(ensureNumber(payload.confidence, 0.6), 0), 1),
  };
}

function calibrateSpatialAnalysis(
  analysis: SpatialAnalysis,
  floorPlan: FloorPlanParsedResult | null,
): SpatialAnalysis {
  const primaryRoom = floorPlan?.rooms?.[0];
  const roomWidth = primaryRoom?.width_mm;
  const roomDepth = primaryRoom?.depth_mm;

  if (!roomWidth && !roomDepth) {
    return analysis;
  }

  const widthCandidates = [
    ...analysis.walls.map((wall) => wall.estimated_width_mm),
    ...analysis.available_spaces.map((space) => space.width_mm),
  ].filter((value) => value > 0);
  const depthCandidates = [
    ...analysis.available_spaces.map((space) => space.depth_mm),
    ...analysis.existing_furniture.map((item) => item.estimated_depth_mm),
  ].filter((value) => value > 0);

  const widthScale = roomWidth && widthCandidates.length > 0
    ? roomWidth / Math.max(...widthCandidates)
    : 1;
  const depthScale = roomDepth && depthCandidates.length > 0
    ? roomDepth / Math.max(...depthCandidates)
    : 1;

  return {
    ...analysis,
    walls: analysis.walls.map((wall) => ({
      ...wall,
      estimated_width_mm: Math.round(
        Math.max(
          roomWidth
            ? Math.min(wall.estimated_width_mm * widthScale, roomWidth)
            : wall.estimated_width_mm,
          600,
        ),
      ),
    })),
    available_spaces: analysis.available_spaces.map((space) => ({
      ...space,
      width_mm: Math.round(
        Math.max(
          roomWidth ? Math.min(space.width_mm * widthScale, roomWidth) : space.width_mm,
          400,
        ),
      ),
      depth_mm: Math.round(
        Math.max(
          roomDepth ? Math.min(space.depth_mm * depthScale, roomDepth) : space.depth_mm,
          300,
        ),
      ),
    })),
    existing_furniture: analysis.existing_furniture.map((item) => ({
      ...item,
      estimated_width_mm: Math.round(
        Math.max(
          roomWidth
            ? Math.min(item.estimated_width_mm * widthScale, roomWidth)
            : item.estimated_width_mm,
          200,
        ),
      ),
      estimated_depth_mm: Math.round(
        Math.max(
          roomDepth
            ? Math.min(item.estimated_depth_mm * depthScale, roomDepth)
            : item.estimated_depth_mm,
          150,
        ),
      ),
    })),
    confidence:
      roomWidth || roomDepth
        ? Math.min(Number((analysis.confidence + 0.08).toFixed(2)), 0.98)
        : analysis.confidence,
  };
}

export async function POST(
  _request: NextRequest,
  { params }: { params: Promise<{ roomId: string }> },
) {
  const { roomId } = await params;
  const supabase = await createClient();

  try {
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });
    }

    const room = await getOwnedRoomRecord(supabase, user.id, roomId);

    if (!room) {
      return NextResponse.json({ success: false, error: "Room not found" }, { status: 404 });
    }

    if (!room.original_photo_url) {
      return NextResponse.json(
        { success: false, error: "Room photo is required before analysis" },
        { status: 400 },
      );
    }

    const roomText = await analyzeImage(
      room.original_photo_url,
      V4_ROOM_ANALYSIS_PROMPT,
      "Return strict JSON only. Focus on furnishing-relevant measurements and placement opportunities.",
    );
    const baseAnalysis = normalizeSpatialAnalysis(extractJson(roomText));

    let floorPlanResult: FloorPlanParsedResult | null = null;
    if (room.floor_plan_url) {
      try {
        const floorPlanText = await analyzeImage(
          room.floor_plan_url,
          V4_FLOOR_PLAN_PROMPT,
          "Return strict JSON only.",
        );
        floorPlanResult = extractJson<FloorPlanParsedResult>(floorPlanText);
      } catch {
        floorPlanResult = null;
      }
    }

    const spatialAnalysis = calibrateSpatialAnalysis(baseAnalysis, floorPlanResult);

    const { data: updatedRoom, error: updateError } = await supabase
      .from("rooms")
      .update({
        spatial_analysis: spatialAnalysis,
        updated_at: new Date().toISOString(),
      })
      .eq("id", roomId)
      .select("id, spatial_analysis")
      .single();

    if (updateError || !updatedRoom) {
      return NextResponse.json(
        { success: false, error: updateError?.message || "Failed to save spatial analysis" },
        { status: 500 },
      );
    }

    return NextResponse.json({
      success: true,
      data: updatedRoom.spatial_analysis,
      partial: false,
    });
  } catch {
    await supabase
      .from("rooms")
      .update({
        spatial_analysis: DEFAULT_SPATIAL_ANALYSIS,
        updated_at: new Date().toISOString(),
      })
      .eq("id", roomId);

    return NextResponse.json({
      success: true,
      data: DEFAULT_SPATIAL_ANALYSIS,
      partial: true,
    });
  }
}
