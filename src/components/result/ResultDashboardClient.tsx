"use client";

import Image from "next/image";
import Link from "next/link";
import { startTransition, useMemo, useState } from "react";
import { AlertTriangle, CheckCircle2, ExternalLink, XCircle } from "lucide-react";
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

interface ResultDashboardClientProps {
  schemeId: string;
  room: RoomPlanDimensions;
  initialFurniture: PlacedFurniture[];
  report: ValidationReport;
  recommendations: ResultRecommendationItem[];
}

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

  return `¥${new Intl.NumberFormat("zh-CN").format(min)} - ¥${new Intl.NumberFormat("zh-CN").format(max)}`;
}

export function ResultDashboardClient({
  schemeId,
  room,
  initialFurniture,
  report,
  recommendations,
}: ResultDashboardClientProps) {
  const router = useRouter();
  const [selectedId, setSelectedId] = useState<string | null>(
    initialFurniture[0]?.id ?? null,
  );
  const [furniture, setFurniture] = useState<PlacedFurniture[]>(initialFurniture);
  const [isBackfilling, setIsBackfilling] = useState(false);

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
        throw new Error("推荐接口调用失败");
      }

      startTransition(() => {
        router.refresh();
      });
    } finally {
      setIsBackfilling(false);
    }
  };

  return (
    <main className="mx-auto flex w-full max-w-7xl flex-1 flex-col gap-6 px-4 py-6 md:px-8 md:py-8">
      <section className="rounded-2xl border border-border bg-white p-5">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div className="space-y-2">
            <p className="text-xs uppercase tracking-wide text-muted-foreground">
              {`方案 ${schemeId.slice(0, 8)}`}
            </p>
            <h1 className="font-serif text-2xl font-semibold text-foreground md:text-3xl">
              {"空间校验与推荐结果"}
            </h1>
          </div>
          <Link
            href={`/generate/loading?scheme_id=${schemeId}`}
            className="inline-flex h-10 items-center justify-center rounded-lg bg-[#8B5A37] px-4 text-sm font-semibold text-white transition-colors hover:bg-[#754a2f]"
          >
            重新生成效果图
          </Link>
        </div>
      </section>

      <section
        className="rounded-2xl border border-border bg-white p-5"
        style={{ borderColor: `${STATUS_COLOR[report.overallStatus]}55` }}
      >
        <div className="flex items-center gap-2" style={{ color: STATUS_COLOR[report.overallStatus] }}>
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
              当前校验没有发现明显冲突，可以直接进入效果图生成。
            </div>
          )}
        </div>

        {report.suggestions.length > 0 ? (
          <div className="mt-4 space-y-2">
            {report.suggestions.map((suggestion) => (
              <p
                key={suggestion}
                className="rounded-lg border border-[#e8dcca] bg-[#fff8eb] px-3 py-2 text-sm text-[#7a5b2f]"
              >
                {suggestion}
              </p>
            ))}
          </div>
        ) : null}
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
          <h2 className="mb-3 text-lg font-semibold text-foreground">推荐清单</h2>
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
                    className="rounded-xl border border-border bg-[#faf8f2] p-3"
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
                        <p className="text-xs text-muted-foreground">{label}</p>
                        <p className="text-xs text-muted-foreground">
                          {`${item.product.widthMm}×${item.product.depthMm}×${item.product.heightMm}mm`}
                        </p>
                        <p className="text-sm font-semibold text-[#8B5A37]">
                          {formatPrice(item.product.priceMin, item.product.priceMax)}
                        </p>
                      </div>
                    </div>

                    {item.reason ? (
                      <p className="mt-2 rounded-md bg-white px-2 py-1 text-xs text-muted-foreground">
                        {`推荐理由：${item.reason}`}
                      </p>
                    ) : null}

                    {item.product.sourceUrl ? (
                      <Link
                        href={item.product.sourceUrl}
                        className="mt-2 inline-flex items-center gap-1 text-xs text-[#8B5A37] hover:underline"
                        target="_blank"
                      >
                        查看来源
                        <ExternalLink className="h-3.5 w-3.5" />
                      </Link>
                    ) : null}
                  </div>
                );
              })}
            </div>
          ) : (
            <div className="space-y-3 rounded-lg border border-dashed border-border px-3 py-4 text-sm text-muted-foreground">
              <p>暂无推荐商品，你可以一键补全推荐清单。</p>
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
