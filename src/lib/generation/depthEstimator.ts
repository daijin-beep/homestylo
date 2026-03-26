import "server-only";

import sharp from "sharp";
import { runPredictionWithRetry } from "@/lib/api/replicate";
import { uploadToR2 } from "@/lib/api/r2";

interface DepthModelConfig {
  model: string;
  buildInput: (imageUrl: string) => Record<string, unknown>;
  supportsFocalLength: boolean;
}

export interface DepthEstimationResult {
  depthImageUrl: string;
  depthRawUrl: string;
  focalLengthPx: number | null;
  model: string;
  processingTimeMs: number;
}

interface DownloadCandidate {
  url: string | null;
  base64: string | null;
  mimeType: string;
  filename: string | null;
}

interface DownloadedBinary {
  buffer: Buffer;
  mimeType: string;
  filename: string | null;
}

interface EstimateDepthOptions {
  timeout?: number;
  planId?: string;
}

const DEPTH_MODELS: DepthModelConfig[] = [
  {
    model: "garg-aayush/ml-depth-pro",
    buildInput: (imageUrl) => ({
      image: imageUrl,
    }),
    supportsFocalLength: true,
  },
  {
    model: "cjwbw/zoedepth",
    buildInput: (imageUrl) => ({
      image: imageUrl,
    }),
    supportsFocalLength: false,
  },
];

const VISUALIZATION_KEYS = [
  "depth_image_url",
  "depth_image",
  "visualization",
  "depth_vis",
  "depth_png",
  "image",
  "output",
  "prediction",
  "result",
  "data",
];

const RAW_DEPTH_KEYS = [
  "depth_raw_url",
  "depth_raw",
  "raw_depth_url",
  "raw_depth",
  "depth_map_url",
  "depth_map",
  "depth_npy_url",
  "depth_npy",
  "depth",
];

const FOCAL_LENGTH_KEYS = [
  "focal_length_px",
  "focalLengthPx",
  "focal_length",
  "focalLength",
  "f_px",
];

function isHttpUrl(value: string) {
  return /^https?:\/\//i.test(value.trim());
}

function getStorageScope(imageUrl: string, explicitPlanId?: string) {
  if (explicitPlanId?.trim()) {
    return explicitPlanId.trim();
  }

  const queryMatch = imageUrl.match(/[?&]plan[_-]?id=([^&]+)/i);
  if (queryMatch?.[1]) {
    return decodeURIComponent(queryMatch[1]).replace(/[^a-zA-Z0-9_-]/g, "");
  }

  return "unknown";
}

function inferFileNameFromUrl(url: string) {
  try {
    const pathname = new URL(url).pathname;
    return pathname.split("/").pop() || null;
  } catch {
    return null;
  }
}

function inferExtension(mimeType: string, fallback = "bin") {
  const normalized = mimeType.toLowerCase();

  if (normalized.includes("png")) {
    return "png";
  }

  if (normalized.includes("jpeg") || normalized.includes("jpg")) {
    return "jpg";
  }

  if (normalized.includes("webp")) {
    return "webp";
  }

  if (normalized.includes("json")) {
    return "json";
  }

  if (normalized.includes("plain")) {
    return "txt";
  }

  return fallback;
}

function extractStringPayload(value: string): DownloadCandidate | null {
  const trimmed = value.trim();
  if (!trimmed) {
    return null;
  }

  if (isHttpUrl(trimmed)) {
    return {
      url: trimmed,
      base64: null,
      mimeType: "application/octet-stream",
      filename: inferFileNameFromUrl(trimmed),
    };
  }

  const dataUriMatch = trimmed.match(/^data:([a-z0-9/+.-]+);base64,(.+)$/i);
  if (dataUriMatch?.[2]) {
    return {
      url: null,
      base64: dataUriMatch[2],
      mimeType: dataUriMatch[1] ?? "application/octet-stream",
      filename: null,
    };
  }

  const likelyBase64 = /^[A-Za-z0-9+/=\r\n]+$/.test(trimmed) && trimmed.length > 64;
  if (likelyBase64) {
    return {
      url: null,
      base64: trimmed.replace(/\s+/g, ""),
      mimeType: "application/octet-stream",
      filename: null,
    };
  }

  return null;
}

