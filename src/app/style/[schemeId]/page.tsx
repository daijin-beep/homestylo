import { SchemePagePlaceholder } from "@/components/SchemePagePlaceholder";

interface StylePageProps {
  params: Promise<{ schemeId: string }>;
}

export default async function StylePage({ params }: StylePageProps) {
  const { schemeId } = await params;

  return (
    <SchemePagePlaceholder
      title="\u98ce\u683c\u9009\u62e9"
      backHref={`/import/${schemeId}`}
      currentStep="style"
      schemeId={schemeId}
    />
  );
}
