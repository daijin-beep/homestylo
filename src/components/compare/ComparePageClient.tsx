"use client";

import Image from "next/image";
import Link from "next/link";
import { useMemo, useState } from "react";
import { Loader2, CheckCircle2, AlertTriangle, XCircle } from "lucide-react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { PRODUCT_CATEGORY_DEFINITIONS } from "@/lib/constants";
import { cn } from "@/lib/utils";

export interface ComparisonCardItem {
  schemeProductId: string;
  category: string;
  product: {
    id: string;
    name: string;
    brand: string | null;
    imageUrl: string;
    priceMin: number;
    priceMax: number;
    widthMm: number;
    depthMm: number;
    heightMm: number;
  };
  effectImage: {
    imageUrl: string | null;
    status: string;
    version: number | null;
  } | null;
  validationStatus: "pass" | "warning" | "block";
  validationSummary: string;
  isCurrent: boolean;
}

interface ComparePageClientProps {
  schemeId: string;
  category: string;
  items: ComparisonCardItem[];
}

const STATUS_META = {
  pass: {
    label: "通过",
    className: "bg-emerald-100 text-emerald-700",
    icon: CheckCircle2,
  },
  warning: {
    label: "警告",
    className: "bg-amber-100 text-amber-700",
    icon: AlertTriangle,
  },
  block: {
    label: "阻塞",
    className: "bg-red-100 text-red-700",
    icon: XCircle,
  },
} as const;

function formatPrice(min: number, max: number) {
  if (min <= 0 && max <= 0) {
    return "价格待补充";
  }

  if (min === max) {
    return `¥${new Intl.NumberFormat("zh-CN").format(min)}`;
  }

  return `¥${new Intl.NumberFormat("zh-CN").format(min)} - ¥${new Intl.NumberFormat(
    "zh-CN",
  ).format(max)}`;
}

