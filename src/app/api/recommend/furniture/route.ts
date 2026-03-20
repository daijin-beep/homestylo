import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import {
  buildFurnitureRecommendations,
  getRoleByCategory,
  type ProductCandidate,
  type RecommendationRoomInput,
  type RecommendationSchemeInput,
} from "@/lib/recommendation/furnitureRecommendation";
import type { RoomType } from "@/lib/types";

interface RecommendFurnitureBody {
  scheme_id?: string;
  limit_per_category?: number;
}

interface SchemeRow {
  id: string;
  room_type: RoomType;
  style: string | null;
  aesthetic_preferences: {
    style?: string | null;
    moodboards?: string[];
    colors?: string[];
  } | null;
}

interface RoomAnalysisRow {
  constraints_json: RecommendationRoomInput | null;
}

function createServiceRoleClient() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!supabaseUrl || !serviceRoleKey) {
    throw new Error("缺少 Supabase service role 环境变量。");
  }

  return createClient(supabaseUrl, serviceRoleKey, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
    },
  });
}

function normalizeLimit(value: unknown) {
  if (typeof value === "number" && Number.isFinite(value)) {
    return Math.min(5, Math.max(1, Math.floor(value)));
  }

  return 3;
}

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as RecommendFurnitureBody;
    const schemeId = body.scheme_id?.trim();

    if (!schemeId) {
      return NextResponse.json(
        { success: false, error: "缺少 scheme_id。" },
        { status: 400 },
      );
    }

    const supabase = createServiceRoleClient();

    const { data: scheme, error: schemeError } = await supabase
      .from("schemes")
      .select("id, room_type, style, aesthetic_preferences")
      .eq("id", schemeId)
      .single<SchemeRow>();

    if (schemeError || !scheme) {
      return NextResponse.json(
        { success: false, error: "方案不存在或无权访问。" },
        { status: 404 },
      );
    }

    const { data: roomAnalysis } = await supabase
      .from("room_analysis")
      .select("constraints_json")
      .eq("scheme_id", schemeId)
      .single<RoomAnalysisRow>();

    const selectedStyle = scheme.style ?? scheme.aesthetic_preferences?.style ?? "dopamine";

    const { data: products, error: productsError } = await supabase
      .from("products")
      .select(
        "id, name, category, style, price_min, price_max, width_mm, depth_mm, height_mm, image_url, source_url, brand, tags, is_hero",
      )
      .in("category", [
        "sofa",
        "coffee_table",
        "tv_cabinet",
        "bed",
        "dining_table",
        "rug",
        "floor_lamp",
        "side_table",
        "curtain",
        "painting",
      ])
      .in("style", [selectedStyle, "universal"]);

    if (productsError || !products) {
      throw new Error(productsError?.message ?? "加载商品数据失败。");
    }

    const recommendationResult = buildFurnitureRecommendations(
      scheme as RecommendationSchemeInput,
      roomAnalysis?.constraints_json,
      products as ProductCandidate[],
      normalizeLimit(body.limit_per_category),
    );

    const recommendedRows = recommendationResult.flatRecommendations.map((item) => ({
      scheme_id: schemeId,
      product_id: item.product.id,
      role: getRoleByCategory(item.product.category),
      category: item.product.category,
      is_user_imported: false,
      import_source: "recommendation",
      status: "recommended",
      notes: item.reason,
    }));

    const { error: deleteError } = await supabase
      .from("scheme_products")
      .delete()
      .eq("scheme_id", schemeId)
      .eq("import_source", "recommendation");

    if (deleteError) {
      throw new Error(deleteError.message);
    }

    if (recommendedRows.length > 0) {
      const { error: insertError } = await supabase
        .from("scheme_products")
        .insert(recommendedRows);

      if (insertError) {
        throw new Error(insertError.message);
      }
    }

    return NextResponse.json({
      success: true,
      scheme_id: schemeId,
      room_type: recommendationResult.roomType,
      style: recommendationResult.style,
      categories: recommendationResult.requestedCategories,
      total: recommendationResult.flatRecommendations.length,
      recommendations: recommendationResult.groupedRecommendations,
    });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "生成家具推荐失败，请稍后重试。";
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
}
