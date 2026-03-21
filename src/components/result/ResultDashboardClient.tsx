"use client";

import Image from "next/image";
import Link from "next/link";
import { startTransition, useEffect, useMemo, useRef, useState } from "react";
import {
  AlertTriangle,
  CheckCircle2,
  ExternalLink,
  Loader2,
  RefreshCw,
  Sparkles,
  XCircle,
} from "lucide-react";
import { useRouter } from "next/navigation";
import { FloorPlanView } from "@/components/layout/FloorPlanView";
import { PRODUCT_CATEGORY_DEFINITIONS } from "@/lib/constants";
import { cn } from "@/lib/utils";
import type { PlacedFurniture, RoomPlanDimensions } from "@/lib/layout/types";
import type { ValidationReport } from "@/lib/validation/dimensionValidator";

export interface ResultRecommendationItem {
  schemeProductId: string;
  category: string;
  reason: string | null;
  product: {
    id: string;
    name: string;
    brand: string | null;
    imageUrl: string;
    sourceUrl: string | null;
    priceMin: number;
    priceMax: number;
    widthMm: number;
    depthMm: number;
    heightMm: number;
  };
}

export interface ResultEffectHotspot {
  productId: string;
  label: string;
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface ResultEffectImage {
  status: string;
  imageUrl: string | null;
  hotspots: ResultEffectHotspot[];
  errorMessage: string | null;
}

interface ResultDashboardClientProps {
  schemeId: string;
  room: RoomPlanDimensions;
  initialFurniture: PlacedFurniture[];
  report: ValidationReport;
  recommendations: ResultRecommendationItem[];
  effectImage: ResultEffectImage | null;
  effectImageVersion: {
    current: number;
    min: number;
    max: number;
  } | null;
}

const GENERATING_STATUSES = new Set(["pending", "depth", "flux", "hotspot"]);

const STATUS_TEXT: Record<ValidationReport["overallStatus"], string> = {
  pass: "尺寸校验通过",
  warning: "存在尺寸风险，请关注提示",
  block: "尺寸冲突明显，建议先调整",
};

const STATUS_COLOR: Record<ValidationReport["overallStatus"], string> = {
  pass: "#22c55e",
  warning: "#eab308",
  block: "#ef4444",
};

function getStatusIcon(status: ValidationReport["overallStatus"]) {
  if (status === "pass") {
    return <CheckCircle2 className="h-5 w-5" />;
  }

  if (status === "warning") {
    return <AlertTriangle className="h-5 w-5" />;
  }

  return <XCircle className="h-5 w-5" />;
}

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

function normalizeHotspots(raw: unknown): ResultEffectHotspot[] {
  if (!Array.isArray(raw)) {
    return [];
  }

  const hotspots: ResultEffectHotspot[] = [];
  for (const item of raw) {
    if (!item || typeof item !== "object") {
      continue;
    }

    const record = item as Record<string, unknown>;
    const rawId =
      typeof record.productId === "string"
        ? record.productId
        : typeof record.product_id === "string"
          ? record.product_id
          : null;

    if (!rawId) {
      continue;
    }

    const x = typeof record.x === "number" ? record.x : Number.NaN;
    const y = typeof record.y === "number" ? record.y : Number.NaN;
    if (!Number.isFinite(x) || !Number.isFinite(y)) {
      continue;
    }

    hotspots.push({
      productId: rawId,
      label: typeof record.label === "string" ? record.label : rawId,
      x: Math.max(0, Math.min(1, x)),
      y: Math.max(0, Math.min(1, y)),
      width:
        typeof record.width === "number"
          ? Math.max(0, Math.min(1, record.width))
          : 0.1,
      height:
        typeof record.height === "number"
          ? Math.max(0, Math.min(1, record.height))
          : 0.1,
    });
  }

  return hotspots;
}

export function ResultDashboardClient({
  schemeId,
  room,
  initialFurniture,
  report,
  recommendations,
  effectImage,
  effectImageVersion,
}: ResultDashboardClientProps) {
  const router = useRouter();
  const [selectedId, setSelectedId] = useState<string | null>(
    initialFurniture[0]?.id ?? null,
  );
  const [furniture, setFurniture] = useState<PlacedFurniture[]>(initialFurniture);
  const [isBackfilling, setIsBackfilling] = useState(false);
  const [isRegenerating, setIsRegenerating] = useState(false);
  const [localEffectImage, setLocalEffectImage] = useState<ResultEffectImage | null>(
    effectImage,
  );
  const [highlightedProductId, setHighlightedProductId] = useState<string | null>(null);
  const recommendationRefs = useRef<Record<string, HTMLDivElement | null>>({});

  useEffect(() => {
    setFurniture(initialFurniture);
    setSelectedId(initialFurniture[0]?.id ?? null);
  }, [initialFurniture]);

  useEffect(() => {
    setLocalEffectImage(effectImage);
  }, [effectImage]);

  useEffect(() => {
    if (!highlightedProductId) {
      return;
    }

    const timer = window.setTimeout(() => {
      setHighlightedProductId(null);
    }, 2800);

    return () => window.clearTimeout(timer);
  }, [highlightedProductId]);

  useEffect(() => {
    if (!localEffectImage || !GENERATING_STATUSES.has(localEffectImage.status)) {
      return;
    }

    let active = true;
    const timer = window.setInterval(async () => {
      if (!active) {
        return;
      }

      try {
        const response = await fetch(`/api/generate/status?scheme_id=${schemeId}`, {
          cache: "no-store",
        });
        const payload = (await response.json()) as {
          success?: boolean;
          status?: string;
          imageUrl?: string | null;
          errorMessage?: string | null;
          hotspots?: unknown;
        };

        if (!response.ok || payload.success === false) {
          return;
        }

        setLocalEffectImage({
          status: payload.status ?? "pending",
          imageUrl: payload.imageUrl ?? null,
          errorMessage: payload.errorMessage ?? null,
          hotspots: normalizeHotspots(payload.hotspots),
        });

        if (payload.status === "done") {
          startTransition(() => {
            router.refresh();
          });
        }
      } catch {
        // Ignore polling failures and continue next round.
      }
    }, 2000);

    return () => {
      active = false;
      window.clearInterval(timer);
    };
  }, [localEffectImage, router, schemeId]);

  const riskChecks = useMemo(
    () =>
      report.items
        .flatMap((item) =>
          item.checks
            .filter((check) => check.status !== "pass")
            .map((check) => ({
              key: `${item.furnitureId}-${check.rule}-${check.message}`,
              furnitureName: item.furnitureName,
              status: check.status,
              message: check.message,
              detail: check.detail,
            })),
        )
        .slice(0, 8),
    [report.items],
  );

  const isEffectGenerating =
    localEffectImage !== null && GENERATING_STATUSES.has(localEffectImage.status);

  const handleBackfillRecommendations = async () => {
    if (isBackfilling) {
      return;
    }

    setIsBackfilling(true);
    try {
      const response = await fetch("/api/recommend/furniture", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ scheme_id: schemeId }),
      });

