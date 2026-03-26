import { NextResponse } from "next/server";
import { createServiceRoleClient } from "@/lib/supabase/admin";

type RouteFStage = "analyzing" | "preparing" | "generating" | "done";

interface EffectImageStatusRow {
  generation_status: string;
  image_url: string | null;
  error_message: string | null;
  version: number;
  generation_params:
    | {
        progress?: {
          stage?: string;
          message?: string;
          currentItem?: string;
          currentIndex?: number;
          totalItems?: number;
          previewUrl?: string | null;
        };
        roughPreviewUrl?: string | null;
        prompt?: string | null;
        maskUrl?: string | null;
        model?: string | null;
        productDescription?: string | null;
      }
    | null;
}

function normalizeStage(value: string | undefined | null): RouteFStage | null {
  if (
    value === "analyzing" ||
    value === "preparing" ||
    value === "generating" ||
    value === "done"
  ) {
    return value;
  }

  return null;
}

function mapStatusToStage(status: string): RouteFStage {
  switch (status) {
    case "done":
      return "done";
    case "generating":
      return "generating";
    case "preparing":
      return "preparing";
    default:
      return "analyzing";
  }
}

export async function GET(request: Request) {
  try {
    const url = new URL(request.url);
    const planId = url.searchParams.get("plan_id")?.trim();

    if (!planId) {
      return NextResponse.json(
        { success: false, error: "Missing plan_id." },
        { status: 400 },
      );
    }

    const supabase = createServiceRoleClient();
    const { data: record, error } = await supabase
      .from("effect_images")
      .select("generation_status, image_url, error_message, version, generation_params")
      .eq("plan_id", planId)
      .order("version", { ascending: false })
      .limit(1)
      .maybeSingle<EffectImageStatusRow>();

    if (error) {
      throw new Error(error.message);
    }

    if (!record) {
      return NextResponse.json({
        success: true,
        status: "pending",
        stage: "analyzing",
        imageUrl: null,
        previewUrl: null,
        currentItem: null,
        currentIndex: null,
        totalItems: null,
        errorMessage: null,
        version: 0,
        params: null,
      });
    }

    const progress = record.generation_params?.progress;
    const stage =
      normalizeStage(progress?.stage) ?? mapStatusToStage(record.generation_status);

    return NextResponse.json({
      success: true,
      status: record.generation_status,
      stage,
      imageUrl: record.image_url || null,
      previewUrl: progress?.previewUrl ?? record.generation_params?.roughPreviewUrl ?? null,
      currentItem: progress?.currentItem ?? null,
      currentIndex: progress?.currentIndex ?? null,
      totalItems: progress?.totalItems ?? null,
      errorMessage: record.error_message || null,
      version: record.version,
      params: record.generation_params,
    });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Failed to read generation status.";
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
}
