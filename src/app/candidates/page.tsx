"use client";

import Image from "next/image";
import Link from "next/link";
import { Trash2 } from "lucide-react";
import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { createClient } from "@/lib/supabase/client";
import {
  CANDIDATES_STORAGE_KEY,
  CANDIDATES_UPDATED_EVENT,
} from "@/hooks/useCandidateCount";

interface CandidateProduct {
  id: string;
  name: string;
  brand: string | null;
  price: number | null;
  price_min: number | null;
  image_url: string;
}

function readCandidateIds() {
  try {
    const rawValue = window.localStorage.getItem(CANDIDATES_STORAGE_KEY);
    if (!rawValue) {
      return [] as string[];
    }

    const parsed = JSON.parse(rawValue);
    return Array.isArray(parsed) ? (parsed as string[]) : [];
  } catch {
    return [] as string[];
  }
}

function formatPrice(product: CandidateProduct) {
  const rawValue = product.price ?? product.price_min ?? 0;
  return `\u00A5${new Intl.NumberFormat("zh-CN").format(rawValue)}`;
}

export default function CandidatesPage() {
  const [products, setProducts] = useState<CandidateProduct[]>([]);
  const [candidateIds, setCandidateIds] = useState<string[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [supabase] = useState(() => createClient());

  useEffect(() => {
    const loadCandidates = async () => {
      const ids = readCandidateIds();
      setCandidateIds(ids);

      if (ids.length === 0) {
        setProducts([]);
        setIsLoading(false);
        return;
      }

      const { data, error } = await supabase
        .from("products")
        .select("id, name, brand, price, price_min, image_url")
        .in("id", ids);

      if (error || !data) {
        setProducts([]);
        setIsLoading(false);
        return;
      }

      const sortedProducts = [...(data as CandidateProduct[])].sort(
        (a, b) => ids.indexOf(a.id) - ids.indexOf(b.id),
      );
      setProducts(sortedProducts);
      setIsLoading(false);
    };

    void loadCandidates();
  }, [supabase]);

  const handleRemove = (productId: string) => {
    const nextIds = candidateIds.filter((id) => id !== productId);
    setCandidateIds(nextIds);
    setProducts((current) => current.filter((item) => item.id !== productId));
    window.localStorage.setItem(CANDIDATES_STORAGE_KEY, JSON.stringify(nextIds));
    window.dispatchEvent(new Event(CANDIDATES_UPDATED_EVENT));
  };

  const totalPrice = products.reduce(
    (sum, product) => sum + (product.price ?? product.price_min ?? 0),
    0,
  );

  if (isLoading) {
    return (
      <main className="mx-auto flex w-full max-w-4xl flex-1 flex-col gap-4 px-4 py-8 md:px-8">
        <h1 className="text-3xl font-serif text-foreground">
          {"\u6211\u7684\u5019\u9009"}
        </h1>
        {Array.from({ length: 3 }).map((_, index) => (
          <div
            key={index}
            className="h-[100px] animate-pulse rounded-xl border border-border bg-card"
          />
        ))}
      </main>
    );
  }

  if (products.length === 0) {
    return (
      <main className="mx-auto flex min-h-[70vh] w-full max-w-4xl flex-1 flex-col items-center justify-center gap-5 px-4 py-8 text-center md:px-8">
        <h1 className="text-3xl font-serif text-foreground">
          {"\u6211\u7684\u5019\u9009"}
        </h1>
        <p className="max-w-md text-sm text-muted-foreground">
          {"\u8fd8\u6ca1\u6709\u9009\u4e2d\u5546\u54c1\uff0c\u5148\u53bb\u5546\u54c1\u5217\u8868\u6311\u9009\u5fc3\u4eea\u6b3e\u5f0f\u5427\u3002"}
        </p>
        <Button asChild className="h-12">
          <Link href="/products">{"\u53bb\u9009\u5546\u54c1"}</Link>
        </Button>
      </main>
    );
  }

  return (
    <main className="mx-auto flex w-full max-w-4xl flex-1 flex-col gap-4 px-4 py-8 pb-28 md:px-8 md:pb-8">
      <h1 className="text-3xl font-serif text-foreground">
        {"\u6211\u7684\u5019\u9009"}
      </h1>

      <section className="space-y-3">
        {products.map((product) => (
          <Card key={product.id} className="rounded-xl border-border bg-card">
            <CardContent className="flex items-center gap-3 p-3">
              <div className="relative h-20 w-20 overflow-hidden rounded-lg border border-border">
                <Image
                  src={product.image_url}
                  alt={product.name}
                  fill
                  className="object-cover"
                  sizes="80px"
                />
              </div>

              <div className="min-w-0 flex-1">
                <p className="line-clamp-2 text-sm font-semibold text-foreground">
                  {product.name}
                </p>
                {product.brand ? (
                  <p className="text-xs text-muted-foreground">{product.brand}</p>
                ) : null}
              </div>

              <div className="flex flex-col items-end gap-2">
                <p className="text-sm font-semibold text-accent">{formatPrice(product)}</p>
                <button
                  type="button"
                  onClick={() => handleRemove(product.id)}
                  className="inline-flex h-8 w-8 items-center justify-center rounded-md text-red-500 transition-colors hover:bg-red-50"
                  aria-label="\u79fb\u9664\u5019\u9009"
                >
                  <Trash2 className="h-4 w-4" />
                </button>
              </div>
            </CardContent>
          </Card>
        ))}
      </section>

      <section className="fixed inset-x-0 bottom-0 border-t border-border bg-white/95 p-4 backdrop-blur md:static md:mt-4 md:rounded-xl md:border">
        <div className="mx-auto flex w-full max-w-4xl items-center justify-between gap-4">
          <div className="space-y-1">
            <p className="text-sm text-muted-foreground">{`\u5df2\u9009 ${products.length} \u4ef6`}</p>
            <p className="text-lg font-semibold text-foreground">
              {`\u603b\u4ef7\u9884\u4f30\uff1a\u00A5${new Intl.NumberFormat("zh-CN").format(totalPrice)}`}
            </p>
          </div>
          <Button
            type="button"
            disabled
            className="h-12 min-w-40 opacity-50 cursor-not-allowed"
            title="Phase 2 \u5f00\u653e"
          >
            {"\u53bb\u751f\u6210\u6548\u679c\u56fe"}
          </Button>
        </div>
      </section>
    </main>
  );
}
