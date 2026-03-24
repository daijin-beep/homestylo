import "server-only";

import { preprocessProductImage } from "@/lib/generation/productImagePreprocessor";
import {
  renderPlan,
  type RenderStep,
} from "@/lib/generation/multiItemRenderer";
import { createServiceRoleClient } from "@/lib/supabase/admin";

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
        available_spaces?: Array<{ width_mm?: number | null }>;
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
  failed_at?: string;
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

function getFallbackPlacement(index: number, total: number) {
  if (total <= 1) {
    return { x: 0.5, y: 0.72 };
  }

  return {
    x: 0.18 + (0.64 / Math.max(total - 1, 1)) * index,
    y: 0.7,
  };
}

function resolvePlacement(category: string, index: number, total: number) {
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

function buildRoomDescription(room: RoomRow) {
  const wallColor = room.spatial_analysis?.wall_color ?? "neutral";
  const floorMaterial = room.spatial_analysis?.floor_material ?? "indoor flooring";
  return `${room.room_type.replaceAll("_", " ")} with ${wallColor} walls and ${floorMaterial}`;
}

function resolveLightingDirection(room: RoomRow) {
  return room.spatial_analysis?.lighting_direction ?? "soft ambient interior lighting";
}

async function resolveRoomImageUrl(room: RoomRow, supabase: ReturnType<typeof createServiceRoleClient>) {
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
    throw new Error(`${item.custom_name ?? item.products?.name ?? item.category} 缺少尺寸信息。`);
  }

  return { widthMm, depthMm, heightMm };
}

function resolveItemName(item: PlanItemRow) {
  return item.custom_name ?? item.products?.name ?? item.category;
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

function mapRenderStep(totalItems: number, step: RenderStep): EffectParams["progress"] {
  if (step.stage === "analyzing") {
    return {
      stage: "analyzing",
      message: step.message,
      totalItems,
    };
  }

  if (step.stage === "placing") {
    return {
      stage: "placing",
      currentItem: step.itemName,
      currentIndex: step.itemIndex,
      totalItems,
      previewUrl: step.previewUrl,
    };
  }

  if (step.stage === "refining") {
    return {
      stage: "refining",
      message: step.message,
      totalItems,
    };
  }

  return {
    stage: "done",
    totalItems,
    previewUrl: step.finalUrl,
  };
}

export async function runRouteDPipeline(effectImageId: string, planId: string) {
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
      throw new Error("当前方案还没有可渲染的商品。");
    }

    const roomImageUrl = await resolveRoomImageUrl(room, supabase);
    const totalItems = items.length;

    await updateEffectProgress(effectImageId, {
      generationStatus: "pending",
      progress: {
        stage: "classifying",
        message: "正在仔细研究这件家具...",
        totalItems,
      },
      extraParams: {
        pipeline: "route_d",
        itemCount: totalItems,
      },
    });

    const preprocessedItems = await Promise.all(
      items.map(async (item) => {
        const imageUrl = resolveItemImageUrl(item);
        if (!imageUrl) {
          throw new Error(`${resolveItemName(item)} 缺少商品图片。`);
        }

        const preprocessResult = await preprocessProductImage(imageUrl, planId);
        if (!preprocessResult.success || !preprocessResult.extractedImageUrl) {
          if (preprocessResult.needsManualCrop) {
            throw new Error(`${resolveItemName(item)} 需要先手动裁剪商品图。`);
          }
          throw new Error(`${resolveItemName(item)} 的商品图预处理失败。`);
        }

        return {
          item,
          preprocessResult,
        };
      }),
    );

    const roomDescription = buildRoomDescription(room);
    const lightingDirection = resolveLightingDirection(room);

    await updateEffectProgress(effectImageId, {
      generationStatus: "depth",
      progress: {
        stage: "analyzing",
        message: "正在丈量你家的空间...",
        totalItems,
      },
      extraParams: {
        roomDescription,
        lightingDirection,
      },
    });

    const renderResult = await renderPlan({
      roomImageUrl,
      roomWidthMm: resolveRoomWidthMm(room),
      roomDescription,
      lightingDirection,
      planId,
      items: preprocessedItems.map(({ item, preprocessResult }, index) => {
        const dimensions = resolveItemDimensions(item);
        const placement = resolvePlacement(item.category, index, totalItems);

        return {
          extractedImageUrl: preprocessResult.extractedImageUrl!,
          widthMm: dimensions.widthMm,
          depthMm: dimensions.depthMm,
          heightMm: dimensions.heightMm,
          placementX: placement.x,
          placementY: placement.y,
          category: item.category,
        };
      }),
      onProgress: (step) => {
        const progress = mapRenderStep(totalItems, step);
        const generationStatus =
          step.stage === "placing"
            ? "flux"
            : step.stage === "refining"
              ? "hotspot"
              : step.stage === "done"
                ? "done"
                : "depth";

        void updateEffectProgress(effectImageId, {
          generationStatus,
          progress,
          imageUrl: step.stage === "done" ? step.finalUrl : null,
          extraParams:
            step.stage === "placing"
              ? { roughPreviewUrl: step.previewUrl }
              : undefined,
        });
      },
    });

    await updateEffectProgress(effectImageId, {
      generationStatus: "done",
      progress: {
        stage: "done",
        totalItems,
        previewUrl: renderResult.finalImageUrl,
      },
      imageUrl: renderResult.finalImageUrl,
      extraParams: {
        roughPreviewUrl: renderResult.roughPreviewUrl,
        processingTimeMs: renderResult.processingTimeMs,
      },
    });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Route D rendering pipeline failed.";

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
