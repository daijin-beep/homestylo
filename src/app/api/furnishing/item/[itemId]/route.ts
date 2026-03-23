import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getOwnedItemRecord } from "@/lib/furnishing/ownership";
import { recalculatePlanCurrentTotal } from "@/lib/furnishing/planTotals";

// PATCH /api/furnishing/item/[itemId] - update item (lock/unlock, status, price, etc.)
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ itemId: string }> },
) {
  try {
    const { itemId } = await params;
    const supabase = await createClient();
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });
    }

    const ownedItem = await getOwnedItemRecord(supabase, user.id, itemId);

    if (!ownedItem) {
      return NextResponse.json({ success: false, error: "Item not found" }, { status: 404 });
    }

    const body = await request.json();
    const allowedFields = [
      "locked",
      "status",
      "price",
      "custom_name",
      "custom_image_url",
      "custom_source_url",
      "custom_width_mm",
      "custom_depth_mm",
      "custom_height_mm",
      "fit_status",
      "fit_message",
      "product_id",
      "purchased_at",
    ];

    const updates: Record<string, unknown> = {};

    for (const field of allowedFields) {
      if (body[field] !== undefined) {
        updates[field] = body[field];
      }
    }

    if (body.status === "purchased" && !body.purchased_at) {
      updates.purchased_at = new Date().toISOString();
    }

    const { data: item, error } = await supabase
      .from("furnishing_plan_items")
      .update(updates)
      .eq("id", itemId)
      .select()
      .single();

    if (error || !item) {
      return NextResponse.json({ success: false, error: "Update failed" }, { status: 500 });
    }

    await recalculatePlanCurrentTotal(supabase, ownedItem.plan_id);

    return NextResponse.json({ success: true, data: item });
  } catch (error) {
    return NextResponse.json({ success: false, error: String(error) }, { status: 500 });
  }
}

// DELETE /api/furnishing/item/[itemId]
export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ itemId: string }> },
) {
  try {
    const { itemId } = await params;
    const supabase = await createClient();
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });
    }

    const ownedItem = await getOwnedItemRecord(supabase, user.id, itemId);

    if (!ownedItem) {
      return NextResponse.json({ success: false, error: "Item not found" }, { status: 404 });
    }

    const { error } = await supabase.from("furnishing_plan_items").delete().eq("id", itemId);

    if (error) {
      return NextResponse.json({ success: false, error: error.message }, { status: 500 });
    }

    await recalculatePlanCurrentTotal(supabase, ownedItem.plan_id);

    return NextResponse.json({ success: true });
  } catch (error) {
    return NextResponse.json({ success: false, error: String(error) }, { status: 500 });
  }
}
