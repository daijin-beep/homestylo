import "server-only";

import sharp from "sharp";
import { compositeRouteEImage } from "@/lib/generation/compositeEngineRouteE";
import { estimateDepth } from "@/lib/generation/depthEstimator";
import { isIcLightEnabled } from "@/lib/generation/envCheck";
import {
  eraseExistingFurniture,
  generateFurnitureMask,
} from "@/lib/generation/furnitureEraser";
import { refineWithFluxFill } from "@/lib/generation/fluxFillRefiner";
import { refineWithICLight } from "@/lib/generation/icLightRefiner";
import { generateInverseMask } from "@/lib/generation/inverseMaskGenerator";
import { preprocessProductImage } from "@/lib/generation/productImagePreprocessor";
import { buildSceneRegenerationPrompt } from "@/lib/generation/promptBuilder";
import { calculateScaleRouteE } from "@/lib/generation/scaleCalculatorRouteE";
import { matchViewAngle } from "@/lib/generation/viewAngleMatcher";
import { createServiceRoleClient } from "@/lib/supabase/admin";
import type { AvailableSpace, CameraView, ExistingFurniture } from "@/lib/types";

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
  spatial_analysis:
    | {
        walls?: Array<{ estimated_width_mm?: number | null }>;
        floor_material?: string | null;
        wall_color?: string | null;
        lighting_direction?: string | null;
        camera_view?: CameraView | null;
        available_spaces?: AvailableSpace[];
        existing_furniture?: ExistingFurniture[];
      }
    | null;
}

interface ProductAssetRow {
  name: string;
  image_url: string | null;
  width_mm: number | null;
  depth_mm: number | null;
  height_mm: number | null;
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
  products: ProductAssetRow | null;
}

interface EffectParams {
  started_at?: string;
  pipeline?: string;
  roughPreviewUrl?: string | null;
  progress?: {
    stage: "classifying" | "analyzing" | "placing" | "refining" | "done";
    message?: string;
    currentItem?: string;
    currentIndex?: number;
    totalItems?: number;
    previewUrl?: string | null;
  };
  itemCount?: number;
  roomDescription?: string;
  lightingDirection?: string;
  processingTimeMs?: number;
  depthModel?: string | null;
  fillModel?: string | null;
  icLightSkipped?: boolean;
  cameraView?: CameraView | null;
  failed_at?: string;
}

interface PreparedItem {
  item: PlanItemRow;
  imageUrl: string;
  dimensions: {
    widthMm: number;
    depthMm: number;
    heightMm: number;
  };
}

const CATEGORY_PLACEMENT: Record<string, { x: number; y: number }> = {
  sofa: { x: 0.5, y: 0.82 },
  coffee_table: { x: 0.5, y: 0.68 },
  tv_cabinet: { x: 0.5, y: 0.22 },
  rug: { x: 0.5, y: 0.72 },
  floor_lamp: { x: 0.82, y: 0.7 },
  side_table: { x: 0.22, y: 0.74 },
  painting: { x: 0.5, y: 0.18 },
  plant: { x: 0.88, y: 0.76 },
  bed: { x: 0.5, y: 0.62 },
  dining_table: { x: 0.5, y: 0.6 },
  wardrobe: { x: 0.85, y: 0.35 },
  curtain: { x: 0.5, y: 0.08 },
};

function clamp(value: number, min: number, max: number) {
  return Math.min(Math.max(value, min), max);
}

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function getFallbackPlacement(index: number, total: number) {
  if (total <= 1) {
    return { x: 0.5, y: 0.72 };
  }

  return {
    x: 0.18 + (0.64 / Math.max(total - 1, 1)) * index,
    y: 0.7,
  };
}

function resolveDefaultPlacement(category: string, index: number, total: number) {
  return CATEGORY_PLACEMENT[category] ?? getFallbackPlacement(index, total);
}

function resolveRoomWidthMm(room: RoomRow) {
  const wallWidths =
    room.spatial_analysis?.walls
      ?.map((wall) => wall.estimated_width_mm ?? 0)
      .filter((value) => value > 0) ?? [];
  const availableSpaceWidths =
    room.spatial_analysis?.available_spaces
      ?.map((space) => space.width_mm ?? 0)
      .filter((value) => value > 0) ?? [];

  return Math.max(...wallWidths, ...availableSpaceWidths, 3600);
}

function resolveRoomDepthMm(room: RoomRow) {
  const availableSpaceDepths =
    room.spatial_analysis?.available_spaces
      ?.map((space) => space.depth_mm ?? 0)
      .filter((value) => value > 0) ?? [];
  const existingDepths =
    room.spatial_analysis?.existing_furniture
      ?.map((item) => item.estimated_depth_mm ?? 0)
      .filter((value) => value > 0) ?? [];

  return Math.max(...availableSpaceDepths, ...existingDepths.map((value) => value * 4), 2800);
}

