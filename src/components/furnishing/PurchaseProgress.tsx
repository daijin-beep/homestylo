"use client";

import type { ReactNode } from "react";
import { CircleDollarSign, PackageCheck, ReceiptText, Wallet } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

interface PurchaseProgressProps {
  purchasedCount: number;
  totalCount: number;
  spentAmount: number;
  remainingBudget: number;
}

export function PurchaseProgress({
  purchasedCount,
  totalCount,
  spentAmount,
  remainingBudget,
}: PurchaseProgressProps) {
  const progress = totalCount > 0 ? Math.round((purchasedCount / totalCount) * 100) : 0;
  const pendingCount = Math.max(totalCount - purchasedCount, 0);

  return (
    <Card className="border-border bg-card">
      <CardHeader className="space-y-2">
        <CardTitle className="text-xl font-serif">采购进度</CardTitle>
        <div className="space-y-2">
          <div className="flex items-center justify-between text-sm text-muted-foreground">
            <span>已采购 {purchasedCount} / {totalCount} 件</span>
            <span>{progress}%</span>
          </div>
          <div className="h-3 overflow-hidden rounded-full bg-muted">
            <div
              className="h-full rounded-full bg-primary transition-all"
              style={{ width: `${Math.min(progress, 100)}%` }}
            />
          </div>
        </div>
      </CardHeader>
      <CardContent className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <MetricCard
          icon={<PackageCheck className="h-4 w-4" />}
          label="已购买"
          value={`${purchasedCount} 件`}
          tone="text-emerald-700"
        />
        <MetricCard
          icon={<ReceiptText className="h-4 w-4" />}
          label="待采购"
          value={`${pendingCount} 件`}
          tone="text-foreground"
        />
        <MetricCard
          icon={<CircleDollarSign className="h-4 w-4" />}
          label="已花费"
          value={formatCurrency(spentAmount)}
          tone="text-foreground"
        />
        <MetricCard
          icon={<Wallet className="h-4 w-4" />}
          label="剩余预算"
          value={formatCurrency(remainingBudget)}
          tone={remainingBudget < 0 ? "text-destructive" : "text-foreground"}
        />
      </CardContent>
    </Card>
  );
}

function MetricCard({
  icon,
  label,
  value,
  tone,
}: {
  icon: ReactNode;
  label: string;
  value: string;
  tone: string;
}) {
  return (
    <div className="rounded-2xl border border-border/70 bg-muted/20 p-4">
      <div className="flex items-center gap-2 text-xs text-muted-foreground">
        {icon}
        <span>{label}</span>
      </div>
      <p className={`mt-2 text-lg font-semibold ${tone}`}>{value}</p>
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
