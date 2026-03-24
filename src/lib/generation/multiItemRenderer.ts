import "server-only";

import sharp from "sharp";
import { uploadToR2 } from "@/lib/api/r2";
import { compositeImage } from "@/lib/generation/compositeEngine";
import { generateEdgeMask } from "@/lib/generation/edgeMaskGenerator";
import { inpaintEdges } from "@/lib/generation/fluxInpainter";
import { buildInpaintPrompt } from "@/lib/generation/promptBuilder";
import { calculateScale, type ScaleResult } from "@/lib/generation/scaleCalculator";

export interface RenderPlanOptions {
  roomImageUrl: string;
  roomWidthMm: number;
  items: Array<{
    extractedImageUrl: string;
    widthMm: number;
    heightMm: number;
    depthMm: number;
    placementX: number;
    placementY: number;
    category: string;
  }>;
  roomDescription: string;
  lightingDirection: string;
  planId: string;
  onProgress?: (step: RenderStep) => void;
}

export type RenderStep =
  | { stage: "analyzing"; message: string }
  | { stage: "placing"; itemIndex: number; itemName: string; previewUrl: string }
  | { stage: "refining"; message: string }
  | { stage: "done"; finalUrl: string };

export interface RenderPlanResult {
  finalImageUrl: string;
  roughPreviewUrl: string;
  processingTimeMs: number;
  itemCount: number;
}

interface RenderedItem {
  furnitureImageUrl: string;
  scale: ScaleResult;
}

const RENDER_ORDER: Record<string, number> = {
  sofa: 1,
  bed: 1,
  dining_table: 1,
  tv_cabinet: 2,
  coffee_table: 2,
  wardrobe: 2,
  rug: 3,
  curtain: 3,
  floor_lamp: 4,
  side_table: 4,
  painting: 5,
  pillow: 5,
  plant: 5,
};

const CATEGORY_LABELS: Record<string, string> = {
  sofa: "沙发",
  bed: "床",
  dining_table: "餐桌",
  tv_cabinet: "电视柜",
  coffee_table: "茶几",
  wardrobe: "衣柜",
  rug: "地毯",
  curtain: "窗帘",
  floor_lamp: "落地灯",
  side_table: "边几",
  painting: "装饰画",
  pillow: "抱枕",
  plant: "绿植",
};

async function downloadImageBuffer(imageUrl: string) {
  const response = await fetch(imageUrl, { cache: "no-store" });
  if (!response.ok) {
    throw new Error(`Failed to download image: ${response.status} ${response.statusText}`);
  }

  const arrayBuffer = await response.arrayBuffer();
  return Buffer.from(arrayBuffer);
}

function sortItems(items: RenderPlanOptions["items"]) {
  return [...items].sort((left, right) => {
    const leftOrder = RENDER_ORDER[left.category] ?? 99;
    const rightOrder = RENDER_ORDER[right.category] ?? 99;

    if (leftOrder !== rightOrder) {
      return leftOrder - rightOrder;
    }

    return left.placementY - right.placementY;
  });
}

async function mergeMaskBuffers(maskBuffers: Buffer[]) {
  const firstMask = maskBuffers[0];
  if (!firstMask) {
    throw new Error("No mask buffer available to merge.");
  }

  const firstImage = sharp(firstMask).ensureAlpha();
  const firstMetadata = await firstImage.metadata();
  const width = firstMetadata.width ?? 0;
  const height = firstMetadata.height ?? 0;

  if (!width || !height) {
    throw new Error("Merged mask dimensions could not be resolved.");
  }

  const merged = new Uint8Array(width * height * 4);

  for (const maskBuffer of maskBuffers) {
    const rawMask = await sharp(maskBuffer)
      .ensureAlpha()
      .raw()
      .toBuffer();

    for (let index = 0; index < rawMask.length; index += 4) {
      if (rawMask[index] > 0 || rawMask[index + 1] > 0 || rawMask[index + 2] > 0) {
        merged[index] = 255;
        merged[index + 1] = 255;
        merged[index + 2] = 255;
        merged[index + 3] = 255;
      }
    }
  }

  return Buffer.from(
    await sharp(merged, {
      raw: {
        width,
        height,
        channels: 4,
      },
    })
      .png()
      .toBuffer(),
  );
}

