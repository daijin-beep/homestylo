"use client";

import Image from "next/image";
import Link from "next/link";
import { useMemo, useState } from "react";
import {
  CheckCircle2,
  ExternalLink,
  Loader2,
  ReceiptText,
  Wallet,
} from "lucide-react";
import { EmptyStateCard } from "@/components/brand/EmptyStateCard";
import { toast } from "sonner";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { PRODUCT_CATEGORY_DEFINITIONS } from "@/lib/constants";
import { cn } from "@/lib/utils";

export interface AccountingItem {
  schemeProductId: string;
  productId: string | null;
  name: string;
  category: string;
  imageUrl: string | null;
  sourceUrl: string | null;
  widthMm: number | null;
  depthMm: number | null;
  heightMm: number | null;
  priceMin: number | null;
  priceMax: number | null;
  estimatedPrice: number;
  actualPrice: number | null;
  purchasedAt: string | null;
  status: string | null;
}

interface AccountingDashboardClientProps {
  schemeId: string;
  items: AccountingItem[];
}

function formatCurrency(value: number | null) {
  if (typeof value !== "number" || !Number.isFinite(value) || value < 0) {
    return "待补充";
  }

  return `¥${new Intl.NumberFormat("zh-CN", {
    maximumFractionDigits: 0,
  }).format(value)}`;
}

function formatPriceRange(min: number | null, max: number | null) {
  if (!min && !max) {
    return "价格待补充";
  }

  const normalizedMin = min ?? max ?? 0;
  const normalizedMax = max ?? min ?? normalizedMin;

  if (normalizedMin === normalizedMax) {
    return formatCurrency(normalizedMin);
  }

  return `${formatCurrency(normalizedMin)} - ${formatCurrency(normalizedMax)}`;
}

function formatDimensions(item: AccountingItem) {
  if (!item.widthMm || !item.depthMm || !item.heightMm) {
    return "尺寸待补充";
  }

  return `${item.widthMm} × ${item.depthMm} × ${item.heightMm} mm`;
}

function getBudgetTone(ratio: number) {
  if (ratio > 1) {
    return {
      bar: "bg-red-500",
      chip: "border-red-200 bg-red-50 text-red-700",
      label: "预算已超支",
    };
  }

  if (ratio >= 0.8) {
    return {
      bar: "bg-amber-500",
      chip: "border-amber-200 bg-amber-50 text-amber-700",
      label: "预算接近上限",
    };
  }

  return {
    bar: "bg-emerald-500",
    chip: "border-emerald-200 bg-emerald-50 text-emerald-700",
    label: "预算健康",
  };
}

