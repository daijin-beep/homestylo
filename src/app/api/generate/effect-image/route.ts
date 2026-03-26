import { after, NextResponse } from "next/server";
import { checkGenerationEnv } from "@/lib/generation/envCheck";
import { runRouteFPipeline } from "@/lib/generation/routeFPipeline";
import { canGenerate, incrementGeneration } from "@/lib/plan/checkUsage";
import { requireCurrentAppUser } from "@/lib/plan/userProfile";
import { createServiceRoleClient } from "@/lib/supabase/admin";

interface GenerateEffectImageBody {
  plan_id?: string;
}

interface EffectImageRow {
  id: string;
  version: number;
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
  planId: string,
) {
  const { data: latestVersion } = await supabase
    .from("effect_images")
    .select("version")
    .eq("plan_id", planId)
    .order("version", { ascending: false })
    .limit(1);

  return typeof latestVersion?.[0]?.version === "number"
    ? latestVersion[0].version + 1
    : 1;
}

async function createPendingEffectTask(
  supabase: ReturnType<typeof createServiceRoleClient>,
  planId: string,
) {
  const nextVersion = await getNextVersion(supabase, planId);

  const { data: effectImage, error } = await supabase
    .from("effect_images")
    .insert({
      scheme_id: null,
      plan_id: planId,
      image_url: "",
      generation_status: "pending",
      generation_params: {
        started_at: new Date().toISOString(),
        pipeline: "route_f",
        progress: {
          stage: "analyzing",
          message: "Analyzing your room space...",
        },
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

    if (!planId) {
      return NextResponse.json(
        { success: false, error: "Missing plan_id." },
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

    const hasAccess = await verifyOwnedPlan(supabase, planId, authUser.id);
    if (!hasAccess) {
      return NextResponse.json(
        { success: false, error: "Plan not found or access denied." },
        { status: 404 },
      );
    }

    const effectImage = await createPendingEffectTask(supabase, planId);

    try {
      await incrementGeneration(authUser.id);
    } catch (error) {
      await supabase.from("effect_images").delete().eq("id", effectImage.id);
      throw error;
    }

    schedulePipeline(() => runRouteFPipeline(effectImage.id, planId));

    return NextResponse.json(
      {
        success: true,
        effectImageId: effectImage.id,
        version: effectImage.version,
      },
      { status: 202 },
    );
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