function extractBinaryCandidate(value: unknown): DownloadCandidate | null {
  if (typeof value === "string") {
    return extractStringPayload(value);
  }

  if (Array.isArray(value)) {
    for (const entry of value) {
      const candidate = extractBinaryCandidate(entry);
      if (candidate) {
        return candidate;
      }
    }

    return null;
  }

  if (value && typeof value === "object") {
    const record = value as Record<string, unknown>;
    const directKeys = ["url", "image", "output", "result", "data", "base64"];

    for (const key of directKeys) {
      if (!(key in record)) {
        continue;
      }

      const candidate = extractBinaryCandidate(record[key]);
      if (candidate) {
        return candidate;
      }
    }
  }

  return null;
}

function searchBinaryByKeys(value: unknown, preferredKeys: string[]): DownloadCandidate | null {
  if (!value || typeof value !== "object") {
    return extractBinaryCandidate(value);
  }

  if (Array.isArray(value)) {
    for (const entry of value) {
      const candidate = searchBinaryByKeys(entry, preferredKeys);
      if (candidate) {
        return candidate;
      }
    }

    return null;
  }

  const record = value as Record<string, unknown>;

  for (const key of preferredKeys) {
    if (!(key in record)) {
      continue;
    }

    const candidate = extractBinaryCandidate(record[key]);
    if (candidate) {
      return candidate;
    }
  }

  for (const nestedValue of Object.values(record)) {
    const candidate = searchBinaryByKeys(nestedValue, preferredKeys);
    if (candidate) {
      return candidate;
    }
  }

  return null;
}

function searchNumberByKeys(value: unknown, preferredKeys: string[]): number | null {
  if (!value || typeof value !== "object") {
    return null;
  }

  if (Array.isArray(value)) {
    for (const entry of value) {
      const found = searchNumberByKeys(entry, preferredKeys);
      if (found !== null) {
        return found;
      }
    }

    return null;
  }

  const record = value as Record<string, unknown>;

  for (const key of preferredKeys) {
    if (!(key in record)) {
      continue;
    }

    const raw = record[key];
    const valueAsNumber =
      typeof raw === "number"
        ? raw
        : typeof raw === "string"
          ? Number(raw)
          : null;

    if (typeof valueAsNumber === "number" && Number.isFinite(valueAsNumber) && valueAsNumber > 0) {
      return valueAsNumber;
    }
  }

  for (const nestedValue of Object.values(record)) {
    const found = searchNumberByKeys(nestedValue, preferredKeys);
    if (found !== null) {
      return found;
    }
  }

  return null;
}

async function downloadBinary(candidate: DownloadCandidate): Promise<DownloadedBinary> {
  if (candidate.url) {
    const response = await fetch(candidate.url, { cache: "no-store" });
    if (!response.ok) {
      throw new Error(
        `Failed to download depth output: ${response.status} ${response.statusText}`,
      );
    }

    const arrayBuffer = await response.arrayBuffer();
    return {
      buffer: Buffer.from(arrayBuffer),
      mimeType: response.headers.get("content-type") || candidate.mimeType,
      filename: candidate.filename,
    };
  }

  if (!candidate.base64) {
    throw new Error("Depth output did not contain downloadable data.");
  }

  return {
    buffer: Buffer.from(candidate.base64, "base64"),
    mimeType: candidate.mimeType,
    filename: candidate.filename,
  };
}

async function getImageSize(imageUrl: string) {
  const response = await fetch(imageUrl, { cache: "no-store" });
  if (!response.ok) {
    return { width: 1024, height: 768 };
  }

  const arrayBuffer = await response.arrayBuffer();
  const metadata = await sharp(Buffer.from(arrayBuffer)).metadata();

  return {
    width: metadata.width ?? 1024,
    height: metadata.height ?? 768,
  };
}