function buildRoomDescription(room: RoomRow) {
  const wallColor = room.spatial_analysis?.wall_color ?? "neutral";
  const floorMaterial = room.spatial_analysis?.floor_material ?? "indoor flooring";
  return `${room.room_type.replaceAll("_", " ")} with ${wallColor} walls and ${floorMaterial}`;
}

function resolveLightingDirection(room: RoomRow) {
  return room.spatial_analysis?.lighting_direction ?? "soft ambient interior lighting";
}

function resolveCameraView(room: RoomRow): CameraView {
  return (
    room.spatial_analysis?.camera_view ?? {
      horizontal_angle: 0,
      vertical_angle: 0,
      direction: "center",
    }
  );
}

async function resolveRoomImageUrl(
  room: RoomRow,
  supabase: ReturnType<typeof createServiceRoleClient>,
) {
  const candidate = room.current_photo_url || room.original_photo_url;
  if (!candidate) {
    throw new Error("Room image is missing.");
  }

  if (/^https?:\/\//i.test(candidate)) {
    return candidate;
  }

  const { data, error } = await supabase.storage
    .from("room-photos")
    .createSignedUrl(candidate, 3600);

  if (error || !data?.signedUrl) {
    throw new Error("Failed to resolve room photo URL.");
  }

  return data.signedUrl;
}

function resolveItemImageUrl(item: PlanItemRow) {
  return item.custom_image_url ?? item.products?.image_url ?? null;
}

function resolveItemDimensions(item: PlanItemRow) {
  const widthMm = item.custom_width_mm ?? item.products?.width_mm ?? null;
  const depthMm = item.custom_depth_mm ?? item.products?.depth_mm ?? null;
  const heightMm = item.custom_height_mm ?? item.products?.height_mm ?? null;

  if (!widthMm || !depthMm || !heightMm) {
    throw new Error(`${resolveItemName(item)} is missing dimensions.`);
  }

  return { widthMm, depthMm, heightMm };
}

function resolveItemName(item: PlanItemRow) {
  return item.custom_name ?? item.products?.name ?? item.category.replaceAll("_", " ");
}

function resolveSmartPlacement(
  item: PlanItemRow,
  existingFurniture: ExistingFurniture[] | undefined,
  availableSpaces: AvailableSpace[] | undefined,
  index: number,
  total: number,
) {
  const matchedFurniture = existingFurniture
    ?.filter((entry) => entry.category === item.category)
    .sort((left, right) => right.estimated_width_mm - left.estimated_width_mm)[0];

  if (matchedFurniture) {
    return {
      x: clamp(matchedFurniture.position.x, 0.05, 0.95),
      y: clamp(matchedFurniture.position.y, 0.05, 0.95),
    };
  }

  const largestSpace = availableSpaces
    ?.slice()
    .sort((left, right) => right.width_mm * right.depth_mm - left.width_mm * left.depth_mm)[0];

  if (largestSpace) {
    return {
      x: clamp(largestSpace.position.x, 0.05, 0.95),
      y: clamp(largestSpace.position.y, 0.05, 0.95),
    };
  }

  return resolveDefaultPlacement(item.category, index, total);
}

async function updateEffectProgress(
  effectImageId: string,
  payload: {
    generationStatus: string;
    progress?: EffectParams["progress"];
    imageUrl?: string | null;
    extraParams?: Partial<EffectParams>;
    errorMessage?: string | null;
  },
) {
  const supabase = createServiceRoleClient();
  const { data: record } = await supabase
    .from("effect_images")
    .select("generation_params")
    .eq("id", effectImageId)
    .maybeSingle<{ generation_params: EffectParams | null }>();

  const nextParams: EffectParams = {
    ...(record?.generation_params ?? {}),
    ...(payload.extraParams ?? {}),
  };

  if (payload.progress) {
    nextParams.progress = payload.progress;
  }

  const { error } = await supabase
    .from("effect_images")
    .update({
      generation_status: payload.generationStatus,
      image_url: payload.imageUrl,
      generation_params: nextParams,
      error_message: payload.errorMessage ?? null,
    })
    .eq("id", effectImageId);

  if (error) {
    throw new Error(error.message);
  }
}

async function downloadImageBuffer(imageUrl: string) {
  const response = await fetch(imageUrl, { cache: "no-store" });
  if (!response.ok) {
    throw new Error(`Failed to download image: ${response.status} ${response.statusText}`);
  }

  const arrayBuffer = await response.arrayBuffer();
  return Buffer.from(arrayBuffer);
}

