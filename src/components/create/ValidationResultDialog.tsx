"use client";

import {
  AlertTriangle,
  CheckCircle2,
  ChevronDown,
  CircleX,
  XCircle,
} from "lucide-react";
import type { CSSProperties } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import type {
  Check,
  LayoutMetrics,
  ValidationItem,
  ValidationReport,
} from "@/lib/validation/dimensionValidator";

const STATUS_COLOR: Record<ValidationReport["overallStatus"], string> = {
  pass: "#22c55e",
  warning: "#eab308",
  block: "#ef4444",
};

const RULE_LABELS: Record<string, string> = {
  sofa_wall_occupancy: "沙发占墙宽比",
  tv_wall_occupancy: "电视柜占墙宽比",
  sofa_to_tv_distance: "沙发到电视墙距离",
  sofa_to_coffee_gap: "沙发到茶几间距",
  coffee_to_sofa_ratio: "茶几占沙发比",
  passage_width: "通道宽度",
  height_to_ceiling_ratio: "家具高度与层高比例",
  rug_size: "地毯尺寸",
};

export interface ValidationResultDialogProps {
  open: boolean;
  report: ValidationReport | null;
  onConfirm: () => void;
  onCancel: () => void;
}

function StatusIcon({
  status,
  className,
  style,
}: {
  status: ValidationReport["overallStatus"];
  className?: string;
  style?: CSSProperties;
}) {
  if (status === "pass") {
    return <CheckCircle2 className={className} style={style} />;
  }

  if (status === "warning") {
    return <AlertTriangle className={className} style={style} />;
  }

  return <XCircle className={className} style={style} />;
}

function getHeaderTitle(report: ValidationReport) {
  if (report.overallStatus === "pass") {
    return "尺寸校验通过";
  }

  if (report.overallStatus === "warning") {
    const warningCount = report.items.filter((item) => item.status === "warning").length;
    return `有${warningCount}项需注意`;
  }

  const blockCount = report.items.filter((item) => item.status === "block").length;
  return `${blockCount}件家具尺寸不合适`;
}

function getHeaderDescription(status: ValidationReport["overallStatus"]) {
  if (status === "pass") {
    return "当前尺寸组合可行，可以继续生成效果图。";
  }

  if (status === "warning") {
    return "存在需要留意的尺寸风险，建议先确认再继续。";
  }

  return "发现明显冲突，建议先返回修改尺寸或家具再继续。";
}

function formatPercent(value: number) {
  return `${(value * 100).toFixed(1)}%`;
}

function formatMillimeter(value: number | null) {
  if (value === null) {
    return "--";
  }

  return `${Math.round(value)}mm`;
}

function statusBadge(status: ValidationReport["overallStatus"]) {
  if (status === "pass") {
    return "通过";
  }

  if (status === "warning") {
    return "注意";
  }

  return "不通过";
}

function metricStatusForOccupancy(occupancy: number): ValidationReport["overallStatus"] {
  if (occupancy > 0.85) {
    return "block";
  }

  if (occupancy > 0.75) {
    return "warning";
  }

  return "pass";
}

function metricStatusForPassage(passageWidth: number | null): ValidationReport["overallStatus"] {
  if (passageWidth === null) {
    return "pass";
  }

  if (passageWidth < 600) {
    return "block";
  }

  if (passageWidth < 800) {
    return "warning";
  }

  return "pass";
}

function metricStatusForGap(gap: number | null): ValidationReport["overallStatus"] {
  if (gap === null) {
    return "pass";
  }

  if (gap < 250) {
    return "block";
  }

  if (gap < 350) {
    return "warning";
  }

  return "pass";
}

