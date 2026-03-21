import type { Metadata } from "next";
import { notFound } from "next/navigation";
import {
  ComparePageClient,
  type ComparisonCardItem,
} from "@/components/compare/ComparePageClient";
import { createClient } from "@/lib/supabase/server";
import {
  validateLayout,
  type FurnitureItem,
  type RoomDimensions,
} from "@/lib/validation/dimensionValidator";

interface ComparePageProps {
  params: Promise<{ schemeId: string }>;
  searchParams?: Promise<{ category?: string }>;
}

interface RoomAnalysisRow {
  constraints_json: {
    sofa_wall_width_mm?: number;
    tv_wall_width_mm?: number;
    room_depth_mm?: number | null;
    ceiling_height_mm?: number | null;
  } | null;
}

export const metadata: Metadata = {
  title: "三选一对比",
  description: "横向对比同一品类的多个替换方案，选出最适合你家的那一个。",
};

interface SchemeProductRow {
  id: string;
  product_id: string | null;
  category: string;
  status: string | null;
  created_at: string;
}

interface ProductRow {
  id: string;
  name: string;
  brand: string | null;
  image_url: string;
  price_min: number;
  price_max: number;
  width_mm: number;
  depth_mm: number;
  height_mm: number;
  category: string;
}

interface EffectImageRow {
  version: number;
  generation_status: string;
  image_url: string | null;
  generation_params: {
    active_products?: Array<{
      id?: string;
      product_id?: string;
      category?: string;
    }>;
  } | null;
}

function ensureNumber(value: unknown, fallback: number) {
  if (typeof value === "number" && Number.isFinite(value) && value > 0) {
    return value;
  }

  return fallback;
}

function ensureNullableNumber(value: unknown) {
  if (typeof value === "number" && Number.isFinite(value) && value > 0) {
    return value;
  }

  return null;
}

function toValidationFurniture(products: ProductRow[]): FurnitureItem[] {
  return products.map((item) => ({
    id: item.id,
    name: item.name,
    category: item.category,
    widthMm: item.width_mm,
    depthMm: item.depth_mm,
    heightMm: item.height_mm,
    placement:
      item.category === "sofa"
        ? "sofa_wall"
        : item.category === "tv_cabinet"
          ? "tv_wall"
          : item.category === "side_table"
            ? "corner"
            : item.category === "dining_table"
              ? "dining_area"
              : "center",
  }));
}

function pickLatestActiveByCategory(rows: SchemeProductRow[], excludedCategory: string) {
  const map = new Map<string, SchemeProductRow>();

  for (const row of rows) {
    if (row.status === "abandoned" || !row.product_id || row.category === excludedCategory) {
      continue;
    }

    if (!map.has(row.category)) {
      map.set(row.category, row);
    }
  }

  return map;
}

function pickCategoryHistory(rows: SchemeProductRow[], category: string) {
  const seen = new Set<string>();
  const history: SchemeProductRow[] = [];

  for (const row of rows) {
    if (!row.product_id || row.category !== category) {
      continue;
    }

    if (seen.has(row.product_id)) {
      continue;
    }

    seen.add(row.product_id);
    history.push(row);

    if (history.length >= 3) {
      break;
    }
  }

  return history;
}

function findEffectImageForProduct(
  effectImages: EffectImageRow[],
  productId: string,
  isCurrent: boolean,
) {
  for (const item of effectImages) {
    const activeProducts = Array.isArray(item.generation_params?.active_products)
      ? item.generation_params?.active_products
      : [];

    const matched = activeProducts.some(
      (active) => active?.id === productId || active?.product_id === productId,
    );

    if (matched) {
      return item;
    }
  }

  if (isCurrent) {
    return effectImages[0] ?? null;
  }

  return null;
}