async function createDepthSampler(depthImageUrl: string) {
  const depthBuffer = await downloadImageBuffer(depthImageUrl);
  const { data, info } = await sharp(depthBuffer)
    .greyscale()
    .raw()
    .toBuffer({ resolveWithObject: true });

  return {
    sample(normalizedX: number, normalizedY: number) {
      const x = clamp(Math.round(normalizedX * (info.width - 1)), 0, info.width - 1);
      const y = clamp(Math.round(normalizedY * (info.height - 1)), 0, info.height - 1);
      const samples: number[] = [];

      for (let offsetY = -1; offsetY <= 1; offsetY += 1) {
        for (let offsetX = -1; offsetX <= 1; offsetX += 1) {
          const sampleX = clamp(x + offsetX, 0, info.width - 1);
          const sampleY = clamp(y + offsetY, 0, info.height - 1);
          samples.push((data[sampleY * info.width + sampleX] ?? 0) / 255);
        }
      }

      return samples.reduce((sum, value) => sum + value, 0) / samples.length;
    },
  };
}

async function preprocessAndMatchItems(
  items: PlanItemRow[],
  planId: string,
  cameraView: CameraView,
) {
  return Promise.all(
    items.map(async (item, index) => {
      await sleep(index * 2000);

      const imageUrl = resolveItemImageUrl(item);
      if (!imageUrl) {
        throw new Error(`${resolveItemName(item)} is missing an image.`);
      }

      const preprocessResult = await preprocessProductImage(imageUrl, planId);
      if (!preprocessResult.success || !preprocessResult.extractedImageUrl) {
        if (preprocessResult.needsManualCrop) {
          throw new Error(`${resolveItemName(item)} needs manual cropping before rendering.`);
        }

        throw new Error(`${resolveItemName(item)} failed during image preprocessing.`);
      }

      const matchedView = await matchViewAngle({
        furnitureImageUrl: preprocessResult.extractedImageUrl,
        targetHorizontalAngle: cameraView.horizontal_angle,
        targetVerticalAngle: cameraView.vertical_angle,
        targetDirection: cameraView.direction,
        category: item.category,
        planId,
      });

      return {
        item,
        imageUrl: matchedView.matchedImageUrl,
        dimensions: resolveItemDimensions(item),
      } satisfies PreparedItem;
    }),
  );
}

