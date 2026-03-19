import { SchemePagePlaceholder } from "@/components/SchemePagePlaceholder";

interface ImportPageProps {
  params: Promise<{ schemeId: string }>;
}

export default async function ImportPage({ params }: ImportPageProps) {
  const { schemeId } = await params;

  return (
    <SchemePagePlaceholder
      title="\u5bfc\u5165\u5019\u9009\u5546\u54c1"
      backHref={`/analyze/${schemeId}`}
      currentStep="import"
      schemeId={schemeId}
    />
  );
}
