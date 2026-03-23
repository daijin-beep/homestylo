import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getOwnedPlanRecord } from "@/lib/furnishing/ownership";
import { recalculatePlanCurrentTotal } from "@/lib/furnishing/planTotals";

// POST /api/furnishing/item - add item to plan
export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient();
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });
    }

    const body = await request.json();
    const {
      plan_id,
      category,
      source = "user_uploaded",
      product_id,
      custom_name,
      custom_image_url,
      custom_source_url,
      custom_width_mm,
      custom_depth_mm,
      custom_height_mm,
      price,
    } = body as Record<string, unknown>;

    if (!plan_id || !category) {
      return NextResponse.json(
        { success: false, error: "plan_id and category are required" },
        { status: 400 },
      );
    }

    const ownedPlan = await getOwnedPlanRecord(supabase, user.id, String(plan_id));

    if (!ownedPlan) {
      return NextResponse.json({ success: false, error: "Plan not found" }, { status: 404 });
    }

    const { data: existingItems } = await supabase
      .from("furnishing_plan_items")
      .select("sort_order")
      .eq("plan_id", String(plan_id))
      .order("sort_order", { ascending: false })
      .limit(1);

    const nextOrder =
      existingItems && existingItems.length > 0 ? existingItems[0].sort_order + 1 : 0;

    const normalizedSource = String(source);
    const { data: item, error } = await supabase
      .from("furnishing_plan_items")
      .insert({
        plan_id,
        category,
        source: normalizedSource,
        locked: normalizedSource === "user_uploaded",
        product_id: product_id || null,
        custom_name: custom_name || null,
        custom_image_url: custom_image_url || null,
        custom_source_url: custom_source_url || null,
        custom_width_mm: custom_width_mm || null,
        custom_depth_mm: custom_depth_mm || null,
        custom_height_mm: custom_height_mm || null,
        price: price || null,
        sort_order: nextOrder,
      })
      .select()
      .single();

    if (error) {
      return NextResponse.json({ success: false, error: error.message }, { status: 500 });
    }

    await recalculatePlanCurrentTotal(supabase, String(plan_id));

    return NextResponse.json({ success: true, data: item }, { status: 201 });
  } catch (error) {
    return NextResponse.json({ success: false, error: String(error) }, { status: 500 });
  }
}
