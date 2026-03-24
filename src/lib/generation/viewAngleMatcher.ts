import "server-only";

import { runPredictionWithRetry } from "@/lib/api/replicate";
import { uploadToR2 } from "@/lib/api/r2";

export interface ViewMatchOptions {
  furnitureImageUrl: string;
  targetHorizontalAngle: number;
  targetVerticalAngle: number;
  targetDirection: "left" | "right" | "center";
  category: string;
  planId: string;
}

export interface ViewMatchResult {
  matchedImageUrl: string;
  processingTimeMs: number;
  wasTransformed: boolean;
}

interface OutputCandidate {
  url: string | null;
  base64: string | null;
  mimeType: string;
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
    throw new Error("View angle matcher output format is not supported.");
  }

  if (candidate.url) {
    const response = await fetch(candidate.url, { cache: "no-store" });
    if (!response.ok) {
      throw new Error(
        `Failed to download angle-matched image: ${response.status} ${response.statusText}`,
      );
    }

    const arrayBuffer = await response.arrayBuffer();
    return {
      buffer: Buffer.from(arrayBuffer),
      mimeType: candidate.mimeType,
    };
  }

  if (!candidate.base64) {
    throw new Error("View angle matcher returned empty image data.");
  }

  return {
    buffer: Buffer.from(candidate.base64, "base64"),
    mimeType: candidate.mimeType,
  };
}

function buildAnglePrompt(options: ViewMatchOptions) {
  const directionText =
    options.targetDirection === "center" ? "centered front" : `${options.targetDirection} side`;
  const categoryText = options.category.replaceAll("_", " ");

  return [
    `Show this ${categoryText} from a ${directionText} ${Math.round(options.targetHorizontalAngle)}-degree horizontal angle.`,
    `Viewed slightly from above at ${Math.round(options.targetVerticalAngle)} degrees.`,
    "Keep the exact same furniture design, silhouette, color, material, and proportions.",
    "Transparent background, isolated product photography, centered framing.",
  ].join(" ");
}

async function removeBackground(imageUrl: string, planId: string) {
  const output = await runPredictionWithRetry(
    "bria/remove-background",
    {
      image: imageUrl,
    },
    {
      timeout: 180000,
      maxRetries: 1,
    },
  );

  const { buffer } = await downloadModelImage(output);
  return uploadToR2(
    buffer,
    `route-e/${planId}/view-match-cutout-${Date.now()}.png`,
    "image/png",
  );
}

export async function matchViewAngle(
  options: ViewMatchOptions,
): Promise<ViewMatchResult> {
  const startedAt = Date.now();

  if (options.targetHorizontalAngle < 10 && options.targetVerticalAngle < 10) {
    return {
      matchedImageUrl: options.furnitureImageUrl,
      processingTimeMs: Date.now() - startedAt,
      wasTransformed: false,
    };
  }

  try {
    const output = await runPredictionWithRetry(
      "black-forest-labs/flux-kontext-pro",
      {
        input_image: options.furnitureImageUrl,
        prompt: buildAnglePrompt(options),
        output_format: "png",
      },
      {
        timeout: 240000,
        maxRetries: 1,
      },
    );

    const { buffer } = await downloadModelImage(output);
    const transformedUrl = await uploadToR2(
      buffer,
      `route-e/${options.planId}/view-match-raw-${Date.now()}.png`,
      "image/png",
    );

    await sleep(2000);
    const cleanedUrl = await removeBackground(transformedUrl, options.planId);

    return {
      matchedImageUrl: cleanedUrl,
      processingTimeMs: Date.now() - startedAt,
      wasTransformed: true,
    };
  } catch {
    return {
      matchedImageUrl: options.furnitureImageUrl,
      processingTimeMs: Date.now() - startedAt,
      wasTransformed: false,
    };
  }
}
