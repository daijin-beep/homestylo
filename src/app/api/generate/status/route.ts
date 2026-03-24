import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

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
      }
    | null;
  hotspot_map:
    | Array<{
        productId?: string;
        product_id?: string;
        label?: string;
        x?: number;
        y?: number;
        width?: number;
        height?: number;
        confidence?: number;
      }>
    | null;
}

function createServiceRoleClient() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!supabaseUrl || !serviceRoleKey) {
    throw new Error("缺少 Supabase service role 环境变量。");
  }

  return createClient(supabaseUrl, serviceRoleKey, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
    },
  });
}

function mapLegacyStage(status: string) {
  switch (status) {
    case "depth":
      return "analyzing";
    case "flux":
      return "placing";
    case "hotspot":
      return "refining";
    case "done":
      return "done";
    default:
      return "classifying";
  }
}

export async function GET(request: Request) {
  try {
    const url = new URL(request.url);
    const schemeId = url.searchParams.get("scheme_id")?.trim();
    const planId = url.searchParams.get("plan_id")?.trim();

    if (!schemeId && !planId) {
      return NextResponse.json(
        { success: false, error: "缺少 scheme_id 或 plan_id。" },
        { status: 400 },
      );
    }

    const supabase = createServiceRoleClient();
    let query = supabase
      .from("effect_images")
      .select(
        "generation_status, image_url, error_message, version, generation_params, hotspot_map",
      )
      .order("version", { ascending: false })
      .limit(1);

    query = planId ? query.eq("plan_id", planId) : query.eq("scheme_id", schemeId!);

    const { data: record, error } = await query.single<EffectImageStatusRow>();

    if (error || !record) {
      return NextResponse.json(
        {
          success: true,
          status: "pending",
          stage: "classifying",
          imageUrl: null,
          previewUrl: null,
          currentItem: null,
          currentIndex: null,
          totalItems: null,
          errorMessage: null,
          version: 0,
          params: null,
          hotspots: [],
        },
        { status: 200 },
      );
    }

    const progress = record.generation_params?.progress;

    return NextResponse.json({
      success: true,
      status: record.generation_status,
      stage: progress?.stage ?? mapLegacyStage(record.generation_status),
      imageUrl: record.image_url || null,
      previewUrl: progress?.previewUrl ?? record.generation_params?.roughPreviewUrl ?? null,
      currentItem: progress?.currentItem ?? null,
      currentIndex: progress?.currentIndex ?? null,
      totalItems: progress?.totalItems ?? null,
      errorMessage: record.error_message || null,
      version: record.version,
      params: record.generation_params,
      hotspots: record.hotspot_map ?? [],
    });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "读取生成状态失败。";
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
}
