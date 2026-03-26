import "server-only";

import sharp from "sharp";
import { uploadToR2 } from "@/lib/api/r2";
import { updateEffectProgress } from "@/lib/generation/effectProgress";
import { generateWithFluxFillPro } from "@/lib/generation/fluxFillPro";
import {
  buildRouteFPrompt,
  describeProductImage,
} from "@/lib/generation/promptBuilder";
import { preprocessProductImage } from "@/lib/generation/productImagePreprocessor";
import { runAutoCalibration } from "@/lib/spatial/autoCalibrationPipeline";
import {
  createFallbackCalibration,
  rebuildCalibration,
} from "@/lib/spatial/cameraCalibrator";
import {
  getDefaultPositionForCategory,
  projectFurnitureMask,
} from "@/lib/spatial/furnitureProjector";
import { createServiceRoleClient } from "@/lib/supabase/admin";
import type {
  CameraCalibrationData,
  FurnitureBBox3D,
  FurniturePixelPosition,
  SpatialAnalysis,
  Vec3mm,
} from "@/lib/types";

interface PlanRow {
  id: string;
  room_id: string;
  name: string;
  style_preference: string | null;
}

interface RoomRow {
  id: string;
  name: string;
  room_type: string;
  current_photo_url: string | null;
  original_photo_url: string | null;
  spatial_analysis: SpatialAnalysis | null;
  camera_calibration: CameraCalibrationData | null;
  focal_length_px: number | null;
}

interface ProductAssetRow {
  name: string | null;
  image_url: string | null;
}

interface PlanItemRow {
  id: string;
  category: string;
  custom_name: string | null;
  custom_image_url: string | null;
  custom_width_mm: number | null;
  custom_depth_mm: number | null;
  custom_height_mm: number | null;
  status: string;
  sort_order: number;
  position_3d: Vec3mm | null;
  position_pixel: FurniturePixelPosition | null;
  rotation_y: number | null;
  extracted_image_url: string | null;
  product_description: Record<string, unknown> | null;
  products: ProductAssetRow | null;
}

function resolveItemName(item: PlanItemRow) {
  return item.custom_name ?? item.products?.name ?? item.category.replaceAll("_", " ");
}

function resolveItemImageUrl(item: PlanItemRow) {
  return item.custom_image_url ?? item.products?.image_url ?? null;
}

function resolveItemDimensions(item: PlanItemRow) {
  const width = item.custom_width_mm;
  const depth = item.custom_depth_mm;
  const height = item.custom_height_mm;

  if (!width || !depth || !height) {
    throw new Error(`${resolveItemName(item)} is missing required dimensions.`);
  }

  return { width, depth, height };
}

function readStoredProductDescription(item: PlanItemRow) {
  if (!item.product_description || typeof item.product_description !== "object") {
    return null;
  }

  const text = (item.product_description as Record<string, unknown>).text;
  return typeof text === "string" && text.trim() ? text.trim() : null;
}

function buildRoomDescription(room: RoomRow) {
  return [
    room.room_type.replaceAll("_", " "),
    room.spatial_analysis?.wall_color ? `${room.spatial_analysis.wall_color} walls` : null,
    room.spatial_analysis?.floor_material
      ? `${room.spatial_analysis.floor_material} flooring`
      : null,
  ]
    .filter(Boolean)
    .join(", ");
}

async function getImageSize(imageUrl: string) {
  const response = await fetch(imageUrl, { cache: "no-store" });
  if (!response.ok) {
    throw new Error(`Failed to load room image: ${response.status} ${response.statusText}`);
  }

  const arrayBuffer = await response.arrayBuffer();
  const metadata = await sharp(Buffer.from(arrayBuffer)).metadata();

  return {
    width: metadata.width ?? 1024,
    height: metadata.height ?? 768,
  };
}

async function ensureCalibration(room: RoomRow, roomImageUrl: string) {
  const imageSize = await getImageSize(roomImageUrl);

  if (room.camera_calibration) {
    return rebuildCalibration(room.camera_calibration);
  }

  await runAutoCalibration(room.id, roomImageUrl).catch(() => undefined);

  const supabase = createServiceRoleClient();
  const { data: refreshedRoom } = await supabase
    .from("rooms")
    .select("camera_calibration, focal_length_px")
    .eq("id", room.id)
    .maybeSingle<{ camera_calibration: CameraCalibrationData | null; focal_length_px: number | null }>();

  if (refreshedRoom?.camera_calibration) {
    return rebuildCalibration(refreshedRoom.camera_calibration);
  }

  return createFallbackCalibration(
    imageSize.width,
    imageSize.height,
    refreshedRoom?.focal_length_px ?? room.focal_length_px ?? imageSize.width * 1.2,
  );
}

function toFurnitureBBox(item: PlanItemRow): FurnitureBBox3D {
  const dimensions = resolveItemDimensions(item);
  return {
    center: item.position_3d ?? getDefaultPositionForCategory(item.category),
    width: dimensions.width,
    depth: dimensions.depth,
    height: dimensions.height,
    rotationY: item.rotation_y ?? 0,
  };
}

