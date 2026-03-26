import { NextResponse } from "next/server";
import { canGenerate } from "@/lib/plan/checkUsage";
import { requireCurrentAppUser } from "@/lib/plan/userProfile";
import { createServiceRoleClient } from "@/lib/supabase/admin";

interface GenerateEffectImageBody {
  plan_id?: string;
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

export async function POST(request: Request) {
  try {
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

    return NextResponse.json(
      { success: false, error: "Route F pipeline not yet implemented" },
      { status: 501 },
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
