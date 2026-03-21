import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";
import { ShareComposerClient } from "@/components/share/ShareComposerClient";
import { SchemeNavigation } from "@/components/SchemeNavigation";
import { fetchShareRenderData } from "@/lib/share/shareData";
import { createClient } from "@/lib/supabase/server";

interface SharePageProps {
  params: Promise<{ schemeId: string }>;
}

interface SchemeRow {
  id: string;
  user_id: string;
}

export const metadata: Metadata = {
  title: "方案分享 | HomeStylo",
  description: "生成公开分享链接，把效果图、购物清单或三选一对比发给别人看。",
};

export default async function SharePage({ params }: SharePageProps) {
  const { schemeId } = await params;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect(`/login?redirect=/share/${schemeId}`);
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

  const data = await fetchShareRenderData(supabase, schemeId);
  if (!data) {
    notFound();
  }

  return (
    <main className="mx-auto flex w-full max-w-7xl flex-1 flex-col gap-6 px-4 py-6 md:px-8 md:py-8">
      <SchemeNavigation currentStep="accounting" schemeId={schemeId} />
      <ShareComposerClient schemeId={schemeId} data={data} />
    </main>
  );
}
