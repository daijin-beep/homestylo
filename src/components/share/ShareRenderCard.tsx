import Image from "next/image";
import { CheckCircle2, AlertTriangle, XCircle } from "lucide-react";
import { EmptyStateCard } from "@/components/brand/EmptyStateCard";
import type { ShareType } from "@/lib/types";
import type { ShareRenderData } from "@/lib/share/shareData";
import { cn } from "@/lib/utils";

interface ShareRenderCardProps {
  shareType: ShareType;
  data: ShareRenderData;
  className?: string;
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

function formatCurrency(value: number | null) {
  if (typeof value !== "number" || !Number.isFinite(value) || value < 0) {
    return "待补充";
  }

  return `¥${new Intl.NumberFormat("zh-CN", {
    maximumFractionDigits: 0,
  }).format(value)}`;
}

function renderEffectImageShare(data: ShareRenderData) {
  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-3">
        <div>
          <p className="text-xs uppercase tracking-[0.25em] text-[#8B5A37]/70">
            Effect Share
          </p>
          <h2 className="mt-1 font-serif text-2xl font-semibold text-foreground">
            把效果图发给家人朋友看
          </h2>
        </div>
        {data.effectImage.version ? (
          <span className="rounded-full bg-[#f5f0e9] px-3 py-1 text-xs font-medium text-[#8B5A37]">
            {`版本 v${data.effectImage.version}`}
          </span>
        ) : null}
      </div>

      <div className="relative overflow-hidden rounded-[28px] border border-[#e1d1bf] bg-[#f5f0e9]">
        <div className="relative aspect-[4/3] w-full">
          {data.effectImage.imageUrl ? (
            <Image
              src={data.effectImage.imageUrl}
              alt="方案效果图"
              fill
              className="object-cover"
              sizes="(max-width: 1024px) 100vw, 960px"
              unoptimized
            />
          ) : (
            <div className="flex h-full items-center justify-center p-6">
              <EmptyStateCard
                title="还没有可分享的效果图"
                description="先回结果页重新生成效果图，再回来创建这张公开分享卡片。"
                eyebrow="Effect Share"
                className="w-full border-none bg-transparent px-0 py-0"
              />
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function renderShoppingListShare(data: ShareRenderData) {
  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="text-xs uppercase tracking-[0.25em] text-[#8B5A37]/70">
            Shopping List
          </p>
          <h2 className="mt-1 font-serif text-2xl font-semibold text-foreground">
            当前方案购物清单
          </h2>
        </div>

        <div className="rounded-2xl border border-[#e7d7c6] bg-[#fbf7f0] px-4 py-3 text-right">
          <p className="text-xs uppercase tracking-[0.18em] text-muted-foreground">
            总预估预算
          </p>
          <p className="text-2xl font-semibold text-[#8B5A37]">
            {formatCurrency(data.shoppingSummary.estimatedTotal)}
          </p>
        </div>
      </div>

      <div className="overflow-hidden rounded-[28px] border border-[#e1d1bf] bg-white">
        <div className="divide-y divide-[#f0e7db]">
          {data.shoppingItems.map((item) => (
            <div
              key={item.schemeProductId}
              className="grid gap-4 px-5 py-4 md:grid-cols-[1.3fr_120px_120px]"
            >
              <div className="flex gap-3">
                <div className="relative h-14 w-14 shrink-0 overflow-hidden rounded-2xl bg-[#f5f0e9]">
                  {item.imageUrl ? (
                    <Image
                      src={item.imageUrl}
                      alt={item.name}
                      fill
                      className="object-cover"
                      sizes="56px"
                      unoptimized
                    />
                  ) : (
                    <div className="flex h-full items-center justify-center text-[11px] text-muted-foreground">
                      暂无图
                    </div>
                  )}
                </div>
                <div className="min-w-0">
                  <p className="text-sm font-semibold text-foreground">{item.name}</p>
                  <p className="mt-1 text-xs text-muted-foreground">{item.categoryLabel}</p>
                  <p className="mt-1 text-xs text-muted-foreground">
                    {`${item.widthMm ?? "--"} × ${item.depthMm ?? "--"} × ${item.heightMm ?? "--"} mm`}
                  </p>
                </div>
              </div>

              <div className="text-sm">
                <p className="text-xs uppercase tracking-[0.18em] text-muted-foreground">
                  预估
                </p>
                <p className="mt-1 font-medium text-[#8B5A37]">
                  {formatCurrency(item.estimatedPrice)}
                </p>
              </div>

              <div className="text-sm">
                <p className="text-xs uppercase tracking-[0.18em] text-muted-foreground">
                  状态
                </p>
                <p
                  className={cn(
                    "mt-1 inline-flex rounded-full px-2.5 py-1 text-xs font-medium",
                    item.status === "purchased"
                      ? "bg-emerald-100 text-emerald-700"
                      : "bg-[#f5f0e9] text-[#8B5A37]",
                  )}
                >
                  {item.status === "purchased" ? "已购买" : "待购买"}
                </p>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

function renderCompareShare(data: ShareRenderData) {
  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="text-xs uppercase tracking-[0.25em] text-[#8B5A37]/70">
            Compare
          </p>
          <h2 className="mt-1 font-serif text-2xl font-semibold text-foreground">
            {data.compareCategoryLabel
              ? `${data.compareCategoryLabel} 三选一对比`
              : "三选一对比分享"}
          </h2>
        </div>
      </div>

      {data.compareItems.length > 0 ? (
        <div className="grid gap-4 lg:grid-cols-3">
          {data.compareItems.map((item) => {
            const statusMeta = STATUS_META[item.validationStatus];
            const StatusIcon = statusMeta.icon;

            return (
              <article
                key={item.schemeProductId}
                className="overflow-hidden rounded-[24px] border border-[#e1d1bf] bg-white"
              >
                <div className="relative aspect-[4/3] w-full bg-[#f5f0e9]">
                  {item.effectImageUrl || item.imageUrl ? (
                    <Image
                      src={item.effectImageUrl ?? item.imageUrl ?? ""}
                      alt={item.name}
                      fill
                      className="object-cover"
                      sizes="(max-width: 1024px) 100vw, 33vw"
                      unoptimized
                    />
                  ) : (
                    <div className="flex h-full items-center justify-center px-6 text-center text-sm text-muted-foreground">
                      暂无可展示的对比图
                    </div>
                  )}
                </div>

                <div className="space-y-3 p-4">
                  <div>
                    <p className="text-base font-semibold text-foreground">{item.name}</p>
                    <p className="mt-1 text-sm text-muted-foreground">
                      {item.dimensionsLabel}
                    </p>
                  </div>

                  <div className="flex items-center justify-between gap-3">
                    <span className="text-sm font-semibold text-[#8B5A37]">
                      {item.priceLabel}
                    </span>
                    <span
                      className={cn(
                        "inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-xs font-medium",
                        statusMeta.className,
                      )}
                    >
                      <StatusIcon className="h-3.5 w-3.5" />
                      {statusMeta.label}
                    </span>
                  </div>
                </div>
              </article>
            );
          })}
        </div>
      ) : (
        <EmptyStateCard
          title="还没有足够的对比版本"
          description="继续在结果页多换几个同品类方案后，这里就能生成可分享的三选一对比卡。"
          eyebrow="Compare"
        />
      )}
    </div>
  );
}

export function ShareRenderCard({
  shareType,
  data,
  className,
}: ShareRenderCardProps) {
  return (
    <section
      className={cn(
        "overflow-hidden rounded-[32px] border border-[#d8c4ad] bg-[linear-gradient(145deg,#fffefb_0%,#fbf7f0_55%,#f3e8da_100%)] p-5 shadow-sm md:p-6",
        className,
      )}
    >
      {shareType === "effect_image" ? renderEffectImageShare(data) : null}
      {shareType === "shopping_list" ? renderShoppingListShare(data) : null}
      {shareType === "compare" ? renderCompareShare(data) : null}

      <div className="mt-5 rounded-[22px] bg-[#8B5A37] px-4 py-3 text-center text-sm font-medium text-white">
        {data.watermarkText}
      </div>
    </section>
  );
}
