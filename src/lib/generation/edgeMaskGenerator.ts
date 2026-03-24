import "server-only";

import sharp from "sharp";
import { uploadToR2 } from "@/lib/api/r2";
import type { ScaleResult } from "@/lib/generation/scaleCalculator";

export interface EdgeMaskOptions {
  compositeBuffer: Buffer;
  furnitureImageUrl: string;
  scale: ScaleResult;
  expansionPx?: number;
  shadowHeightPx?: number;
}

export interface EdgeMaskResult {
  maskBuffer: Buffer;
  maskImageUrl: string;
}

async function downloadImageBuffer(imageUrl: string) {
  const response = await fetch(imageUrl, { cache: "no-store" });
  if (!response.ok) {
    throw new Error(`Failed to download image: ${response.status} ${response.statusText}`);
  }

  const arrayBuffer = await response.arrayBuffer();
  return Buffer.from(arrayBuffer);
}

function setMaskPixel(buffer: Uint8Array, width: number, x: number, y: number, value: number) {
  if (x < 0 || y < 0 || x >= width) {
    return;
  }

  const index = (y * width + x) * 4;
  if (index < 0 || index + 3 >= buffer.length) {
    return;
  }

  buffer[index] = value;
  buffer[index + 1] = value;
  buffer[index + 2] = value;
  buffer[index + 3] = 255;
}

async function buildAlphaMask(
  furnitureBuffer: Buffer,
  width: number,
  height: number,
  expansionPx: number,
) {
  const original = await sharp(furnitureBuffer)
    .ensureAlpha()
    .extractChannel("alpha")
    .resize({
      width,
      height,
      fit: "fill",
    })
    .threshold(1)
    .raw()
    .toBuffer();

  const expanded = await sharp(furnitureBuffer)
    .ensureAlpha()
    .extractChannel("alpha")
    .resize({
      width,
      height,
      fit: "fill",
    })
    .blur(Math.max(0.1, expansionPx / 2))
    .threshold(10)
    .raw()
    .toBuffer();

  return {
    original: new Uint8Array(original),
    expanded: new Uint8Array(expanded),
  };
}

export async function generateEdgeMask(options: EdgeMaskOptions): Promise<EdgeMaskResult> {
  const expansionPx = options.expansionPx ?? 60;
  const shadowHeightPx = options.shadowHeightPx ?? 30;
  const compositeMetadata = await sharp(options.compositeBuffer).metadata();
  const maskWidth = compositeMetadata.width ?? 0;
  const maskHeight = compositeMetadata.height ?? 0;

  if (!maskWidth || !maskHeight) {
    throw new Error("Composite image dimensions could not be resolved.");
  }

  const furnitureWidth = Math.max(1, Math.round(options.scale.pixelWidth));
  const furnitureHeight = Math.max(1, Math.round(options.scale.pixelHeight));
  const left = Math.round(options.scale.positionX);
  const top = Math.round(options.scale.positionY);
  const furnitureBuffer = await downloadImageBuffer(options.furnitureImageUrl);
  const { original, expanded } = await buildAlphaMask(
    furnitureBuffer,
    furnitureWidth,
    furnitureHeight,
    expansionPx,
  );

  const rawMask = new Uint8Array(maskWidth * maskHeight * 4);

  for (let localY = 0; localY < furnitureHeight; localY += 1) {
    for (let localX = 0; localX < furnitureWidth; localX += 1) {
      const localIndex = localY * furnitureWidth + localX;
      const expandedValue = expanded[localIndex] ?? 0;
      const originalValue = original[localIndex] ?? 0;
      const shouldDrawRing = expandedValue > 0 && originalValue === 0;

      if (shouldDrawRing) {
        setMaskPixel(rawMask, maskWidth, left + localX, top + localY, 255);
      }
    }
  }

  const ellipseCenterX = left + furnitureWidth / 2;
  const ellipseCenterY = top + furnitureHeight + shadowHeightPx * 0.2;
  const radiusX = Math.max(12, furnitureWidth * 0.4);
  const radiusY = Math.max(8, shadowHeightPx);

  for (let y = Math.floor(ellipseCenterY - radiusY); y <= Math.ceil(ellipseCenterY + radiusY); y += 1) {
    if (y < 0 || y >= maskHeight) {
      continue;
    }

    for (let x = Math.floor(ellipseCenterX - radiusX); x <= Math.ceil(ellipseCenterX + radiusX); x += 1) {
      if (x < 0 || x >= maskWidth) {
        continue;
      }

      const normalizedX = (x - ellipseCenterX) / radiusX;
      const normalizedY = (y - ellipseCenterY) / radiusY;
      const insideEllipse = normalizedX * normalizedX + normalizedY * normalizedY <= 1;

      if (insideEllipse) {
        setMaskPixel(rawMask, maskWidth, x, y, 255);
      }
    }
  }

  const maskBuffer = Buffer.from(
    await sharp(rawMask, {
      raw: {
        width: maskWidth,
        height: maskHeight,
        channels: 4,
      },
    })
      .png()
      .toBuffer(),
  );

  const maskImageUrl = await uploadToR2(
    maskBuffer,
    `route-d/masks/edge-mask-${Date.now()}.png`,
    "image/png",
  );

  return {
    maskBuffer,
    maskImageUrl,
  };
}