export async function runRouteFPipeline(
  effectImageId: string,
  planId: string,
): Promise<void> {
  const startedAt = Date.now();
  const supabase = createServiceRoleClient();

  try {
    const { data: plan, error: planError } = await supabase
      .from("furnishing_plans")
      .select("id, room_id, name, style_preference")
      .eq("id", planId)
      .single<PlanRow>();

    if (planError || !plan) {
      throw new Error("Furnishing plan not found.");
    }

    const { data: room, error: roomError } = await supabase
      .from("rooms")
      .select(
        "id, name, room_type, current_photo_url, original_photo_url, spatial_analysis, camera_calibration, focal_length_px",
      )
      .eq("id", plan.room_id)
      .single<RoomRow>();

    if (roomError || !room) {
      throw new Error("Room not found for this furnishing plan.");
    }

    const { data: items, error: itemsError } = await supabase
      .from("furnishing_plan_items")
      .select(
        "id, category, custom_name, custom_image_url, custom_width_mm, custom_depth_mm, custom_height_mm, status, sort_order, position_3d, position_pixel, rotation_y, extracted_image_url, product_description, products(name, image_url)",
      )
      .eq("plan_id", planId)
      .neq("status", "abandoned")
      .order("sort_order", { ascending: true })
      .returns<PlanItemRow[]>();

    if (itemsError) {
      throw new Error(itemsError.message);
    }

    const activeItems = items ?? [];
    if (activeItems.length === 0) {
      throw new Error("Current plan has no renderable item.");
    }

    if (activeItems.length > 1) {
      throw new Error("Phase 1 Route F only supports one active item.");
    }

    const item = activeItems[0];
    const itemName = resolveItemName(item);
    const roomImageUrl = room.current_photo_url ?? room.original_photo_url;

    if (!roomImageUrl) {
      throw new Error("Room photo is missing.");
    }

    await updateEffectProgress(effectImageId, {
      generationStatus: "analyzing",
      progress: {
        stage: "analyzing",
        message: "Analyzing room calibration and geometry...",
        currentItem: itemName,
        currentIndex: 1,
        totalItems: 1,
      },
      extraParams: {
        pipeline: "route_f",
        started_at: new Date().toISOString(),
      },
    });

    const calibration = await ensureCalibration(room, roomImageUrl);
    const imageSize = await getImageSize(roomImageUrl);

    await updateEffectProgress(effectImageId, {
      generationStatus: "preparing",
      progress: {
        stage: "preparing",
        message: "Preparing product image and projection mask...",
        currentItem: itemName,
        currentIndex: 1,
        totalItems: 1,
      },
    });

    const itemImageUrl = resolveItemImageUrl(item);
    if (!itemImageUrl) {
      throw new Error(`${itemName} is missing a source image.`);
    }

    const preprocessResult = await preprocessProductImage(itemImageUrl, planId);
    const extractedImageUrl = preprocessResult.extractedImageUrl ?? item.extracted_image_url;
    if (!extractedImageUrl) {
      throw new Error(`${itemName} failed during product preprocessing.`);
    }

    const productDescription =
      readStoredProductDescription(item) ??
      (await describeProductImage(extractedImageUrl, itemName, item.category));

    const furnitureBBox = toFurnitureBBox(item);
    const projection = await projectFurnitureMask(
      calibration,
      furnitureBBox,
      imageSize.width,
      imageSize.height,
    );
    const maskUrl = await uploadToR2(
      projection.maskBuffer,
      `route-f/${planId}/mask-${Date.now()}.png`,
      "image/png",
    );
    const prompt = buildRouteFPrompt({
      furnitureDescription: productDescription,
      category: item.category,
      roomDescription: buildRoomDescription(room),
      lightingDirection: room.spatial_analysis?.lighting_direction ?? "soft interior lighting",
      stylePreference: plan.style_preference ?? undefined,
    });

    const { error: itemUpdateError } = await supabase
      .from("furnishing_plan_items")
      .update({
        position_3d: furnitureBBox.center,
        position_pixel: projection.boundingRect,
        rotation_y: furnitureBBox.rotationY,
        extracted_image_url: extractedImageUrl,
        candidate_image_urls: [itemImageUrl, extractedImageUrl],
        product_description: {
          text: productDescription,
          source: "claude_vision",
          generated_at: new Date().toISOString(),
          reference_image_url: extractedImageUrl,
        },
      })
      .eq("id", item.id);

    if (itemUpdateError) {
      throw new Error(itemUpdateError.message);
    }

    await updateEffectProgress(effectImageId, {
      generationStatus: "preparing",
      progress: {
        stage: "preparing",
        message: "Preparing Route F rendering parameters...",
        currentItem: itemName,
        currentIndex: 1,
        totalItems: 1,
      },
      extraParams: {
        maskUrl,
        prompt,
        productDescription,
      },
    });

    await updateEffectProgress(effectImageId, {
      generationStatus: "generating",
      progress: {
        stage: "generating",
        message: "Generating furniture inside the projected mask...",
        currentItem: itemName,
        currentIndex: 1,
        totalItems: 1,
      },
    });

    const renderResult = await generateWithFluxFillPro({
      imageUrl: roomImageUrl,
      maskUrl,
      prompt,
      planId,
    });

    await updateEffectProgress(effectImageId, {
      generationStatus: "done",
      imageUrl: renderResult.imageUrl,
      progress: {
        stage: "done",
        message: "Route F rendering completed.",
        currentItem: itemName,
        currentIndex: 1,
        totalItems: 1,
      },
      extraParams: {
        maskUrl,
        prompt,
        productDescription,
        model: renderResult.model,
        processingTimeMs: Date.now() - startedAt,
      },
    });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Route F rendering pipeline failed.";

    await updateEffectProgress(effectImageId, {
      generationStatus: "failed",
      errorMessage: message,
      extraParams: {
        failed_at: new Date().toISOString(),
        processingTimeMs: Date.now() - startedAt,
      },
    });
  }
}
