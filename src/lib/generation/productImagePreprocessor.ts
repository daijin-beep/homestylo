import "server-only";

import sharp from "sharp";
import { analyzeImage } from "@/lib/api/claude";
import { runPredictionWithRetry } from "@/lib/api/replicate";
import { uploadToR2 } from "@/lib/api/r2";

type ProductImageClassification = "white_bg" | "scene" | "multi_angle" | "other";
type ProductPosition = "left" | "center" | "right" | null;

interface FrontViewRegion {
  x: number;
  y: number;
  w: number;
  h: number;
}

interface ClassificationResponse {
  type: ProductImageClassification;
  description: string;
  product_position: ProductPosition;
  front_view_region: FrontViewRegion | null;
}

interface ModelConfig {
  model: string;
  buildInput: (imageUrl: string, prompt?: string) => Record<string, unknown>;
}

interface OutputCandidate {
  url: string | null;
  base64: string | null;
  mimeType: string;
}

export interface PreprocessResult {
  success: boolean;
  extractedImageUrl: string | null;
  classification: ProductImageClassification;
  needsManualCrop: boolean;
  processingTimeMs: number;
}

const CLASSIFICATION_SYSTEM_PROMPT =
  "You classify furniture/product images for downstream cutout extraction. Return only valid JSON.";

const CLASSIFICATION_USER_PROMPT = `
Analyze this product image and classify it:
1. "white_bg" - Product on white/solid background, clean cutout possible
2. "scene" - Product in a room scene with other furniture/decor
3. "multi_angle" - Multiple views of the product in one image
4. "other" - None of the above

If "scene", describe the product's approximate position (left/center/right) and what it is.
If "multi_angle", identify which sub-image shows the front view.

Respond in JSON: {
  "type": "white_bg"|"scene"|"multi_angle"|"other",
  "description": "...",
  "product_position": "left"|"center"|"right"|null,
  "front_view_region": { "x": 0, "y": 0, "w": 1, "h": 1 } | null
}
`.trim();

const BACKGROUND_REMOVAL_MODELS: ModelConfig[] = [
  {
    model: "cjwbw/birefnet",
    buildInput: (imageUrl) => ({
      image: imageUrl,
    }),
  },
  {
    // TODO: replace with the best available Replicate background removal model when IDs change.
    model: "lucataco/remove-bg",
    buildInput: (imageUrl) => ({
      image: imageUrl,
    }),
  },
];

const SCENE_SEGMENTATION_MODELS: ModelConfig[] = [
  {
    // TODO: validate the exact SAM 2 image segmentation model + prompt schema on Replicate.
    model: "meta/sam-2-video",
    buildInput: (imageUrl, prompt) => ({
      image: imageUrl,
      prompt: prompt ?? "segment the main furniture product",
    }),
  },
  ...BACKGROUND_REMOVAL_MODELS,
];

function clamp(value: number, min: number, max: number) {
  return Math.min(Math.max(value, min), max);
}

function extractJson(raw: string) {
  const fenced = raw.match(/```json\s*([\s\S]*?)\s*```/i);
  if (fenced?.[1]) {
    return fenced[1].trim();
  }

  const firstBrace = raw.indexOf("{");
  const lastBrace = raw.lastIndexOf("}");
  if (firstBrace >= 0 && lastBrace > firstBrace) {
    return raw.slice(firstBrace, lastBrace + 1).trim();
  }

  return raw.trim();
}

