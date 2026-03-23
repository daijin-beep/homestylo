"use client";

import { useState } from "react";
import { motion } from "framer-motion";
import { AlertTriangle, Wallet } from "lucide-react";

interface BudgetSliderProps {
  totalBudget: number;
  lockedTotal: number;
  onBudgetChange: (newBudget: number) => void | Promise<void>;
}

const MAX_BUDGET = 200000;
const MIN_BUDGET = 0;
const STEP = 1000;

export function BudgetSlider({
  totalBudget,
  lockedTotal,
  onBudgetChange,
}: BudgetSliderProps) {
  const [draftBudget, setDraftBudget] = useState<number | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const displayBudget = draftBudget ?? totalBudget;
  const allocatableBudget = displayBudget - lockedTotal;
  const isOverBudget = allocatableBudget < 0;

  async function commitBudget() {
    if (draftBudget == null || draftBudget === totalBudget || isSubmitting) {
      return;
    }

    setIsSubmitting(true);

    try {
      await onBudgetChange(draftBudget);
    } finally {
      setDraftBudget(null);
      setIsSubmitting(false);
    }
  }

  return (
    <div className="space-y-4 rounded-3xl border border-border bg-muted/20 p-4">
      <div className="space-y-1">
        <p className="text-sm text-muted-foreground">当前总预算</p>
        <motion.p
          key={displayBudget}
          initial={{ opacity: 0.4, y: 6 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.18 }}
          className="text-3xl font-semibold text-foreground"
        >
          {formatCurrency(displayBudget)}
        </motion.p>
      </div>

      <div className="space-y-2">
        <input
          type="range"
          min={MIN_BUDGET}
          max={MAX_BUDGET}
          step={STEP}
          value={displayBudget}
          disabled={isSubmitting}
          onChange={(event) => setDraftBudget(Number(event.target.value))}
          onMouseUp={() => void commitBudget()}
          onTouchEnd={() => void commitBudget()}
          onKeyUp={() => void commitBudget()}
          className="h-2 w-full cursor-pointer appearance-none rounded-full bg-border accent-primary disabled:cursor-not-allowed disabled:opacity-60"
        />
        <div className="flex items-center justify-between text-xs text-muted-foreground">
          <span>{formatCurrency(MIN_BUDGET)}</span>
          <span>{formatCurrency(MAX_BUDGET)}</span>
        </div>
      </div>

      <div className="grid gap-3 sm:grid-cols-2">
        <div className="rounded-2xl bg-background p-3">
          <p className="text-xs text-muted-foreground">锁定商品总价</p>
          <p className="mt-1 text-lg font-semibold text-foreground">
            {formatCurrency(lockedTotal)}
          </p>
        </div>
        <div className="rounded-2xl bg-background p-3">
          <p className="text-xs text-muted-foreground">AI 可分配预算</p>
          <p
            className={`mt-1 text-lg font-semibold ${
              isOverBudget ? "text-destructive" : "text-foreground"
            }`}
          >
            {formatCurrency(allocatableBudget)}
          </p>
        </div>
      </div>

      {isOverBudget ? (
        <div className="flex items-start gap-3 rounded-2xl border border-destructive/20 bg-destructive/5 p-3 text-sm text-destructive">
          <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
          <div>锁定商品已经超出预算 {formatCurrency(Math.abs(allocatableBudget))}</div>
        </div>
      ) : (
        <div className="flex items-center gap-3 rounded-2xl border border-emerald-200 bg-emerald-50/70 p-3 text-sm text-emerald-700">
          <Wallet className="h-4 w-4 shrink-0" />
          <span>调整预算后，未锁定商品会自动重新分配价格区间。</span>
        </div>
      )}
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
