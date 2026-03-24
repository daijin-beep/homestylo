import "server-only";

import sharp from "sharp";
import { uploadToR2 } from "@/lib/api/r2";

export interface InverseMaskOptions {
  furnitureMaskBuffer: Buffer;
  imageWidth: number;
  imageHeight: number;
  edgeExpansionPx?: number;
  shadowWidthPx?: number;
  shadowSidePx?: number;
  erasedRegionMask?: Buffer | null;
  featherPx?: number;
}

export interface InverseMaskResult {
  maskBuffer: Buffer;
  maskUrl: string;
}

interface BoundingBox {
  left: number;
  top: number;
  right: number;
  bottom: number;
}

function clamp(value: number, min: number, max: number) {
  return Math.min(Math.max(value, min), max);
}

function mergeMasks(target: Uint8Array, source: Uint8Array) {
  for (let index = 0; index < target.length; index += 1) {
    if ((source[index] ?? 0) > (target[index] ?? 0)) {
      target[index] = source[index] ?? 0;
    }
  }
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

async function loadBinaryMask(buffer: Buffer, width: number, height: number) {
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

async function expandMask(
  mask: Uint8Array,
  width: number,
  height: number,
  edgeExpansionPx: number,
) {
  return new Uint8Array(
    await sharp(mask, {
      raw: {
        width,
        height,
        channels: 1,
      },
    })
      .blur(Math.max(0.1, edgeExpansionPx / 3))
      .threshold(1)
      .raw()
      .toBuffer(),
  );
}

function buildRingMask(expandedMask: Uint8Array, originalMask: Uint8Array) {
  const ringMask = new Uint8Array(expandedMask.length);

  for (let index = 0; index < expandedMask.length; index += 1) {
    if ((expandedMask[index] ?? 0) > 0 && (originalMask[index] ?? 0) === 0) {
      ringMask[index] = 255;
    }
  }

  return ringMask;
}

function collectBoundingBoxes(mask: Uint8Array, width: number, height: number) {
  const visited = new Uint8Array(width * height);
  const boxes: BoundingBox[] = [];

  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      const startIndex = y * width + x;
      if ((mask[startIndex] ?? 0) === 0 || visited[startIndex] === 1) {
        continue;
      }

      const queue: number[] = [startIndex];
      visited[startIndex] = 1;
      let left = x;
      let right = x;
      let top = y;
      let bottom = y;

      while (queue.length > 0) {
        const current = queue.pop()!;
        const currentX = current % width;
        const currentY = Math.floor(current / width);

        left = Math.min(left, currentX);
        right = Math.max(right, currentX);
        top = Math.min(top, currentY);
        bottom = Math.max(bottom, currentY);

        for (let offsetY = -1; offsetY <= 1; offsetY += 1) {
          for (let offsetX = -1; offsetX <= 1; offsetX += 1) {
            if (offsetX === 0 && offsetY === 0) {
              continue;
            }

            const nextX = currentX + offsetX;
            const nextY = currentY + offsetY;
            if (nextX < 0 || nextY < 0 || nextX >= width || nextY >= height) {
              continue;
            }

            const nextIndex = nextY * width + nextX;
            if ((mask[nextIndex] ?? 0) === 0 || visited[nextIndex] === 1) {
              continue;
            }

            visited[nextIndex] = 1;
            queue.push(nextIndex);
          }
        }
      }

      boxes.push({ left, top, right, bottom });
    }
  }

  return boxes;
}

function buildShadowMask(
  boxes: BoundingBox[],
  width: number,
  height: number,
  shadowWidthPx: number,
  shadowSidePx: number,
) {
  const shadowMask = new Uint8Array(width * height);

  for (const box of boxes) {
    const rectLeft = clamp(box.left - shadowSidePx, 0, width - 1);
    const rectRight = clamp(box.right + shadowSidePx, 0, width - 1);
    const rectTop = clamp(box.bottom - 4, 0, height - 1);
    const rectBottom = clamp(box.bottom + shadowWidthPx, 0, height - 1);

    for (let y = rectTop; y <= rectBottom; y += 1) {
      const rowOffset = y * width;
      for (let x = rectLeft; x <= rectRight; x += 1) {
        shadowMask[rowOffset + x] = 255;
      }
    }
  }

  return shadowMask;
}

function grayscaleToRgbBuffer(source: Uint8Array) {
  const rgb = Buffer.alloc(source.length * 3);

  for (let index = 0; index < source.length; index += 1) {
    const value = source[index] ?? 0;
    const offset = index * 3;
    rgb[offset] = value;
    rgb[offset + 1] = value;
    rgb[offset + 2] = value;
  }

  return rgb;
}

export async function generateInverseMask(
  options: InverseMaskOptions,
  planId: string,
): Promise<InverseMaskResult> {
  const edgeExpansionPx = Math.max(32, Math.round(options.edgeExpansionPx ?? 150));
  const shadowWidthPx = Math.max(80, Math.round(options.shadowWidthPx ?? 250));
  const shadowSidePx = Math.max(20, Math.round(options.shadowSidePx ?? 50));
  const featherPx = Math.max(1, Math.round(options.featherPx ?? 8));
  const baseMask = await loadBinaryMask(
    options.furnitureMaskBuffer,
    options.imageWidth,
    options.imageHeight,
  );
  const expandedMask = await expandMask(
    baseMask,
    options.imageWidth,
    options.imageHeight,
    edgeExpansionPx,
  );
  const ringMask = buildRingMask(expandedMask, baseMask);
  const boxes = collectBoundingBoxes(baseMask, options.imageWidth, options.imageHeight);
  const shadowMask = buildShadowMask(
    boxes,
    options.imageWidth,
    options.imageHeight,
    shadowWidthPx,
    shadowSidePx,
  );
  const combinedMask = new Uint8Array(options.imageWidth * options.imageHeight);

  mergeMasks(combinedMask, ringMask);
  mergeMasks(combinedMask, shadowMask);

  if (options.erasedRegionMask) {
    const erasedMask = await loadBinaryMask(
      options.erasedRegionMask,
      options.imageWidth,
      options.imageHeight,
    );
    mergeMasks(combinedMask, erasedMask);
  }

  const feathered = new Uint8Array(
    await sharp(combinedMask, {
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

  const rgbMask = grayscaleToRgbBuffer(feathered);

  const maskBuffer = Buffer.from(
    await sharp(rgbMask, {
      raw: {
        width: options.imageWidth,
        height: options.imageHeight,
        channels: 3,
      },
    })
      .png()
      .toBuffer(),
  );
  const maskMeta = await sharp(maskBuffer).metadata();
  console.log("[inverseMaskGenerator] mask metadata:", {
    width: maskMeta.width,
    height: maskMeta.height,
    channels: maskMeta.channels,
    format: maskMeta.format,
  });
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
