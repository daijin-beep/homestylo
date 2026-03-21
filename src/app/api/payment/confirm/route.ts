import { NextResponse } from "next/server";
import { PLAN_LIMITS, normalizePlanType } from "@/lib/plan/planLimits";
import { createServiceRoleClient } from "@/lib/supabase/admin";

interface ConfirmOrderBody {
  order_id?: string;
}

interface OrderRow {
  id: string;
  user_id: string;
  plan_type: string;
  status: string;
}

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as ConfirmOrderBody;
    const orderId = body.order_id?.trim();

    if (!orderId) {
      return NextResponse.json(
        { success: false, error: "Missing order_id." },
        { status: 400 },
      );
    }

    const supabase = createServiceRoleClient();
    const { data: order, error } = await supabase
      .from("orders")
      .select("id, user_id, plan_type, status")
      .eq("id", orderId)
      .single<OrderRow>();

    if (error || !order) {
      return NextResponse.json(
        { success: false, error: "Order not found." },
        { status: 404 },
      );
    }

    const normalizedPlan = normalizePlanType(order.plan_type);

    if (order.status !== "confirmed") {
      const { error: orderUpdateError } = await supabase
        .from("orders")
        .update({
          status: "confirmed",
          confirmed_at: new Date().toISOString(),
        })
        .eq("id", orderId);

      if (orderUpdateError) {
        throw new Error(orderUpdateError.message);
      }
    }

    const { error: userUpdateError } = await supabase
      .from("users")
      .update({
        plan_type: normalizedPlan,
        plan_room_limit: PLAN_LIMITS[normalizedPlan].rooms,
        generation_count: 0,
        replacement_count: 0,
        replacement_daily_count: 0,
        replacement_daily_reset_at: null,
      })
      .eq("id", order.user_id);

    if (userUpdateError) {
      throw new Error(userUpdateError.message);
    }

    return NextResponse.json({
      success: true,
      order_id: orderId,
      plan_type: normalizedPlan,
    });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Failed to confirm payment order.";
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
}
