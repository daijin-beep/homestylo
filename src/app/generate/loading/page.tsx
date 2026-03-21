import type { Metadata } from "next";
import { GenerateLoadingPageClient } from "@/components/generate/GenerateLoadingPageClient";

export const metadata: Metadata = {
  title: "生成中",
  description: "HomeStylo 正在分析空间、推荐商品并生成你的方案效果图。",
};

export default function GenerateLoadingPage() {
  return <GenerateLoadingPageClient />;
}
