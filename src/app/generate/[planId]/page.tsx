"use client";

import dynamic from "next/dynamic";
import { useParams } from "next/navigation";

const GeneratePageClient = dynamic(
  () => import("@/components/generate/GeneratePageClient"),
  { ssr: false },
);

export default function GeneratePage() {
  const params = useParams<{ planId: string }>();
  const planId = Array.isArray(params.planId) ? params.planId[0] : params.planId;

  if (!planId) {
    return null;
  }

  return <GeneratePageClient planId={planId} />;
}
