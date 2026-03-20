import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

interface EffectImageStatusRow {
  generation_status: string;
  image_url: string | null;
  error_message: string | null;
  version: number;
  generation_params: Record<string, unknown> | null;
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

export async function GET(request: Request) {
  try {
    const url = new URL(request.url);
    const schemeId = url.searchParams.get("scheme_id")?.trim();

    if (!schemeId) {
      return NextResponse.json(
        { success: false, error: "缺少 scheme_id。" },
        { status: 400 },
      );
    }

    const supabase = createServiceRoleClient();
    const { data: record, error } = await supabase
      .from("effect_images")
      .select("generation_status, image_url, error_message, version, generation_params")
      .eq("scheme_id", schemeId)
      .order("version", { ascending: false })
      .limit(1)
      .single<EffectImageStatusRow>();

    if (error || !record) {
      return NextResponse.json(
        {
          success: true,
          status: "pending",
          imageUrl: null,
          errorMessage: null,
          version: 0,
          params: null,
        },
        { status: 200 },
      );
    }

    return NextResponse.json({
      success: true,
      status: record.generation_status,
      imageUrl: record.image_url || null,
      errorMessage: record.error_message || null,
      version: record.version,
      params: record.generation_params,
    });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "读取生成状态失败。";
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
}

