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

function isSchemaCacheError(error: { code?: string; message?: string } | null) {
  const message = error?.message ?? "";
  return error?.code === "PGRST204" || error?.code === "42703" || message.includes("schema cache");
}

function isMissingOrdersTableError(error: { code?: string; message?: string } | null) {
  const message = error?.message ?? "";
  return (
    error?.code === "PGRST205" ||
    message.includes("Could not find the table 'public.orders'") ||
    message.includes('relation "public.orders" does not exist')
  );
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

    if (error && isMissingOrdersTableError(error)) {
      return NextResponse.json(
        {
          success: false,
          error:
            "Orders table is not available yet. Apply supabase/migrations/add_orders_table.sql before confirming payments.",
        },
        { status: 503 },
      );
    }

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

    if (!userUpdateError) {
      return NextResponse.json({
        success: true,
        order_id: orderId,
        plan_type: normalizedPlan,
      });
    }

    if (!isSchemaCacheError(userUpdateError)) {
      throw new Error(userUpdateError.message);
    }

    const { error: legacyUserUpdateError } = await supabase
      .from("users")
      .update({
        plan_type: normalizedPlan,
        generation_count: 0,
      })
      .eq("id", order.user_id);

    if (legacyUserUpdateError) {
      throw new Error(legacyUserUpdateError.message);
    }

    return NextResponse.json({
      success: true,
      order_id: orderId,
      plan_type: normalizedPlan,
      compatibilityMode: true,
    });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Failed to confirm payment order.";
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
}
