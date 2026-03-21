import { notFound } from "next/navigation";
import { ProductImportClient } from "@/components/import/ProductImportClient";
import { createClient } from "@/lib/supabase/server";
import type { ProductCategory, StyleType } from "@/lib/types";

interface ImportPageProps {
  params: Promise<{ schemeId: string }>;
  searchParams?: Promise<{
    replace?: string;
    category?: ProductCategory;
  }>;
}

interface SchemeRow {
  id: string;
  style: StyleType | null;
}

interface HeroProductRow {
  id: string;
  name: string;
  brand: string | null;
  image_url: string;
  price_min: number;
  price_max: number;
  width_mm: number;
  depth_mm: number;
  height_mm: number;
  category: ProductCategory;
  style: string;
}

export default async function ImportPage({
  params,
  searchParams,
}: ImportPageProps) {
  const { schemeId } = await params;
  const query = searchParams ? await searchParams : undefined;
  const supabase = await createClient();

  const { data: scheme } = await supabase
    .from("schemes")
    .select("id, style")
    .eq("id", schemeId)
    .single<SchemeRow>();

  if (!scheme) {
    notFound();
  }

  let heroQuery = supabase
    .from("products")
    .select(
      "id, name, brand, image_url, price_min, price_max, width_mm, depth_mm, height_mm, category, style",
    )
    .eq("is_hero", true)
    .order("created_at", { ascending: false });

  if (query?.category) {
    heroQuery = heroQuery.eq("category", query.category);
  }

  const { data: heroProducts } = await heroQuery.returns<HeroProductRow[]>();

  return (
    <ProductImportClient
      schemeId={scheme.id}
      schemeStyle={scheme.style}
      replaceProductId={query?.replace ?? null}
      category={query?.category ?? null}
      heroProducts={heroProducts ?? []}
    />
  );
}