function CheckStatusTag({ status }: { status: Check["status"] }) {
  const normalizedStatus: ValidationReport["overallStatus"] =
    status === "block" ? "block" : status === "warning" ? "warning" : "pass";

  return (
    <span
      className="inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium"
      style={{
        backgroundColor: `${STATUS_COLOR[normalizedStatus]}1f`,
        color: STATUS_COLOR[normalizedStatus],
      }}
    >
      <StatusIcon status={normalizedStatus} className="h-3.5 w-3.5" />
      {statusBadge(normalizedStatus)}
    </span>
  );
}

function ItemRow({ item }: { item: ValidationItem }) {
  const color = STATUS_COLOR[item.status];

  return (
    <details className="group rounded-xl border border-border bg-white">
      <summary className="flex cursor-pointer list-none items-center justify-between gap-3 px-4 py-3 [&::-webkit-details-marker]:hidden">
        <div className="flex min-w-0 items-center gap-2">
          <StatusIcon status={item.status} className="h-4 w-4 shrink-0" style={{ color }} />
          <span className="truncate text-sm font-medium text-foreground">{item.furnitureName}</span>
        </div>
        <div className="flex items-center gap-2">
          <span
            className="rounded-full px-2 py-0.5 text-xs font-medium"
            style={{ backgroundColor: `${color}1f`, color }}
          >
            {statusBadge(item.status)}
          </span>
          <ChevronDown className="h-4 w-4 text-muted-foreground transition-transform duration-200 group-open:rotate-180" />
        </div>
      </summary>
      <div className="space-y-2 border-t border-border px-4 py-3">
        {item.checks.length > 0 ? (
          item.checks.map((check) => (
            <div
              key={`${item.furnitureId}-${check.rule}-${check.message}`}
              className="rounded-lg border border-border/70 bg-[#faf9f6] p-3"
            >
              <div className="mb-1 flex items-center justify-between gap-2">
                <p className="text-xs font-medium text-foreground">
                  {RULE_LABELS[check.rule] ?? check.rule}
                </p>
                <CheckStatusTag status={check.status} />
              </div>
              <p className="text-sm text-foreground">{check.message}</p>
              <p className="mt-1 text-xs text-muted-foreground">{check.detail}</p>
            </div>
          ))
        ) : (
          <p className="text-sm text-muted-foreground">暂无该家具的详细校验项。</p>
        )}
      </div>
    </details>
  );
}

function MetricCard({
  label,
  value,
  status,
}: {
  label: string;
  value: string;
  status: ValidationReport["overallStatus"];
}) {
  const color = STATUS_COLOR[status];

  return (
    <div className="rounded-xl border border-border bg-white p-3">
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className="mt-1 text-sm font-semibold" style={{ color }}>
        {value}
      </p>
    </div>
  );
}

function MetricsSection({ metrics }: { metrics: LayoutMetrics }) {
  const sofaStatus = metricStatusForOccupancy(metrics.sofaWallOccupancy);
  const passageStatus = metricStatusForPassage(metrics.passageWidth);
  const sofaGapStatus = metricStatusForGap(metrics.sofaToCoffeeTableGap);
  const coffeeGapStatus = metricStatusForGap(metrics.coffeeTableToTvGap);
  const occupancyPercentage = Math.min(100, Math.max(0, metrics.sofaWallOccupancy * 100));

  return (
    <section className="space-y-3 rounded-xl border border-border bg-[#faf8f2] p-4">
      <h3 className="text-sm font-semibold text-foreground">布局指标</h3>

      <div className="space-y-2">
        <div className="flex items-center justify-between text-xs">
          <span className="text-muted-foreground">沙发占墙宽</span>
          <span className="font-medium" style={{ color: STATUS_COLOR[sofaStatus] }}>
            {formatPercent(metrics.sofaWallOccupancy)}
          </span>
        </div>
        <div className="h-2 overflow-hidden rounded-full bg-white">
          <div
            className="h-full rounded-full transition-all duration-300"
            style={{
              width: `${occupancyPercentage}%`,
              backgroundColor: STATUS_COLOR[sofaStatus],
            }}
          />
        </div>
      </div>

      <div className="grid gap-2 sm:grid-cols-3">
        <MetricCard
          label="通道宽度"
          value={formatMillimeter(metrics.passageWidth)}
          status={passageStatus}
        />
        <MetricCard
          label="沙发到茶几间距"
          value={formatMillimeter(metrics.sofaToCoffeeTableGap)}
          status={sofaGapStatus}
        />
        <MetricCard
          label="茶几到电视间距"
          value={formatMillimeter(metrics.coffeeTableToTvGap)}
          status={coffeeGapStatus}
        />
      </div>
    </section>
  );
}

