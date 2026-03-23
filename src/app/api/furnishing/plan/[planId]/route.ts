import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

async function getOwnedPlan(
  planId: string,
  userId: string,
  withItems = false,
) {
  const supabase = await createClient();
  const planQuery = withItems
    ? supabase
        .from("furnishing_plans")
        .select(
          "*, rooms(id, name, room_type, original_photo_url, current_photo_url), furnishing_plan_items(*, products(name, image_url, price_min, price_max, width_mm, depth_mm, height_mm, brand, source_url))",
        )
        .eq("id", planId)
        .single()
    : supabase.from("furnishing_plans").select("*").eq("id", planId).single();

  const { data: plan, error } = await planQuery;

  if (error || !plan) {
    return null;
  }

  const { data: room, error: roomError } = await supabase
    .from("rooms")
    .select("id, home_id")
    .eq("id", plan.room_id)
    .single();

  if (roomError || !room) {
    return null;
  }

  const { data: home, error: homeError } = await supabase
    .from("homes")
    .select("id")
    .eq("id", room.home_id)
    .eq("user_id", userId)
    .single();

  if (homeError || !home) {
    return null;
  }

  return plan;
}

// GET /api/furnishing/plan/[planId] - get plan with all items
export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ planId: string }> },
) {
  try {
    const { planId } = await params;
    const supabase = await createClient();
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });
    }

    const plan = await getOwnedPlan(planId, user.id, true);

    if (!plan) {
      return NextResponse.json({ success: false, error: "Plan not found" }, { status: 404 });
    }

    return NextResponse.json({ success: true, data: plan });
  } catch (error) {
    return NextResponse.json({ success: false, error: String(error) }, { status: 500 });
  }
}

// PATCH /api/furnishing/plan/[planId] - update plan (budget, style, status)
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ planId: string }> },
) {
  try {
    const { planId } = await params;
    const supabase = await createClient();
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });
    }

    const ownedPlan = await getOwnedPlan(planId, user.id);

    if (!ownedPlan) {
      return NextResponse.json({ success: false, error: "Plan not found" }, { status: 404 });
    }

    const body = await request.json();
    const allowedFields = ["name", "total_budget", "current_total", "style_preference", "status"];

    const updates: Record<string, unknown> = { updated_at: new Date().toISOString() };

    for (const field of allowedFields) {
      if (body[field] !== undefined) {
        updates[field] = body[field];
      }
    }

    const { data: plan, error } = await supabase
      .from("furnishing_plans")
      .update(updates)
      .eq("id", planId)
      .select()
      .single();

    if (error || !plan) {
      return NextResponse.json({ success: false, error: "Update failed" }, { status: 500 });
    }

    return NextResponse.json({ success: true, data: plan });
  } catch (error) {
    return NextResponse.json({ success: false, error: String(error) }, { status: 500 });
  }
}

// DELETE /api/furnishing/plan/[planId]
export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ planId: string }> },
) {
  try {
    const { planId } = await params;
    const supabase = await createClient();
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });
    }

    const ownedPlan = await getOwnedPlan(planId, user.id);

    if (!ownedPlan) {
      return NextResponse.json({ success: false, error: "Plan not found" }, { status: 404 });
    }

    const { error } = await supabase.from("furnishing_plans").delete().eq("id", planId);

    if (error) {
      return NextResponse.json({ success: false, error: error.message }, { status: 500 });
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    return NextResponse.json({ success: false, error: String(error) }, { status: 500 });
  }
}
