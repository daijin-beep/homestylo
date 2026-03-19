import { BackLinkButton } from "@/components/BackLinkButton";

interface PublicSharePageProps {
  params: Promise<{ shareId: string }>;
}

export default async function PublicSharePage({ params }: PublicSharePageProps) {
  const { shareId } = await params;

  return (
    <main className="mx-auto flex w-full max-w-5xl flex-1 flex-col gap-6 px-4 py-8 md:px-8">
      <BackLinkButton href="/" />

      <section className="space-y-2">
        <h1 className="text-3xl font-serif text-foreground">
          {"\u516c\u5f00\u5206\u4eab"}
        </h1>
        <p className="text-sm text-muted-foreground">{`ID: ${shareId}`}</p>
      </section>

      <section className="rounded-2xl border border-border bg-card p-6">
        <p className="text-muted-foreground">
          {"\u8be5\u9875\u9762\u4e3a\u516c\u5f00\u5206\u4eab\u5360\u4f4d\u9875\u3002"}
        </p>
      </section>
    </main>
  );
}
