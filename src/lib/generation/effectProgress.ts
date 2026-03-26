import "server-only";

import { createServiceRoleClient } from "@/lib/supabase/admin";

export type RouteFProgressStage = "analyzing" | "preparing" | "generating" | "done";

export interface EffectGenerationParams {
  started_at?: string;
  pipeline?: string;
  maskUrl?: string | null;
  prompt?: string | null;
  productDescription?: string | null;
  model?: string | null;
  roughPreviewUrl?: string | null;
  failed_at?: string;
  processingTimeMs?: number;
  progress?: {
    stage: RouteFProgressStage;
    message?: string;
    currentItem?: string;
    currentIndex?: number;
    totalItems?: number;
    previewUrl?: string | null;
  };
}

export async function updateEffectProgress(
  effectImageId: string,
  payload: {
    generationStatus: string;
    progress?: EffectGenerationParams["progress"];
    imageUrl?: string | null;
    extraParams?: Partial<EffectGenerationParams>;
    errorMessage?: string | null;
  },
) {
  const supabase = createServiceRoleClient();
  const { data: record } = await supabase
    .from("effect_images")
    .select("generation_params")
    .eq("id", effectImageId)
    .maybeSingle<{ generation_params: EffectGenerationParams | null }>();

  const nextParams: EffectGenerationParams = {
    ...(record?.generation_params ?? {}),
    ...(payload.extraParams ?? {}),
  };

  if (payload.progress) {
    nextParams.progress = payload.progress;
  }

  const { error } = await supabase
    .from("effect_images")
    .update({
      generation_status: payload.generationStatus,
      image_url: payload.imageUrl ?? null,
      generation_params: nextParams,
      error_message: payload.errorMessage ?? null,
    })
    .eq("id", effectImageId);

  if (error) {
    throw new Error(error.message);
  }
}
