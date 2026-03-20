import Image from "next/image";
import Link from "next/link";
import { Sparkles, Upload, ShoppingBag } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";

interface StyleRow {
  id: string;
  name: string;
  description: string | null;
  cover_image_url: string;
}

interface StyleCardData extends StyleRow {
  productCount: number;
}

async function getStylesWithProductCount(): Promise<StyleCardData[]> {
  const supabase = await createClient();
  const { data: styles, error } = await supabase
    .from("styles")
    .select("id, name, description, cover_image_url")
    .order("created_at", { ascending: true })
    .returns<StyleRow[]>();

  if (error) {
    return [];
  }

  const countPairs = await Promise.all(
    (styles ?? []).map(async (style) => {
      const { count } = await supabase
        .from("products")
        .select("*", { count: "exact", head: true })
        .eq("style", style.id);
      return [style.id, count ?? 0] as const;
    }),
  );

  const countMap = new Map(countPairs);
  return (styles ?? []).map((style) => ({
    ...style,
    productCount: countMap.get(style.id) ?? 0,
  }));
}

export default async function HomePage() {
  const styles = await getStylesWithProductCount();
  const displayStyles =
    styles.length > 0
      ? styles
      : [
          {
            id: "dopamine",
            name: "\u591a\u5df4\u80fa / \u5b5f\u83f2\u65af",
            description: "\u9ad8\u9971\u548c\u3001\u51e0\u4f55\u9020\u578b\u3001\u6d3b\u529b\u649e\u8272",
            cover_image_url: "/images/styles/dopamine-cover.webp",
            productCount: 0,
          },
        ];

  return (
    <main className="flex flex-1 flex-col">
      <section className="relative overflow-hidden border-b border-border bg-gradient-to-b from-[#fff8ee] via-[#fffdf8] to-background">
        <div className="mx-auto flex w-full max-w-6xl flex-col items-center gap-6 px-4 py-20 text-center md:px-8">
          <p className="inline-flex items-center gap-2 rounded-full border border-accent/40 bg-accent/10 px-3 py-1 text-xs font-medium text-accent">
            <Sparkles className="h-3.5 w-3.5" />
            {"HomeStylo"}
          </p>
          <h1 className="max-w-4xl text-[28px] font-extrabold leading-tight text-foreground md:text-[36px]">
            {"\u4e70\u5927\u4ef6\u524d\uff0c\u5148\u653e\u8fdb\u4f60\u5bb6\u770b\u770b"}
          </h1>
          <p className="max-w-2xl text-sm leading-7 text-muted-foreground md:text-lg">
            {"AI \u5e2e\u4f60\u9884\u89c8\u771f\u5b9e\u6548\u679c\uff0c\u9009\u5bf9\u4e0d\u9000\u8d27"}
          </p>
          <Button asChild className="h-12 px-8 text-base">
            <Link href="/products">{"\u5f00\u59cb\u9009\u54c1"}</Link>
          </Button>
        </div>
      </section>

      <section className="mx-auto flex w-full max-w-6xl flex-1 flex-col gap-6 px-4 py-10 md:px-8">
        <div className="flex items-end justify-between">
          <h2 className="text-2xl font-serif text-foreground">
            {"\u53ef\u7528\u98ce\u683c\u96c6"}
          </h2>
        </div>

        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 md:gap-6">
          {displayStyles.map((style) => (
            <Link key={style.id} href="/products" className="group block">
              <Card className="overflow-hidden rounded-2xl border-border bg-card transition-all duration-200 group-hover:-translate-y-1 group-hover:shadow-lg">
                <div className="relative aspect-[16/9] w-full">
                  <Image
                    src={style.cover_image_url}
                    alt={style.name}
                    fill
                    className="object-cover"
                    sizes="(max-width: 768px) 100vw, 50vw"
                  />
                  <div className="absolute inset-0 bg-gradient-to-t from-black/50 via-black/10 to-transparent" />
                  <div className="absolute bottom-3 left-3 right-3 text-white">
                    <p className="text-lg font-semibold">{style.name}</p>
                    <p className="line-clamp-2 text-xs text-white/90 md:text-sm">
                      {style.description ?? ""}
                    </p>
                  </div>
                </div>
                <CardContent className="p-4">
                  <p className="text-sm text-muted-foreground">
                    {`\u5df2\u4e0a\u67b6 ${style.productCount} \u4ef6\u5546\u54c1`}
                  </p>
                </CardContent>
              </Card>
            </Link>
          ))}
        </div>
      </section>

      <section className="border-t border-border bg-card/50">
        <div className="mx-auto grid w-full max-w-6xl gap-4 px-4 py-10 md:grid-cols-3 md:gap-6 md:px-8">
          <div className="flex gap-3 rounded-xl border border-border bg-card p-4">
            <div className="inline-flex h-10 w-10 items-center justify-center rounded-full bg-primary/10 text-primary">
              <ShoppingBag className="h-5 w-5" />
            </div>
            <div className="space-y-1">
              <p className="text-sm font-semibold text-foreground">
                {"Step 1: \u9009\u62e9\u5fc3\u4eea\u5bb6\u5177"}
              </p>
              <p className="text-xs text-muted-foreground">
                {"\u5148\u628a\u5019\u9009\u5927\u4ef6\u52a0\u5165\u6e05\u5355"}
              </p>
            </div>
          </div>

          <div className="flex gap-3 rounded-xl border border-border bg-card p-4">
            <div className="inline-flex h-10 w-10 items-center justify-center rounded-full bg-primary/10 text-primary">
              <Upload className="h-5 w-5" />
            </div>
            <div className="space-y-1">
              <p className="text-sm font-semibold text-foreground">
                {"Step 2: \u4e0a\u4f20\u4f60\u7684\u623f\u95f4\u7167\u7247"}
              </p>
              <p className="text-xs text-muted-foreground">{"Coming Soon"}</p>
            </div>
          </div>

          <div className="flex gap-3 rounded-xl border border-border bg-card p-4">
            <div className="inline-flex h-10 w-10 items-center justify-center rounded-full bg-primary/10 text-primary">
              <Sparkles className="h-5 w-5" />
            </div>
            <div className="space-y-1">
              <p className="text-sm font-semibold text-foreground">
                {"Step 3: AI \u751f\u6210\u642d\u914d\u6548\u679c\u56fe"}
              </p>
              <p className="text-xs text-muted-foreground">{"Coming Soon"}</p>
            </div>
          </div>
        </div>
      </section>
    </main>
  );
}
