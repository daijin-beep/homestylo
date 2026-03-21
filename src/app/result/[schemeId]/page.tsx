import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { ResultDashboardClient } from "@/components/result/ResultDashboardClient";
import { requireCurrentAppUser } from "@/lib/plan/userProfile";
import { createClient } from "@/lib/supabase/server";
import type { PlacedFurniture, RoomPlanDimensions } from "@/lib/layout/types";
import type { FurnitureItem, ValidationReport } from "@/lib/validation/dimensionValidator";
import { validateLayout } from "@/lib/validation/dimensionValidator";

interface ResultPageProps {
  params: Promise<{ schemeId: string }>;
  searchParams?: Promise<{ v?: string }>;
}

interface SchemeRow {
  id: string;
  room_type: "living_room" | "bedroom" | "dining_room";
}

interface RoomAnalysisRow {
  constraints_json: {
    sofa_wall_width_mm?: number;
    tv_wall_width_mm?: number;
    room_depth_mm?: number | null;
    ceiling_height_mm?: number | null;
  } | null;
}

interface SchemeProductRow {
  id: string;
  product_id: string | null;
  category: string;
  notes: string | null;
  status: string | null;
  import_source: string | null;
  created_at: string;
}

interface ProductRow {
  id: string;
  name: string;
  brand: string | null;
  image_url: string;
  source_url: string | null;
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
  error_message: string | null;
  hotspot_map:
    | Array<{
        productId?: string;
        product_id?: string;
        label?: string;
        x?: number;
        y?: number;
        width?: number;
        height?: number;
      }>
    | null;
}

export const metadata: Metadata = {
  title: "方案结果",
  description: "查看布局图、尺寸校验、效果图和推荐清单，继续替换、对比或分享你的方案。",
};

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

function clamp(value: number, min: number, max: number) {
  if (value < min) {
    return min;
  }

  if (value > max) {
    return max;
  }

  return value;
}

function createRoomPlan(constraints: RoomAnalysisRow["constraints_json"]): RoomPlanDimensions {
  const sofaWall = ensureNumber(constraints?.sofa_wall_width_mm, 3600);
  const tvWall = ensureNumber(constraints?.tv_wall_width_mm, sofaWall);
  const roomWidth = Math.max(sofaWall, tvWall, 3200);
  const roomDepth = ensureNumber(constraints?.room_depth_mm, 5600);

  return {
    widthMm: roomWidth,
    depthMm: roomDepth,
    walls: [
      { side: "top", startMm: 0, endMm: roomWidth, type: "wall" },
      { side: "right", startMm: 0, endMm: roomDepth, type: "wall" },
      { side: "bottom", startMm: 0, endMm: roomWidth, type: "wall" },
      { side: "left", startMm: 0, endMm: roomDepth * 0.45, type: "wall" },
      { side: "left", startMm: roomDepth * 0.45, endMm: roomDepth * 0.7, type: "opening" },
      { side: "left", startMm: roomDepth * 0.7, endMm: roomDepth, type: "wall" },
      { side: "top", startMm: roomWidth * 0.15, endMm: roomWidth * 0.42, type: "window" },
      { side: "bottom", startMm: roomWidth * 0.08, endMm: roomWidth * 0.24, type: "door" },
    ],
  };
}

