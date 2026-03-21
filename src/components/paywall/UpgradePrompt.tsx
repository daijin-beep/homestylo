"use client";

import Link from "next/link";
import { ArrowRight, Lock, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  PLAN_LABELS,
  PLAN_LIMITS,
  PLAN_PRICES,
  PLAN_UNLOCKS,
  type NormalizedPlanType,
} from "@/lib/plan/planLimits";

interface UpgradePromptProps {
  reason: string;
  currentPlan: string;
  suggestedPlan: string;
}

function normalizeSuggestedPlan(plan: string): NormalizedPlanType {
  if (plan in PLAN_LIMITS) {
    return plan as NormalizedPlanType;
  }

  return "trial";
}

export function UpgradePrompt({
  reason,
  currentPlan,
  suggestedPlan,
}: UpgradePromptProps) {
  const nextPlan = normalizeSuggestedPlan(suggestedPlan);
  const price =
    nextPlan in PLAN_PRICES
      ? PLAN_PRICES[nextPlan as keyof typeof PLAN_PRICES]
      : null;

  return (
    <div className="space-y-5 rounded-[28px] border border-[#ddc8ad] bg-[linear-gradient(180deg,#fffdf9_0%,#f7efe1_100%)] p-6 shadow-sm">
      <div className="flex items-start gap-3">
        <div className="rounded-2xl bg-[#f3e7d7] p-3 text-[#8B5A37]">
          <Lock className="h-5 w-5" />
        </div>
        <div className="space-y-2">
          <p className="text-xs uppercase tracking-[0.28em] text-[#8B5A37]/70">
            Upgrade Required
          </p>
          <h3 className="font-serif text-2xl font-semibold text-foreground">
            升级到{PLAN_LABELS[nextPlan]}后即可继续
          </h3>
          <p className="text-sm leading-6 text-muted-foreground">{reason}</p>
        </div>
      </div>

      <div className="grid gap-3 rounded-2xl border border-[#eadbc9] bg-white/90 p-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <p className="text-sm text-muted-foreground">
              当前套餐：{currentPlan || "免费体验"}
            </p>
            <p className="text-lg font-semibold text-foreground">
              推荐升级：{PLAN_LABELS[nextPlan]}
            </p>
          </div>
          <div className="rounded-full bg-[#8B5A37] px-3 py-1 text-sm font-semibold text-white">
            {price === null ? "联系客服" : `¥${price}`}
          </div>
        </div>

        <div className="space-y-2">
          {PLAN_UNLOCKS[nextPlan].map((item) => (
            <div key={item} className="flex items-center gap-2 text-sm text-foreground">
              <Sparkles className="h-4 w-4 text-[#8B5A37]" />
              <span>{item}</span>
            </div>
          ))}
        </div>
      </div>

      <Button
        asChild
        size="lg"
        className="h-11 w-full rounded-xl bg-[#8B5A37] text-white hover:bg-[#754a2f]"
      >
        <Link href="/pricing">
          升级到{PLAN_LABELS[nextPlan]}
          <ArrowRight className="h-4 w-4" />
        </Link>
      </Button>
    </div>
  );
}
