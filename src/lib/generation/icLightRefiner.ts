import "server-only";

import { runPredictionWithRetry } from "@/lib/api/replicate";
import { uploadToR2 } from "@/lib/api/r2";

export interface ICLightOptions {
  imageUrl: string;
  backgroundImageUrl: string;
  prompt?: string;
  denoise?: number;
  planId: string;
}

export interface ICLightResult {
  refinedImageUrl: string;
  processingTimeMs: number;
  skipped: boolean;
}

interface OutputCandidate {
  url: string | null;
  base64: string | null;
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
    };
  }

  const dataUriMatch = trimmed.match(/^data:image\/[a-z0-9+.-]+;base64,(.+)$/i);
  if (dataUriMatch?.[1]) {
    return {
      url: null,
      base64: dataUriMatch[1],
    };
  }

  const likelyBase64 = /^[A-Za-z0-9+/=\r\n]+$/.test(trimmed) && trimmed.length > 64;
  if (likelyBase64) {
    return {
      url: null,
      base64: trimmed.replace(/\s+/g, ""),
    };
  }

  return null;
}

function extractOutputCandidate(output: unknown): OutputCandidate | null {
  if (typeof output === "string") {
    return extractStringPayload(output);
  }

  if (Array.isArray(output)) {
    for (const item of output) {
      const candidate = extractOutputCandidate(item);
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
    throw new Error("IC-Light output format is not supported.");
  }

  if (candidate.url) {
    const response = await fetch(candidate.url, { cache: "no-store" });
    if (!response.ok) {
      throw new Error(
        `Failed to download IC-Light output: ${response.status} ${response.statusText}`,
      );
    }

    const arrayBuffer = await response.arrayBuffer();
    return Buffer.from(arrayBuffer);
  }

  if (!candidate.base64) {
    throw new Error("IC-Light returned empty image data.");
  }

  return Buffer.from(candidate.base64, "base64");
}

export async function refineWithICLight(
  options: ICLightOptions,
): Promise<ICLightResult> {
  const startedAt = Date.now();

  try {
    const output = await runPredictionWithRetry(
      "zsxkib/ic-light-background",
      {
        foreground_image: options.imageUrl,
        background_image: options.backgroundImageUrl,
        prompt:
          options.prompt ??
          "indoor room with natural lighting, consistent ambient illumination",
        denoise_strength: Math.min(Math.max(options.denoise ?? 0.08, 0.05), 0.1),
        output_format: "png",
      },
      {
        timeout: 180000,
        maxRetries: 1,
      },
    );

    const imageBuffer = await downloadModelImage(output);
    const refinedImageUrl = await uploadToR2(
      imageBuffer,
      `route-e/${options.planId}/ic-light-${Date.now()}.png`,
      "image/png",
    );

    return {
      refinedImageUrl,
      processingTimeMs: Date.now() - startedAt,
      skipped: false,
    };
  } catch {
    return {
      refinedImageUrl: options.imageUrl,
      processingTimeMs: Date.now() - startedAt,
      skipped: true,
    };
  }
}
