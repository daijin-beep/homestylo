import { SchemePagePlaceholder } from "@/components/SchemePagePlaceholder";

interface ComparePageProps {
  params: Promise<{ schemeId: string }>;
}

export default async function ComparePage({ params }: ComparePageProps) {
  const { schemeId } = await params;

  return (
    <SchemePagePlaceholder
      title="\u65b9\u6848\u5bf9\u6bd4"
      backHref={`/result/${schemeId}`}
      currentStep="compare"
      schemeId={schemeId}
    />
  );
}
