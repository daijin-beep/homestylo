import { NextResponse } from "next/server";
import { createClient as createAdminClient } from "@supabase/supabase-js";
import { createClient as createAuthClient } from "@/lib/supabase/server";
import type { ProductCategory, StyleType } from "@/lib/types";

interface SelectProductBody {
  scheme_id?: string;
  product_id?: string;
  category?: ProductCategory;
}

interface OwnedSchemeRow {
  id: string;
  user_id: string;
  style: StyleType | null;
}

interface SchemeProductRow {
  id: string;
}

function createServiceRoleClient() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!supabaseUrl || !serviceRoleKey) {
    throw new Error("缺少 Supabase service role 环境变量。");
  }

  return createAdminClient(supabaseUrl, serviceRoleKey, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
    },
  });
}

async function requireOwnedScheme(schemeId: string) {
  const authSupabase = await createAuthClient();
  const {
    data: { user },
    error: authError,
  } = await authSupabase.auth.getUser();

  if (authError || !user) {
    throw new Error("请先登录后再切换对比商品。");
  }

  const adminSupabase = createServiceRoleClient();
  const { data: scheme, error } = await adminSupabase
    .from("schemes")
    .select("id, user_id, style")
    .eq("id", schemeId)
    .eq("user_id", user.id)
    .single<OwnedSchemeRow>();

  if (error || !scheme) {
    throw new Error("方案不存在或无权访问。");
  }

  return {
    adminSupabase,
  };
}

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as SelectProductBody;
    const schemeId = body.scheme_id?.trim();
    const productId = body.product_id?.trim();
    const category = body.category;

    if (!schemeId || !productId || !category) {
      return NextResponse.json(
        { success: false, error: "缺少 scheme_id、product_id 或 category。" },
        { status: 400 },
      );
    }

    const { adminSupabase } = await requireOwnedScheme(schemeId);

    const { data: targetRow, error: targetError } = await adminSupabase
      .from("scheme_products")
      .select("id")
      .eq("scheme_id", schemeId)
      .eq("category", category)
      .eq("product_id", productId)
      .order("created_at", { ascending: false })
      .limit(1)
      .single<SchemeProductRow>();

    if (targetError || !targetRow) {
      return NextResponse.json(
        { success: false, error: "未找到可切换的方案商品记录。" },
        { status: 404 },
      );
    }

    const { error: abandonError } = await adminSupabase
      .from("scheme_products")
      .update({ status: "abandoned" })
      .eq("scheme_id", schemeId)
      .eq("category", category)
      .neq("id", targetRow.id)
      .neq("status", "abandoned");

    if (abandonError) {
      throw new Error(abandonError.message);
    }

    const { error: activateError } = await adminSupabase
      .from("scheme_products")
      .update({ status: "confirmed" })
      .eq("id", targetRow.id);

    if (activateError) {
      throw new Error(activateError.message);
    }

    return NextResponse.json({
      success: true,
      schemeProductId: targetRow.id,
    });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "切换当前对比商品失败，请稍后重试。";
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
}