function buildPlacedFurniture(products: ProductRow[], room: RoomPlanDimensions): PlacedFurniture[] {
  const sorted = [...products].sort((a, b) => {
    const priority: Record<string, number> = {
      sofa: 1,
      bed: 1,
      dining_table: 1,
      tv_cabinet: 2,
      coffee_table: 3,
      rug: 4,
      side_table: 5,
      floor_lamp: 6,
      painting: 7,
      curtain: 8,
    };

    return (priority[a.category] ?? 99) - (priority[b.category] ?? 99);
  });

  return sorted.map((item, index) => {
    const width = Math.min(item.width_mm, room.widthMm * 0.9);
    const depth = Math.min(item.depth_mm, room.depthMm * 0.7);
    const safeX = (x: number) => clamp(Math.round(x), 0, Math.max(0, room.widthMm - width));
    const safeY = (y: number) => clamp(Math.round(y), 0, Math.max(0, room.depthMm - depth));

    if (item.category === "sofa") {
      return {
        id: item.id,
        name: item.name,
        category: item.category,
        widthMm: width,
        depthMm: depth,
        x: safeX((room.widthMm - width) / 2),
        y: safeY(room.depthMm - depth - 120),
        rotation: 0,
        color: "#2B3A4A",
      };
    }

    if (item.category === "tv_cabinet") {
      return {
        id: item.id,
        name: item.name,
        category: item.category,
        widthMm: width,
        depthMm: depth,
        x: safeX((room.widthMm - width) / 2),
        y: safeY(120),
        rotation: 0,
        color: "#6B8E6B",
      };
    }

    if (item.category === "coffee_table") {
      return {
        id: item.id,
        name: item.name,
        category: item.category,
        widthMm: width,
        depthMm: depth,
        x: safeX((room.widthMm - width) / 2),
        y: safeY(room.depthMm * 0.54 - depth / 2),
        rotation: 0,
        color: "#8B5A37",
      };
    }

    if (item.category === "rug") {
      return {
        id: item.id,
        name: item.name,
        category: item.category,
        widthMm: width,
        depthMm: depth,
        x: safeX((room.widthMm - width) / 2),
        y: safeY(room.depthMm * 0.55 - depth / 2),
        rotation: 0,
        color: "#DDDDDD",
      };
    }

    if (item.category === "bed") {
      return {
        id: item.id,
        name: item.name,
        category: item.category,
        widthMm: width,
        depthMm: depth,
        x: safeX((room.widthMm - width) / 2),
        y: safeY((room.depthMm - depth) / 2),
        rotation: 0,
        color: "#9B59B6",
      };
    }

    if (item.category === "dining_table") {
      return {
        id: item.id,
        name: item.name,
        category: item.category,
        widthMm: width,
        depthMm: depth,
        x: safeX((room.widthMm - width) / 2),
        y: safeY((room.depthMm - depth) / 2),
        rotation: 0,
        color: "#C8956C",
      };
    }

    if (item.category === "floor_lamp") {
      return {
        id: item.id,
        name: item.name,
        category: item.category,
        widthMm: Math.min(width, 450),
        depthMm: Math.min(depth, 450),
        x: safeX(room.widthMm * 0.78),
        y: safeY(room.depthMm * 0.68),
        rotation: 0,
        color: "#FDCB6E",
      };
    }

    if (item.category === "side_table") {
      return {
        id: item.id,
        name: item.name,
        category: item.category,
        widthMm: Math.min(width, 600),
        depthMm: Math.min(depth, 600),
        x: safeX(room.widthMm * 0.16),
        y: safeY(room.depthMm * 0.72),
        rotation: 0,
        color: "#E67E22",
      };
    }

    return {
      id: item.id,
      name: item.name,
      category: item.category,
      widthMm: width,
      depthMm: depth,
      x: safeX((index * 240) % Math.max(1, room.widthMm - width)),
      y: safeY(room.depthMm * 0.2 + (index % 3) * 260),
      rotation: 0,
      color: "#94A3B8",
    };
  });
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

function pickLatestActiveSchemeProducts(rows: SchemeProductRow[]) {
  const latestByCategory = new Map<string, SchemeProductRow>();

  for (const row of rows) {
    if (row.status === "abandoned" || !row.product_id) {
      continue;
    }

    if (!latestByCategory.has(row.category)) {
      latestByCategory.set(row.category, row);
    }
  }

  return [...latestByCategory.values()];
}

export default async function ResultPage({ params, searchParams }: ResultPageProps) {
  const { schemeId } = await params;
  const query = searchParams ? await searchParams : undefined;
  const supabase = await createClient();
  const { appUser } = await requireCurrentAppUser();

  const { data: scheme } = await supabase
    .from("schemes")
    .select("id, room_type")
    .eq("id", schemeId)
    .single<SchemeRow>();

  if (!scheme) {
    notFound();
  }

  const { data: roomAnalysis } = await supabase
    .from("room_analysis")
    .select("constraints_json")
    .eq("scheme_id", schemeId)
    .single<RoomAnalysisRow>();

  const { data: effectImages } = await supabase
    .from("effect_images")
    .select("version, generation_status, image_url, error_message, hotspot_map")
    .eq("scheme_id", schemeId)
    .order("version", { ascending: true })
    .returns<EffectImageRow[]>();

  const { data: schemeProductRows } = await supabase
    .from("scheme_products")
    .select("id, product_id, category, notes, status, import_source, created_at")
    .eq("scheme_id", schemeId)
    .order("created_at", { ascending: false })
    .returns<SchemeProductRow[]>();

  const activeSchemeProducts = pickLatestActiveSchemeProducts(schemeProductRows ?? []);
  const productIds = activeSchemeProducts
    .map((item) => item.product_id)
    .filter((value): value is string => typeof value === "string");

  let products: ProductRow[] = [];
  if (productIds.length > 0) {
    const { data: productRows } = await supabase
      .from("products")
      .select(
        "id, name, brand, image_url, source_url, price_min, price_max, width_mm, depth_mm, height_mm, category",
      )
      .in("id", productIds)
      .returns<ProductRow[]>();

    products = productRows ?? [];
  }

  const productMap = new Map(products.map((item) => [item.id, item]));
  const recommendations = activeSchemeProducts
    .map((item) => {
      const product = item.product_id ? productMap.get(item.product_id) : null;
      if (!product) {
        return null;
      }

      return {
        schemeProductId: item.id,
        category: item.category,
        reason: item.notes,
        product: {
          id: product.id,
          name: product.name,
          brand: product.brand,
          imageUrl: product.image_url,
          sourceUrl: product.source_url,
          priceMin: product.price_min,
          priceMax: product.price_max,
          widthMm: product.width_mm,
          depthMm: product.depth_mm,
          heightMm: product.height_mm,
        },
      };
    })
    .filter((item): item is NonNullable<typeof item> => item !== null);

  const room = createRoomPlan(roomAnalysis?.constraints_json ?? null);
  const placedFurniture = buildPlacedFurniture(products, room);
  const sofaWallWidth = ensureNumber(
    roomAnalysis?.constraints_json?.sofa_wall_width_mm,
    room.widthMm,
  );
  const tvWallWidth = ensureNumber(
    roomAnalysis?.constraints_json?.tv_wall_width_mm,
    room.widthMm,
  );
  const roomDepthMm =
    ensureNullableNumber(roomAnalysis?.constraints_json?.room_depth_mm) ?? room.depthMm;
  const ceilingHeightMm = ensureNullableNumber(
    roomAnalysis?.constraints_json?.ceiling_height_mm,
  );

  const report: ValidationReport = validateLayout(
    {
      sofaWallWidthMm: sofaWallWidth,
      tvWallWidthMm: tvWallWidth,
      roomDepthMm,
      ceilingHeightMm,
    },
    toValidationFurniture(products),
  );

  const selectedVersion = query?.v ? Number(query.v) : Number.NaN;
  const selectedEffectImage =
    effectImages && effectImages.length > 0
      ? effectImages.find((item) => item.version === selectedVersion) ??
        effectImages[effectImages.length - 1]
      : null;

  const normalizedEffectImage = selectedEffectImage
    ? {
        status: selectedEffectImage.generation_status,
        imageUrl: selectedEffectImage.image_url || null,
        errorMessage: selectedEffectImage.error_message || null,
        hotspots: (selectedEffectImage.hotspot_map ?? [])
          .map((item) => {
            const productId =
              typeof item.productId === "string"
                ? item.productId
                : typeof item.product_id === "string"
                  ? item.product_id
                  : null;

            if (!productId || typeof item.x !== "number" || typeof item.y !== "number") {
              return null;
            }

            return {
              productId,
              label: typeof item.label === "string" ? item.label : productId,
              x: Math.max(0, Math.min(1, item.x)),
              y: Math.max(0, Math.min(1, item.y)),
              width:
                typeof item.width === "number"
                  ? Math.max(0, Math.min(1, item.width))
                  : 0.1,
              height:
                typeof item.height === "number"
                  ? Math.max(0, Math.min(1, item.height))
                  : 0.1,
            };
          })
          .filter((item): item is NonNullable<typeof item> => item !== null),
      }
    : null;

  const effectImageVersionMeta =
    effectImages && effectImages.length > 0
      ? {
          current: selectedEffectImage?.version ?? effectImages[effectImages.length - 1].version,
          min: effectImages[0].version,
          max: effectImages[effectImages.length - 1].version,
        }
      : null;

  return (
    <ResultDashboardClient
      schemeId={scheme.id}
      room={room}
      initialFurniture={placedFurniture}
      report={report}
      recommendations={recommendations}
      effectImage={normalizedEffectImage}
      effectImageVersion={effectImageVersionMeta}
      currentPlan={appUser.plan_type}
    />
  );
}
