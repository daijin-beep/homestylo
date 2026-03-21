import { NextResponse } from "next/server";
import { createServiceRoleClient } from "@/lib/supabase/admin";
import { createClient as createAuthClient } from "@/lib/supabase/server";

interface PurchaseBody {
  scheme_id?: string;
  scheme_product_id?: string;
  action?: "purchase" | "reset";
  actual_price?: number | null;
}

interface OwnedSchemeRow {
  id: string;
  user_id: string;
}

interface SchemeProductRow {
  id: string;
  scheme_id: string;
  status: string | null;
  actual_price: number | null;
  purchased_at: string | null;
}

async function requireOwnedSchemeProduct(schemeId: string, schemeProductId: string) {
  const authSupabase = await createAuthClient();
  const {
    data: { user },
    error: authError,
  } = await authSupabase.auth.getUser();

  if (authError || !user) {
    throw new Error("请先登录后再更新购买状态。");
  }

  const adminSupabase = createServiceRoleClient();
  const { data: scheme, error: schemeError } = await adminSupabase
    .from("schemes")
    .select("id, user_id")
    .eq("id", schemeId)
    .eq("user_id", user.id)
    .single<OwnedSchemeRow>();

  if (schemeError || !scheme) {
    throw new Error("方案不存在或无权访问。");
  }

  const { data: schemeProduct, error: schemeProductError } = await adminSupabase
    .from("scheme_products")
    .select("id, scheme_id, status, actual_price, purchased_at")
    .eq("id", schemeProductId)
    .eq("scheme_id", schemeId)
    .single<SchemeProductRow>();

  if (schemeProductError || !schemeProduct) {
    throw new Error("未找到要更新的商品记录。");
  }

  return { adminSupabase };
}

function normalizeActualPrice(value: unknown) {
  if (typeof value !== "number" || !Number.isFinite(value) || value <= 0) {
    return null;
  }

  return Math.round(value * 100) / 100;
}

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as PurchaseBody;
    const schemeId = body.scheme_id?.trim();
    const schemeProductId = body.scheme_product_id?.trim();
    const action = body.action;

    if (!schemeId || !schemeProductId || !action) {
      return NextResponse.json(
        { success: false, error: "缺少 scheme_id、scheme_product_id 或 action。" },
        { status: 400 },
      );
    }

    const { adminSupabase } = await requireOwnedSchemeProduct(schemeId, schemeProductId);

    if (action === "purchase") {
      const actualPrice = normalizeActualPrice(body.actual_price);
      if (actualPrice === null) {
        return NextResponse.json(
          { success: false, error: "请输入有效的实际成交价。" },
          { status: 400 },
        );
      }

      const purchasedAt = new Date().toISOString();
      const { data, error } = await adminSupabase
        .from("scheme_products")
        .update({
          status: "purchased",
          actual_price: actualPrice,
          purchased_at: purchasedAt,
        })
        .eq("id", schemeProductId)
        .select("id, status, actual_price, purchased_at")
        .single<SchemeProductRow>();

      if (error || !data) {
        throw new Error(error?.message ?? "更新购买状态失败。");
      }

      return NextResponse.json({ success: true, schemeProduct: data });
    }

    if (action === "reset") {
      const { data, error } = await adminSupabase
        .from("scheme_products")
        .update({
          status: "confirmed",
          actual_price: null,
          purchased_at: null,
        })
        .eq("id", schemeProductId)
        .select("id, status, actual_price, purchased_at")
        .single<SchemeProductRow>();

      if (error || !data) {
        throw new Error(error?.message ?? "恢复待购买状态失败。");
      }

      return NextResponse.json({ success: true, schemeProduct: data });
    }

    return NextResponse.json(
      { success: false, error: "不支持的购买状态操作。" },
      { status: 400 },
    );
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "更新购买状态失败，请稍后重试。";
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
}