export async function renderPlan(options: RenderPlanOptions): Promise<RenderPlanResult> {
  const startedAt = Date.now();
  const sortedItems = sortItems(options.items);

  if (sortedItems.length === 0) {
    return {
      finalImageUrl: options.roomImageUrl,
      roughPreviewUrl: options.roomImageUrl,
      processingTimeMs: 0,
      itemCount: 0,
    };
  }

  options.onProgress?.({
    stage: "analyzing",
    message: "正在分析房间尺寸与摆放顺序...",
  });

  const roomBuffer = await downloadImageBuffer(options.roomImageUrl);
  const roomMetadata = await sharp(roomBuffer).metadata();
  const roomPhotoWidthPx = roomMetadata.width ?? 0;
  const roomPhotoHeightPx = roomMetadata.height ?? 0;

  if (!roomPhotoWidthPx || !roomPhotoHeightPx) {
    throw new Error("Room image dimensions could not be resolved.");
  }

  let currentBaseImageUrl = options.roomImageUrl;
  let latestCompositeBuffer: Uint8Array = new Uint8Array(roomBuffer);
  let latestPreviewUrl = options.roomImageUrl;
  const renderedItems: RenderedItem[] = [];

  for (const [index, item] of sortedItems.entries()) {
    const scale = calculateScale({
      roomWidthMm: options.roomWidthMm,
      roomPhotoWidthPx,
      roomPhotoHeightPx,
      furnitureWidthMm: item.widthMm,
      furnitureHeightMm: item.heightMm,
      furnitureDepthMm: item.depthMm,
      placementX: item.placementX,
      placementY: item.placementY,
    });

    const composite = await compositeImage({
      roomImageUrl: currentBaseImageUrl,
      furnitureImageUrl: item.extractedImageUrl,
      scale,
      planId: options.planId,
    });

    currentBaseImageUrl = composite.compositeImageUrl;
    latestPreviewUrl = composite.compositeImageUrl;
    latestCompositeBuffer = new Uint8Array(composite.compositeBuffer);
    renderedItems.push({
      furnitureImageUrl: item.extractedImageUrl,
      scale,
    });

    options.onProgress?.({
      stage: "placing",
      itemIndex: index + 1,
      itemName: CATEGORY_LABELS[item.category] || item.category,
      previewUrl: composite.compositeImageUrl,
    });
  }

  options.onProgress?.({
    stage: "refining",
    message: "正在统一打磨边缘、阴影和环境融合...",
  });

  const edgeMasks = await Promise.all(
    renderedItems.map((item) =>
      generateEdgeMask({
        compositeBuffer: Buffer.from(latestCompositeBuffer),
        furnitureImageUrl: item.furnitureImageUrl,
        scale: item.scale,
      }),
    ),
  );

  const mergedMaskBuffer = await mergeMaskBuffers(edgeMasks.map((item) => item.maskBuffer));
  const mergedMaskUrl = await uploadToR2(
    mergedMaskBuffer,
    `route-d/${options.planId}/merged-mask-${Date.now()}.png`,
    "image/png",
  );

  const inpaintPrompt = buildInpaintPrompt(
    options.roomDescription,
    options.lightingDirection,
  );
  const inpaintResult = await inpaintEdges({
    compositeImageUrl: latestPreviewUrl,
    maskImageUrl: mergedMaskUrl,
    prompt: inpaintPrompt,
    planId: options.planId,
  });

  options.onProgress?.({
    stage: "done",
    finalUrl: inpaintResult.refinedImageUrl,
  });

  return {
    finalImageUrl: inpaintResult.refinedImageUrl,
    roughPreviewUrl: latestPreviewUrl,
    processingTimeMs: Date.now() - startedAt,
    itemCount: sortedItems.length,
  };
}
