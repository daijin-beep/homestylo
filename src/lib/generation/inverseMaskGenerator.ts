import "server-only";

import sharp from "sharp";
import { uploadToR2 } from "@/lib/api/r2";

export interface InverseMaskOptions {
  furnitureMaskBuffer: Buffer;
  imageWidth: number;
  imageHeight: number;
  featherPx?: number;
  protectShadow?: boolean;
}

export interface InverseMaskResult {
  maskBuffer: Buffer;
  maskUrl: string;
}

function erodeMask(
  source: Uint8Array,
  width: number,
  height: number,
  radius: number,
) {
  if (radius <= 0) {
    return new Uint8Array(source);
  }

  const eroded = new Uint8Array(width * height);

  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      let keep = 255;

      for (let offsetY = -radius; offsetY <= radius && keep > 0; offsetY += 1) {
        const sampleY = y + offsetY;
        if (sampleY < 0 || sampleY >= height) {
          keep = 0;
          break;
        }

        for (let offsetX = -radius; offsetX <= radius; offsetX += 1) {
          const sampleX = x + offsetX;
          if (sampleX < 0 || sampleX >= width) {
            keep = 0;
            break;
          }

          if ((source[sampleY * width + sampleX] ?? 0) === 0) {
            keep = 0;
            break;
          }
        }
      }

      eroded[y * width + x] = keep;
    }
  }

  return eroded;
}

async function loadMaskBuffer(buffer: Buffer, width: number, height: number) {
  return new Uint8Array(
    await sharp(buffer)
      .ensureAlpha()
      .resize({
        width,
        height,
        fit: "fill",
      })
      .extractChannel("red")
      .threshold(1)
      .raw()
      .toBuffer(),
  );
}

async function applyOptionalShadowProtection(
  mask: Uint8Array,
  width: number,
  height: number,
  protectShadow: boolean,
  featherPx: number,
) {
  if (!protectShadow) {
    return mask;
  }

  return new Uint8Array(
    await sharp(mask, {
      raw: {
        width,
        height,
        channels: 1,
      },
    })
      .blur(Math.max(0.1, featherPx))
      .threshold(1)
      .raw()
      .toBuffer(),
  );
}

export async function generateInverseMask(
  options: InverseMaskOptions,
  planId: string,
): Promise<InverseMaskResult> {
  const featherPx = Math.max(1, Math.round(options.featherPx ?? 6));
  const baseMask = await loadMaskBuffer(
    options.furnitureMaskBuffer,
    options.imageWidth,
    options.imageHeight,
  );
  const protectedMask = await applyOptionalShadowProtection(
    baseMask,
    options.imageWidth,
    options.imageHeight,
    options.protectShadow ?? false,
    featherPx,
  );
  const inverse = new Uint8Array(options.imageWidth * options.imageHeight);

  for (let index = 0; index < protectedMask.length; index += 1) {
    inverse[index] = 255 - (protectedMask[index] ?? 0);
  }

  const feathered = new Uint8Array(
    await sharp(inverse, {
      raw: {
        width: options.imageWidth,
        height: options.imageHeight,
        channels: 1,
      },
    })
      .blur(Math.max(0.1, featherPx / 2))
      .raw()
      .toBuffer(),
  );

  const safetyMask = erodeMask(baseMask, options.imageWidth, options.imageHeight, 4);

  for (let index = 0; index < safetyMask.length; index += 1) {
    if ((safetyMask[index] ?? 0) > 0) {
      feathered[index] = 0;
    }
  }

  const maskBuffer = Buffer.from(
    await sharp(feathered, {
      raw: {
        width: options.imageWidth,
        height: options.imageHeight,
        channels: 1,
      },
    })
      .png()
      .toBuffer(),
  );

  const maskUrl = await uploadToR2(
    maskBuffer,
    `route-e/${planId}/inverse-mask-${Date.now()}.png`,
    "image/png",
  );

  return {
    maskBuffer,
    maskUrl,
  };
}