export function ComparePageClient({
  schemeId,
  category,
  items,
}: ComparePageClientProps) {
  const router = useRouter();
  const [selectedProductId, setSelectedProductId] = useState<string>(
    items.find((item) => item.isCurrent)?.product.id ?? items[0]?.product.id ?? "",
  );
  const [isSubmitting, setIsSubmitting] = useState(false);

  const selectedItem = useMemo(
    () => items.find((item) => item.product.id === selectedProductId) ?? items[0] ?? null,
    [items, selectedProductId],
  );

  const handleChoose = async () => {
    if (!selectedItem || isSubmitting) {
      return;
    }

    setIsSubmitting(true);
    try {
      const selectResponse = await fetch("/api/product/select", {
        method: "POST",
        headers: {
          "content-type": "application/json",
        },
        body: JSON.stringify({
          scheme_id: schemeId,
          product_id: selectedItem.product.id,
          category,
        }),
      });
      const selectPayload = (await selectResponse.json()) as {
        success?: boolean;
        error?: string;
      };

      if (!selectResponse.ok || selectPayload.success === false) {
        throw new Error(selectPayload.error ?? "切换当前商品失败。");
      }

      const validateResponse = await fetch("/api/product/validate", {
        method: "POST",
        headers: {
          "content-type": "application/json",
        },
        body: JSON.stringify({
          scheme_id: schemeId,
          product_id: selectedItem.product.id,
          category,
        }),
      });
      const validatePayload = (await validateResponse.json()) as {
        success?: boolean;
        status?: "pass" | "warning" | "block";
        suggestion?: string;
        error?: string;
      };

      if (!validateResponse.ok || validatePayload.success === false) {
        throw new Error(validatePayload.error ?? "新商品校验失败。");
      }

      if (validatePayload.status === "block") {
        toast.error(validatePayload.suggestion ?? "尺寸存在明显冲突，请回结果页查看。");
      } else if (validatePayload.status === "warning") {
        toast.success("已切换该方案，效果图正在刷新，结果页会显示警告项。");
      } else {
        toast.success("已切换该方案，效果图正在刷新。");
      }

      router.push(`/result/${schemeId}`);
      router.refresh();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "切换对比方案失败。");
    } finally {
      setIsSubmitting(false);
    }
  };

  const categoryLabel =
    PRODUCT_CATEGORY_DEFINITIONS[category as keyof typeof PRODUCT_CATEGORY_DEFINITIONS]?.label ??
    category;

  return (
    <main className="mx-auto flex w-full max-w-7xl flex-1 flex-col gap-6 px-4 py-6 md:px-8 md:py-8">
      <section className="rounded-3xl border border-[#e4d7c5] bg-[radial-gradient(circle_at_top_left,_rgba(255,255,255,0.96),_rgba(246,239,228,0.98))] p-6">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="space-y-2">
            <p className="text-xs uppercase tracking-[0.25em] text-[#8B5A37]/70">
              三选一对比
            </p>
            <h1 className="font-serif text-3xl font-semibold text-foreground">
              {`比较同一空间下的 ${categoryLabel} 方案`}
            </h1>
            <p className="max-w-2xl text-sm text-muted-foreground">
              横向查看不同商品在同一空间中的效果、尺寸和校验状态，选定后会直接刷新结果页。
            </p>
          </div>

          <Link
            href={`/result/${schemeId}`}
            className="inline-flex h-10 items-center justify-center rounded-lg border border-border bg-white px-4 text-sm font-medium text-foreground transition-colors hover:bg-muted"
          >
            返回结果页
          </Link>
        </div>
      </section>

      <section className="grid gap-4 lg:grid-cols-3">
        {items.map((item) => {
          const statusMeta = STATUS_META[item.validationStatus];
          const StatusIcon = statusMeta.icon;

          return (
            <article
              key={item.schemeProductId}
              className={cn(
                "overflow-hidden rounded-2xl border bg-white shadow-sm transition-all",
                selectedProductId === item.product.id
                  ? "border-[#8B5A37] ring-2 ring-[#8B5A37]/15"
                  : "border-border",
              )}
            >
              <button
                type="button"
                className="block w-full text-left"
                onClick={() => setSelectedProductId(item.product.id)}
              >
                <div className="relative aspect-[4/3] w-full bg-[#f5f0e8]">
                  {item.effectImage?.imageUrl ? (
                    <Image
                      src={item.effectImage.imageUrl}
                      alt={item.product.name}
                      fill
                      className="object-cover"
                      sizes="(max-width: 1024px) 100vw, 33vw"
                      unoptimized
                    />
                  ) : (
                    <div className="flex h-full items-center justify-center px-6 text-center text-sm text-muted-foreground">
                      {item.effectImage?.status && item.effectImage.status !== "done"
                        ? `效果图状态：${item.effectImage.status}`
                        : "当前还没有可用效果图版本"}
                    </div>
                  )}

                  <div className="absolute left-3 top-3 flex flex-wrap gap-2">
                    {item.isCurrent ? (
                      <span className="rounded-full bg-black/70 px-2 py-1 text-xs font-medium text-white">
                        当前方案
                      </span>
                    ) : null}
                    {item.effectImage?.version ? (
                      <span className="rounded-full bg-white/85 px-2 py-1 text-xs font-medium text-[#8B5A37]">
                        {`v${item.effectImage.version}`}
                      </span>
                    ) : null}
                  </div>
                </div>
              </button>

              <div className="space-y-3 p-4">
                <div className="space-y-1">
                  <p className="text-base font-semibold text-foreground">{item.product.name}</p>
                  <p className="text-sm text-muted-foreground">
                    {item.product.brand ? `${categoryLabel} · ${item.product.brand}` : categoryLabel}
                  </p>
                </div>

                <div className="grid gap-2 text-sm text-muted-foreground">
                  <div className="rounded-lg bg-[#f8f5ef] px-3 py-2">
                    {`${item.product.widthMm} × ${item.product.depthMm} × ${item.product.heightMm}mm`}
                  </div>
                  <div className="rounded-lg bg-[#f8f5ef] px-3 py-2 text-[#8B5A37]">
                    {formatPrice(item.product.priceMin, item.product.priceMax)}
                  </div>
                </div>

                <div
                  className={cn(
                    "inline-flex items-center gap-2 rounded-full px-3 py-1 text-xs font-medium",
                    statusMeta.className,
                  )}
                >
                  <StatusIcon className="h-3.5 w-3.5" />
                  {statusMeta.label}
                </div>

                <p className="text-sm text-muted-foreground">{item.validationSummary}</p>
              </div>
            </article>
          );
        })}

        {items.length < 3 ? (
          <Link
            href={`/import/${schemeId}?category=${category}`}
            className="flex min-h-[460px] items-center justify-center rounded-2xl border border-dashed border-[#d7c4ad] bg-[#fbf7f0] px-6 text-center text-sm font-medium text-[#8B5A37] transition-colors hover:bg-[#f7efe4]"
          >
            添加对比项
          </Link>
        ) : null}
      </section>

      <div className="sticky bottom-4 z-20 mt-2">
        <div className="mx-auto flex w-full max-w-4xl flex-wrap items-center justify-between gap-3 rounded-2xl border border-[#dec8aa] bg-white/95 px-4 py-3 shadow-lg backdrop-blur">
          <div className="min-w-0">
            <p className="text-xs uppercase tracking-[0.2em] text-[#8B5A37]/70">
              当前选择
            </p>
            <p className="truncate text-sm font-semibold text-foreground">
              {selectedItem?.product.name ?? "请选择一个方案"}
            </p>
          </div>

          <div className="flex items-center gap-2">
            <Link
              href={`/import/${schemeId}?category=${category}`}
              className="inline-flex h-10 items-center justify-center rounded-lg border border-border bg-white px-4 text-sm font-medium text-foreground transition-colors hover:bg-muted"
            >
              再加一个
            </Link>
            <button
              type="button"
              onClick={handleChoose}
              disabled={!selectedItem || isSubmitting}
              className="inline-flex h-10 items-center justify-center gap-2 rounded-lg bg-[#8B5A37] px-4 text-sm font-semibold text-white transition-colors hover:bg-[#754a2f] disabled:cursor-not-allowed disabled:opacity-60"
            >
              {isSubmitting ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  切换中...
                </>
              ) : (
                "选这个"
              )}
            </button>
          </div>
        </div>
      </div>
    </main>
  );
}
