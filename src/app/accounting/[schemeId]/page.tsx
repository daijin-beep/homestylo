import { SchemePagePlaceholder } from "@/components/SchemePagePlaceholder";

interface AccountingPageProps {
  params: Promise<{ schemeId: string }>;
}

export default async function AccountingPage({ params }: AccountingPageProps) {
  const { schemeId } = await params;

  return (
    <SchemePagePlaceholder
      title="\u9884\u7b97\u8bb0\u8d26"
      backHref={`/compare/${schemeId}`}
      currentStep="accounting"
      schemeId={schemeId}
    />
  );
}