function parseClassification(raw: string): ClassificationResponse {
  try {
    const parsed = JSON.parse(extractJson(raw)) as Partial<ClassificationResponse>;
    const type: ProductImageClassification =
      parsed.type === "white_bg" ||
      parsed.type === "scene" ||
      parsed.type === "multi_angle" ||
      parsed.type === "other"
        ? parsed.type
        : "other";

    const position: ProductPosition =
      parsed.product_position === "left" ||
      parsed.product_position === "center" ||
      parsed.product_position === "right"
        ? parsed.product_position
        : null;

    const region =
      parsed.front_view_region &&
      typeof parsed.front_view_region.x === "number" &&
      typeof parsed.front_view_region.y === "number" &&
      typeof parsed.front_view_region.w === "number" &&
      typeof parsed.front_view_region.h === "number"
        ? {
            x: clamp(parsed.front_view_region.x, 0, 1),
            y: clamp(parsed.front_view_region.y, 0, 1),
            w: clamp(parsed.front_view_region.w, 0.05, 1),
            h: clamp(parsed.front_view_region.h, 0.05, 1),
          }
        : null;

    return {
      type,
      description: typeof parsed.description === "string" ? parsed.description.trim() : "",
      product_position: position,
      front_view_region: region,
    };
  } catch {
    return {
      type: "other",
      description: "",
      product_position: null,
      front_view_region: null,
    };
  }
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
    const possibleKeys = [
      "url",
      "image",
      "output",
      "images",
      "prediction",
      "result",
      "mask",
      "data",
      "base64",
    ];

    for (const key of possibleKeys) {
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

async function downloadBufferFromUrl(imageUrl: string) {
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

async function downloadModelOutput(output: unknown) {
  const candidate = extractOutputCandidate(output);
  if (!candidate) {
    throw new Error("Background removal model output format is not supported.");
  }

  if (candidate.url) {
    const response = await fetch(candidate.url, { cache: "no-store" });
    if (!response.ok) {
      throw new Error(`Failed to download extracted image: ${response.status} ${response.statusText}`);
    }

    const arrayBuffer = await response.arrayBuffer();
    return {
      buffer: Buffer.from(arrayBuffer),
      mimeType: candidate.mimeType,
    };
  }

  if (!candidate.base64) {
    throw new Error("Background removal model returned empty image data.");
  }

  return {
    buffer: Buffer.from(candidate.base64, "base64"),
    mimeType: candidate.mimeType,
  };
}

async function cropFrontView(buffer: Uint8Array, region: FrontViewRegion | null) {
  if (!region) {
    return buffer;
  }

  const image = sharp(buffer);
  const metadata = await image.metadata();
  const width = metadata.width ?? 0;
  const height = metadata.height ?? 0;

  if (!width || !height) {
    return buffer;
  }

  const left = clamp(Math.floor(region.x * width), 0, Math.max(width - 1, 0));
  const top = clamp(Math.floor(region.y * height), 0, Math.max(height - 1, 0));
  const cropWidth = clamp(Math.floor(region.w * width), 1, width - left);
  const cropHeight = clamp(Math.floor(region.h * height), 1, height - top);

  const cropped = await image
    .extract({
      left,
      top,
      width: cropWidth,
      height: cropHeight,
    })
    .png()
    .toBuffer();

  return new Uint8Array(cropped);
}

async function classifyProductImage(imageUrl: string) {
  const response = await analyzeImage(
    imageUrl,
    CLASSIFICATION_SYSTEM_PROMPT,
    CLASSIFICATION_USER_PROMPT,
  );
  return parseClassification(response);
}

async function runExtractionModel(
  models: ModelConfig[],
  imageUrl: string,
  prompt?: string,
) {
  const errors: string[] = [];

  for (const modelConfig of models) {
    try {
      const output = await runPredictionWithRetry(
        modelConfig.model,
        modelConfig.buildInput(imageUrl, prompt),
        {
          timeout: 120000,
          maxRetries: 1,
        },
      );
      return await downloadModelOutput(output);
    } catch (error) {
      const message = error instanceof Error ? error.message : "unknown model error";
      errors.push(`${modelConfig.model}: ${message}`);
    }
  }

  throw new Error(`All extraction models failed: ${errors.join(" | ")}`);
}

async function validateExtraction(buffer: Buffer) {
  const { data, info } = await sharp(buffer)
    .ensureAlpha()
    .raw()
    .toBuffer({ resolveWithObject: true });

  const totalPixels = info.width * info.height;
  if (!totalPixels) {
    return false;
  }

  let opaquePixels = 0;
  for (let index = 3; index < data.length; index += 4) {
    if (data[index] > 16) {
      opaquePixels += 1;
    }
  }

  const coverage = opaquePixels / totalPixels;
  return coverage >= 0.1 && coverage <= 0.9;
}

function getTargetModels(classification: ProductImageClassification) {
  if (classification === "scene") {
    return SCENE_SEGMENTATION_MODELS;
  }

  return BACKGROUND_REMOVAL_MODELS;
}

export async function preprocessProductImage(
  imageUrl: string,
  planId: string,
): Promise<PreprocessResult> {
  const startedAt = Date.now();
  let classification: ProductImageClassification = "other";

  try {
    const detected = await classifyProductImage(imageUrl);
    classification = detected.type;

    let sourceBuffer: Uint8Array = new Uint8Array(
      Buffer.from((await downloadBufferFromUrl(imageUrl)).buffer),
    );
    if (classification === "multi_angle") {
      sourceBuffer = await cropFrontView(sourceBuffer, detected.front_view_region);
    }

    const preparedSource = Buffer.from(
      await sharp(sourceBuffer)
      .ensureAlpha()
      .png()
      .toBuffer(),
    );

    const preparedSourceUrl = await uploadToR2(
      preparedSource,
      `product-preprocess/${planId}/source-${Date.now()}.png`,
      "image/png",
    );

    const extracted = await runExtractionModel(
      getTargetModels(classification),
      preparedSourceUrl,
      detected.description,
    );

    const normalizedBuffer = Buffer.from(
      await sharp(extracted.buffer)
      .ensureAlpha()
      .png()
      .toBuffer(),
    );

    const passesQualityCheck = await validateExtraction(normalizedBuffer);
    if (!passesQualityCheck) {
      return {
        success: false,
        extractedImageUrl: null,
        classification,
        needsManualCrop: true,
        processingTimeMs: Date.now() - startedAt,
      };
    }

    const extractedImageUrl = await uploadToR2(
      normalizedBuffer,
      `product-preprocess/${planId}/extracted-${Date.now()}.png`,
      "image/png",
    );

    return {
      success: true,
      extractedImageUrl,
      classification,
      needsManualCrop: false,
      processingTimeMs: Date.now() - startedAt,
    };
  } catch (error) {
    console.error("[productImagePreprocessor] failed", error);
    return {
      success: false,
      extractedImageUrl: null,
      classification,
      needsManualCrop: false,
      processingTimeMs: Date.now() - startedAt,
    };
  }
}
