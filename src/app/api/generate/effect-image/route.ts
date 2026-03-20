import { after, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { estimateDepth } from "@/lib/generation/depthEstimator";
import { renderWithFlux } from "@/lib/generation/fluxRenderer";
import { detectHotspots } from "@/lib/generation/hotspotDetector";
import { buildFluxPrompt } from "@/lib/generation/promptBuilder";
import { checkGenerationEnv } from "@/lib/generation/envCheck";

interface GenerateEffectImageBody {
  scheme_id?: string;
}

interface SchemeRow {
  id: string;
  room_type: string;
  style: string | null;
}

interface RoomAnalysisRow {
  photo_url: string;
  constraints_json: {
    sofa_wall_width_mm?: number | null;
    room_depth_mm?: number | null;
  } | null;
}

interface SchemeProductRow {
  product_id: string | null;
}

interface ProductRow {
  id: string;
  name: string;
  category: string;
  width_mm: number;
  depth_mm: number;
}

interface EffectImageRow {
  id: string;
  version: number;
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

function ensureNumber(value: unknown, fallback: number) {
  if (typeof value === "number" && Number.isFinite(value) && value > 0) {
    return value;
  }

  return fallback;
}

function ensureNullableNumber(value: unknown) {
  if (typeof value === "number" && Number.isFinite(value) && value > 0) {
    return value;
  }

  return null;
}

async function resolveRoomPhotoUrl(
  photoUrl: string,
  supabase: ReturnType<typeof createServiceRoleClient>,
) {
  if (/^https?:\/\//i.test(photoUrl)) {
    return photoUrl;
  }

  const { data, error } = await supabase.storage
    .from("room-photos")
    .createSignedUrl(photoUrl, 3600);

  if (error || !data?.signedUrl) {
    throw new Error("房间照片签名 URL 生成失败。");
  }

  return data.signedUrl;
}

async function updateEffectStatus(
  supabase: ReturnType<typeof createServiceRoleClient>,
  effectImageId: string,
  payload: Record<string, unknown>,
) {
  const { error } = await supabase
    .from("effect_images")
    .update(payload)
    .eq("id", effectImageId);

  if (error) {
    throw new Error(error.message);
  }
}

async function runPipeline(effectImageId: string, schemeId: string) {
  const startedAt = Date.now();
  const supabase = createServiceRoleClient();

  try {
    const { data: scheme, error: schemeError } = await supabase
      .from("schemes")
      .select("id, room_type, style")
      .eq("id", schemeId)
      .single<SchemeRow>();

    if (schemeError || !scheme) {
      throw new Error("方案不存在。");
    }

    const { data: roomAnalysis, error: roomAnalysisError } = await supabase
      .from("room_analysis")
      .select("photo_url, constraints_json")
      .eq("scheme_id", schemeId)
      .single<RoomAnalysisRow>();

    if (roomAnalysisError || !roomAnalysis) {
      throw new Error("空间分析记录不存在。");
    }

    const { data: schemeProducts, error: schemeProductsError } = await supabase
      .from("scheme_products")
      .select("product_id")
      .eq("scheme_id", schemeId);

    if (schemeProductsError) {
      throw new Error(schemeProductsError.message);
    }

    const productIds = (schemeProducts as SchemeProductRow[] | null)
      ?.map((item) => item.product_id)
      .filter((item): item is string => typeof item === "string");

    let products: ProductRow[] = [];
    if (productIds && productIds.length > 0) {
      const { data: rows, error: productsError } = await supabase
        .from("products")
        .select("id, name, category, width_mm, depth_mm")
        .in("id", productIds)
        .returns<ProductRow[]>();

      if (productsError) {
        throw new Error(productsError.message);
      }

      products = rows ?? [];
    }

    const signedPhotoUrl = await resolveRoomPhotoUrl(roomAnalysis.photo_url, supabase);

    await updateEffectStatus(supabase, effectImageId, { generation_status: "depth" });
    const depth = await estimateDepth(signedPhotoUrl, {
      timeout: 90000,
      schemeId,
    });

    const prompt = buildFluxPrompt({
      roomType: scheme.room_type,
      style: scheme.style ?? "dopamine",
      furniture: products.map((item) => ({
        name: item.name,
        category: item.category,
        widthMm: item.width_mm,
        depthMm: item.depth_mm,
      })),
      roomWidthMm: ensureNumber(roomAnalysis.constraints_json?.sofa_wall_width_mm, 3600),
      roomDepthMm: ensureNullableNumber(roomAnalysis.constraints_json?.room_depth_mm),
    });

    await updateEffectStatus(supabase, effectImageId, { generation_status: "flux" });
    const render = await renderWithFlux(schemeId, {
      depthImageUrl: depth.depthImageUrl,
      prompt,
      width: 1024,
      height: 768,
    });

    await updateEffectStatus(supabase, effectImageId, { generation_status: "hotspot" });
    const hotspots = await detectHotspots(
      render.imageUrl,
      products.map((item) => ({
        id: item.id,
        name: item.name,
        category: item.category,
      })),
    );

    await updateEffectStatus(supabase, effectImageId, {
      image_url: render.imageUrl,
      hotspot_map: hotspots.hotspots,
      generation_status: "done",
      generation_params: {
        prompt: render.prompt,
        seed: render.seed,
        model: render.model,
        depth_model: depth.model,
        depth_time_ms: depth.processingTimeMs,
        render_time_ms: render.processingTimeMs,
        hotspot_time_ms: hotspots.processingTimeMs,
        total_time_ms: Date.now() - startedAt,
      },
      error_message: null,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "效果图生成失败。";
    await updateEffectStatus(supabase, effectImageId, {
      generation_status: "failed",
      error_message: message,
      generation_params: {
        failed_at: new Date().toISOString(),
        total_time_ms: Date.now() - startedAt,
      },
    });
  }
}

function schedulePipeline(task: () => Promise<void>) {
  if (typeof after === "function") {
    after(() => {
      void task();
    });
    return;
  }

  void task();
}

export async function POST(request: Request) {
  try {
    const envCheck = checkGenerationEnv();
    if (!envCheck.ready) {
      return NextResponse.json(
        {
          success: false,
          error: `生成环境变量缺失: ${envCheck.missing.join(", ")}`,
          missing: envCheck.missing,
        },
        { status: 400 },
      );
    }

    const body = (await request.json()) as GenerateEffectImageBody;
    const schemeId = body.scheme_id?.trim();

    if (!schemeId) {
      return NextResponse.json(
        { success: false, error: "缺少 scheme_id。" },
        { status: 400 },
      );
    }

    const supabase = createServiceRoleClient();

    const { data: latestVersion } = await supabase
      .from("effect_images")
      .select("version")
      .eq("scheme_id", schemeId)
      .order("version", { ascending: false })
      .limit(1);

    const nextVersion =
      typeof latestVersion?.[0]?.version === "number"
        ? latestVersion[0].version + 1
        : 1;

    const { data: effectImage, error: insertError } = await supabase
      .from("effect_images")
      .insert({
        scheme_id: schemeId,
        image_url: "",
        generation_status: "pending",
        generation_params: {
          started_at: new Date().toISOString(),
        },
        version: nextVersion,
      })
      .select("id, version")
      .single<EffectImageRow>();

    if (insertError || !effectImage) {
      throw new Error(insertError?.message ?? "创建效果图任务失败。");
    }

    schedulePipeline(() => runPipeline(effectImage.id, schemeId));

    return NextResponse.json({
      success: true,
      effectImageId: effectImage.id,
      version: effectImage.version,
    });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "创建效果图任务失败，请稍后重试。";
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
}
