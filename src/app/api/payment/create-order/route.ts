import { NextResponse } from "next/server";
import { PLAN_PRICES, normalizePlanType } from "@/lib/plan/planLimits";
import { createServiceRoleClient } from "@/lib/supabase/admin";
import { createClient as createAuthClient } from "@/lib/supabase/server";
import type { PlanType } from "@/lib/types";

interface CreateOrderBody {
  plan_type?: string;
  user_id?: string;
}

interface OrderRow {
  id: string;
  amount: number;
  payment_note: string | null;
}

function isMissingOrdersTableError(error: { code?: string; message?: string } | null) {
  const message = error?.message ?? "";
  return (
    error?.code === "PGRST205" ||
    message.includes("Could not find the table 'public.orders'") ||
    message.includes('relation "public.orders" does not exist')
  );
}

function isPurchasablePlan(plan: string | undefined): plan is Exclude<PlanType, "free" | "creator"> {
  return plan === "trial" || plan === "serious" || plan === "full";
}

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as CreateOrderBody;
    const requestedPlan = normalizePlanType(body.plan_type);

    if (!isPurchasablePlan(requestedPlan)) {
      return NextResponse.json(
        { success: false, error: "Unsupported plan type." },
        { status: 400 },
      );
    }

    const authSupabase = await createAuthClient();
    const {
      data: { user },
      error: authError,
    } = await authSupabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json(
        { success: false, error: "Please sign in first." },
        { status: 401 },
      );
    }

    if (!body.user_id || body.user_id !== user.id) {
      return NextResponse.json(
        { success: false, error: "User mismatch." },
        { status: 403 },
      );
    }

    const amount = PLAN_PRICES[requestedPlan];
    const adminSupabase = createServiceRoleClient();

    const { data: order, error } = await adminSupabase
      .from("orders")
      .insert({
        user_id: user.id,
        plan_type: requestedPlan,
        amount,
        status: "pending",
      })
      .select("id, amount, payment_note")
      .single<OrderRow>();

    if (error && isMissingOrdersTableError(error)) {
      const fallbackOrderId = crypto.randomUUID();
      const fallbackPaymentNote = `HS-${fallbackOrderId}`;

      return NextResponse.json({
        success: true,
        order_id: fallbackOrderId,
        amount,
        payment_note: fallbackPaymentNote,
        compatibilityMode: true,
        payment: {
          amount,
          note: fallbackPaymentNote,
          alipayQrUrl: "/images/payment/alipay-qr.svg",
          wechatQrUrl: "/images/payment/wechat-qr.svg",
        },
      });
    }

    if (error || !order) {
      throw new Error(error?.message ?? "Failed to create order.");
    }

    const paymentNote = `HS-${order.id}`;
    const { error: updateError } = await adminSupabase
      .from("orders")
      .update({ payment_note: paymentNote })
      .eq("id", order.id);

    if (updateError) {
      throw new Error(updateError.message);
    }

    return NextResponse.json({
      success: true,
      order_id: order.id,
      amount,
      payment_note: paymentNote,
      payment: {
        amount,
        note: paymentNote,
        alipayQrUrl: "/images/payment/alipay-qr.svg",
        wechatQrUrl: "/images/payment/wechat-qr.svg",
      },
    });
  } catch (error) {
    if (error instanceof Error && error.message === "Authentication required.") {
      return NextResponse.json(
        { success: false, error: "Please sign in first." },
        { status: 401 },
      );
    }

    const message =
      error instanceof Error ? error.message : "Failed to create payment order.";
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
}
