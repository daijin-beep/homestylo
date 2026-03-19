import { BackLinkButton } from "@/components/BackLinkButton";

export default function AdminProductsPage() {
  return (
    <main className="mx-auto flex w-full max-w-5xl flex-1 flex-col gap-6 px-4 py-8 md:px-8">
      <BackLinkButton href="/dashboard" />

      <section className="space-y-2">
        <h1 className="text-3xl font-serif text-foreground">
          {"SKU \u7ba1\u7406"}
        </h1>
      </section>

      <section className="rounded-2xl border border-border bg-card p-6">
        <p className="text-muted-foreground">
          {"\u8be5\u9875\u9762\u4e3a\u7ba1\u7406\u7aef\u5360\u4f4d\u9875\uff0c\u540e\u7eed\u9636\u6bb5\u8865\u5168 SKU \u64cd\u4f5c\u529f\u80fd\u3002"}
        </p>
      </section>
    </main>
  );
}