function SuggestionsSection({ suggestions }: { suggestions: string[] }) {
  return (
    <section className="space-y-2">
      <h3 className="text-sm font-semibold text-foreground">优化建议</h3>
      {suggestions.length > 0 ? (
        <div className="space-y-2">
          {suggestions.map((suggestion) => (
            <div
              key={suggestion}
              className="rounded-lg border border-[#e8dcca] bg-[#fff8eb] px-3 py-2 text-sm text-[#7a5b2f]"
            >
              {suggestion}
            </div>
          ))}
        </div>
      ) : (
        <div className="rounded-lg border border-[#d9f1de] bg-[#f2fbf4] px-3 py-2 text-sm text-[#1f7a36]">
          当前布局没有明显风险项，可继续生成效果图。
        </div>
      )}
    </section>
  );
}

export function ValidationResultDialog({
  open,
  report,
  onConfirm,
  onCancel,
}: ValidationResultDialogProps) {
  if (!report) {
    return null;
  }

  const titleColor = STATUS_COLOR[report.overallStatus];
  const isBlock = report.overallStatus === "block";

  return (
    <Dialog
      open={open}
      onOpenChange={(nextOpen) => {
        if (!nextOpen && isBlock) {
          onCancel();
        }
      }}
    >
      <DialogContent
        className={cn(
          "h-dvh w-screen max-w-none gap-0 overflow-hidden rounded-none border-0 p-0 [&>button]:hidden",
          "sm:h-auto sm:w-full sm:max-w-[560px] sm:rounded-2xl sm:border",
        )}
        onEscapeKeyDown={(event) => event.preventDefault()}
        onInteractOutside={(event) => event.preventDefault()}
      >
        <DialogHeader className="space-y-2 border-b border-border bg-white px-5 py-4 text-left">
          <div className="flex items-center gap-2">
            <StatusIcon status={report.overallStatus} className="h-5 w-5" style={{ color: titleColor }} />
            <DialogTitle className="text-base font-semibold text-foreground">
              {getHeaderTitle(report)}
            </DialogTitle>
          </div>
          <DialogDescription className="text-sm text-muted-foreground">
            {getHeaderDescription(report.overallStatus)}
          </DialogDescription>
        </DialogHeader>

        <div className="flex-1 space-y-4 overflow-y-auto bg-[#f8f6f1] px-5 py-4">
          <section className="space-y-2">
            <h3 className="text-sm font-semibold text-foreground">逐项检查</h3>
            <div className="space-y-2">
              {report.items.map((item) => (
                <ItemRow key={item.furnitureId} item={item} />
              ))}
            </div>
          </section>

          <MetricsSection metrics={report.layoutMetrics} />
          <SuggestionsSection suggestions={report.suggestions} />
        </div>

        <div className="border-t border-border bg-white px-5 py-4">
          {isBlock ? (
            <div className="grid grid-cols-2 gap-2">
              <Button type="button" variant="outline" onClick={onCancel}>
                返回修改
              </Button>
              <Button
                type="button"
                className="bg-[#ef4444] text-white hover:bg-[#dc2626]"
                onClick={onConfirm}
              >
                <CircleX className="h-4 w-4" />
                仍然继续
              </Button>
            </div>
          ) : (
            <Button type="button" className="w-full" onClick={onConfirm}>
              确认并生成效果图
            </Button>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
