import { SchemePagePlaceholder } from "@/components/SchemePagePlaceholder";

interface AnalyzePageProps {
  params: Promise<{ schemeId: string }>;
}

export default async function AnalyzePage({ params }: AnalyzePageProps) {
  const { schemeId } = await params;

  return (
    <SchemePagePlaceholder
      title="\u7a7a\u95f4\u5206\u6790"
      backHref="/upload"
      currentStep="analyze"
      schemeId={schemeId}
    />
  );
}
