import { NextResponse } from "next/server";
import { canGenerate, canReplace, incrementReplacement } from "@/lib/plan/checkUsage";
import { requireCurrentAppUser } from "@/lib/plan/userProfile";
import type { ProductCategory, StyleType } from "@/lib/types";
import {
  getMaxRecommendedSize,
  validateLayout,
  type Check,
  type FurnitureItem,
  type RoomDimensions,
} from "@/lib/validation/dimensionValidator";

interface ValidateProductBody {
  scheme_id?: string;
  product_id?: string;
  category?: ProductCategory;
}

interface OwnedSchemeRow {
  id: string;
  user_id: string;
  style: StyleType | null;
}

interface RoomAnalysisRow {
  constraints_json: {
    sofa_wall_width_mm?: number | null;
    tv_wall_width_mm?: number | null;
    room_depth_mm?: number | null;
    ceiling_height_mm?: number | null;
  } | null;
}

interface SchemeProductRow {
  product_id: string | null;
  category: ProductCategory;
  status: string | null;
}

interface ProductRow {
  id: string;
  name: string;
  category: ProductCategory;
  width_mm: number;
  depth_mm: number;
  height_mm: number;
}

async function requireOwnedScheme(schemeId: string) {
  const { authUser, appUser, adminSupabase } = await requireCurrentAppUser();
  const { data: scheme, error } = await adminSupabase
    .from("schemes")
    .select("id, user_id, style")
    .eq("id", schemeId)
    .eq("user_id", authUser.id)
    .single<OwnedSchemeRow>();

  if (error || !scheme) {
    throw new Error("Scheme not found or access denied.");
  }

  return {
    scheme,
    authUser,
    appUser,
    adminSupabase,
  };
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

function toPlacement(category: ProductCategory): FurnitureItem["placement"] {
  if (category === "sofa") {
    return "sofa_wall";
  }

  if (category === "tv_cabinet") {
    return "tv_wall";
  }

  if (category === "side_table") {
    return "corner";
  }

  if (category === "dining_table") {
    return "dining_area";
  }

  return "center";
}

function toValidationFurniture(products: ProductRow[]) {
  return products.map<FurnitureItem>((item) => ({
    id: item.id,
    name: item.name,
    category: item.category,
    widthMm: item.width_mm,
    depthMm: item.depth_mm,
    heightMm: item.height_mm,
    placement: toPlacement(item.category),
  }));
}

function pickLatestActiveProducts(records: SchemeProductRow[]) {
  const latestByCategory = new Map<ProductCategory, string>();

  for (const record of records) {
    if (!record.product_id || record.status === "abandoned") {
      continue;
    }

    if (!latestByCategory.has(record.category)) {
      latestByCategory.set(record.category, record.product_id);
    }
  }

  return latestByCategory;
}

async function triggerEffectImageGeneration(request: Request, schemeId: string) {
  const response = await fetch(new URL("/api/generate/effect-image", request.url), {
    method: "POST",
    headers: {
      "content-type": "application/json",
      cookie: request.headers.get("cookie") ?? "",
    },
    body: JSON.stringify({
      scheme_id: schemeId,
    }),
    cache: "no-store",
  });

  if (!response.ok) {
    const payload = (await response.json().catch(() => null)) as
      | { error?: string }
      | null;
    throw new Error(payload?.error ?? "Failed to trigger effect image regeneration.");
  }

  return (await response.json()) as {
    success?: boolean;
    effectImageId?: string;
    version?: number;
    error?: string;
  };
}

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as ValidateProductBody;
    const schemeId = body.scheme_id?.trim();
    const productId = body.product_id?.trim();
    const category = body.category;

    if (!schemeId || !productId || !category) {
      return NextResponse.json(
        { success: false, error: "Missing scheme_id, product_id, or category." },
        { status: 400 },
      );
    }

    const { authUser, appUser, adminSupabase } = await requireOwnedScheme(schemeId);
    const replacementCheck = canReplace(appUser);

    if (!replacementCheck.allowed) {
      return NextResponse.json(
        {
          success: false,
          code: "PAYWALL_LIMIT",
          reason: replacementCheck.reason,
          currentPlan: replacementCheck.currentPlan,
          suggestedPlan: replacementCheck.suggestedPlan,
        },
        { status: 403 },
      );
    }

    const generationCheck = canGenerate(appUser);
    if (!generationCheck.allowed) {
      return NextResponse.json(
        {
          success: false,
          code: "PAYWALL_LIMIT",
          reason: generationCheck.reason,
          currentPlan: generationCheck.currentPlan,
          suggestedPlan: generationCheck.suggestedPlan,
        },
        { status: 403 },
      );
    }

    await incrementReplacement(authUser.id);

    const { data: roomAnalysis, error: roomError } = await adminSupabase
      .from("room_analysis")
      .select("constraints_json")
      .eq("scheme_id", schemeId)
      .single<RoomAnalysisRow>();

    if (roomError || !roomAnalysis?.constraints_json) {
      return NextResponse.json(
        { success: false, error: "Room dimensions are not available for validation." },
        { status: 404 },
      );
    }

    const { data: schemeProducts, error: schemeProductsError } = await adminSupabase
      .from("scheme_products")
      .select("product_id, category, status")
      .eq("scheme_id", schemeId)
      .order("created_at", { ascending: false })
      .returns<SchemeProductRow[]>();

    if (schemeProductsError) {
      throw new Error(schemeProductsError.message);
    }

    const latestProductsByCategory = pickLatestActiveProducts(schemeProducts ?? []);
    latestProductsByCategory.set(category, productId);

    const productIds = [...new Set(latestProductsByCategory.values())];
    const { data: products, error: productsError } = await adminSupabase
      .from("products")
      .select("id, name, category, width_mm, depth_mm, height_mm")
      .in("id", productIds)
      .returns<ProductRow[]>();

    if (productsError) {
      throw new Error(productsError.message);
    }

    const productMap = new Map((products ?? []).map((item) => [item.id, item]));
    const targetProduct = productMap.get(productId);

    if (!targetProduct) {
      return NextResponse.json(
        { success: false, error: "Target product was not found." },
        { status: 404 },
      );
    }

    if (targetProduct.category !== category) {
      return NextResponse.json(
        { success: false, error: "Target product category does not match request." },
        { status: 400 },
      );
    }

    const orderedProducts = [...latestProductsByCategory.entries()]
      .map(([, id]) => productMap.get(id))
      .filter((item): item is ProductRow => Boolean(item));

    const room: RoomDimensions = {
      sofaWallWidthMm: ensureNumber(
        roomAnalysis.constraints_json.sofa_wall_width_mm,
        3600,
      ),
      tvWallWidthMm: ensureNumber(
        roomAnalysis.constraints_json.tv_wall_width_mm,
        ensureNumber(roomAnalysis.constraints_json.sofa_wall_width_mm, 3600),
      ),
      roomDepthMm: ensureNullableNumber(roomAnalysis.constraints_json.room_depth_mm),
      ceilingHeightMm: ensureNullableNumber(
        roomAnalysis.constraints_json.ceiling_height_mm,
      ),
    };

    const report = validateLayout(room, toValidationFurniture(orderedProducts));
    const targetResult = report.items.find((item) => item.furnitureId === targetProduct.id);
    const checks: Check[] = targetResult?.checks ?? [];
    const status = targetResult?.status ?? report.overallStatus;

    let suggestion: string | undefined;
    if (status === "block") {
      const recommended = getMaxRecommendedSize(room, category);
      suggestion = `建议将 ${targetProduct.name} 控制在宽 ${recommended.maxWidthMm}mm、深 ${recommended.maxDepthMm}mm 以内。${recommended.reason}`;
    }

    let generationTriggered = false;
    let generationVersion: number | null = null;
    let generationError: string | null = null;

    if (status === "pass" || status === "warning") {
      try {
        const generation = await triggerEffectImageGeneration(request, schemeId);
        generationTriggered = generation.success === true;
        generationVersion =
          typeof generation.version === "number" ? generation.version : null;
        generationError = generation.success === false ? generation.error ?? null : null;
      } catch (error) {
        generationError =
          error instanceof Error
            ? error.message
            : "Failed to trigger effect image regeneration.";
      }
    }

    return NextResponse.json({
      success: true,
      status,
      checks,
      suggestion,
      overallStatus: report.overallStatus,
      layoutMetrics: report.layoutMetrics,
      generationTriggered,
      generationVersion,
      generationError,
    });
  } catch (error) {
    if (error instanceof Error && error.message === "Authentication required.") {
      return NextResponse.json(
        { success: false, error: "Please sign in first." },
        { status: 401 },
      );
    }

    const message =
      error instanceof Error
        ? error.message
        : "Product validation failed. Please try again later.";

    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
}
