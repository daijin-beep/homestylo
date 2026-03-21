import { NextResponse } from "next/server";
import { createServiceRoleClient } from "@/lib/supabase/admin";
import { createClient as createAuthClient } from "@/lib/supabase/server";
import { resolveShareType } from "@/lib/share/shareData";

interface CreateShareBody {
  scheme_id?: string;
  share_type?: string;
}

interface OwnedSchemeRow {
  id: string;
  user_id: string;
}

interface ShareRow {
  id: string;
  scheme_id: string;
  share_type: string;
  watermark_level: string | null;
  created_at: string;
}

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as CreateShareBody;
    const schemeId = body.scheme_id?.trim();
    const shareType = resolveShareType(body.share_type);

    if (!schemeId || !shareType) {
      return NextResponse.json(
        { success: false, error: "缺少 scheme_id 或 share_type。" },
        { status: 400 },
      );
    }

    const authSupabase = await createAuthClient();
    const {
      data: { user },
      error: authError,
    } = await authSupabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json(
        { success: false, error: "请先登录后再生成分享链接。" },
        { status: 401 },
      );
    }

    const adminSupabase = createServiceRoleClient();
    const { data: scheme, error: schemeError } = await adminSupabase
      .from("schemes")
      .select("id, user_id")
      .eq("id", schemeId)
      .eq("user_id", user.id)
      .single<OwnedSchemeRow>();

    if (schemeError || !scheme) {
      return NextResponse.json(
        { success: false, error: "方案不存在或无权访问。" },
        { status: 404 },
      );
    }

    const { data: share, error: shareError } = await adminSupabase
      .from("shares")
      .insert({
        scheme_id: schemeId,
        share_type: shareType,
        watermark_level: "brand_bar",
      })
      .select("id, scheme_id, share_type, watermark_level, created_at")
      .single<ShareRow>();

    if (shareError || !share) {
      throw new Error(shareError?.message ?? "生成分享链接失败。");
    }

    const publicUrl = new URL(`/s/${share.id}`, request.url).toString();

    return NextResponse.json({
      success: true,
      shareId: share.id,
      publicUrl,
      shareType: share.share_type,
      watermarkLevel: share.watermark_level,
    });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "生成分享链接失败，请稍后重试。";
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
}
