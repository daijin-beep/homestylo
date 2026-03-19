import { BackLinkButton } from "@/components/BackLinkButton";
import { SchemeNavigation } from "@/components/SchemeNavigation";

interface SharePageProps {
  params: Promise<{ schemeId: string }>;
}

export default async function SharePage({ params }: SharePageProps) {
  const { schemeId } = await params;

  return (
    <main className="mx-auto flex w-full max-w-5xl flex-1 flex-col gap-6 px-4 py-8 md:px-8">
      <BackLinkButton href={`/accounting/${schemeId}`} />

      <section className="space-y-4">
        <h1 className="text-3xl font-serif text-foreground">
          {"\u5206\u4eab\u9875\u9762"}
        </h1>
        <SchemeNavigation currentStep="accounting" schemeId={schemeId} />
      </section>

      <section className="rounded-2xl border border-border bg-card p-6">
        <p className="text-muted-foreground">
          {"\u8be5\u9875\u9762\u4e3a\u5360\u4f4d\u9875\uff0c\u5c06\u5728\u540e\u7eed\u9636\u6bb5\u586b\u5145\u5206\u4eab\u529f\u80fd\u3002"}
        </p>
      </section>
    </main>
  );
}