export default async function ComparePage({
  params,
  searchParams,
}: ComparePageProps) {
  const { schemeId } = await params;
  const query = searchParams ? await searchParams : undefined;
  const supabase = await createClient();

  const { data: roomAnalysis } = await supabase
    .from("room_analysis")
    .select("constraints_json")
    .eq("scheme_id", schemeId)
    .single<RoomAnalysisRow>();

  const { data: schemeProducts } = await supabase
    .from("scheme_products")
    .select("id, product_id, category, status, created_at")
    .eq("scheme_id", schemeId)
    .order("created_at", { ascending: false })
    .returns<SchemeProductRow[]>();

  if (!schemeProducts || schemeProducts.length === 0) {
    notFound();
  }

  const fallbackCategory = schemeProducts.find((item) => item.product_id)?.category ?? null;
  const category = query?.category ?? fallbackCategory;

  if (!category) {
    notFound();
  }

  const historyRows = pickCategoryHistory(schemeProducts, category);
  const currentByCategory = pickLatestActiveByCategory(schemeProducts, category);
  const currentCategoryRow =
    schemeProducts.find(
      (item) => item.category === category && item.status !== "abandoned" && item.product_id,
    ) ?? null;

  const productIds = [
    ...new Set(
      [
        ...historyRows.map((item) => item.product_id),
        ...[...currentByCategory.values()].map((item) => item.product_id),
      ].filter((value): value is string => typeof value === "string"),
    ),
  ];

  let products: ProductRow[] = [];
  if (productIds.length > 0) {
    const { data: productRows } = await supabase
      .from("products")
      .select(
        "id, name, brand, image_url, price_min, price_max, width_mm, depth_mm, height_mm, category",
      )
      .in("id", productIds)
      .returns<ProductRow[]>();

    products = productRows ?? [];
  }

  const { data: effectImages } = await supabase
    .from("effect_images")
    .select("version, generation_status, image_url, generation_params")
    .eq("scheme_id", schemeId)
    .order("version", { ascending: false })
    .returns<EffectImageRow[]>();

  const productMap = new Map(products.map((item) => [item.id, item]));
  const comparisonBaseProducts = [...currentByCategory.values()]
    .map((row) => (row.product_id ? productMap.get(row.product_id) : null))
    .filter((item): item is ProductRow => Boolean(item));

  const room: RoomDimensions = {
    sofaWallWidthMm: ensureNumber(
      roomAnalysis?.constraints_json?.sofa_wall_width_mm,
      3600,
    ),
    tvWallWidthMm: ensureNumber(
      roomAnalysis?.constraints_json?.tv_wall_width_mm,
      ensureNumber(roomAnalysis?.constraints_json?.sofa_wall_width_mm, 3600),
    ),
    roomDepthMm: ensureNullableNumber(roomAnalysis?.constraints_json?.room_depth_mm),
    ceilingHeightMm: ensureNullableNumber(
      roomAnalysis?.constraints_json?.ceiling_height_mm,
    ),
  };

  const rawItems = historyRows.map((row) => {
    const product = row.product_id ? productMap.get(row.product_id) : null;
    if (!product) {
      return null;
    }

    const validationProducts = [product, ...comparisonBaseProducts];
    const report = validateLayout(room, toValidationFurniture(validationProducts));
    const targetValidation = report.items.find((item) => item.furnitureId === product.id);
    const matchedEffectImage = findEffectImageForProduct(
      effectImages ?? [],
      product.id,
      currentCategoryRow?.product_id === product.id,
    );

    return {
      schemeProductId: row.id,
      category,
      product: {
        id: product.id,
        name: product.name,
        brand: product.brand,
        imageUrl: product.image_url,
        priceMin: product.price_min,
        priceMax: product.price_max,
        widthMm: product.width_mm,
        depthMm: product.depth_mm,
        heightMm: product.height_mm,
      },
      effectImage: matchedEffectImage
        ? {
            imageUrl: matchedEffectImage.image_url,
            status: matchedEffectImage.generation_status,
            version: matchedEffectImage.version,
          }
        : null,
      validationStatus: targetValidation?.status ?? report.overallStatus,
      validationSummary:
        targetValidation?.checks.find((check) => check.status !== "pass")?.message ??
        "当前尺寸校验未发现明显风险。",
      isCurrent: currentCategoryRow?.product_id === product.id,
    } satisfies ComparisonCardItem;
  });

  const items = rawItems.filter(Boolean) as ComparisonCardItem[];

  return <ComparePageClient schemeId={schemeId} category={category} items={items} />;
}
