import "server-only";

import { runPredictionWithRetry } from "@/lib/api/replicate";
import { uploadToR2 } from "@/lib/api/r2";
import { buildNegativePrompt } from "@/lib/generation/promptBuilder";

export interface FluxRenderResult {
  imageUrl: string;
  prompt: string;
  model: string;
  seed: number;
  processingTimeMs: number;
}

export interface FluxRenderOptions {
  depthImageUrl: string;
  prompt: string;
  negativePrompt?: string;
  width?: number;
  height?: number;
  seed?: number;
  guidanceScale?: number;
  controlnetConditioningScale?: number;
  numInferenceSteps?: number;
  timeout?: number;
}

interface FluxModelConfig {
  model: string;
  supportsDepth: boolean;
  buildInput: (
    options: Required<
      Pick<
        FluxRenderOptions,
        | "depthImageUrl"
        | "prompt"
        | "negativePrompt"
        | "width"
        | "height"
        | "guidanceScale"
        | "controlnetConditioningScale"
        | "numInferenceSteps"
      >
    >,
    seed: number,
  ) => Record<string, unknown>;
}

const FLUX_MODELS: FluxModelConfig[] = [
  {
    model: "black-forest-labs/flux-depth-pro",
    supportsDepth: true,
    buildInput: (options, seed) => ({
      control_image: options.depthImageUrl,
      prompt: options.prompt,
      negative_prompt: options.negativePrompt,
      width: options.width,
      height: options.height,
      seed,
      guidance_scale: options.guidanceScale,
      controlnet_conditioning_scale: options.controlnetConditioningScale,
      num_inference_steps: options.numInferenceSteps,
      output_format: "png",
    }),
  },
  {
    model: "black-forest-labs/flux-1.1-pro",
    supportsDepth: false,
    buildInput: (options, seed) => ({
      prompt: options.prompt,
      negative_prompt: options.negativePrompt,
      width: options.width,
      height: options.height,
      seed,
      guidance_scale: options.guidanceScale,
      num_inference_steps: options.numInferenceSteps,
      output_format: "png",
    }),
  },
  {
    model: "black-forest-labs/flux-schnell",
    supportsDepth: false,
    buildInput: (options, seed) => ({
      prompt: options.prompt,
      negative_prompt: options.negativePrompt,
      width: options.width,
      height: options.height,
      seed,
      guidance_scale: Math.max(1, options.guidanceScale - 2),
      num_inference_steps: Math.max(8, options.numInferenceSteps - 10),
      output_format: "png",
    }),
  },
];

function randomSeed() {
  return Math.floor(Math.random() * 2147483647);
}

function isHttpUrl(value: string) {
  return /^https?:\/\//i.test(value.trim());
}

function extractImagePayload(output: unknown): { url?: string; base64?: string } | null {
  if (typeof output === "string") {
    const trimmed = output.trim();
    if (!trimmed) {
      return null;
    }

    if (isHttpUrl(trimmed)) {
      return { url: trimmed };
    }

    const base64Match = trimmed.match(/^data:image\/[a-z0-9+.-]+;base64,(.+)$/i);
    if (base64Match?.[1]) {
      return { base64: base64Match[1] };
    }

    const likelyBase64 = /^[A-Za-z0-9+/=\r\n]+$/.test(trimmed) && trimmed.length > 64;
    if (likelyBase64) {
      return { base64: trimmed.replace(/\s+/g, "") };
    }
    return null;
  }

  if (Array.isArray(output)) {
    for (const item of output) {
      const extracted = extractImagePayload(item);
      if (extracted) {
        return extracted;
      }
    }
    return null;
  }

  if (output && typeof output === "object") {
    const record = output as Record<string, unknown>;
    const keys = ["url", "image", "output", "images", "prediction", "data"];

    for (const key of keys) {
      if (!(key in record)) {
        continue;
      }

      const extracted = extractImagePayload(record[key]);
      if (extracted) {
        return extracted;
      }
    }
  }

  return null;
}

async function toImageBuffer(output: unknown) {
  const payload = extractImagePayload(output);
  if (!payload) {
    throw new Error("渲染输出格式异常，未识别到图片数据。");
  }

  if (payload.url) {
    const response = await fetch(payload.url, { cache: "no-store" });
    if (!response.ok) {
      throw new Error(`下载渲染图失败: ${response.status} ${response.statusText}`);
    }
    const arrayBuffer = await response.arrayBuffer();
    return Buffer.from(arrayBuffer);
  }

  if (!payload.base64) {
    throw new Error("渲染输出缺少图片数据。");
  }

  return Buffer.from(payload.base64, "base64");
}

function isNsfwError(error: unknown) {
  if (!(error instanceof Error)) {
    return false;
  }

  const message = error.message.toLowerCase();
  return message.includes("nsfw") || message.includes("safety") || message.includes("content");
}

export async function renderWithFlux(
  schemeId: string,
  options: FluxRenderOptions,
): Promise<FluxRenderResult> {
  const startedAt = Date.now();
  const timeoutMs = options.timeout ?? 120000;
  const baseOptions: Required<
    Pick<
      FluxRenderOptions,
      | "depthImageUrl"
      | "prompt"
      | "negativePrompt"
      | "width"
      | "height"
      | "guidanceScale"
      | "controlnetConditioningScale"
      | "numInferenceSteps"
    >
  > = {
    depthImageUrl: options.depthImageUrl,
    prompt: options.prompt,
    negativePrompt: options.negativePrompt ?? buildNegativePrompt(),
    width: options.width ?? 1024,
    height: options.height ?? 768,
    guidanceScale: options.guidanceScale ?? 7.5,
    controlnetConditioningScale: options.controlnetConditioningScale ?? 0.6,
    numInferenceSteps: options.numInferenceSteps ?? 30,
  };

  const baseSeed = options.seed ?? randomSeed();
  const errors: string[] = [];

  for (const fluxModel of FLUX_MODELS) {
    let seed = baseSeed;
    for (let attempt = 0; attempt < 2; attempt += 1) {
      try {
        const input = fluxModel.buildInput(baseOptions, seed);
        if (!fluxModel.supportsDepth) {
          delete input.control_image;
          delete input.controlnet_conditioning_scale;
        }

        const output = await runPredictionWithRetry(fluxModel.model, input, {
          timeout: timeoutMs,
        });
        const buffer = await toImageBuffer(output);
        const key = `effect-images/${schemeId}/${Date.now()}_v1.png`;
        const imageUrl = await uploadToR2(buffer, key, "image/png");

        return {
          imageUrl,
          prompt: baseOptions.prompt,
          model: fluxModel.model,
          seed,
          processingTimeMs: Date.now() - startedAt,
        };
      } catch (error) {
        const message = error instanceof Error ? error.message : "未知渲染错误";
        errors.push(`${fluxModel.model}: ${message}`);

        if (isNsfwError(error) && attempt === 0) {
          seed = randomSeed();
          continue;
        }

        break;
      }
    }
  }

  throw new Error(`FLUX 渲染失败：${errors.join(" | ")}`);
}
