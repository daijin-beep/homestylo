import { NextResponse } from "next/server";
import { PLAN_PRICES, normalizePlanType } from "@/lib/plan/planLimits";
import { requireCurrentAppUser } from "@/lib/plan/userProfile";
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

    const { authUser, adminSupabase } = await requireCurrentAppUser();
    if (!body.user_id || body.user_id !== authUser.id) {
      return NextResponse.json(
        { success: false, error: "User mismatch." },
        { status: 403 },
      );
    }

    const amount = PLAN_PRICES[requestedPlan];

    const { data: order, error } = await adminSupabase
      .from("orders")
      .insert({
        user_id: authUser.id,
        plan_type: requestedPlan,
        amount,
        status: "pending",
      })
      .select("id, amount, payment_note")
      .single<OrderRow>();

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
