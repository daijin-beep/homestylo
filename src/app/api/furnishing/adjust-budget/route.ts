import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { allocateBudget } from "@/lib/recommendation/budgetAllocator";
import { getOwnedPlanRecord } from "@/lib/furnishing/ownership";
import type { FurnishingPlanItem } from "@/lib/types";

// POST /api/furnishing/adjust-budget - recalculate budget allocation
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
    const { plan_id, new_budget } = body as { plan_id?: string; new_budget?: number };

    if (!plan_id || new_budget === undefined) {
      return NextResponse.json(
        { success: false, error: "plan_id and new_budget are required" },
        { status: 400 },
      );
    }

    const ownedPlan = await getOwnedPlanRecord(supabase, user.id, plan_id);

    if (!ownedPlan) {
      return NextResponse.json({ success: false, error: "Plan not found" }, { status: 404 });
    }

    const { error: updatePlanError } = await supabase
      .from("furnishing_plans")
      .update({ total_budget: new_budget, updated_at: new Date().toISOString() })
      .eq("id", plan_id);

    if (updatePlanError) {
      return NextResponse.json({ success: false, error: updatePlanError.message }, { status: 500 });
    }

    const { data: items, error: itemsError } = await supabase
      .from("furnishing_plan_items")
      .select("*")
      .eq("plan_id", plan_id)
      .neq("status", "abandoned");

    if (itemsError) {
      return NextResponse.json({ success: false, error: itemsError.message }, { status: 500 });
    }

    const typedItems = (items || []) as FurnishingPlanItem[];
    const unlockedCategories = [
      ...new Set(typedItems.filter((item) => !item.locked).map((item) => item.category)),
    ];

    const result = allocateBudget(new_budget, typedItems, unlockedCategories);

    const responseData = {
      allocations: result.allocations,
      remaining: result.remaining,
      locked_total: new_budget - result.remaining,
    };

    if (!result.success) {
      return NextResponse.json(
        { success: false, error: result.error, data: responseData },
        { status: 400 },
      );
    }

    for (const allocation of result.allocations) {
      const { error } = await supabase
        .from("furnishing_plan_items")
        .update({
          price_range_min: allocation.price_range.min,
          price_range_max: allocation.price_range.max,
        })
        .eq("plan_id", plan_id)
        .eq("category", allocation.category)
        .eq("locked", false)
        .neq("status", "abandoned");

      if (error) {
        return NextResponse.json({ success: false, error: error.message }, { status: 500 });
      }
    }

    return NextResponse.json({
      success: true,
      data: responseData,
    });
  } catch (error) {
    return NextResponse.json({ success: false, error: String(error) }, { status: 500 });
  }
}
