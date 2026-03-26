import "server-only";

import sharp from "sharp";
import { runPredictionWithRetry } from "@/lib/api/replicate";
import { downloadModelOutput } from "@/lib/api/replicateUtils";
import { uploadToR2 } from "@/lib/api/r2";

export interface FluxFillProOptions {
  imageUrl: string;
  maskUrl: string;
  prompt: string;
  guidance?: number;
  steps?: number;
  planId: string;
  timeout?: number;
}

export interface FluxFillProResult {
  imageUrl: string;
  model: string;
  processingTimeMs: number;
}

interface FluxModelConfig {
  model: string;
  buildInput: (options: FluxFillProOptions) => Record<string, unknown>;
}

const FLUX_FILL_MODELS: FluxModelConfig[] = [
  {
    model: "black-forest-labs/flux-fill-pro",
    buildInput: (options) => ({
      image: options.imageUrl,
      mask: options.maskUrl,
      prompt: options.prompt,
      guidance: options.guidance ?? 3.5,
      steps: options.steps ?? 50,
      safety_tolerance: 4,
      prompt_upsampling: false,
      output_format: "png",
    }),
  },
  {
    model: "black-forest-labs/flux-fill-dev",
    buildInput: (options) => ({
      image: options.imageUrl,
      mask: options.maskUrl,
      prompt: options.prompt,
      guidance: options.guidance ?? 3.5,
      steps: options.steps ?? 50,
      safety_tolerance: 4,
      prompt_upsampling: false,
      output_format: "png",
    }),
  },
];

export async function generateWithFluxFillPro(
  options: FluxFillProOptions,
): Promise<FluxFillProResult> {
  const startedAt = Date.now();
  const timeout = options.timeout ?? 180000;
  const errors: string[] = [];

  for (const [index, modelConfig] of FLUX_FILL_MODELS.entries()) {
    try {
      const output = await runPredictionWithRetry(
        modelConfig.model,
        modelConfig.buildInput(options),
        {
          timeout,
          maxRetries: 1,
        },
      );

      const downloaded = await downloadModelOutput(output);
      const normalizedBuffer = Buffer.from(
        await sharp(downloaded.buffer)
          .png()
          .toBuffer(),
      );
      const imageUrl = await uploadToR2(
        normalizedBuffer,
        `route-f/${options.planId}/effect-${Date.now()}.png`,
        "image/png",
      );

      return {
        imageUrl,
        model: modelConfig.model,
        processingTimeMs: Date.now() - startedAt,
      };
    } catch (error) {
      const message = error instanceof Error ? error.message : "unknown FLUX Fill Pro error";
      errors.push(`${modelConfig.model}: ${message}`);
      console.error("[fluxFillPro] model attempt failed", {
        model: modelConfig.model,
        imageUrl: options.imageUrl,
        maskUrl: options.maskUrl,
        error: message,
      });

      if (index < FLUX_FILL_MODELS.length - 1) {
        await new Promise((resolve) => setTimeout(resolve, 2000));
      }
    }
  }

  throw new Error(`FLUX Fill Pro generation failed: ${errors.join(" | ")}`);
}
