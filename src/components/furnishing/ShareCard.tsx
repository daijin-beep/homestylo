"use client";

import Image from "next/image";
import { Copy, Download, ImageIcon, Link2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

interface ShareCardPlan {
  id: string;
  name: string;
  total_budget: number | null;
  current_total: number;
}

interface ShareCardItem {
  id: string;
  name: string;
  category: string;
  status: string;
  price: number | null;
  priceRangeMin: number | null;
  priceRangeMax: number | null;
}

interface ShareCardProps {
  plan: ShareCardPlan;
  items: ShareCardItem[];
  effectImageUrl?: string | null;
}

const WATERMARK = "HomeStylo · 买大件前先放进你家看看";

export function ShareCard({ plan, items, effectImageUrl }: ShareCardProps) {
  const visibleItems = items.slice(0, 4);

  async function handleCopyLink() {
    if (typeof window === "undefined") {
      return;
    }

    try {
      await navigator.clipboard.writeText(window.location.href);
      toast.success("分享链接已复制");
    } catch {
      toast.error("复制失败，请稍后重试");
    }
  }

  async function handleDownloadImage() {
    if (typeof window === "undefined") {
      return;
    }

    try {
      const canvas = document.createElement("canvas");
      canvas.width = 1200;
      canvas.height = 900;

      const context = canvas.getContext("2d");
      if (!context) {
        throw new Error("无法创建分享卡画布");
      }

      context.fillStyle = "#f7f2e8";
      context.fillRect(0, 0, canvas.width, canvas.height);

      context.fillStyle = "#1f2937";
      context.font = "bold 52px Georgia";
      context.fillText(plan.name || "HomeStylo 软装清单", 72, 110);

      context.font = "28px sans-serif";
      context.fillStyle = "#5b6470";
      context.fillText("软装清单摘要", 72, 154);

      context.fillStyle = "#ffffff";
      roundRect(context, 72, 200, 1056, 440, 28);
      context.fill();

      context.fillStyle = "#111827";
      context.font = "bold 30px sans-serif";
      context.fillText(`当前总价 ${formatCurrency(plan.current_total)}`, 108, 260);
      context.font = "24px sans-serif";
      context.fillStyle = "#4b5563";
      context.fillText(
        `总预算 ${formatCurrency(plan.total_budget ?? 0)} · 共 ${items.length} 件商品`,
        108,
        302,
      );

      visibleItems.forEach((item, index) => {
        const top = 358 + index * 70;
        context.fillStyle = index % 2 === 0 ? "#faf7f2" : "#f3eee5";
        roundRect(context, 98, top - 34, 1004, 56, 18);
        context.fill();

        context.fillStyle = "#111827";
        context.font = "bold 24px sans-serif";
        context.fillText(`${index + 1}. ${item.name}`, 124, top);

        context.font = "20px sans-serif";
        context.fillStyle = "#6b7280";
        context.fillText(
          `${CATEGORY_LABELS[item.category] || item.category} · ${STATUS_LABELS[item.status] || item.status}`,
          124,
          top + 26,
        );

        context.textAlign = "right";
        context.fillStyle = "#111827";
        context.fillText(formatItemPrice(item), 1068, top + 12);
        context.textAlign = "left";
      });

      context.fillStyle = "#1f2937";
      context.font = "bold 26px sans-serif";
      context.fillText(WATERMARK, 72, 774);

      context.font = "20px sans-serif";
      context.fillStyle = "#6b7280";
      context.fillText("分享自软装清单页 · 可继续补充效果图与商品链接", 72, 814);

      const dataUrl = canvas.toDataURL("image/png");
      const link = document.createElement("a");
      link.href = dataUrl;
      link.download = `${plan.name || "homestylo-plan"}-share-card.png`;
      link.click();
      toast.success("分享卡已下载");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "下载分享卡失败");
    }
  }

  return (
    <Card className="border-border bg-card" id="plan-share-card">
      <CardHeader className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
        <div className="space-y-2">
          <CardTitle className="text-xl font-serif">分享清单卡片</CardTitle>
          <CardDescription>
            适合先把当前软装方案发给家人或朋友确认，后续再接入正式的公开分享链接。
          </CardDescription>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button variant="outline" onClick={() => void handleCopyLink()}>
            <Copy className="h-4 w-4" />
            复制链接
          </Button>
          <Button onClick={() => void handleDownloadImage()}>
            <Download className="h-4 w-4" />
            下载图片
          </Button>
        </div>
      </CardHeader>
      <CardContent className="grid gap-4 lg:grid-cols-[1.1fr_0.9fr]">
        <div className="overflow-hidden rounded-3xl border border-border bg-muted/30">
          <div className="relative aspect-[4/3]">
            {effectImageUrl ? (
              <Image
                src={effectImageUrl}
                alt="分享预览图"
                fill
                className="object-cover"
                unoptimized
              />
            ) : (
              <div className="flex h-full flex-col items-center justify-center gap-3 bg-[radial-gradient(circle_at_top,_rgba(227,196,146,0.45),_transparent_55%),linear-gradient(135deg,#f7f2e8,#ece3d2)] px-6 text-center text-muted-foreground">
                <ImageIcon className="h-10 w-10" />
                <p className="max-w-xs text-sm">效果图入口将在后续阶段接入，这里先展示软装清单分享卡。</p>
              </div>
            )}
          </div>
          <div className="border-t border-border bg-background/90 px-5 py-4">
            <p className="text-sm font-medium text-foreground">{WATERMARK}</p>
          </div>
        </div>

        <div className="space-y-4 rounded-3xl border border-border bg-background/70 p-5">
          <div className="space-y-1">
            <p className="text-sm text-muted-foreground">方案名称</p>
            <p className="text-2xl font-semibold text-foreground">{plan.name}</p>
          </div>

          <div className="grid gap-3 sm:grid-cols-2">
            <SummaryTile label="总预算" value={formatCurrency(plan.total_budget ?? 0)} />
            <SummaryTile label="当前总价" value={formatCurrency(plan.current_total)} />
          </div>

          <div className="space-y-3">
            <div className="flex items-center gap-2 text-sm font-medium text-foreground">
              <Link2 className="h-4 w-4" />
              <span>清单摘要</span>
            </div>
            <div className="space-y-2">
              {visibleItems.length > 0 ? (
                visibleItems.map((item) => (
                  <div
                    key={item.id}
                    className="flex items-center justify-between gap-3 rounded-2xl bg-muted/35 px-4 py-3"
                  >
                    <div className="min-w-0">
                      <p className="truncate text-sm font-medium text-foreground">{item.name}</p>
                      <p className="text-xs text-muted-foreground">
                        {CATEGORY_LABELS[item.category] || item.category} ·{" "}
                        {STATUS_LABELS[item.status] || item.status}
                      </p>
                    </div>
                    <p className="shrink-0 text-sm font-medium text-foreground">
                      {formatItemPrice(item)}
                    </p>
                  </div>
                ))
              ) : (
                <div className="rounded-2xl border border-dashed border-border px-4 py-6 text-sm text-muted-foreground">
                  当前还没有可分享的商品摘要。
                </div>
              )}
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

function SummaryTile({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-2xl border border-border/70 bg-muted/20 p-4">
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className="mt-2 text-lg font-semibold text-foreground">{value}</p>
    </div>
  );
}

function formatCurrency(value: number) {
  return new Intl.NumberFormat("zh-CN", {
    style: "currency",
    currency: "CNY",
    maximumFractionDigits: 0,
  }).format(value);
}

function formatItemPrice(item: ShareCardItem) {
  if (item.price != null) {
    return formatCurrency(item.price);
  }

  if (item.priceRangeMin != null && item.priceRangeMax != null) {
    return `${formatCurrency(item.priceRangeMin)} - ${formatCurrency(item.priceRangeMax)}`;
  }

  return "待补充";
}

function roundRect(
  context: CanvasRenderingContext2D,
  x: number,
  y: number,
  width: number,
  height: number,
  radius: number,
) {
  context.beginPath();
  context.moveTo(x + radius, y);
  context.lineTo(x + width - radius, y);
  context.quadraticCurveTo(x + width, y, x + width, y + radius);
  context.lineTo(x + width, y + height - radius);
  context.quadraticCurveTo(x + width, y + height, x + width - radius, y + height);
  context.lineTo(x + radius, y + height);
  context.quadraticCurveTo(x, y + height, x, y + height - radius);
  context.lineTo(x, y + radius);
  context.quadraticCurveTo(x, y, x + radius, y);
  context.closePath();
}

const CATEGORY_LABELS: Record<string, string> = {
  sofa: "沙发",
  coffee_table: "茶几",
  tv_cabinet: "电视柜",
  bed: "床",
  dining_table: "餐桌",
  wardrobe: "衣柜",
  curtain: "窗帘",
  rug: "地毯",
  floor_lamp: "落地灯",
  painting: "装饰画",
  pillow: "抱枕",
  side_table: "边几",
  plant: "绿植",
};

const STATUS_LABELS: Record<string, string> = {
  recommended: "推荐中",
  candidate: "候选",
  confirmed: "已确认",
  purchased: "已购买",
  abandoned: "已放弃",
};
