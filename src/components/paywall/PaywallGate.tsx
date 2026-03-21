"use client";

import * as React from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { UpgradePrompt } from "@/components/paywall/UpgradePrompt";
import {
  getPlanLabel,
  getNextPlan,
  isPlanAtLeast,
  normalizePlanType,
  type NormalizedPlanType,
} from "@/lib/plan/planLimits";

interface PaywallGateProps {
  children: React.ReactElement<{
    onClick?: React.MouseEventHandler<HTMLElement>;
  }>;
  currentPlan: string;
  requiredPlan: NormalizedPlanType;
  reason: string;
  suggestedPlan?: NormalizedPlanType;
}

export function PaywallGate({
  children,
  currentPlan,
  requiredPlan,
  reason,
  suggestedPlan,
}: PaywallGateProps) {
  const [open, setOpen] = React.useState(false);
  const normalizedCurrentPlan = normalizePlanType(currentPlan);
  const allowed = isPlanAtLeast(normalizedCurrentPlan, requiredPlan);

  if (allowed) {
    return children;
  }

  const gatedChild = React.cloneElement(children, {
    onClick: (event: React.MouseEvent<HTMLElement>) => {
      event.preventDefault();
      event.stopPropagation();
      setOpen(true);
    },
  });

  return (
    <>
      {gatedChild}
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-xl border-none bg-transparent p-0 shadow-none">
          <DialogHeader className="sr-only">
            <DialogTitle>升级套餐</DialogTitle>
            <DialogDescription>解锁当前受限功能</DialogDescription>
          </DialogHeader>
          <UpgradePrompt
            reason={reason}
            currentPlan={getPlanLabel(normalizedCurrentPlan)}
            suggestedPlan={suggestedPlan ?? getNextPlan(normalizedCurrentPlan)}
          />
        </DialogContent>
      </Dialog>
    </>
  );
}
