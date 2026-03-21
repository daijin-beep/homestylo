import type { Metadata } from "next";
import { PricingPageClient } from "@/components/pricing/PricingPageClient";

interface PricingPageProps {
  searchParams?: Promise<{ plan?: string }>;
}

export const metadata: Metadata = {
  title: "套餐价格",
  description: "查看 HomeStylo 的定价方案并完成购买。",
};

export default async function PricingPage({ searchParams }: PricingPageProps) {
  const query = searchParams ? await searchParams : undefined;
  const initialPlan =
    query?.plan === "free" ||
    query?.plan === "trial" ||
    query?.plan === "serious" ||
    query?.plan === "full"
      ? query.plan
      : "serious";

  return <PricingPageClient initialPlan={initialPlan} />;
}
