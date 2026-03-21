import type { SupabaseClient } from "@supabase/supabase-js";
import { PRODUCT_CATEGORY_DEFINITIONS } from "@/lib/constants";
import type { ShareType } from "@/lib/types";
import {
  validateLayout,
  type FurnitureItem,
  type RoomDimensions,
} from "@/lib/validation/dimensionValidator";

type SupabaseLike = Pick<SupabaseClient, "from">;

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
  actual_price: number | null;
  purchased_at: string | null;
  status: string | null;
  created_at: string;
}

interface ProductRow {
  id: string;
  name: string;
  brand: string | null;
  category: string;
  image_url: string | null;
  source_url: string | null;
  price_min: number | null;
  price_max: number | null;
  width_mm: number | null;
  depth_mm: number | null;
  height_mm: number | null;
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

interface RoomAnalysisRow {
  constraints_json: {
    sofa_wall_width_mm?: number;
    tv_wall_width_mm?: number;
    room_depth_mm?: number | null;
    ceiling_height_mm?: number | null;
  } | null;
}

export interface ShareShoppingItem {
  schemeProductId: string;
  productId: string | null;
  name: string;
  category: string;
  categoryLabel: string;
  imageUrl: string | null;
  sourceUrl: string | null;
  widthMm: number | null;
  depthMm: number | null;
  heightMm: number | null;
  priceMin: number | null;
  priceMax: number | null;
  estimatedPrice: number;
  actualPrice: number | null;
  purchasedAt: string | null;
  status: string | null;
}

export interface ShareCompareItem {
  schemeProductId: string;
  productId: string;
  name: string;
  category: string;
  categoryLabel: string;
  imageUrl: string | null;
  effectImageUrl: string | null;
  effectImageVersion: number | null;
  priceLabel: string;
  dimensionsLabel: string;
  validationStatus: "pass" | "warning" | "block";
}

export interface ShareRenderData {
  schemeId: string;
  effectImage: {
    imageUrl: string | null;
    status: string | null;
    version: number | null;
  };
  shoppingItems: ShareShoppingItem[];
  shoppingSummary: {
    estimatedTotal: number;
    purchasedTotal: number;
  };
  compareCategory: string | null;
  compareCategoryLabel: string | null;
  compareItems: ShareCompareItem[];
  watermarkText: string;
}

const SHARE_WATERMARK_TEXT = "HomeStylo · 买大件前先放进你家看看";

export function resolveShareType(value: string | null | undefined): ShareType | null {
  if (value === "effect_image" || value === "shopping_list" || value === "compare") {
    return value;
  }

  if (value === "single") {
    return "effect_image";
  }

  if (value === "list") {
    return "shopping_list";
  }

  return null;
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

function formatCurrency(value: number | null) {
  if (typeof value !== "number" || !Number.isFinite(value) || value < 0) {
    return "待补充";
  }

  return `¥${new Intl.NumberFormat("zh-CN", {
    maximumFractionDigits: 0,
  }).format(value)}`;
}

function formatPriceRange(min: number | null, max: number | null) {
  if (!min && !max) {
    return "价格待补充";
  }

  const normalizedMin = min ?? max ?? 0;
  const normalizedMax = max ?? min ?? normalizedMin;

  if (normalizedMin === normalizedMax) {
    return formatCurrency(normalizedMin);
  }

  return `${formatCurrency(normalizedMin)} - ${formatCurrency(normalizedMax)}`;
}

function formatDimensions(
  widthMm: number | null,
  depthMm: number | null,
  heightMm: number | null,
) {
  if (!widthMm || !depthMm || !heightMm) {
    return "尺寸待补充";
  }

  return `${widthMm} × ${depthMm} × ${heightMm} mm`;
}

function pickLatestActiveRows(rows: SchemeProductRow[]) {
  const latestByCategory = new Map<string, SchemeProductRow>();

  for (const row of rows) {
    if (row.status === "abandoned") {
      continue;
    }

    if (!latestByCategory.has(row.category)) {
      latestByCategory.set(row.category, row);
    }
  }

  return [...latestByCategory.values()];
}

function pickCompareCategory(rows: SchemeProductRow[]) {
  const counts = new Map<string, number>();

  for (const row of rows) {
    if (!row.product_id || row.status === "abandoned") {
      continue;
    }

    counts.set(row.category, (counts.get(row.category) ?? 0) + 1);
  }

  if ((counts.get("sofa") ?? 0) >= 2) {
    return "sofa";
  }

  return [...counts.entries()].sort((a, b) => b[1] - a[1])[0]?.[0] ?? null;
}

function pickCategoryHistory(rows: SchemeProductRow[], category: string | null) {
  if (!category) {
    return [];
  }

  const seen = new Set<string>();
  const history: SchemeProductRow[] = [];

  for (const row of rows) {
    if (!row.product_id || row.category !== category || row.status === "abandoned") {
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
  for (const effectImage of effectImages) {
    const activeProducts = Array.isArray(effectImage.generation_params?.active_products)
      ? effectImage.generation_params?.active_products
      : [];

    const matched = activeProducts.some(
      (item) => item?.id === productId || item?.product_id === productId,
    );

    if (matched) {
      return effectImage;
    }
  }

  if (isCurrent) {
    return effectImages[0] ?? null;
  }

  return null;
}

function toValidationFurniture(products: ProductRow[]): FurnitureItem[] {
  return products.map((item) => ({
    id: item.id,
    name: item.name,
    category: item.category,
    widthMm: item.width_mm ?? 0,
    depthMm: item.depth_mm ?? 0,
    heightMm: item.height_mm ?? 0,
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

export async function fetchShareRenderData(
  supabase: SupabaseLike,
  schemeId: string,
): Promise<ShareRenderData | null> {
  const [{ data: schemeProducts }, { data: effectImages }, { data: roomAnalysis }] =
    await Promise.all([
      supabase
        .from("scheme_products")
        .select(
          "id, product_id, category, custom_name, custom_image_url, custom_width_mm, custom_depth_mm, custom_height_mm, custom_price, actual_price, purchased_at, status, created_at",
        )
        .eq("scheme_id", schemeId)
        .order("created_at", { ascending: false })
        .returns<SchemeProductRow[]>(),
      supabase
        .from("effect_images")
        .select("version, generation_status, image_url, generation_params")
        .eq("scheme_id", schemeId)
        .order("version", { ascending: false })
        .returns<EffectImageRow[]>(),
      supabase
        .from("room_analysis")
        .select("constraints_json")
        .eq("scheme_id", schemeId)
        .single<RoomAnalysisRow>(),
    ]);

  const schemeProductRows = schemeProducts ?? [];
  const activeRows = pickLatestActiveRows(schemeProductRows);
  const compareCategory = pickCompareCategory(schemeProductRows);
  const compareHistory = pickCategoryHistory(schemeProductRows, compareCategory);

  const productIds = [
    ...new Set(
      [...activeRows, ...compareHistory]
        .map((item) => item.product_id)
        .filter((value): value is string => typeof value === "string"),
    ),
  ];

  let productRows: ProductRow[] = [];
  if (productIds.length > 0) {
    const { data } = await supabase
      .from("products")
      .select(
        "id, name, brand, category, image_url, source_url, price_min, price_max, width_mm, depth_mm, height_mm",
      )
      .in("id", productIds)
      .returns<ProductRow[]>();

    productRows = data ?? [];
  }

  const productMap = new Map(productRows.map((item) => [item.id, item]));

  const shoppingItems: ShareShoppingItem[] = activeRows.map((row) => {
    const product = row.product_id ? productMap.get(row.product_id) : null;
    const priceMin = row.custom_price ?? product?.price_min ?? null;
    const priceMax = row.custom_price ?? product?.price_max ?? null;
    const estimatedPrice =
      row.custom_price ??
      (typeof priceMax === "number" && priceMax > 0
        ? priceMax
        : typeof priceMin === "number"
          ? priceMin
          : 0);

    return {
      schemeProductId: row.id,
      productId: row.product_id,
      name: row.custom_name ?? product?.name ?? "未命名商品",
      category: row.category,
      categoryLabel:
        PRODUCT_CATEGORY_DEFINITIONS[row.category as keyof typeof PRODUCT_CATEGORY_DEFINITIONS]
          ?.label ?? row.category,
      imageUrl: row.custom_image_url ?? product?.image_url ?? null,
      sourceUrl: product?.source_url ?? null,
      widthMm: row.custom_width_mm ?? product?.width_mm ?? null,
      depthMm: row.custom_depth_mm ?? product?.depth_mm ?? null,
      heightMm: row.custom_height_mm ?? product?.height_mm ?? null,
      priceMin,
      priceMax,
      estimatedPrice,
      actualPrice: row.actual_price,
      purchasedAt: row.purchased_at,
      status: row.status,
    };
  });

  const shoppingSummary = {
    estimatedTotal: shoppingItems.reduce((sum, item) => sum + item.estimatedPrice, 0),
    purchasedTotal: shoppingItems.reduce(
      (sum, item) => sum + (item.status === "purchased" ? item.actualPrice ?? 0 : 0),
      0,
    ),
  };

  const room: RoomDimensions = {
    sofaWallWidthMm: ensureNumber(roomAnalysis?.constraints_json?.sofa_wall_width_mm, 3600),
    tvWallWidthMm: ensureNumber(
      roomAnalysis?.constraints_json?.tv_wall_width_mm,
      ensureNumber(roomAnalysis?.constraints_json?.sofa_wall_width_mm, 3600),
    ),
    roomDepthMm: ensureNullableNumber(roomAnalysis?.constraints_json?.room_depth_mm),
    ceilingHeightMm: ensureNullableNumber(roomAnalysis?.constraints_json?.ceiling_height_mm),
  };

  const comparisonBaseProducts = activeRows
    .filter((row) => row.category !== compareCategory)
    .map((row) => (row.product_id ? productMap.get(row.product_id) : null))
    .filter((item): item is ProductRow => Boolean(item));

  const currentCompareRow =
    activeRows.find((row) => row.category === compareCategory && row.product_id) ?? null;

  const compareItems: ShareCompareItem[] = compareHistory
    .map((row) => {
      const product = row.product_id ? productMap.get(row.product_id) : null;
      if (!product) {
        return null;
      }

      const validationProducts = [product, ...comparisonBaseProducts];
      const report = validateLayout(room, toValidationFurniture(validationProducts));
      const target = report.items.find((item) => item.furnitureId === product.id);
      const matchedEffectImage = findEffectImageForProduct(
        effectImages ?? [],
        product.id,
        currentCompareRow?.product_id === product.id,
      );

      return {
        schemeProductId: row.id,
        productId: product.id,
        name: product.name,
        category: product.category,
        categoryLabel:
          PRODUCT_CATEGORY_DEFINITIONS[
            product.category as keyof typeof PRODUCT_CATEGORY_DEFINITIONS
          ]?.label ?? product.category,
        imageUrl: product.image_url,
        effectImageUrl: matchedEffectImage?.image_url ?? null,
        effectImageVersion: matchedEffectImage?.version ?? null,
        priceLabel: formatPriceRange(product.price_min, product.price_max),
        dimensionsLabel: formatDimensions(
          product.width_mm,
          product.depth_mm,
          product.height_mm,
        ),
        validationStatus: target?.status ?? report.overallStatus,
      } satisfies ShareCompareItem;
    })
    .filter((item): item is ShareCompareItem => item !== null);

  const currentEffectImage =
    (effectImages ?? []).find((item) => item.generation_status === "done" && item.image_url) ??
    effectImages?.[0] ??
    null;

  return {
    schemeId,
    effectImage: {
      imageUrl: currentEffectImage?.image_url ?? null,
      status: currentEffectImage?.generation_status ?? null,
      version: currentEffectImage?.version ?? null,
    },
    shoppingItems,
    shoppingSummary,
    compareCategory,
    compareCategoryLabel: compareCategory
      ? PRODUCT_CATEGORY_DEFINITIONS[
          compareCategory as keyof typeof PRODUCT_CATEGORY_DEFINITIONS
        ]?.label ?? compareCategory
      : null,
    compareItems,
    watermarkText: SHARE_WATERMARK_TEXT,
  };
}
