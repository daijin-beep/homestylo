import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { createClient as createSupabaseClient } from "@supabase/supabase-js";
import { AddToCandidateButton } from "@/components/AddToCandidateButton";
import { Card, CardContent } from "@/components/ui/card";

interface ProductDetailRow {
  id: string;
  name: string;
  brand: string | null;
  price: number | null;
  price_min: number | null;
  image_url: string;
  source_url: string | null;
  dimensions: string | null;
  description: string | null;
  style: string;
}

interface ProductParams {
  id: string;
}

interface ProductDetailPageProps {
  params: Promise<ProductParams>;
}

function formatPrice(product: { price: number | null; price_min: number | null }) {
  const rawValue = product.price ?? product.price_min ?? 0;
  return `\u00A5${new Intl.NumberFormat("zh-CN").format(rawValue)}`;
}

function createStaticDataClient() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!supabaseUrl || !supabaseAnonKey) {
    throw new Error("Missing Supabase public environment variables.");
  }

  return createSupabaseClient(supabaseUrl, supabaseAnonKey, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
    },
  });
}

async function getProductById(id: string) {
  const supabase = createStaticDataClient();
  const { data, error } = await supabase
    .from("products")
    .select("id, name, brand, price, price_min, image_url, source_url, dimensions, description, style")
    .eq("id", id)
    .single<ProductDetailRow>();

  if (error) {
    return null;
  }

  return data;
}

export async function generateStaticParams() {
  const supabase = createStaticDataClient();
  const { data, error } = await supabase.from("products").select("id");

  if (error || !data) {
    return [];
  }

  return data.map((row) => ({ id: row.id as string }));
}

export async function generateMetadata({
  params,
}: ProductDetailPageProps): Promise<Metadata> {
  const { id } = await params;
  const product = await getProductById(id);

  if (!product) {
    return {
      title: "HomeStylo | \u5546\u54c1\u8be6\u60c5",
    };
  }

  return {
    title: `${product.name} | HomeStylo`,
    description: product.description ?? undefined,
  };
}

export default async function ProductDetailPage({ params }: ProductDetailPageProps) {
  const { id } = await params;
  const product = await getProductById(id);

  if (!product) {
    notFound();
  }

  const supabase = createStaticDataClient();
  const { data: recommendedProducts } = await supabase
    .from("products")
    .select("id, name, price, price_min, image_url")
    .eq("style", product.style)
    .neq("id", product.id)
    .limit(8);

  return (
    <main className="mx-auto flex w-full max-w-6xl flex-1 flex-col gap-8 px-4 py-6 md:px-8 md:py-8">
      <Link
        href="/products"
        className="inline-flex w-fit items-center gap-2 text-sm font-medium text-muted-foreground transition-colors hover:text-foreground"
      >
        <ArrowLeft className="h-4 w-4" />
        {"\u8fd4\u56de\u5217\u8868"}
      </Link>

      <section className="relative w-full overflow-hidden rounded-2xl border border-border bg-card">
        <div className="relative h-[48vh] max-h-[60vh] min-h-[280px] w-full">
          <Image
            src={product.image_url}
            alt={product.name}
            fill
            className="object-cover"
            sizes="100vw"
            priority
          />
        </div>
      </section>

      <section className="grid gap-6 md:grid-cols-[1fr_auto] md:items-start">
        <div className="space-y-3">
          <h1 className="text-3xl font-serif font-semibold text-foreground">{product.name}</h1>
          {product.brand ? (
            <p className="text-base text-muted-foreground">{product.brand}</p>
          ) : null}
          <p className="text-2xl font-bold text-accent">{formatPrice(product)}</p>
          {product.dimensions ? (
            <p className="text-sm text-muted-foreground">
              {`\u5c3a\u5bf8\uff1a${product.dimensions}`}
            </p>
          ) : null}
          {product.description ? (
            <p className="text-sm leading-6 text-foreground/90">{product.description}</p>
          ) : null}
          {product.source_url ? (
            <Link
              href={product.source_url}
              className="inline-flex text-sm text-primary underline-offset-4 hover:underline"
              target="_blank"
            >
              {"\u67e5\u770b\u5546\u54c1\u6765\u6e90"}
            </Link>
          ) : null}
        </div>

        <AddToCandidateButton productId={product.id} />
      </section>

      <section className="space-y-4">
        <h2 className="text-xl font-serif text-foreground">
          {"\u540c\u98ce\u683c\u63a8\u8350"}
        </h2>
        <div className="flex snap-x snap-mandatory gap-4 overflow-x-auto pb-2">
          {recommendedProducts && recommendedProducts.length > 0 ? (
            recommendedProducts.map((item) => (
              <Link
                key={item.id as string}
                href={`/products/${item.id as string}`}
                className="min-w-[120px] snap-start"
              >
                <Card className="overflow-hidden rounded-xl border-border">
                  <div className="relative h-[120px] w-[120px]">
                    <Image
                      src={(item.image_url as string) || "/images/products/placeholder.webp"}
                      alt={item.name as string}
                      fill
                      className="object-cover"
                      sizes="120px"
                    />
                  </div>
                  <CardContent className="space-y-1 p-2">
                    <p className="line-clamp-2 text-xs font-medium text-foreground">
                      {item.name as string}
                    </p>
                    <p className="text-xs font-semibold text-accent">
                      {formatPrice({
                        price: (item.price as number | null) ?? null,
                        price_min: (item.price_min as number | null) ?? null,
                      })}
                    </p>
                  </CardContent>
                </Card>
              </Link>
            ))
          ) : (
            <p className="text-sm text-muted-foreground">
              {"\u6682\u65e0\u540c\u98ce\u683c\u63a8\u8350"}
            </p>
          )}
        </div>
      </section>
    </main>
  );
}
