import { SchemePagePlaceholder } from "@/components/SchemePagePlaceholder";

interface ResultPageProps {
  params: Promise<{ schemeId: string }>;
}

export default async function ResultPage({ params }: ResultPageProps) {
  const { schemeId } = await params;

  return (
    <SchemePagePlaceholder
      title="\u751f\u6210\u7ed3\u679c"
      backHref={`/generate/${schemeId}`}
      currentStep="result"
      schemeId={schemeId}
    />
  );
}