export async function runRouteEPipeline(effectImageId: string, planId: string) {
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
      .select("id, name, room_type, current_photo_url, original_photo_url, spatial_analysis")
      .eq("id", plan.room_id)
      .single<RoomRow>();

    if (roomError || !room) {
      throw new Error("Room not found for this furnishing plan.");
    }

    const { data: items, error: itemsError } = await supabase
      .from("furnishing_plan_items")
      .select(
        "id, category, custom_name, custom_image_url, custom_width_mm, custom_depth_mm, custom_height_mm, status, sort_order, products(name, image_url, width_mm, depth_mm, height_mm)",
      )
      .eq("plan_id", planId)
      .neq("status", "abandoned")
      .order("sort_order", { ascending: true })
      .returns<PlanItemRow[]>();

    if (itemsError) {
      throw new Error(itemsError.message);
    }

    if (!items?.length) {
      throw new Error("Current plan has no renderable items.");
    }

    const totalItems = items.length;
    const roomWidthMm = resolveRoomWidthMm(room);
    const roomDepthMm = resolveRoomDepthMm(room);
    const roomDescription = buildRoomDescription(room);
    const lightingDirection = resolveLightingDirection(room);
    const cameraView = resolveCameraView(room);

    await updateEffectProgress(effectImageId, {
      generationStatus: "classifying",
      progress: {
        stage: "classifying",
        message: "正在处理商品图并匹配视角...",
        totalItems,
      },
      extraParams: {
        pipeline: "route_e",
        itemCount: totalItems,
        roomDescription,
        lightingDirection,
        cameraView,
      },
    });

    const preparedItems = await preprocessAndMatchItems(items, planId, cameraView);
    const roomImageUrl = await resolveRoomImageUrl(room, supabase);
    const roomImageBuffer = await downloadImageBuffer(roomImageUrl);
    const roomMetadata = await sharp(roomImageBuffer).metadata();
    const roomPhotoWidthPx = roomMetadata.width ?? 0;
    const roomPhotoHeightPx = roomMetadata.height ?? 0;

    if (!roomPhotoWidthPx || !roomPhotoHeightPx) {
      throw new Error("Room image dimensions could not be resolved.");
    }

    const erasedRegionMask = await generateFurnitureMask({
      existingFurniture: room.spatial_analysis?.existing_furniture,
      imageWidth: roomPhotoWidthPx,
      imageHeight: roomPhotoHeightPx,
      roomWidthMm,
      roomDepthMm,
    });

    await updateEffectProgress(effectImageId, {
      generationStatus: "analyzing",
      progress: {
        stage: "analyzing",
        message: erasedRegionMask
          ? "正在清理旧家具并分析空间深度..."
          : "正在分析空间深度...",
        totalItems,
      },
    });

    let cleanRoomUrl = roomImageUrl;
    if (erasedRegionMask) {
      try {
        const eraseResult = await eraseExistingFurniture(roomImageUrl, erasedRegionMask, planId);
        cleanRoomUrl = eraseResult.cleanRoomUrl;
      } catch {
        cleanRoomUrl = roomImageUrl;
      }
    }

    let depthModel: string | null = null;
    let depthSampler:
      | {
          sample: (normalizedX: number, normalizedY: number) => number;
        }
      | null = null;

    try {
      const depth = await estimateDepth(cleanRoomUrl, {
        timeout: 90000,
        schemeId: planId,
      });
      depthModel = depth.model;
      depthSampler = await createDepthSampler(depth.depthImageUrl);
    } catch {
      depthModel = null;
      depthSampler = null;
    }

    const cleanRoomBuffer = await downloadImageBuffer(cleanRoomUrl);
    const wallDepth = depthSampler?.sample(0.5, 0.18) ?? null;
    const compositeItems = await Promise.all(
      preparedItems.map(async ({ item, imageUrl, dimensions }, index) => {
        const placement = resolveSmartPlacement(
          item,
          room.spatial_analysis?.existing_furniture,
          room.spatial_analysis?.available_spaces,
          index,
          totalItems,
        );
        const scale = calculateScaleRouteE({
          roomWidthMm,
          roomPhotoWidthPx,
          roomPhotoHeightPx,
          furnitureWidthMm: dimensions.widthMm,
          furnitureHeightMm: dimensions.heightMm,
          placementX: placement.x,
          placementY: placement.y,
          depthAtPlacement: depthSampler?.sample(placement.x, placement.y),
          depthAtWall: wallDepth ?? undefined,
        });
        const furnitureBuffer = await downloadImageBuffer(imageUrl);

        return {
          furnitureBuffer,
          scale,
          category: item.category,
        };
      }),
    );

    const compositeResult = await compositeRouteEImage(
      {
        roomImageBuffer: cleanRoomBuffer,
        items: compositeItems,
        addPreShadow: true,
      },
      planId,
    );

    await updateEffectProgress(effectImageId, {
      generationStatus: "placing",
      progress: {
        stage: "placing",
        message: "正在按真实尺寸放置家具...",
        totalItems,
        previewUrl: compositeResult.compositeUrl,
      },
      extraParams: {
        roughPreviewUrl: compositeResult.compositeUrl,
        depthModel,
      },
    });

    const inverseMask = await generateInverseMask(
      {
        furnitureMaskBuffer: compositeResult.furnitureMaskBuffer,
        imageWidth: roomPhotoWidthPx,
        imageHeight: roomPhotoHeightPx,
        edgeExpansionPx: 160,
        shadowWidthPx: 250,
        shadowSidePx: 50,
        erasedRegionMask,
        featherPx: 8,
      },
      planId,
    );

    const prompt = buildSceneRegenerationPrompt(
      roomDescription,
      lightingDirection,
      plan.style_preference ?? undefined,
      preparedItems.map(({ item }) => resolveItemName(item)),
    );

    await updateEffectProgress(effectImageId, {
      generationStatus: "refining",
      progress: {
        stage: "refining",
        message: "正在精修家具边缘、阴影和局部环境融合...",
        totalItems,
        previewUrl: compositeResult.compositeUrl,
      },
    });

    const fluxFillResult = await refineWithFluxFill({
      compositeImageUrl: compositeResult.compositeUrl,
      inverseMaskUrl: inverseMask.maskUrl,
      prompt,
      denoise: 0.88,
      guidance: 15,
      planId,
    });

    let finalImageUrl = fluxFillResult.refinedImageUrl;
    let icLightSkipped = true;

    if (isIcLightEnabled()) {
      const icLightResult = await refineWithICLight({
        imageUrl: fluxFillResult.refinedImageUrl,
        backgroundImageUrl: cleanRoomUrl,
        prompt: `indoor room with ${lightingDirection}`,
        denoise: 0.08,
        planId,
      });
      finalImageUrl = icLightResult.refinedImageUrl;
      icLightSkipped = icLightResult.skipped;
    }

    await updateEffectProgress(effectImageId, {
      generationStatus: "done",
      progress: {
        stage: "done",
        totalItems,
        previewUrl: finalImageUrl,
      },
      imageUrl: finalImageUrl,
      extraParams: {
        roughPreviewUrl: compositeResult.compositeUrl,
        processingTimeMs: Date.now() - startedAt,
        depthModel,
        fillModel: fluxFillResult.model,
        icLightSkipped,
        roomDescription,
        lightingDirection,
        cameraView,
      },
    });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Route E rendering pipeline failed.";

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
