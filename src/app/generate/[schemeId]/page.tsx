"use client";

import dynamic from "next/dynamic";
import { useParams } from "next/navigation";

const GeneratePageClient = dynamic(
  () => import("@/components/generate/GeneratePageClient"),
  { ssr: false },
);

export default function GeneratePage() {
  const params = useParams<{ schemeId: string }>();
  const schemeId = Array.isArray(params.schemeId) ? params.schemeId[0] : params.schemeId;

  if (!schemeId) {
    return null;
  }

  return <GeneratePageClient schemeId={schemeId} />;
}