export function AccountingDashboardClient({
  schemeId,
  items: initialItems,
}: AccountingDashboardClientProps) {
  const [items, setItems] = useState(initialItems);
  const [activeItem, setActiveItem] = useState<AccountingItem | null>(null);
  const [actualPriceInput, setActualPriceInput] = useState("");
  const [submittingId, setSubmittingId] = useState<string | null>(null);

  const totals = useMemo(() => {
    const estimated = items.reduce((sum, item) => sum + item.estimatedPrice, 0);
    const spent = items.reduce(
      (sum, item) => sum + (item.status === "purchased" ? item.actualPrice ?? 0 : 0),
      0,
    );

    return {
      estimated,
      spent,
      remaining: estimated - spent,
      ratio: estimated > 0 ? spent / estimated : 0,
    };
  }, [items]);

  const budgetTone = getBudgetTone(totals.ratio);

  const updateLocalItem = (
    schemeProductId: string,
    nextStatus: "confirmed" | "purchased",
    actualPrice: number | null,
    purchasedAt: string | null,
  ) => {
    setItems((current) =>
      current.map((item) =>
        item.schemeProductId === schemeProductId
          ? {
              ...item,
              status: nextStatus,
              actualPrice,
              purchasedAt,
            }
          : item,
      ),
    );
  };

  const submitPurchase = async () => {
    if (!activeItem) {
      return;
    }

    const actualPrice = Number(actualPriceInput);
    if (!Number.isFinite(actualPrice) || actualPrice <= 0) {
      toast.error("请输入有效的实际成交价。");
      return;
    }

    setSubmittingId(activeItem.schemeProductId);
    try {
      const response = await fetch("/api/product/purchase", {
        method: "POST",
        headers: {
          "content-type": "application/json",
        },
        body: JSON.stringify({
          scheme_id: schemeId,
          scheme_product_id: activeItem.schemeProductId,
          action: "purchase",
          actual_price: actualPrice,
        }),
      });
      const payload = (await response.json()) as {
        success?: boolean;
        error?: string;
        schemeProduct?: {
          status: "confirmed" | "purchased";
          actual_price: number | null;
          purchased_at: string | null;
        };
      };

      if (!response.ok || payload.success === false || !payload.schemeProduct) {
        throw new Error(payload.error ?? "更新购买状态失败。");
      }

      updateLocalItem(
        activeItem.schemeProductId,
        payload.schemeProduct.status,
        payload.schemeProduct.actual_price,
        payload.schemeProduct.purchased_at,
      );
      toast.success("已记录成交价并标记为已购买。");
      setActiveItem(null);
      setActualPriceInput("");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "更新购买状态失败。");
    } finally {
      setSubmittingId(null);
    }
  };

  const resetPurchase = async (item: AccountingItem) => {
    setSubmittingId(item.schemeProductId);
    try {
      const response = await fetch("/api/product/purchase", {
        method: "POST",
        headers: {
          "content-type": "application/json",
        },
        body: JSON.stringify({
          scheme_id: schemeId,
          scheme_product_id: item.schemeProductId,
          action: "reset",
        }),
      });
      const payload = (await response.json()) as {
        success?: boolean;
        error?: string;
        schemeProduct?: {
          status: "confirmed" | "purchased";
          actual_price: number | null;
          purchased_at: string | null;
        };
      };

      if (!response.ok || payload.success === false || !payload.schemeProduct) {
        throw new Error(payload.error ?? "恢复待购买状态失败。");
      }

      updateLocalItem(item.schemeProductId, "confirmed", null, null);
      toast.success("已恢复为待购买。");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "恢复待购买状态失败。");
    } finally {
      setSubmittingId(null);
    }
  };

  return (
    <>
      <main className="mx-auto flex w-full max-w-7xl flex-1 flex-col gap-6 px-4 py-6 md:px-8 md:py-8">
        <section className="rounded-[28px] border border-[#dfd2c1] bg-[linear-gradient(140deg,#fffdf9_0%,#f7f1e7_50%,#efe4d5_100%)] px-6 py-6 shadow-sm">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div className="space-y-2">
              <p className="text-xs uppercase tracking-[0.3em] text-[#8B5A37]/70">
                Shopping List
              </p>
              <h1 className="font-serif text-3xl font-semibold text-foreground md:text-4xl">
                当前方案购物清单与预算追踪
              </h1>
              <p className="max-w-2xl text-sm leading-6 text-muted-foreground md:text-base">
                把已经确定的大件、成交价和剩余预算放在一个页面里看清楚，临下单前更安心。
              </p>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <Link
                href={`/result/${schemeId}`}
                className="inline-flex h-10 items-center justify-center rounded-xl border border-border bg-white px-4 text-sm font-medium text-foreground transition-colors hover:bg-muted"
              >
                返回结果页
              </Link>
              <Link
                href={`/share/${schemeId}`}
                className="inline-flex h-10 items-center justify-center rounded-xl bg-[#8B5A37] px-4 text-sm font-semibold text-white transition-colors hover:bg-[#754a2f]"
              >
                去生成分享链接
              </Link>
            </div>
          </div>
        </section>

        <section className="grid gap-4 lg:grid-cols-3">
          <article className="rounded-2xl border border-border bg-white p-5 shadow-sm">
            <div className="flex items-center gap-3">
              <div className="rounded-2xl bg-[#f3e7d7] p-3 text-[#8B5A37]">
                <Wallet className="h-5 w-5" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">总预估预算</p>
                <p className="text-2xl font-semibold text-foreground">
                  {formatCurrency(totals.estimated)}
                </p>
              </div>
            </div>
          </article>

          <article className="rounded-2xl border border-border bg-white p-5 shadow-sm">
            <div className="flex items-center gap-3">
              <div className="rounded-2xl bg-emerald-50 p-3 text-emerald-600">
                <CheckCircle2 className="h-5 w-5" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">已花费</p>
                <p className="text-2xl font-semibold text-foreground">
                  {formatCurrency(totals.spent)}
                </p>
              </div>
            </div>
          </article>

          <article className="rounded-2xl border border-border bg-white p-5 shadow-sm">
            <div className="flex items-center gap-3">
              <div className="rounded-2xl bg-[#f5f0e9] p-3 text-[#8B5A37]">
                <ReceiptText className="h-5 w-5" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">剩余预算</p>
                <p className="text-2xl font-semibold text-foreground">
                  {formatCurrency(Math.abs(totals.remaining))}
                </p>
                <p className="text-xs text-muted-foreground">
                  {totals.remaining >= 0 ? "仍在预算内" : "已超出预估预算"}
                </p>
              </div>
            </div>
          </article>
        </section>

        <section className="rounded-2xl border border-border bg-white p-5 shadow-sm">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <h2 className="text-lg font-semibold text-foreground">预算进度</h2>
              <p className="text-sm text-muted-foreground">
                已花费 / 总预估预算 ={" "}
                {`${Math.min(totals.ratio * 100, 999).toFixed(totals.ratio > 1 ? 0 : 1)}%`}
              </p>
            </div>

            <span
              className={cn(
                "rounded-full border px-3 py-1 text-xs font-medium",
                budgetTone.chip,
              )}
            >
              {budgetTone.label}
            </span>
          </div>

          <div className="mt-4 h-3 overflow-hidden rounded-full bg-[#f1e7da]">
            <div
              className={cn("h-full rounded-full transition-all", budgetTone.bar)}
              style={{ width: `${Math.min(totals.ratio * 100, 100)}%` }}
            />
          </div>
        </section>

        <section className="overflow-hidden rounded-2xl border border-border bg-white shadow-sm">
          <div className="border-b border-border px-5 py-4">
            <h2 className="text-lg font-semibold text-foreground">完整家具清单</h2>
            <p className="mt-1 text-sm text-muted-foreground">
              共 {items.length} 件，支持记录成交价并持续刷新预算状态。
            </p>
          </div>

          {items.length > 0 ? (
            <div className="divide-y divide-border">
              {items.map((item) => {
                const categoryLabel =
                  PRODUCT_CATEGORY_DEFINITIONS[
                    item.category as keyof typeof PRODUCT_CATEGORY_DEFINITIONS
                  ]?.label ?? item.category;
                const isPurchased = item.status === "purchased";
                const estimatedPriceLabel = formatPriceRange(item.priceMin, item.priceMax);
                const showStrike =
                  isPurchased &&
                  item.actualPrice !== null &&
                  !(item.priceMin === item.actualPrice && item.priceMax === item.actualPrice);

                return (
                  <article
                    key={item.schemeProductId}
                    className={cn(
                      "grid gap-4 px-5 py-4 md:grid-cols-[1.4fr_1fr_0.95fr_180px]",
                      isPurchased && "bg-emerald-50/60",
                    )}
                  >
                    <div className="flex gap-4">
                      <div className="relative h-16 w-16 shrink-0 overflow-hidden rounded-2xl border border-border bg-[#f5f0e9]">
                        {item.imageUrl ? (
                          <Image
                            src={item.imageUrl}
                            alt={item.name}
                            fill
                            className="object-cover"
                            sizes="64px"
                            unoptimized
                          />
                        ) : (
                          <div className="flex h-full items-center justify-center text-xs text-muted-foreground">
                            暂无图
                          </div>
                        )}
                      </div>

                      <div className="min-w-0 space-y-2">
                        <div className="flex flex-wrap items-center gap-2">
                          <p className="text-base font-semibold text-foreground">{item.name}</p>
                          <span className="rounded-full bg-[#f5f0e9] px-2.5 py-1 text-xs font-medium text-[#8B5A37]">
                            {categoryLabel}
                          </span>
                          {isPurchased ? (
                            <span className="inline-flex items-center gap-1 rounded-full bg-emerald-100 px-2.5 py-1 text-xs font-medium text-emerald-700">
                              <CheckCircle2 className="h-3.5 w-3.5" />
                              已购买
                            </span>
                          ) : null}
                        </div>

                        <p className="text-sm text-muted-foreground">
                          {formatDimensions(item)}
                        </p>

                        <div className="flex flex-wrap items-center gap-3 text-sm">
                          <span
                            className={cn(
                              "font-medium text-[#8B5A37]",
                              showStrike && "text-muted-foreground line-through",
                            )}
                          >
                            {estimatedPriceLabel}
                          </span>
                          {isPurchased && item.actualPrice !== null ? (
                            <span className="font-semibold text-emerald-700">
                              成交价 {formatCurrency(item.actualPrice)}
                            </span>
                          ) : null}
                          {item.sourceUrl ? (
                            <Link
                              href={item.sourceUrl}
                              target="_blank"
                              className="inline-flex items-center gap-1 text-sm text-[#8B5A37] hover:underline"
                            >
                              来源链接
                              <ExternalLink className="h-3.5 w-3.5" />
                            </Link>
                          ) : null}
                        </div>
                      </div>
                    </div>

                    <div className="space-y-2">
                      <p className="text-xs uppercase tracking-[0.2em] text-muted-foreground">
                        状态
                      </p>
                      <div
                        className={cn(
                          "inline-flex rounded-full px-3 py-1 text-sm font-medium",
                          isPurchased
                            ? "bg-emerald-100 text-emerald-700"
                            : "bg-[#f5f0e9] text-[#8B5A37]",
                        )}
                      >
                        {isPurchased ? "已购买" : "待购买"}
                      </div>
                      {item.purchasedAt ? (
                        <p className="text-sm text-muted-foreground">
                          购买时间 {new Date(item.purchasedAt).toLocaleDateString("zh-CN")}
                        </p>
                      ) : (
                        <p className="text-sm text-muted-foreground">
                          还未记录真实成交价
                        </p>
                      )}
                    </div>

                    <div className="space-y-2">
                      <p className="text-xs uppercase tracking-[0.2em] text-muted-foreground">
                        预算参考
                      </p>
                      <p className="text-base font-semibold text-foreground">
                        {formatCurrency(item.estimatedPrice)}
                      </p>
                      <p className="text-sm text-muted-foreground">
                        用于总预算与剩余金额的计算
                      </p>
                    </div>

                    <div className="flex flex-col items-stretch justify-center gap-2">
                      {isPurchased ? (
                        <button
                          type="button"
                          onClick={() => void resetPurchase(item)}
                          disabled={submittingId === item.schemeProductId}
                          className="inline-flex h-10 items-center justify-center gap-2 rounded-xl border border-border bg-white px-4 text-sm font-medium text-foreground transition-colors hover:bg-muted disabled:cursor-not-allowed disabled:opacity-60"
                        >
                          {submittingId === item.schemeProductId ? (
                            <>
                              <Loader2 className="h-4 w-4 animate-spin" />
                              更新中
                            </>
                          ) : (
                            "改回待购买"
                          )}
                        </button>
                      ) : (
                        <button
                          type="button"
                          onClick={() => {
                            setActiveItem(item);
                            setActualPriceInput(
                              item.estimatedPrice > 0 ? String(item.estimatedPrice) : "",
                            );
                          }}
                          disabled={submittingId === item.schemeProductId}
                          className="inline-flex h-10 items-center justify-center gap-2 rounded-xl bg-[#8B5A37] px-4 text-sm font-semibold text-white transition-colors hover:bg-[#754a2f] disabled:cursor-not-allowed disabled:opacity-60"
                        >
                          标记为已购买
                        </button>
                      )}
                    </div>
                  </article>
                );
              })}
            </div>
          ) : (
            <div className="px-5 py-8">
              <EmptyStateCard
                title="当前方案还没有可记账的商品"
                description="先去生成推荐、导入商品或完成替换，这里就会自动出现购物清单与预算追踪。"
                eyebrow="Shopping List"
              />
            </div>
          )}
        </section>
      </main>

      <div className="sticky bottom-0 z-20 border-t border-border bg-white/95 backdrop-blur">
        <div className="mx-auto flex w-full max-w-7xl flex-wrap items-center justify-between gap-4 px-4 py-4 md:px-8">
          <div className="flex flex-wrap items-center gap-5">
            <div>
              <p className="text-xs uppercase tracking-[0.18em] text-muted-foreground">
                总预估预算
              </p>
              <p className="text-lg font-semibold text-foreground">
                {formatCurrency(totals.estimated)}
              </p>
            </div>
            <div>
              <p className="text-xs uppercase tracking-[0.18em] text-muted-foreground">
                已花费
              </p>
              <p className="text-lg font-semibold text-emerald-700">
                {formatCurrency(totals.spent)}
              </p>
            </div>
            <div>
              <p className="text-xs uppercase tracking-[0.18em] text-muted-foreground">
                剩余
              </p>
              <p
                className={cn(
                  "text-lg font-semibold",
                  totals.remaining >= 0 ? "text-foreground" : "text-red-600",
                )}
              >
                {totals.remaining >= 0 ? "" : "-"}
                {formatCurrency(Math.abs(totals.remaining))}
              </p>
            </div>
          </div>

          <Link
            href={`/share/${schemeId}`}
            className="inline-flex h-11 items-center justify-center rounded-xl bg-[#8B5A37] px-5 text-sm font-semibold text-white transition-colors hover:bg-[#754a2f]"
          >
            下一步：分享方案
          </Link>
        </div>
      </div>

      <Dialog
        open={Boolean(activeItem)}
        onOpenChange={(open) => {
          if (!open) {
            setActiveItem(null);
            setActualPriceInput("");
          }
        }}
      >
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>记录实际成交价</DialogTitle>
            <DialogDescription>
              {activeItem
                ? `为「${activeItem.name}」填写这次真实下单价格，记账页会同步更新预算。`
                : "填写实际成交价后，将自动标记为已购买。"}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-3">
            <div className="rounded-2xl bg-[#f8f4ed] px-4 py-3 text-sm text-muted-foreground">
              预估价格：{activeItem ? formatPriceRange(activeItem.priceMin, activeItem.priceMax) : "--"}
            </div>
            <div className="space-y-2">
              <label htmlFor="actual-price" className="text-sm font-medium text-foreground">
                实际成交价
              </label>
              <Input
                id="actual-price"
                type="number"
                min="1"
                step="0.01"
                value={actualPriceInput}
                onChange={(event) => setActualPriceInput(event.target.value)}
                placeholder="例如 8999"
              />
            </div>
          </div>

          <DialogFooter>
            <button
              type="button"
              className="inline-flex h-10 items-center justify-center rounded-lg border border-border bg-white px-4 text-sm font-medium text-foreground transition-colors hover:bg-muted"
              onClick={() => {
                setActiveItem(null);
                setActualPriceInput("");
              }}
            >
              取消
            </button>
            <button
              type="button"
              className="inline-flex h-10 items-center justify-center gap-2 rounded-lg bg-[#8B5A37] px-4 text-sm font-semibold text-white transition-colors hover:bg-[#754a2f] disabled:cursor-not-allowed disabled:opacity-60"
              disabled={!activeItem || submittingId === activeItem.schemeProductId}
              onClick={() => void submitPurchase()}
            >
              {activeItem && submittingId === activeItem.schemeProductId ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  保存中
                </>
              ) : (
                "确认已购买"
              )}
            </button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
