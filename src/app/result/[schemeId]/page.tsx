import { notFound } from "next/navigation";
import { ResultDashboardClient } from "@/components/result/ResultDashboardClient";
import { createClient } from "@/lib/supabase/server";
import type { PlacedFurniture, RoomPlanDimensions } from "@/lib/layout/types";
import type { FurnitureItem, ValidationReport } from "@/lib/validation/dimensionValidator";
import { validateLayout } from "@/lib/validation/dimensionValidator";

interface ResultPageProps {
  params: Promise<{ schemeId: string }>;
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
  } | null;
}

interface SchemeProductRow {
  id: string;
  product_id: string | null;
  category: string;
  notes: string | null;
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

export default async function ResultPage({ params }: ResultPageProps) {
  const { schemeId } = await params;
  const supabase = await createClient();

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

  const { data: schemeProducts } = await supabase
    .from("scheme_products")
    .select("id, product_id, category, notes")
    .eq("scheme_id", schemeId)
    .eq("import_source", "recommendation")
    .order("created_at", { ascending: true })
    .returns<SchemeProductRow[]>();

  const productIds = (schemeProducts ?? [])
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
  const recommendations = (schemeProducts ?? [])
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
  const sofaWallWidth = ensureNumber(roomAnalysis?.constraints_json?.sofa_wall_width_mm, room.widthMm);
  const tvWallWidth = ensureNumber(roomAnalysis?.constraints_json?.tv_wall_width_mm, room.widthMm);
  const roomDepthMm = ensureNullableNumber(roomAnalysis?.constraints_json?.room_depth_mm) ?? room.depthMm;

  const report: ValidationReport = validateLayout(
    {
      sofaWallWidthMm: sofaWallWidth,
      tvWallWidthMm: tvWallWidth,
      roomDepthMm,
      ceilingHeightMm: null,
    },
    toValidationFurniture(products),
  );

  return (
    <ResultDashboardClient
      schemeId={scheme.id}
      room={room}
      initialFurniture={placedFurniture}
      report={report}
      recommendations={recommendations}
    />
  );
}

