import { after, NextResponse } from "next/server";
import { estimateDepth } from "@/lib/generation/depthEstimator";
import {
  checkGenerationEnv,
  resolveRenderPipeline,
} from "@/lib/generation/envCheck";
import { renderWithFlux } from "@/lib/generation/fluxRenderer";
import { detectHotspots } from "@/lib/generation/hotspotDetector";
import { buildFluxPrompt } from "@/lib/generation/promptBuilder";
import { runRouteDPipeline } from "@/lib/generation/routeDPipeline";
import { runRouteEPipeline } from "@/lib/generation/routeEPipeline";
import { canGenerate, incrementGeneration } from "@/lib/plan/checkUsage";
import { requireCurrentAppUser } from "@/lib/plan/userProfile";
import { createServiceRoleClient } from "@/lib/supabase/admin";

interface GenerateEffectImageBody {
  scheme_id?: string;
  plan_id?: string;
  room_id?: string;
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
  category: string;
  status: string | null;
}

interface ProductRow {
  id: string;
  name: string;
  category: string;
  width_mm: number;
  depth_mm: number;
  height_mm: number;
}

interface EffectImageRow {
  id: string;
  version: number;
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

function getLatestActiveProductIds(records: SchemeProductRow[] | null) {
  const latestByCategory = new Map<string, string>();

  for (const item of records ?? []) {
    if (!item.product_id || item.status === "abandoned") {
      continue;
    }

    if (!latestByCategory.has(item.category)) {
      latestByCategory.set(item.category, item.product_id);
    }
  }

  return [...new Set(latestByCategory.values())];
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
    throw new Error("Failed to create signed room photo URL.");
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

async function runLegacySchemePipeline(effectImageId: string, schemeId: string) {
  const startedAt = Date.now();
  const supabase = createServiceRoleClient();

  try {
    const { data: scheme, error: schemeError } = await supabase
      .from("schemes")
      .select("id, room_type, style")
      .eq("id", schemeId)
      .single<SchemeRow>();

    if (schemeError || !scheme) {
      throw new Error("Scheme not found.");
    }

    const { data: roomAnalysis, error: roomAnalysisError } = await supabase
      .from("room_analysis")
      .select("photo_url, constraints_json")
      .eq("scheme_id", schemeId)
      .single<RoomAnalysisRow>();

    if (roomAnalysisError || !roomAnalysis) {
      throw new Error("Room analysis record not found.");
    }

    const { data: schemeProducts, error: schemeProductsError } = await supabase
      .from("scheme_products")
      .select("product_id, category, status")
      .eq("scheme_id", schemeId)
      .order("created_at", { ascending: false })
      .returns<SchemeProductRow[]>();

    if (schemeProductsError) {
      throw new Error(schemeProductsError.message);
    }

    const productIds = getLatestActiveProductIds(schemeProducts ?? []);

    let products: ProductRow[] = [];
    if (productIds.length > 0) {
      const { data: rows, error: productsError } = await supabase
        .from("products")
        .select("id, name, category, width_mm, depth_mm, height_mm")
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
        active_products: products.map((item) => ({
          id: item.id,
          name: item.name,
          category: item.category,
          width_mm: item.width_mm,
          depth_mm: item.depth_mm,
          height_mm: item.height_mm,
        })),
      },
      error_message: null,
    });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Effect image generation failed.";

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

async function verifyOwnedPlan(
  supabase: ReturnType<typeof createServiceRoleClient>,
  planId: string,
  userId: string,
) {
  const { data: plan } = await supabase
    .from("furnishing_plans")
    .select("id, room_id")
    .eq("id", planId)
    .maybeSingle<{ id: string; room_id: string }>();

  if (!plan) {
    return false;
  }

  const { data: room } = await supabase
    .from("rooms")
    .select("id, home_id")
    .eq("id", plan.room_id)
    .maybeSingle<{ id: string; home_id: string }>();

  if (!room) {
    return false;
  }

  const { data: home } = await supabase
    .from("homes")
    .select("id")
    .eq("id", room.home_id)
    .eq("user_id", userId)
    .maybeSingle<{ id: string }>();

  return Boolean(home);
}

async function getNextVersion(
  supabase: ReturnType<typeof createServiceRoleClient>,
  field: "scheme_id" | "plan_id",
  recordId: string,
) {
  const { data: latestVersion } = await supabase
    .from("effect_images")
    .select("version")
    .eq(field, recordId)
    .order("version", { ascending: false })
    .limit(1);

  return typeof latestVersion?.[0]?.version === "number"
    ? latestVersion[0].version + 1
    : 1;
}

async function createPendingEffectTask(
  supabase: ReturnType<typeof createServiceRoleClient>,
  payload: {
    schemeId?: string;
    planId?: string;
    generationParams?: Record<string, unknown>;
  },
) {
  const nextVersion = await getNextVersion(
    supabase,
    payload.planId ? "plan_id" : "scheme_id",
    payload.planId ?? payload.schemeId ?? "",
  );

  const { data: effectImage, error } = await supabase
    .from("effect_images")
    .insert({
      scheme_id: payload.schemeId ?? null,
      plan_id: payload.planId ?? null,
      image_url: "",
      generation_status: "pending",
      generation_params: payload.generationParams ?? {
        started_at: new Date().toISOString(),
      },
      version: nextVersion,
    })
    .select("id, version")
    .single<EffectImageRow>();

  if (error || !effectImage) {
    throw new Error(error?.message ?? "Failed to create effect image task.");
  }

  return effectImage;
}

export async function POST(request: Request) {
  try {
    const envCheck = checkGenerationEnv();
    if (!envCheck.ready) {
      return NextResponse.json(
        {
          success: false,
          error: `Missing generation environment variables: ${envCheck.missing.join(", ")}`,
          missing: envCheck.missing,
        },
        { status: 400 },
      );
    }

    const body = (await request.json()) as GenerateEffectImageBody;
    const planId = body.plan_id?.trim();
    const schemeId = body.scheme_id?.trim();

    if (!planId && !schemeId) {
      return NextResponse.json(
        { success: false, error: "Missing plan_id or scheme_id." },
        { status: 400 },
      );
    }

    const { authUser, appUser, adminSupabase: supabase } =
      await requireCurrentAppUser();
    const generationCheck = canGenerate(appUser);

    if (!generationCheck.allowed) {
      return NextResponse.json(
        {
          success: false,
          code: "PAYWALL_LIMIT",
          reason: generationCheck.reason,
          currentPlan: generationCheck.currentPlan,
          suggestedPlan: generationCheck.suggestedPlan,
        },
        { status: 403 },
      );
    }

    if (planId) {
      const selectedPipeline = resolveRenderPipeline();
      const hasAccess = await verifyOwnedPlan(supabase, planId, authUser.id);
      if (!hasAccess) {
        return NextResponse.json(
          { success: false, error: "Plan not found or access denied." },
          { status: 404 },
        );
      }

      const effectImage = await createPendingEffectTask(supabase, {
        planId,
        generationParams: {
          started_at: new Date().toISOString(),
          pipeline: selectedPipeline,
          progress: {
            stage: "classifying",
            message: "正在仔细研究这件家具...",
          },
        },
      });

      try {
        await incrementGeneration(authUser.id);
      } catch (error) {
        await supabase.from("effect_images").delete().eq("id", effectImage.id);
        throw error;
      }

      schedulePipeline(() =>
        selectedPipeline === "route_e"
          ? runRouteEPipeline(effectImage.id, planId)
          : runRouteDPipeline(effectImage.id, planId),
      );

      return NextResponse.json({
        success: true,
        effectImageId: effectImage.id,
        version: effectImage.version,
      });
    }

    const { data: ownedSchemes, error: ownedSchemeError } = await supabase
      .from("schemes")
      .select("id")
      .eq("id", schemeId)
      .eq("user_id", authUser.id)
      .limit(1);

    if (ownedSchemeError || !ownedSchemes?.length) {
      return NextResponse.json(
        { success: false, error: "Scheme not found or access denied." },
        { status: 404 },
      );
    }

    const effectImage = await createPendingEffectTask(supabase, {
      schemeId,
      generationParams: {
        started_at: new Date().toISOString(),
      },
    });

    try {
      await incrementGeneration(authUser.id);
    } catch (error) {
      await supabase.from("effect_images").delete().eq("id", effectImage.id);
      throw error;
    }

    schedulePipeline(() => runLegacySchemePipeline(effectImage.id, schemeId!));

    return NextResponse.json({
      success: true,
      effectImageId: effectImage.id,
      version: effectImage.version,
    });
  } catch (error) {
    if (error instanceof Error && error.message === "Authentication required.") {
      return NextResponse.json(
        { success: false, error: "Please sign in first." },
        { status: 401 },
      );
    }

    const message =
      error instanceof Error
        ? error.message
        : "Failed to create effect image task. Please try again later.";

    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
}
