import { NextResponse } from "next/server";
import { createClient as createAdminClient } from "@supabase/supabase-js";
import { uploadToR2 } from "@/lib/api/r2";
import { createClient as createAuthClient } from "@/lib/supabase/server";
import type { ProductCategory, ProductRole, StyleType } from "@/lib/types";

interface OwnedSchemeRow {
  id: string;
  user_id: string;
  style: StyleType | null;
}

interface HeroProductRow {
  id: string;
  category: ProductCategory;
  is_hero: boolean;
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

function ensurePositiveInt(value: FormDataEntryValue | null) {
  if (typeof value !== "string") {
    return null;
  }

  const parsed = Number.parseInt(value, 10);
  if (!Number.isFinite(parsed) || parsed <= 0) {
    return null;
  }

  return parsed;
}

function sanitizeFileName(value: string) {
  return value.replace(/[^a-zA-Z0-9._-]/g, "-");
}

function inferRole(category: ProductCategory): ProductRole {
  if (
    category === "sofa" ||
    category === "bed" ||
    category === "dining_table" ||
    category === "tv_cabinet" ||
    category === "curtain"
  ) {
    return "primary";
  }

  if (
    category === "coffee_table" ||
    category === "rug" ||
    category === "floor_lamp" ||
    category === "side_table"
  ) {
    return "secondary";
  }

  return "accessory";
}

async function requireOwnedScheme(schemeId: string) {
  const authSupabase = await createAuthClient();
  const {
    data: { user },
    error: authError,
  } = await authSupabase.auth.getUser();

  if (authError || !user) {
    throw new Error("请先登录后再导入商品。");
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
    user,
    scheme,
    adminSupabase,
  };
}

async function abandonCategoryRecords(
  supabase: ReturnType<typeof createServiceRoleClient>,
  schemeId: string,
  category: ProductCategory,
  replaceProductId: string | null,
) {
  let query = supabase
    .from("scheme_products")
    .update({
      status: "abandoned",
    })
    .eq("scheme_id", schemeId)
    .eq("category", category)
    .neq("status", "abandoned");

  if (replaceProductId) {
    query = query.eq("product_id", replaceProductId);
  }

  const { error } = await query;
  if (error) {
    throw new Error(error.message);
  }
}

async function insertSchemeProduct(params: {
  supabase: ReturnType<typeof createServiceRoleClient>;
  schemeId: string;
  productId: string;
  category: ProductCategory;
  importSource: "hero_sku" | "screenshot";
  isUserImported: boolean;
  notes: string;
}) {
  const { error } = await params.supabase.from("scheme_products").insert({
    scheme_id: params.schemeId,
    product_id: params.productId,
    role: inferRole(params.category),
    category: params.category,
    is_user_imported: params.isUserImported,
    import_source: params.importSource,
    status: "confirmed",
    notes: params.notes,
  });

  if (error) {
    throw new Error(error.message);
  }
}

async function handleHeroSelection(formData: FormData) {
  const schemeId = String(formData.get("scheme_id") ?? "").trim();
  const productId = String(formData.get("product_id") ?? "").trim();
  const category = String(formData.get("category") ?? "").trim() as ProductCategory;
  const replaceProductId =
    String(formData.get("replace_product_id") ?? "").trim() || null;

  if (!schemeId || !productId || !category) {
    throw new Error("Hero 商品导入参数不完整。");
  }

  const { adminSupabase } = await requireOwnedScheme(schemeId);
  const { data: heroProduct, error } = await adminSupabase
    .from("products")
    .select("id, category, is_hero")
    .eq("id", productId)
    .single<HeroProductRow>();

  if (error || !heroProduct || !heroProduct.is_hero) {
    throw new Error("所选 Hero 商品不存在。");
  }

  if (heroProduct.category !== category) {
    throw new Error("商品品类与当前替换目标不匹配。");
  }

  await abandonCategoryRecords(adminSupabase, schemeId, category, replaceProductId);
  await insertSchemeProduct({
    supabase: adminSupabase,
    schemeId,
    productId,
    category,
    importSource: "hero_sku",
    isUserImported: false,
    notes: "从 Hero SKU 库选择",
  });

  return {
    schemeId,
    category,
    productId,
  };
}

async function handleManualImport(formData: FormData) {
  const schemeId = String(formData.get("scheme_id") ?? "").trim();
  const name = String(formData.get("name") ?? "").trim();
  const category = String(formData.get("manual_category") ?? "").trim() as ProductCategory;
  const replaceProductId =
    String(formData.get("replace_product_id") ?? "").trim() || null;
  const sourceUrl = String(formData.get("source_url") ?? "").trim() || null;
  const priceMin = ensurePositiveInt(formData.get("price_min")) ?? 0;
  const priceMax = ensurePositiveInt(formData.get("price_max")) ?? priceMin;
  const widthMm = ensurePositiveInt(formData.get("width_mm"));
  const depthMm = ensurePositiveInt(formData.get("depth_mm"));
  const heightMm = ensurePositiveInt(formData.get("height_mm"));
  const screenshot = formData.get("screenshot");

  if (!schemeId || !name || !category || !widthMm || !depthMm || !heightMm) {
    throw new Error("请完整填写商品名称、品类与尺寸。");
  }

  if (!(screenshot instanceof File) || screenshot.size <= 0) {
    throw new Error("请上传商品截图。");
  }

  const { adminSupabase, scheme } = await requireOwnedScheme(schemeId);
  const screenshotBuffer = Buffer.from(await screenshot.arrayBuffer());
  const screenshotKey = `product-imports/${schemeId}/${Date.now()}-${sanitizeFileName(
    screenshot.name || "manual-product.png",
  )}`;
  const imageUrl = await uploadToR2(
    screenshotBuffer,
    screenshotKey,
    screenshot.type || "image/png",
  );

  const style = scheme.style ?? "universal";
  const { data: product, error: insertProductError } = await adminSupabase
    .from("products")
    .insert({
      name,
      category,
      style,
      price_min: priceMin,
      price_max: Math.max(priceMin, priceMax),
      width_mm: widthMm,
      depth_mm: depthMm,
      height_mm: heightMm,
      image_url: imageUrl,
      source_url: sourceUrl,
      brand: "用户导入",
      tags: ["manual-import", category],
      is_hero: false,
    })
    .select("id")
    .single<{ id: string }>();

  if (insertProductError || !product) {
    throw new Error(insertProductError?.message ?? "创建自定义商品失败。");
  }

  await abandonCategoryRecords(adminSupabase, schemeId, category, replaceProductId);
  await insertSchemeProduct({
    supabase: adminSupabase,
    schemeId,
    productId: product.id,
    category,
    importSource: "screenshot",
    isUserImported: true,
    notes: "用户手动导入",
  });

  return {
    schemeId,
    category,
    productId: product.id,
  };
}

export async function POST(request: Request) {
  try {
    const formData = await request.formData();
    const mode = String(formData.get("mode") ?? "").trim();

    const result =
      mode === "hero"
        ? await handleHeroSelection(formData)
        : mode === "manual"
          ? await handleManualImport(formData)
          : null;

    if (!result) {
      return NextResponse.json(
        { success: false, error: "不支持的导入模式。" },
        { status: 400 },
      );
    }

    return NextResponse.json({
      success: true,
      redirectTo: `/result/${result.schemeId}`,
      productId: result.productId,
      category: result.category,
    });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "商品导入失败，请稍后重试。";
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
}
