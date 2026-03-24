import "server-only";

import sharp from "sharp";
import { runPredictionWithRetry } from "@/lib/api/replicate";
import { uploadToR2 } from "@/lib/api/r2";
import type { ExistingFurniture } from "@/lib/types";

export interface EraseResult {
  cleanRoomUrl: string;
  processingTimeMs: number;
}

export interface GenerateFurnitureMaskOptions {
  existingFurniture: ExistingFurniture[] | null | undefined;
  imageWidth: number;
  imageHeight: number;
  roomWidthMm: number;
  roomDepthMm?: number | null;
  featherPx?: number;
}

interface OutputCandidate {
  url: string | null;
  base64: string | null;
  mimeType: string;
}

interface ModelConfig {
  model: string;
  buildInput: (roomImageUrl: string, maskUrl: string) => Record<string, unknown>;
}

const ERASER_MODELS: ModelConfig[] = [
  {
    model: "black-forest-labs/flux-fill-pro",
    buildInput: (roomImageUrl, maskUrl) => ({
      image: roomImageUrl,
      mask: maskUrl,
      prompt:
        "empty room, clean walls, continuous flooring, no furniture, natural indoor lighting",
      guidance: 18,
      steps: 40,
      output_format: "png",
      prompt_upsampling: false,
    }),
  },
  {
    model: "black-forest-labs/flux-fill-dev",
    buildInput: (roomImageUrl, maskUrl) => ({
      image: roomImageUrl,
      mask: maskUrl,
      prompt:
        "empty room, clean walls, continuous flooring, no furniture, natural indoor lighting",
      guidance: 18,
      steps: 36,
      output_format: "png",
      prompt_upsampling: false,
    }),
  },
];

function clamp(value: number, min: number, max: number) {
  return Math.min(Math.max(value, min), max);
}

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function isHttpUrl(value: string) {
  return /^https?:\/\//i.test(value.trim());
}

function extractStringPayload(value: string): OutputCandidate | null {
  const trimmed = value.trim();
  if (!trimmed) {
    return null;
  }

  if (isHttpUrl(trimmed)) {
    return {
      url: trimmed,
      base64: null,
      mimeType: "image/png",
    };
  }

  const dataUriMatch = trimmed.match(/^data:(image\/[a-z0-9+.-]+);base64,(.+)$/i);
  if (dataUriMatch?.[2]) {
    return {
      url: null,
      base64: dataUriMatch[2],
      mimeType: dataUriMatch[1] ?? "image/png",
    };
  }

  const likelyBase64 = /^[A-Za-z0-9+/=\r\n]+$/.test(trimmed) && trimmed.length > 64;
  if (likelyBase64) {
    return {
      url: null,
      base64: trimmed.replace(/\s+/g, ""),
      mimeType: "image/png",
    };
  }

  return null;
}

function extractOutputCandidate(output: unknown): OutputCandidate | null {
  if (typeof output === "string") {
    return extractStringPayload(output);
  }

  if (Array.isArray(output)) {
    for (const entry of output) {
      const candidate = extractOutputCandidate(entry);
      if (candidate) {
        return candidate;
      }
    }
    return null;
  }

  if (output && typeof output === "object") {
    const record = output as Record<string, unknown>;
    const keys = ["url", "image", "images", "output", "prediction", "data", "result"];

    for (const key of keys) {
      if (!(key in record)) {
        continue;
      }

      const candidate = extractOutputCandidate(record[key]);
      if (candidate) {
        return candidate;
      }
    }
  }

  return null;
}

async function downloadModelImage(output: unknown) {
  const candidate = extractOutputCandidate(output);
  if (!candidate) {
    throw new Error("Furniture eraser output format is not supported.");
  }

  if (candidate.url) {
    const response = await fetch(candidate.url, { cache: "no-store" });
    if (!response.ok) {
      throw new Error(
        `Failed to download erased room image: ${response.status} ${response.statusText}`,
      );
    }

    const arrayBuffer = await response.arrayBuffer();
    return Buffer.from(arrayBuffer);
  }

  if (!candidate.base64) {
    throw new Error("Furniture eraser returned empty image data.");
  }

  return Buffer.from(candidate.base64, "base64");
}