      if (!response.ok) {
        throw new Error("推荐接口调用失败。");
      }

      startTransition(() => {
        router.refresh();
      });
    } finally {
      setIsBackfilling(false);
    }
  };

  const handleRegenerateEffectImage = async () => {
    if (isRegenerating) {
      return;
    }

    setIsRegenerating(true);
    try {
      const response = await fetch("/api/generate/effect-image", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ scheme_id: schemeId }),
      });
      const payload = (await response.json()) as { success?: boolean };

      if (!response.ok || payload.success === false) {
        throw new Error("效果图任务创建失败。");
      }

      setLocalEffectImage({
        status: "pending",
        imageUrl: null,
        hotspots: [],
        errorMessage: null,
      });
    } finally {
      setIsRegenerating(false);
    }
  };

  const handleHotspotClick = (productId: string) => {
    setHighlightedProductId(productId);
    setSelectedId(productId);
    const target = recommendationRefs.current[productId];
    if (target) {
      target.scrollIntoView({ behavior: "smooth", block: "center" });
    }
  };

  const renderEffectArea = () => {
    const status = localEffectImage?.status ?? "none";
    const isGenerating = GENERATING_STATUSES.has(status);
    const isDone = status === "done" && Boolean(localEffectImage?.imageUrl);
    const isFailed = status === "failed" || status === "none";

    return (
      <section className="rounded-2xl border border-border bg-white p-4 md:p-5">
        <div className="mb-3 flex items-center justify-between gap-3">
          <div className="flex flex-wrap items-center gap-2">
            <Sparkles className="h-5 w-5 text-[#8B5A37]" />
            <h2 className="text-lg font-semibold text-foreground">AI 效果图</h2>
            {effectImageVersion ? (
              <span className="rounded-full bg-[#f5f0e9] px-2 py-1 text-xs font-medium text-[#8B5A37]">
                {`版本 v${effectImageVersion.current}`}
              </span>
            ) : null}
            {isGenerating ? (
              <span className="rounded-full bg-amber-100 px-2 py-1 text-xs font-medium text-amber-700">
                正在重新生成
              </span>
            ) : null}
          </div>

          <div className="flex items-center gap-2">
            {effectImageVersion ? (
              <div className="flex items-center gap-1">
                <Link
                  href={
                    effectImageVersion.current > effectImageVersion.min
                      ? `/result/${schemeId}?v=${effectImageVersion.current - 1}`
                      : "#"
                  }
                  aria-disabled={effectImageVersion.current <= effectImageVersion.min}
                  className={cn(
                    "inline-flex h-8 items-center justify-center rounded-md border border-border px-2 text-xs font-medium transition-colors",
                    effectImageVersion.current > effectImageVersion.min
                      ? "bg-white text-foreground hover:bg-muted"
                      : "pointer-events-none bg-muted text-muted-foreground",
                  )}
                >
                  上一版
                </Link>
                <Link
                  href={
                    effectImageVersion.current < effectImageVersion.max
                      ? `/result/${schemeId}?v=${effectImageVersion.current + 1}`
                      : "#"
                  }
                  aria-disabled={effectImageVersion.current >= effectImageVersion.max}
                  className={cn(
                    "inline-flex h-8 items-center justify-center rounded-md border border-border px-2 text-xs font-medium transition-colors",
                    effectImageVersion.current < effectImageVersion.max
                      ? "bg-white text-foreground hover:bg-muted"
                      : "pointer-events-none bg-muted text-muted-foreground",
                  )}
                >
                  下一版
                </Link>
              </div>
            ) : null}

            <button
              type="button"
              onClick={handleRegenerateEffectImage}
              disabled={isRegenerating}
              className="inline-flex h-9 items-center justify-center gap-2 rounded-lg border border-border bg-white px-3 text-xs font-semibold text-foreground transition-colors hover:bg-muted disabled:cursor-not-allowed disabled:opacity-60"
            >
              {isRegenerating ? (
                <>
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                  提交中...
                </>
              ) : (
                <>
                  <RefreshCw className="h-3.5 w-3.5" />
                  重新生成
                </>
              )}
            </button>
          </div>
        </div>

        {isDone ? (
          <div className="space-y-3">
            <div className="relative overflow-hidden rounded-2xl border border-border bg-[#f8f7f3]">
              <div className="absolute right-3 top-3 z-10 rounded-full bg-black/60 px-3 py-1 text-xs font-semibold text-white">
                AI 生成效果图
              </div>
              <div className="relative aspect-[4/3] w-full">
                <Image
                  src={localEffectImage?.imageUrl ?? ""}
                  alt="AI 效果图"
                  fill
                  className="object-cover"
                  sizes="(max-width: 1024px) 100vw, 1200px"
                  unoptimized
                  loading="eager"
                />

                {localEffectImage?.hotspots.map((hotspot) => (
                  <button
                    key={`${hotspot.productId}-${hotspot.x}-${hotspot.y}`}
                    type="button"
                    title={hotspot.label}
                    onClick={() => handleHotspotClick(hotspot.productId)}
                    className="group absolute -translate-x-1/2 -translate-y-1/2"
                    style={{
                      left: `${hotspot.x * 100}%`,
                      top: `${hotspot.y * 100}%`,
                    }}
                  >
                    <span className="absolute inset-0 animate-ping rounded-full bg-[#8B5A37]/25" />
                    <span className="relative inline-flex h-10 w-10 items-center justify-center rounded-full border-2 border-[#8B5A37] bg-white/80 text-xs font-semibold text-[#8B5A37] shadow-sm">
                      热点
                    </span>
                    <span className="pointer-events-none absolute -top-8 left-1/2 -translate-x-1/2 whitespace-nowrap rounded-md bg-black/75 px-2 py-1 text-xs text-white opacity-0 transition group-hover:opacity-100">
                      {hotspot.label}
                    </span>
                  </button>
                ))}
              </div>
            </div>
            <p className="text-xs text-muted-foreground">
              点击热点可以快速定位并高亮下方推荐清单中的对应商品。
            </p>
          </div>
        ) : null}

        {isGenerating ? (
          <div className="space-y-3">
            <div className="relative overflow-hidden rounded-2xl border border-border bg-[#f8f7f3]">
              <div className="aspect-[4/3] w-full animate-pulse bg-gradient-to-br from-[#efe6d8] via-[#f8f3ea] to-[#ece1cf]" />
              <div className="absolute inset-0 flex items-center justify-center">
                <p className="rounded-full bg-black/60 px-4 py-2 text-sm text-white">
                  效果图生成中...
                </p>
              </div>
            </div>
            <p className="text-xs text-muted-foreground">
              {`当前阶段：${status}，页面会自动刷新最新结果。`}
            </p>
          </div>
        ) : null}

        {isFailed ? (
          <div className="space-y-3 rounded-xl border border-dashed border-border bg-[#faf8f2] px-4 py-6 text-center">
            <p className="text-sm text-muted-foreground">
              {localEffectImage?.errorMessage ?? "效果图暂未生成或生成失败。"}
            </p>
            <button
              type="button"
              onClick={handleRegenerateEffectImage}
              disabled={isRegenerating}
              className="inline-flex h-10 items-center justify-center rounded-lg bg-[#8B5A37] px-4 text-sm font-semibold text-white transition-colors hover:bg-[#754a2f] disabled:cursor-not-allowed disabled:opacity-60"
            >
              {isRegenerating ? "正在提交任务..." : "重新生成效果图"}
            </button>
          </div>
        ) : null}
      </section>
    );
  };

  return (
    <main className="mx-auto flex w-full max-w-7xl flex-1 flex-col gap-6 px-4 py-6 md:px-8 md:py-8">
      {renderEffectArea()}

      <section
        className="rounded-2xl border border-border bg-white p-5"
        style={{ borderColor: `${STATUS_COLOR[report.overallStatus]}55` }}
      >
        <div
          className="flex items-center gap-2"
          style={{ color: STATUS_COLOR[report.overallStatus] }}
        >
          {getStatusIcon(report.overallStatus)}
          <h2 className="text-lg font-semibold">{STATUS_TEXT[report.overallStatus]}</h2>
        </div>

        <div className="mt-4 grid gap-3 md:grid-cols-3">
          <div className="rounded-xl border border-border bg-[#faf8f2] p-3">
            <p className="text-xs text-muted-foreground">沙发占墙宽</p>
            <p className="text-sm font-semibold text-foreground">
              {(report.layoutMetrics.sofaWallOccupancy * 100).toFixed(1)}%
            </p>
          </div>
          <div className="rounded-xl border border-border bg-[#faf8f2] p-3">
            <p className="text-xs text-muted-foreground">通道宽度</p>
            <p className="text-sm font-semibold text-foreground">
              {report.layoutMetrics.passageWidth === null
                ? "--"
                : `${Math.round(report.layoutMetrics.passageWidth)}mm`}
            </p>
          </div>
          <div className="rounded-xl border border-border bg-[#faf8f2] p-3">
            <p className="text-xs text-muted-foreground">沙发到茶几间距</p>
            <p className="text-sm font-semibold text-foreground">
              {report.layoutMetrics.sofaToCoffeeTableGap === null
                ? "--"
                : `${Math.round(report.layoutMetrics.sofaToCoffeeTableGap)}mm`}
            </p>
          </div>
        </div>

        <div className="mt-4 space-y-2">
          {riskChecks.length > 0 ? (
            riskChecks.map((check) => (
              <article
                key={check.key}
                className={cn(
                  "rounded-lg border px-3 py-2 text-sm",
                  check.status === "block"
                    ? "border-red-200 bg-red-50 text-red-700"
                    : "border-amber-200 bg-amber-50 text-amber-700",
                )}
              >
                <p className="font-medium">{`${check.furnitureName}：${check.message}`}</p>
                <p className="text-xs opacity-90">{check.detail}</p>
              </article>
            ))
          ) : (
            <div className="rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-700">
              当前校验没有发现明显冲突，可以继续保持这套布局方案。
            </div>
          )}
        </div>
      </section>

      <section className="grid gap-6 xl:grid-cols-[1.45fr_1fr]">
        <article className="rounded-2xl border border-border bg-white p-4">
          <h2 className="mb-3 text-lg font-semibold text-foreground">2.5D 布局图</h2>
          <FloorPlanView
            room={room}
            furniture={furniture}
            selectedFurnitureId={selectedId}
            onFurnitureSelect={setSelectedId}
            onFurnitureMove={(id, x, y) =>
              setFurniture((current) =>
                current.map((item) => (item.id === id ? { ...item, x, y } : item)),
              )
            }
          />
        </article>

        <article className="rounded-2xl border border-border bg-white p-4">
          <div className="mb-3 flex items-center justify-between gap-3">
            <div className="flex items-center gap-2">
              <h2 className="text-lg font-semibold text-foreground">推荐清单</h2>
              {isEffectGenerating ? (
                <span className="rounded-full bg-amber-100 px-2 py-1 text-[11px] font-medium text-amber-700">
                  效果图更新中
                </span>
              ) : null}
            </div>

            <Link
              href={`/generate/loading?scheme_id=${schemeId}`}
              className="text-xs font-medium text-[#8B5A37] hover:underline"
            >
              重新跑全流程
            </Link>
          </div>

          {recommendations.length > 0 ? (
            <div className="space-y-3">
              {recommendations.map((item) => {
                const label =
                  PRODUCT_CATEGORY_DEFINITIONS[
                    item.category as keyof typeof PRODUCT_CATEGORY_DEFINITIONS
                  ]?.label ?? item.category;

                return (
                  <div
                    key={item.schemeProductId}
                    ref={(element) => {
                      recommendationRefs.current[item.product.id] = element;
                    }}
                    className={cn(
                      "rounded-xl border bg-[#faf8f2] p-3 transition-all",
                      highlightedProductId === item.product.id
                        ? "border-[#8B5A37] ring-2 ring-[#8B5A37]/25"
                        : "border-border",
                    )}
                  >
                    <button
                      type="button"
                      onClick={() => setSelectedId(item.product.id)}
                      className="w-full text-left"
                    >
                      <div className="flex gap-3">
                        <div className="relative h-20 w-20 shrink-0 overflow-hidden rounded-lg border border-border">
                          <Image
                            src={item.product.imageUrl || "/images/products/placeholder.webp"}
                            alt={item.product.name}
                            fill
                            className="object-cover"
                            sizes="80px"
                            unoptimized
                          />
                        </div>

                        <div className="min-w-0 flex-1 space-y-1">
                          <p className="line-clamp-2 text-sm font-semibold text-foreground">
                            {item.product.name}
                          </p>
                          <p className="text-xs text-muted-foreground">
                            {item.product.brand ? `${label} · ${item.product.brand}` : label}
                          </p>
                          <p className="text-xs text-muted-foreground">
                            {`${item.product.widthMm} × ${item.product.depthMm} × ${item.product.heightMm}mm`}
                          </p>
                          <p className="text-sm font-semibold text-[#8B5A37]">
                            {formatPrice(item.product.priceMin, item.product.priceMax)}
                          </p>
                        </div>
                      </div>
                    </button>

                    {item.reason ? (
                      <p className="mt-2 rounded-md bg-white px-2 py-1 text-xs text-muted-foreground">
                        {`推荐理由：${item.reason}`}
                      </p>
                    ) : null}

                    <div className="mt-3 flex flex-wrap items-center gap-2">
                      <Link
                        href={`/import/${schemeId}?replace=${item.product.id}&category=${item.category}`}
                        className="inline-flex h-8 items-center justify-center rounded-md bg-[#8B5A37] px-3 text-xs font-medium text-white transition-colors hover:bg-[#754a2f]"
                      >
                        换一个
                      </Link>
                      <Link
                        href={`/compare/${schemeId}?category=${item.category}`}
                        className="inline-flex h-8 items-center justify-center rounded-md border border-border px-3 text-xs font-medium text-foreground transition-colors hover:bg-white"
                      >
                        对比
                      </Link>
                      {item.product.sourceUrl ? (
                        <Link
                          href={item.product.sourceUrl}
                          className="inline-flex h-8 items-center gap-1 rounded-md border border-border px-3 text-xs text-[#8B5A37] hover:bg-white"
                          target="_blank"
                        >
                          查看来源
                          <ExternalLink className="h-3.5 w-3.5" />
                        </Link>
                      ) : null}
                    </div>
                  </div>
                );
              })}
            </div>
          ) : (
            <div className="space-y-3 rounded-lg border border-dashed border-border px-3 py-4 text-sm text-muted-foreground">
              <p>当前还没有推荐商品，你可以一键补全推荐清单。</p>
              <button
                type="button"
                onClick={handleBackfillRecommendations}
                disabled={isBackfilling}
                className="inline-flex h-9 items-center justify-center rounded-lg bg-[#8B5A37] px-3 text-xs font-semibold text-white transition-colors hover:bg-[#754a2f] disabled:cursor-not-allowed disabled:opacity-60"
              >
                {isBackfilling ? "正在补全..." : "一键补全推荐"}
              </button>
            </div>
          )}
        </article>
      </section>
    </main>
  );
}
