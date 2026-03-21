import type { PlanType } from "@/lib/types";

export const PLAN_LIMITS = {
  free: {
    rooms: 1,
    generations: 1,
    replacements: 0,
    dailyReplacements: 0,
    watermark: true,
    exportHd: false,
  },
  trial: {
    rooms: 1,
    generations: 3,
    replacements: 3,
    dailyReplacements: 3,
    watermark: false,
    exportHd: true,
  },
  serious: {
    rooms: 1,
    generations: 999,
    replacements: 999,
    dailyReplacements: 50,
    watermark: false,
    exportHd: true,
  },
  full: {
    rooms: 2,
    generations: 999,
    replacements: 999,
    dailyReplacements: 50,
    watermark: false,
    exportHd: true,
  },
  creator: {
    rooms: 999,
    generations: 999,
    replacements: 999,
    dailyReplacements: 999,
    watermark: false,
    exportHd: true,
  },
} as const;

export type NormalizedPlanType = keyof typeof PLAN_LIMITS;
export type LegacyPlanType = "single" | "room" | "dual";
export type StoredPlanType = NormalizedPlanType | LegacyPlanType;

export const PLAN_ORDER: NormalizedPlanType[] = [
  "free",
  "trial",
  "serious",
  "full",
  "creator",
];

export const PLAN_LABELS: Record<NormalizedPlanType, string> = {
  free: "免费体验",
  trial: "试一试",
  serious: "认真选",
  full: "全屋搞定",
  creator: "创作者",
};

export const PLAN_PRICES: Record<Exclude<NormalizedPlanType, "creator">, number> = {
  free: 0,
  trial: 9.9,
  serious: 29.9,
  full: 69.9,
};

export const PLAN_UNLOCKS: Record<NormalizedPlanType, string[]> = {
  free: ["1 次效果图", "基础布局图", "尺寸校验报告"],
  trial: ["3 次替换", "无水印导出", "更高生成额度"],
  serious: ["无限替换", "三选一对比", "购物清单导出"],
  full: ["2 个房间", "全功能记账", "更多家庭场景覆盖"],
  creator: ["超高额度", "内部运营与创作者使用"],
};

const LEGACY_PLAN_MAP: Record<StoredPlanType, NormalizedPlanType> = {
  free: "free",
  trial: "trial",
  serious: "serious",
  full: "full",
  creator: "creator",
  single: "trial",
  room: "serious",
  dual: "full",
};

export function normalizePlanType(
  plan: StoredPlanType | string | null | undefined,
): PlanType {
  if (!plan) {
    return "free";
  }

  return LEGACY_PLAN_MAP[plan as StoredPlanType] ?? "free";
}

export function getPlanLabel(plan: StoredPlanType | string | null | undefined) {
  return PLAN_LABELS[normalizePlanType(plan)];
}

export function getPlanPrice(plan: Exclude<NormalizedPlanType, "creator">) {
  return PLAN_PRICES[plan];
}

export function isPlanAtLeast(
  currentPlan: StoredPlanType | string | null | undefined,
  requiredPlan: NormalizedPlanType,
) {
  return (
    PLAN_ORDER.indexOf(normalizePlanType(currentPlan)) >= PLAN_ORDER.indexOf(requiredPlan)
  );
}

export function getNextPlan(plan: StoredPlanType | string | null | undefined): PlanType {
  const normalizedPlan = normalizePlanType(plan);
  const currentIndex = PLAN_ORDER.indexOf(normalizedPlan);
  const nextIndex = Math.min(currentIndex + 1, PLAN_ORDER.length - 1);

  return PLAN_ORDER[nextIndex];
}
