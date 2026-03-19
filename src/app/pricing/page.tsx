import { BackLinkButton } from "@/components/BackLinkButton";

export default function PricingPage() {
  return (
    <main className="mx-auto flex w-full max-w-5xl flex-1 flex-col gap-6 px-4 py-8 md:px-8">
      <BackLinkButton href="/" />

      <section className="space-y-2">
        <h1 className="text-3xl font-serif text-foreground">
          {"\u5957\u9910\u4ef7\u683c"}
        </h1>
      </section>

      <section className="rounded-2xl border border-border bg-card p-6">
        <p className="text-muted-foreground">
          {"\u8be5\u9875\u9762\u4e3a\u4ef7\u683c\u5360\u4f4d\u9875\uff0c\u540e\u7eed\u9636\u6bb5\u586b\u5145\u8be6\u7ec6\u5957\u9910\u4fe1\u606f\u3002"}
        </p>
      </section>
    </main>
  );
}
