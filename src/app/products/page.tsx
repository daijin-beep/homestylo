import Image from "next/image";
import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { Card, CardContent } from "@/components/ui/card";

interface StyleRow {
  id: string;
  name: string;
  description: string | null;
  cover_image_url: string;
}

interface ProductRow {
  id: string;
  name: string;
  brand: string | null;
  price: number | null;
  price_min: number | null;
  image_url: string;
}

function formatProductPrice(product: ProductRow) {
  const rawValue = product.price ?? product.price_min ?? 0;
  return `\u00A5${new Intl.NumberFormat("zh-CN").format(rawValue)}`;
}

export default async function ProductsPage() {
  const supabase = await createClient();

  const { data: style, error: styleError } = await supabase
    .from("styles")
    .select("id, name, description, cover_image_url")
    .eq("id", "dopamine")
    .single<StyleRow>();

  if (styleError && styleError.code !== "PGRST116") {
    throw new Error(styleError.message);
  }

  const activeStyleId = style?.id ?? "dopamine";
  const { data: products, error: productsError } = await supabase
    .from("products")
    .select("id, name, brand, price, price_min, image_url")
    .eq("style", activeStyleId)
    .order("created_at", { ascending: false })
    .returns<ProductRow[]>();

  if (productsError) {
    throw new Error(productsError.message);
  }

  return (
    <main className="mx-auto flex w-full max-w-6xl flex-1 flex-col gap-8 px-4 py-8 md:px-8">
      <section className="rounded-xl border border-amber-300 bg-amber-50 px-4 py-3 text-sm text-amber-900">
        <p className="font-medium">{"旧商品列表流程已弃用"}</p>
        <p>
          {"推荐使用新的一体化创建页："}
          <Link href="/create" className="ml-1 font-semibold underline">
            {"/create"}
          </Link>
        </p>
      </section>

      <section className="overflow-hidden rounded-2xl border border-border bg-card">
        <div className="relative h-48 w-full md:h-64">
          <Image
            src={style?.cover_image_url ?? "/images/styles/dopamine-cover.webp"}
            alt={style?.name ?? "style cover"}
            fill
            className="object-cover"
            sizes="(max-width: 768px) 100vw, 1200px"
            priority
          />
          <div className="absolute inset-0 bg-gradient-to-t from-black/55 via-black/15 to-transparent" />
          <div className="absolute bottom-4 left-4 right-4 space-y-1 text-white">
            <h1 className="text-2xl font-serif font-semibold md:text-3xl">
              {style?.name ?? "\u591a\u5df4\u80fa / \u5b5f\u83f2\u65af"}
            </h1>
            <p className="text-sm text-white/90 md:text-base">
              {style?.description ?? "\u9ad8\u9971\u548c\u3001\u51e0\u4f55\u9020\u578b\u3001\u6d3b\u529b\u649e\u8272"}
            </p>
          </div>
        </div>
      </section>

      {products && products.length > 0 ? (
        <section className="grid grid-cols-2 gap-4 md:grid-cols-3 md:gap-6">
          {products.map((product) => (
            <Link key={product.id} href={`/products/${product.id}`} className="group block">
              <Card className="overflow-hidden rounded-xl border-border bg-card transition-all duration-200 group-hover:-translate-y-1 group-hover:shadow-lg">
                <div className="relative aspect-square w-full overflow-hidden">
                  <Image
                    src={product.image_url}
                    alt={product.name}
                    fill
                    className="object-cover transition-transform duration-300 group-hover:scale-[1.03]"
                    sizes="(max-width: 768px) 50vw, 33vw"
                  />
                </div>
                <CardContent className="space-y-1 p-3 md:p-4">
                  <h2 className="line-clamp-2 text-sm font-semibold leading-5 text-foreground md:text-base">
                    {product.name}
                  </h2>
                  {product.brand ? (
                    <p className="text-xs text-muted-foreground md:text-sm">{product.brand}</p>
                  ) : null}
                  <p className="text-sm font-semibold text-accent md:text-base">
                    {formatProductPrice(product)}
                  </p>
                </CardContent>
              </Card>
            </Link>
          ))}
        </section>
      ) : (
        <section className="flex flex-col items-center justify-center gap-4 rounded-2xl border border-dashed border-border bg-card px-6 py-14 text-center">
          <div className="flex h-20 w-20 items-center justify-center rounded-full bg-muted text-3xl">
            {"\ud83d\udecd\ufe0f"}
          </div>
          <p className="text-lg font-medium text-foreground">{"\u6682\u65e0\u5546\u54c1"}</p>
          <p className="text-sm text-muted-foreground">
            {"\u79cd\u5b50\u6570\u636e\u51c6\u5907\u5b8c\u6210\u540e\uff0c\u8fd9\u91cc\u4f1a\u663e\u793a\u5019\u9009\u5546\u54c1\u3002"}
          </p>
        </section>
      )}
    </main>
  );
}
