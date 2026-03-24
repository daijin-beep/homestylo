import "server-only";

import { runPredictionWithRetry } from "@/lib/api/replicate";
import { uploadToR2 } from "@/lib/api/r2";

export interface FluxFillOptions {
  compositeImageUrl: string;
  inverseMaskUrl: string;
  prompt: string;
  denoise?: number;
  guidance?: number;
  planId: string;
  timeout?: number;
}

export interface FluxFillResult {
  refinedImageUrl: string;
  model: string;
  processingTimeMs: number;
}

interface ModelConfig {
  model: string;
  buildInput: (
    options: Required<
      Pick<
        FluxFillOptions,
        "compositeImageUrl" | "inverseMaskUrl" | "prompt" | "guidance" | "denoise"
      >
    >,
  ) => Record<string, unknown>;
}

interface OutputCandidate {
  url: string | null;
  base64: string | null;
  mimeType: string;
}

const FLUX_FILL_MODELS: ModelConfig[] = [
  {
    model: "black-forest-labs/flux-fill-pro",
    buildInput: (options) => ({
      image: options.compositeImageUrl,
      mask: options.inverseMaskUrl,
      prompt: options.prompt,
      guidance: options.guidance,
      steps: Math.round(15 + options.denoise * 35),
      safety_tolerance: 4,
      prompt_upsampling: false,
      output_format: "png",
    }),
  },
  {
    model: "black-forest-labs/flux-fill-dev",
    buildInput: (options) => ({
      image: options.compositeImageUrl,
      mask: options.inverseMaskUrl,
      prompt: options.prompt,
      guidance: Math.max(12, options.guidance),
      steps: Math.round(15 + options.denoise * 35),
      prompt_upsampling: false,
      output_format: "png",
    }),
  },
];

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
    throw new Error("FLUX Fill output format is not supported.");
  }

  if (candidate.url) {
    const response = await fetch(candidate.url, { cache: "no-store" });
    if (!response.ok) {
      throw new Error(
        `Failed to download FLUX Fill output: ${response.status} ${response.statusText}`,
      );
    }

    const arrayBuffer = await response.arrayBuffer();
    return Buffer.from(arrayBuffer);
  }

  if (!candidate.base64) {
    throw new Error("FLUX Fill returned empty image data.");
  }

  return Buffer.from(candidate.base64, "base64");
}

export async function refineWithFluxFill(
  options: FluxFillOptions,
): Promise<FluxFillResult> {
  const startedAt = Date.now();
  const timeout = options.timeout ?? 240000;
  const resolvedOptions = {
    compositeImageUrl: options.compositeImageUrl,
    inverseMaskUrl: options.inverseMaskUrl,
    prompt: options.prompt,
    denoise: Math.min(Math.max(options.denoise ?? 0.88, 0.1), 1),
    guidance: Math.min(Math.max(options.guidance ?? 15, 1.5), 100),
  };
  const errors: string[] = [];

  for (const [index, modelConfig] of FLUX_FILL_MODELS.entries()) {
    try {
      const output = await runPredictionWithRetry(
        modelConfig.model,
        modelConfig.buildInput(resolvedOptions),
        {
          timeout,
          maxRetries: 1,
        },
      );
      const imageBuffer = await downloadModelImage(output);
      const refinedImageUrl = await uploadToR2(
        imageBuffer,
        `route-e/${options.planId}/flux-fill-${Date.now()}.png`,
        "image/png",
      );

      return {
        refinedImageUrl,
        model: modelConfig.model,
        processingTimeMs: Date.now() - startedAt,
      };
    } catch (error) {
      const message = error instanceof Error ? error.message : "unknown flux fill error";
      errors.push(`${modelConfig.model}: ${message}`);

      if (index < FLUX_FILL_MODELS.length - 1) {
        await sleep(2000);
      }
    }
  }

  throw new Error(`FLUX Fill scene regeneration failed: ${errors.join(" | ")}`);
}
