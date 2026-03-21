import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";
import { AccountingDashboardClient } from "@/components/accounting/AccountingDashboardClient";
import { SchemeNavigation } from "@/components/SchemeNavigation";
import { createClient } from "@/lib/supabase/server";

interface AccountingPageProps {
  params: Promise<{ schemeId: string }>;
}

interface SchemeRow {
  id: string;
  user_id: string;
}

interface SchemeProductRow {
  id: string;
  product_id: string | null;
  category: string;
  custom_name: string | null;
  custom_image_url: string | null;
  custom_width_mm: number | null;
  custom_depth_mm: number | null;
  custom_height_mm: number | null;
  custom_price: number | null;
  status: string | null;
  actual_price: number | null;
  purchased_at: string | null;
  created_at: string;
}

interface ProductRow {
  id: string;
  name: string;
  image_url: string | null;
  source_url: string | null;
  price_min: number | null;
  price_max: number | null;
  width_mm: number | null;
  depth_mm: number | null;
  height_mm: number | null;
}

export const metadata: Metadata = {
  title: "购物清单与预算",
  description: "查看当前方案的商品清单、记录成交价并追踪预算进度。",
};

export default async function AccountingPage({ params }: AccountingPageProps) {
  const { schemeId } = await params;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect(`/login?redirect=/accounting/${schemeId}`);
  }

  const { data: scheme } = await supabase
    .from("schemes")
    .select("id, user_id")
    .eq("id", schemeId)
    .eq("user_id", user.id)
    .single<SchemeRow>();

  if (!scheme) {
    notFound();
  }

  const { data: schemeProducts } = await supabase
    .from("scheme_products")
    .select(
      "id, product_id, category, custom_name, custom_image_url, custom_width_mm, custom_depth_mm, custom_height_mm, custom_price, status, actual_price, purchased_at, created_at",
    )
    .eq("scheme_id", schemeId)
    .neq("status", "abandoned")
    .order("created_at", { ascending: true })
    .returns<SchemeProductRow[]>();

  const productIds = (schemeProducts ?? [])
    .map((item) => item.product_id)
    .filter((value): value is string => typeof value === "string");

  let products: ProductRow[] = [];
  if (productIds.length > 0) {
    const { data } = await supabase
      .from("products")
      .select(
        "id, name, image_url, source_url, price_min, price_max, width_mm, depth_mm, height_mm",
      )
      .in("id", productIds)
      .returns<ProductRow[]>();

    products = data ?? [];
  }

  const productMap = new Map(products.map((item) => [item.id, item]));
  const items = (schemeProducts ?? []).map((item) => {
    const product = item.product_id ? productMap.get(item.product_id) : null;
    const priceMin = item.custom_price ?? product?.price_min ?? null;
    const priceMax = item.custom_price ?? product?.price_max ?? null;
    const estimatedPrice =
      item.custom_price ??
      (typeof priceMax === "number" && priceMax > 0
        ? priceMax
        : typeof priceMin === "number"
          ? priceMin
          : 0);

    return {
      schemeProductId: item.id,
      productId: item.product_id,
      name: item.custom_name ?? product?.name ?? "未命名商品",
      category: item.category,
      imageUrl: item.custom_image_url ?? product?.image_url ?? null,
      sourceUrl: product?.source_url ?? null,
      widthMm: item.custom_width_mm ?? product?.width_mm ?? null,
      depthMm: item.custom_depth_mm ?? product?.depth_mm ?? null,
      heightMm: item.custom_height_mm ?? product?.height_mm ?? null,
      priceMin,
      priceMax,
      estimatedPrice,
      actualPrice: item.actual_price,
      purchasedAt: item.purchased_at,
      status: item.status,
    };
  });

  return (
    <>
      <div className="mx-auto w-full max-w-7xl px-4 pt-6 md:px-8">
        <SchemeNavigation currentStep="accounting" schemeId={schemeId} />
      </div>
      <AccountingDashboardClient schemeId={scheme.id} items={items} />
    </>
  );
}