function resolveRoomDepthMm(options: GenerateFurnitureMaskOptions) {
  if (
    typeof options.roomDepthMm === "number" &&
    Number.isFinite(options.roomDepthMm) &&
    options.roomDepthMm > 0
  ) {
    return options.roomDepthMm;
  }

  const maxExistingDepth = Math.max(
    ...(options.existingFurniture ?? []).map((item) => item.estimated_depth_mm || 0),
    0,
  );

  return Math.max(options.roomWidthMm * 0.72, maxExistingDepth * 4, 2400);
}

function drawRectMask(
  buffer: Uint8Array,
  width: number,
  height: number,
  left: number,
  top: number,
  rectWidth: number,
  rectHeight: number,
) {
  const safeLeft = clamp(Math.round(left), 0, width - 1);
  const safeTop = clamp(Math.round(top), 0, height - 1);
  const safeWidth = clamp(Math.round(rectWidth), 1, width - safeLeft);
  const safeHeight = clamp(Math.round(rectHeight), 1, height - safeTop);

  for (let y = safeTop; y < safeTop + safeHeight; y += 1) {
    const rowOffset = y * width;
    for (let x = safeLeft; x < safeLeft + safeWidth; x += 1) {
      buffer[rowOffset + x] = 255;
    }
  }
}

export async function generateFurnitureMask(
  options: GenerateFurnitureMaskOptions,
): Promise<Buffer | null> {
  if (!options.existingFurniture?.length) {
    return null;
  }

  const roomDepthMm = resolveRoomDepthMm(options);
  const rawMask = new Uint8Array(options.imageWidth * options.imageHeight);

  for (const item of options.existingFurniture) {
    const anchorX = clamp(item.position.x, 0, 1) * options.imageWidth;
    const anchorY = clamp(item.position.y, 0, 1) * options.imageHeight;
    const rectWidth = clamp(
      Math.round((item.estimated_width_mm / options.roomWidthMm) * options.imageWidth * 1.16),
      Math.round(options.imageWidth * 0.06),
      Math.round(options.imageWidth * 0.92),
    );
    const footprintHeight = (item.estimated_depth_mm / roomDepthMm) * options.imageHeight * 0.62;
    const rectHeight = clamp(
      Math.round(Math.max(footprintHeight * 1.8, options.imageHeight * 0.1)),
      Math.round(options.imageHeight * 0.08),
      Math.round(options.imageHeight * 0.42),
    );
    const left = anchorX - rectWidth / 2;
    const top = anchorY - rectHeight * 0.62;

    drawRectMask(
      rawMask,
      options.imageWidth,
      options.imageHeight,
      left,
      top,
      rectWidth,
      rectHeight,
    );
  }

  return Buffer.from(
    await sharp(rawMask, {
      raw: {
        width: options.imageWidth,
        height: options.imageHeight,
        channels: 1,
      },
    })
      .blur(Math.max(0.1, (options.featherPx ?? 8) / 2))
      .png()
      .toBuffer(),
  );
}

export async function eraseExistingFurniture(
  roomImageUrl: string,
  existingFurnitureMask: Buffer | null,
  planId: string,
): Promise<EraseResult> {
  const startedAt = Date.now();

  if (!existingFurnitureMask) {
    return {
      cleanRoomUrl: roomImageUrl,
      processingTimeMs: Date.now() - startedAt,
    };
  }

  const maskUrl = await uploadToR2(
    existingFurnitureMask,
    `route-e/${planId}/furniture-erase-mask-${Date.now()}.png`,
    "image/png",
  );

  const errors: string[] = [];

  for (const [index, modelConfig] of ERASER_MODELS.entries()) {
    try {
      const output = await runPredictionWithRetry(
        modelConfig.model,
        modelConfig.buildInput(roomImageUrl, maskUrl),
        {
          timeout: 240000,
          maxRetries: 1,
        },
      );

      const cleanRoomBuffer = await downloadModelImage(output);
      const cleanRoomUrl = await uploadToR2(
        cleanRoomBuffer,
        `route-e/${planId}/clean-room-${Date.now()}.png`,
        "image/png",
      );

      return {
        cleanRoomUrl,
        processingTimeMs: Date.now() - startedAt,
      };
    } catch (error) {
      const message = error instanceof Error ? error.message : "unknown furniture eraser error";
      errors.push(`${modelConfig.model}: ${message}`);

      if (index < ERASER_MODELS.length - 1) {
        await sleep(2000);
      }
    }
  }

  throw new Error(`Furniture eraser failed: ${errors.join(" | ")}`);
}
