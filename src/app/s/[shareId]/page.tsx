import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ShareRenderCard } from "@/components/share/ShareRenderCard";
import { resolveShareType, fetchShareRenderData } from "@/lib/share/shareData";
import { createServiceRoleClient } from "@/lib/supabase/admin";

interface PublicSharePageProps {
  params: Promise<{ shareId: string }>;
}

interface ShareRow {
  id: string;
  scheme_id: string;
  share_type: string;
  watermark_level: string | null;
  view_count: number | null;
}

export const metadata: Metadata = {
  title: "HomeStylo 公开分享",
  description: "查看公开分享的 HomeStylo 家居方案。",
};

export default async function PublicSharePage({ params }: PublicSharePageProps) {
  const { shareId } = await params;
  const supabase = createServiceRoleClient();

  const { data: share } = await supabase
    .from("shares")
    .select("id, scheme_id, share_type, watermark_level, view_count")
    .eq("id", shareId)
    .single<ShareRow>();

  if (!share) {
    notFound();
  }

  const shareType = resolveShareType(share.share_type);
  if (!shareType) {
    notFound();
  }

  const data = await fetchShareRenderData(supabase, share.scheme_id);
  if (!data) {
    notFound();
  }

  await supabase
    .from("shares")
    .update({ view_count: (share.view_count ?? 0) + 1 })
    .eq("id", shareId);

  return (
    <main className="min-h-screen bg-[linear-gradient(180deg,#f9f4ec_0%,#f4ecdf_100%)] px-4 py-8 md:px-8">
      <div className="mx-auto flex w-full max-w-6xl flex-col gap-6">
        <div className="space-y-3 text-center">
          <p className="text-xs uppercase tracking-[0.28em] text-[#8B5A37]/70">
            Shared with HomeStylo
          </p>
          <h1 className="font-serif text-3xl font-semibold text-foreground md:text-4xl">
            买大件前，先放进你家看看
          </h1>
          <p className="mx-auto max-w-2xl text-sm leading-6 text-muted-foreground md:text-base">
            HomeStylo 会帮你在下单前先看效果、先验尺寸、再决定要不要买。
          </p>
        </div>

        <ShareRenderCard shareType={shareType} data={data} />

        <div className="sticky bottom-4 z-20">
          <div className="mx-auto flex w-full max-w-4xl flex-wrap items-center justify-between gap-3 rounded-[24px] border border-[#dec8aa] bg-white/95 px-4 py-4 shadow-lg backdrop-blur">
            <div>
              <p className="text-xs uppercase tracking-[0.22em] text-[#8B5A37]/70">
                HomeStylo
              </p>
              <p className="text-sm text-foreground">
                用 AI 帮你验证尺寸、预览效果、做出不后悔的选择
              </p>
            </div>

            <Link
              href="/"
              className="inline-flex h-11 items-center justify-center rounded-xl bg-[#8B5A37] px-5 text-sm font-semibold text-white transition-colors hover:bg-[#754a2f]"
            >
              用 HomeStylo 设计你的家
            </Link>
          </div>
        </div>
      </div>
    </main>
  );
}
