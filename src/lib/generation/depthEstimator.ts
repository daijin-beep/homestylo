import "server-only";

import { runPredictionWithRetry } from "@/lib/api/replicate";
import { uploadToR2 } from "@/lib/api/r2";

interface DepthModelConfig {
  model: string;
  buildInput: (imageUrl: string) => Record<string, unknown>;
}

export interface DepthEstimationResult {
  depthImageUrl: string;
  model: string;
  processingTimeMs: number;
}

interface DepthOutputCandidate {
  url: string | null;
  base64: string | null;
  mimeType: string;
}

interface EstimateDepthOptions {
  timeout?: number;
  schemeId?: string;
}

export const DEPTH_MODELS: DepthModelConfig[] = [
  {
    model: "apple/depth-pro",
    buildInput: (imageUrl) => ({
      image: imageUrl,
    }),
  },
  {
    model: "adirik/depth-anything-v2-large",
    buildInput: (imageUrl) => ({
      image: imageUrl,
    }),
  },
  {
    model: "prs-eth/marigold-lcm",
    buildInput: (imageUrl) => ({
      image: imageUrl,
    }),
  },
];

function isHttpUrl(value: string) {
  return /^https?:\/\//i.test(value.trim());
}

function extractStringPayload(value: string): DepthOutputCandidate | null {
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

function extractOutputCandidate(output: unknown): DepthOutputCandidate | null {
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
    const potentialKeys = [
      "url",
      "image",
      "depth",
      "depth_map",
      "depthMap",
      "output",
      "prediction",
      "base64",
      "data",
    ];

    for (const key of potentialKeys) {
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

async function downloadOutputBuffer(output: unknown) {
  const candidate = extractOutputCandidate(output);
  if (!candidate) {
    throw new Error("深度模型输出格式异常，无法解析。");
  }

  if (candidate.url) {
    const response = await fetch(candidate.url, { cache: "no-store" });
    if (!response.ok) {
      throw new Error(`下载深度图失败: ${response.status} ${response.statusText}`);
    }

    const arrayBuffer = await response.arrayBuffer();
    return {
      buffer: Buffer.from(arrayBuffer),
      mimeType: candidate.mimeType,
    };
  }

  if (!candidate.base64) {
    throw new Error("深度模型输出缺少有效图像数据。");
  }

  return {
    buffer: Buffer.from(candidate.base64, "base64"),
    mimeType: candidate.mimeType,
  };
}

function inferSchemeId(imageUrl: string, explicitSchemeId?: string) {
  if (explicitSchemeId && explicitSchemeId.trim()) {
    return explicitSchemeId.trim();
  }

  const queryMatch = imageUrl.match(/[?&]scheme[_-]?id=([^&]+)/i);
  if (queryMatch?.[1]) {
    return decodeURIComponent(queryMatch[1]).replace(/[^a-zA-Z0-9_-]/g, "");
  }

  return "unknown";
}

function isTimeoutError(error: unknown) {
  if (!(error instanceof Error)) {
    return false;
  }

  const message = error.message.toLowerCase();
  return message.includes("timeout") || message.includes("timed out");
}

export async function estimateDepth(
  imageUrl: string,
  options?: EstimateDepthOptions,
): Promise<DepthEstimationResult> {
  const startedAt = Date.now();
  const timeoutMs = options?.timeout ?? 90000;
  const schemeId = inferSchemeId(imageUrl, options?.schemeId);
  const modelErrors: string[] = [];

  for (const depthModel of DEPTH_MODELS) {
    try {
      const output = await runPredictionWithRetry(
        depthModel.model,
        depthModel.buildInput(imageUrl),
        {
          timeout: timeoutMs,
        },
      );

      const { buffer, mimeType } = await downloadOutputBuffer(output);
      const key = `depth-maps/${schemeId}/${Date.now()}.png`;
      const depthImageUrl = await uploadToR2(buffer, key, mimeType || "image/png");

      return {
        depthImageUrl,
        model: depthModel.model,
        processingTimeMs: Date.now() - startedAt,
      };
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "未知错误";
      modelErrors.push(`${depthModel.model}: ${message}`);

      const isLastModel = depthModel.model === DEPTH_MODELS[DEPTH_MODELS.length - 1]?.model;
      if (!isLastModel) {
        continue;
      }

      if (isTimeoutError(error)) {
        throw new Error("深度估计超时");
      }

      throw new Error(`深度估计失败：${modelErrors.join(" | ")}`);
    }
  }

  throw new Error("深度估计失败：没有可用模型。");
}
