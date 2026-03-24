import "server-only";

import sharp from "sharp";
import { uploadToR2 } from "@/lib/api/r2";
import type { ScaleResult } from "@/lib/generation/scaleCalculator";

export interface CompositeOptions {
  roomImageUrl: string;
  furnitureImageUrl: string;
  scale: ScaleResult;
  planId: string;
}

export interface CompositeResult {
  compositeImageUrl: string;
  compositeBuffer: Buffer;
  processingTimeMs: number;
}

async function downloadImageBuffer(imageUrl: string) {
  const response = await fetch(imageUrl, { cache: "no-store" });
  if (!response.ok) {
    throw new Error(`Failed to download image: ${response.status} ${response.statusText}`);
  }

  const contentType = response.headers.get("content-type") || "image/png";
  const arrayBuffer = await response.arrayBuffer();

  return {
    buffer: Buffer.from(arrayBuffer),
    contentType,
  };
}

export async function compositeImage(options: CompositeOptions): Promise<CompositeResult> {
  const startedAt = Date.now();
  const roomImage = await downloadImageBuffer(options.roomImageUrl);
  const furnitureImage = await downloadImageBuffer(options.furnitureImageUrl);

  const resizedFurniture = Buffer.from(
    await sharp(furnitureImage.buffer)
      .ensureAlpha()
      .resize({
        width: Math.max(1, Math.round(options.scale.pixelWidth)),
        height: Math.max(1, Math.round(options.scale.pixelHeight)),
        fit: "fill",
      })
      .png()
      .toBuffer(),
  );

  const compositeBuffer = Buffer.from(
    await sharp(roomImage.buffer)
      .ensureAlpha()
      .composite([
        {
          input: resizedFurniture,
          left: Math.round(options.scale.positionX),
          top: Math.round(options.scale.positionY),
        },
      ])
      .png()
      .toBuffer(),
  );

  const compositeImageUrl = await uploadToR2(
    compositeBuffer,
    `route-d/${options.planId}/rough-composite-${Date.now()}.png`,
    "image/png",
  );

  return {
    compositeImageUrl,
    compositeBuffer,
    processingTimeMs: Date.now() - startedAt,
  };
}
