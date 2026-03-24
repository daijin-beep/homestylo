"use client";

import dynamic from "next/dynamic";
import { useParams } from "next/navigation";

const FurnishingPlanPageClient = dynamic(
  () => import("@/components/furnishing/FurnishingPlanPageClient"),
  { ssr: false },
);

export default function FurnishingPlanPage() {
  const params = useParams<{ planId: string }>();
  const planId = Array.isArray(params.planId) ? params.planId[0] : params.planId;

  if (!planId) {
    return null;
  }

  return <FurnishingPlanPageClient planId={planId} />;
}