function isTimeoutError(error: unknown) {
  if (!(error instanceof Error)) {
    return false;
  }

  const message = error.message.toLowerCase();
  return message.includes("timeout") || message.includes("timed out");
}

async function resolveDepthArtifacts(output: unknown) {
  const visualizationCandidate =
    searchBinaryByKeys(output, VISUALIZATION_KEYS) ?? searchBinaryByKeys(output, RAW_DEPTH_KEYS);

  if (!visualizationCandidate) {
    throw new Error("Depth model did not return a usable visualization image.");
  }

  const visualization = await downloadBinary(visualizationCandidate);
  const rawDepthCandidate = searchBinaryByKeys(output, RAW_DEPTH_KEYS);
  const rawDepth = rawDepthCandidate ? await downloadBinary(rawDepthCandidate) : null;

  return {
    visualization,
    rawDepth,
  };
}

export async function estimateDepthWithPro(
  imageUrl: string,
  options?: EstimateDepthOptions,
): Promise<DepthEstimationResult> {
  const startedAt = Date.now();
  const timeoutMs = options?.timeout ?? 90000;
  const storageScope = getStorageScope(imageUrl, options?.planId);
  const modelErrors: string[] = [];
  const imageSize = await getImageSize(imageUrl);

  for (const modelConfig of DEPTH_MODELS) {
    try {
      const output = await runPredictionWithRetry(
        modelConfig.model,
        modelConfig.buildInput(imageUrl),
        {
          timeout: timeoutMs,
        },
      );

      const { visualization, rawDepth } = await resolveDepthArtifacts(output);
      const focalLengthPx =
        (modelConfig.supportsFocalLength
          ? searchNumberByKeys(output, FOCAL_LENGTH_KEYS)
          : null) ?? imageSize.width * 1.2;

      const depthImageUrl = await uploadToR2(
        visualization.buffer,
        `depth-maps/${storageScope}/depth-visual-${Date.now()}.${inferExtension(
          visualization.mimeType,
          "png",
        )}`,
        visualization.mimeType || "image/png",
      );

      const rawDepthPayload = rawDepth ?? {
        buffer: visualization.buffer,
        mimeType: visualization.mimeType || "image/png",
        filename: visualization.filename,
      };

      const depthRawUrl = await uploadToR2(
        rawDepthPayload.buffer,
        `depth-maps/${storageScope}/depth-raw-${Date.now()}.${inferExtension(
          rawDepthPayload.mimeType,
          rawDepth ? "bin" : "png",
        )}`,
        rawDepthPayload.mimeType || "application/octet-stream",
      );

      if (!rawDepth || !modelConfig.supportsFocalLength) {
        console.warn("[depthEstimator] using fallback depth artifacts", {
          model: modelConfig.model,
          usedVisualizationAsRaw: !rawDepth,
          usedFallbackFocalLength: !modelConfig.supportsFocalLength
            || searchNumberByKeys(output, FOCAL_LENGTH_KEYS) === null,
        });
      }

      return {
        depthImageUrl,
        depthRawUrl,
        focalLengthPx,
        model: modelConfig.model,
        processingTimeMs: Date.now() - startedAt,
      };
    } catch (error) {
      const message = error instanceof Error ? error.message : "Unknown depth error";
      modelErrors.push(`${modelConfig.model}: ${message}`);

      const isLastModel =
        modelConfig.model === DEPTH_MODELS[DEPTH_MODELS.length - 1]?.model;
      if (!isLastModel) {
        continue;
      }

      if (isTimeoutError(error)) {
        throw new Error("Depth estimation timed out.");
      }

      throw new Error(`Depth estimation failed: ${modelErrors.join(" | ")}`);
    }
  }

  throw new Error("Depth estimation failed: no usable model output.");
}

export const estimateDepth = estimateDepthWithPro;
