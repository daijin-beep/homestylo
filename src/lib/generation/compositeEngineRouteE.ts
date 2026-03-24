import "server-only";

import sharp from "sharp";
import { uploadToR2 } from "@/lib/api/r2";
import type { ScaleResult } from "@/lib/generation/scaleCalculatorRouteE";

export interface CompositeItem {
  furnitureBuffer: Buffer;
  scale: ScaleResult;
  category: string;
}

export interface CompositeOptions {
  roomImageBuffer: Buffer;
  items: CompositeItem[];
  addPreShadow?: boolean;
}

export interface CompositeResult {
  compositeBuffer: Buffer;
  compositeUrl: string;
  furnitureMaskBuffer: Buffer;
  processingTimeMs: number;
}

const SHADOW_FACTORS: Record<
  string,
  { widthFactor: number; heightFactor: number; opacity: number }
> = {
  sofa: { widthFactor: 0.84, heightFactor: 0.16, opacity: 0.32 },
  bed: { widthFactor: 0.9, heightFactor: 0.14, opacity: 0.28 },
  dining_table: { widthFactor: 0.78, heightFactor: 0.12, opacity: 0.26 },
  tv_cabinet: { widthFactor: 0.74, heightFactor: 0.12, opacity: 0.22 },
  coffee_table: { widthFactor: 0.72, heightFactor: 0.12, opacity: 0.24 },
  rug: { widthFactor: 0.95, heightFactor: 0.1, opacity: 0.12 },
  floor_lamp: { widthFactor: 0.38, heightFactor: 0.11, opacity: 0.24 },
  side_table: { widthFactor: 0.54, heightFactor: 0.12, opacity: 0.22 },
  plant: { widthFactor: 0.5, heightFactor: 0.12, opacity: 0.22 },
};

function clamp(value: number, min: number, max: number) {
  return Math.min(Math.max(value, min), max);
}

function sortItems(items: CompositeItem[]) {
  return [...items].sort((left, right) => {
    if (left.scale.positionY === right.scale.positionY) {
      return left.scale.positionX - right.scale.positionX;
    }

    return left.scale.positionY - right.scale.positionY;
  });
}

function buildShadowSvg(width: number, height: number, items: CompositeItem[]) {
  const ellipses = items.map((item) => {
    const shadow = SHADOW_FACTORS[item.category] ?? {
      widthFactor: 0.8,
      heightFactor: 0.15,
      opacity: 0.3,
    };

    const centerX = item.scale.positionX + item.scale.pixelWidth / 2;
    const centerY = item.scale.positionY + item.scale.pixelHeight + 5;
    const radiusX = Math.max(10, item.scale.pixelWidth * shadow.widthFactor * 0.5);
    const radiusY = Math.max(6, item.scale.pixelHeight * shadow.heightFactor * 0.5);

    return `<ellipse cx="${centerX.toFixed(2)}" cy="${clamp(centerY, 0, height).toFixed(2)}" rx="${radiusX.toFixed(2)}" ry="${radiusY.toFixed(2)}" fill="rgba(0,0,0,${shadow.opacity.toFixed(3)})" />`;
  });

  return [
    `<svg width="${width}" height="${height}" viewBox="0 0 ${width} ${height}" xmlns="http://www.w3.org/2000/svg">`,
    '<rect width="100%" height="100%" fill="transparent" />',
    ...ellipses,
    "</svg>",
  ].join("");
}

async function buildShadowLayer(width: number, height: number, items: CompositeItem[]) {
  if (items.length === 0) {
    return null;
  }

  const svg = buildShadowSvg(width, height, items);
  return Buffer.from(
    await sharp(Buffer.from(svg))
      .ensureAlpha()
      .blur(15)
      .png()
      .toBuffer(),
  );
}

async function buildMaskAndFurnitureLayers(
  width: number,
  height: number,
  items: CompositeItem[],
) {
  const compositeLayers: Array<{ input: Buffer; left: number; top: number }> = [];
  const rawMask = new Uint8Array(width * height);

  for (const item of items) {
    const targetWidth = Math.max(1, Math.round(item.scale.pixelWidth));
    const targetHeight = Math.max(1, Math.round(item.scale.pixelHeight));
    const left = Math.round(item.scale.positionX);
    const top = Math.round(item.scale.positionY);
    const resizedBuffer = Buffer.from(
      await sharp(item.furnitureBuffer)
        .ensureAlpha()
        .resize({
          width: targetWidth,
          height: targetHeight,
          fit: "fill",
        })
        .png()
        .toBuffer(),
    );

    compositeLayers.push({
      input: resizedBuffer,
      left,
      top,
    });

    const alpha = await sharp(resizedBuffer)
      .ensureAlpha()
      .extractChannel("alpha")
      .threshold(1)
      .raw()
      .toBuffer();

    for (let localY = 0; localY < targetHeight; localY += 1) {
      const globalY = top + localY;
      if (globalY < 0 || globalY >= height) {
        continue;
      }

      const localRowOffset = localY * targetWidth;
      const globalRowOffset = globalY * width;

      for (let localX = 0; localX < targetWidth; localX += 1) {
        const globalX = left + localX;
        if (globalX < 0 || globalX >= width) {
          continue;
        }

        if ((alpha[localRowOffset + localX] ?? 0) > 0) {
          rawMask[globalRowOffset + globalX] = 255;
        }
      }
    }
  }

  const furnitureMaskBuffer = Buffer.from(
    await sharp(rawMask, {
      raw: {
        width,
        height,
        channels: 1,
      },
    })
      .png()
      .toBuffer(),
  );

  return {
    compositeLayers,
    furnitureMaskBuffer,
  };
}

export async function compositeRouteEImage(
  options: CompositeOptions,
  planId: string,
): Promise<CompositeResult> {
  const startedAt = Date.now();
  const sortedItems = sortItems(options.items);
  const roomMetadata = await sharp(options.roomImageBuffer).metadata();
  const width = roomMetadata.width ?? 0;
  const height = roomMetadata.height ?? 0;

  if (!width || !height) {
    throw new Error("Room image dimensions could not be resolved for Route E composite.");
  }

  const { compositeLayers, furnitureMaskBuffer } = await buildMaskAndFurnitureLayers(
    width,
    height,
    sortedItems,
  );
  const layers = [...compositeLayers];
  const addPreShadow = options.addPreShadow ?? true;

  if (addPreShadow) {
    const shadowLayer = await buildShadowLayer(width, height, sortedItems);
    if (shadowLayer) {
      layers.unshift({
        input: shadowLayer,
        left: 0,
        top: 0,
      });
    }
  }

  const compositeBuffer = Buffer.from(
    await sharp(options.roomImageBuffer)
      .ensureAlpha()
      .composite(layers)
      .png()
      .toBuffer(),
  );

  const compositeUrl = await uploadToR2(
    compositeBuffer,
    `route-e/${planId}/rough-composite-${Date.now()}.png`,
    "image/png",
  );

  return {
    compositeBuffer,
    compositeUrl,
    furnitureMaskBuffer,
    processingTimeMs: Date.now() - startedAt,
  };
}
