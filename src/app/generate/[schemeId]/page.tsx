import { SchemePagePlaceholder } from "@/components/SchemePagePlaceholder";

interface GeneratePageProps {
  params: Promise<{ schemeId: string }>;
}

export default async function GeneratePage({ params }: GeneratePageProps) {
  const { schemeId } = await params;

  return (
    <SchemePagePlaceholder
      title="\u751f\u6210\u9884\u89c8\u56fe"
      backHref={`/style/${schemeId}`}
      currentStep="generate"
      schemeId={schemeId}
    />
  );
}
