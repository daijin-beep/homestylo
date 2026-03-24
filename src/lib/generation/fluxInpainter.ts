import "server-only";

import { runPredictionWithRetry } from "@/lib/api/replicate";
import { uploadToR2 } from "@/lib/api/r2";

export interface InpaintOptions {
  compositeImageUrl: string;
  maskImageUrl: string;
  prompt: string;
  denoise?: number;
  planId: string;
  timeout?: number;
}

export interface InpaintResult {
  refinedImageUrl: string;
  model: string;
  processingTimeMs: number;
}

interface InpaintModelConfig {
  model: string;
  buildInput: (options: Required<Pick<InpaintOptions, "compositeImageUrl" | "maskImageUrl" | "prompt" | "denoise">>) => Record<string, unknown>;
}

interface OutputCandidate {
  url: string | null;
  base64: string | null;
}

const INPAINT_MODELS: InpaintModelConfig[] = [
  {
    model: "black-forest-labs/flux-fill-pro",
    buildInput: (options) => ({
      image: options.compositeImageUrl,
      mask: options.maskImageUrl,
      prompt: options.prompt,
      strength: options.denoise,
      output_format: "png",
    }),
  },
  {
    // TODO: validate the exact public fallback model/version when Replicate catalog changes.
    model: "stability-ai/stable-diffusion-inpainting",
    buildInput: (options) => ({
      image: options.compositeImageUrl,
      mask: options.maskImageUrl,
      prompt: options.prompt,
      strength: options.denoise,
      output_format: "png",
    }),
  },
  {
    // TODO: replace with a true FLUX-compatible fallback if a better public model becomes available.
    model: "black-forest-labs/flux-1.1-pro-ultra",
    buildInput: (options) => ({
      image: options.compositeImageUrl,
      prompt: options.prompt,
      output_format: "png",
      strength: options.denoise,
    }),
  },
];

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
    const possibleKeys = ["url", "image", "images", "output", "prediction", "data"];

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

async function downloadModelImage(output: unknown) {
  const candidate = extractOutputCandidate(output);
  if (!candidate) {
    throw new Error("Inpainting model output format is not supported.");
  }

  if (candidate.url) {
    const response = await fetch(candidate.url, { cache: "no-store" });
    if (!response.ok) {
      throw new Error(`Failed to download inpaint result: ${response.status} ${response.statusText}`);
    }

    const arrayBuffer = await response.arrayBuffer();
    return Buffer.from(arrayBuffer);
  }

  if (!candidate.base64) {
    throw new Error("Inpainting model returned empty image data.");
  }

  return Buffer.from(candidate.base64, "base64");
}

export async function inpaintEdges(options: InpaintOptions): Promise<InpaintResult> {
  const startedAt = Date.now();
  const timeout = options.timeout ?? 180000;
  const resolvedOptions = {
    compositeImageUrl: options.compositeImageUrl,
    maskImageUrl: options.maskImageUrl,
    prompt: options.prompt,
    denoise: options.denoise ?? 0.7,
  };
  const errors: string[] = [];

  for (const modelConfig of INPAINT_MODELS) {
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
        `route-d/${options.planId}/refined-${Date.now()}.png`,
        "image/png",
      );

      return {
        refinedImageUrl,
        model: modelConfig.model,
        processingTimeMs: Date.now() - startedAt,
      };
    } catch (error) {
      const message = error instanceof Error ? error.message : "unknown inpaint error";
      errors.push(`${modelConfig.model}: ${message}`);
    }
  }

  throw new Error(`Edge inpainting failed: ${errors.join(" | ")}`);
}
