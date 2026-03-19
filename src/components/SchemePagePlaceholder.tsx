import type { ReactNode } from "react";
import type { SchemeStep } from "@/lib/store/schemeStore";
import { BackLinkButton } from "@/components/BackLinkButton";
import { SchemeNavigation } from "@/components/SchemeNavigation";

interface SchemePagePlaceholderProps {
  title: string;
  backHref: string;
  currentStep: SchemeStep;
  schemeId?: string;
  children?: ReactNode;
}

export function SchemePagePlaceholder({
  title,
  backHref,
  currentStep,
  schemeId,
  children,
}: SchemePagePlaceholderProps) {
  return (
    <main className="mx-auto flex w-full max-w-5xl flex-1 flex-col gap-6 px-4 py-8 md:px-8">
      <div className="flex items-center justify-between gap-4">
        <BackLinkButton href={backHref} />
      </div>

      <section className="space-y-4">
        <h1 className="text-3xl font-serif text-foreground">{title}</h1>
        <SchemeNavigation currentStep={currentStep} schemeId={schemeId} />
      </section>

      <section className="rounded-2xl border border-border bg-card p-6">
        {children ?? (
          <p className="text-muted-foreground">
            {"\u8be5\u9875\u9762\u4e3a\u5360\u4f4d\u9875\uff0c\u5c06\u5728\u540e\u7eed\u9636\u6bb5\u586b\u5145\u529f\u80fd\u3002"}
          </p>
        )}
      </section>
    </main>
  );
}
