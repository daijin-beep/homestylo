import { NextRequest, NextResponse } from "next/server";
import { getOwnedPlanRecord } from "@/lib/furnishing/ownership";
import { recalculatePlanCurrentTotal } from "@/lib/furnishing/planTotals";
import { createClient } from "@/lib/supabase/server";

interface CreateFurnishingItemBody {
  plan_id?: string;
  category?: string;
  custom_name?: string;
  custom_image_url?: string;
  custom_width_mm?: number;
  custom_depth_mm?: number;
  custom_height_mm?: number;
  price?: number;
  custom_source_url?: string;
  source?: "user_uploaded";
}

function parseRequiredPositiveNumber(label: string, value: unknown) {
  const parsed =
    typeof value === "number" ? value : typeof value === "string" ? Number(value) : Number.NaN;

  if (!Number.isFinite(parsed) || parsed <= 0) {
    throw new Error(`${label} must be a positive number.`);
  }

  return parsed;
}

function parseOptionalPositiveNumber(label: string, value: unknown) {
  if (value == null || value === "") {
    return null;
  }

  const parsed =
    typeof value === "number" ? value : typeof value === "string" ? Number(value) : Number.NaN;

  if (!Number.isFinite(parsed) || parsed <= 0) {
    throw new Error(`${label} must be a positive number when provided.`);
  }

  return parsed;
}

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

    const body = (await request.json()) as CreateFurnishingItemBody;
    const planId = body.plan_id?.trim();
    const category = body.category?.trim();
    const customName = body.custom_name?.trim();
    const customImageUrl = body.custom_image_url?.trim();
    const customSourceUrl = body.custom_source_url?.trim() || null;
    const source = body.source ?? "user_uploaded";

    if (!planId || !category || !customName || !customImageUrl) {
      return NextResponse.json(
        {
          success: false,
          error:
            "plan_id, category, custom_name, and custom_image_url are required.",
        },
        { status: 400 },
      );
    }

    if (source !== "user_uploaded") {
      return NextResponse.json(
        { success: false, error: 'source must be "user_uploaded".' },
        { status: 400 },
      );
    }

    const customWidthMm = parseRequiredPositiveNumber("custom_width_mm", body.custom_width_mm);
    const customDepthMm = parseRequiredPositiveNumber("custom_depth_mm", body.custom_depth_mm);
    const customHeightMm = parseRequiredPositiveNumber("custom_height_mm", body.custom_height_mm);
    const price = parseOptionalPositiveNumber("price", body.price);

    const ownedPlan = await getOwnedPlanRecord(supabase, user.id, planId);

    if (!ownedPlan) {
      return NextResponse.json({ success: false, error: "Plan not found" }, { status: 404 });
    }

    const { data: existingItems } = await supabase
      .from("furnishing_plan_items")
      .select("sort_order")
      .eq("plan_id", planId)
      .order("sort_order", { ascending: false })
      .limit(1);

    const nextOrder =
      existingItems && existingItems.length > 0 ? existingItems[0].sort_order + 1 : 0;

    const { data: item, error } = await supabase
      .from("furnishing_plan_items")
      .insert({
        plan_id: planId,
        category,
        source,
        locked: true,
        product_id: null,
        custom_name: customName,
        custom_image_url: customImageUrl,
        custom_source_url: customSourceUrl,
        custom_width_mm: customWidthMm,
        custom_depth_mm: customDepthMm,
        custom_height_mm: customHeightMm,
        price,
        sort_order: nextOrder,
      })
      .select()
      .single();

    if (error || !item) {
      return NextResponse.json(
        { success: false, error: error?.message ?? "Failed to create item." },
        { status: 500 },
      );
    }

    await recalculatePlanCurrentTotal(supabase, planId);

    return NextResponse.json({ success: true, data: item }, { status: 201 });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    return NextResponse.json({ success: false, error: message }, { status: 400 });
  }
}
