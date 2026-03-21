import { getAppUserById } from "@/lib/plan/userProfile";
import {
  PLAN_LIMITS,
  getNextPlan,
  getPlanLabel,
  normalizePlanType,
} from "@/lib/plan/planLimits";
import { createServiceRoleClient } from "@/lib/supabase/admin";
import type { PlanType, User } from "@/lib/types";

export interface UsageCheckResult {
  allowed: boolean;
  reason?: string;
  currentPlan: PlanType;
  suggestedPlan?: PlanType;
}

function getShanghaiDateKey(date: Date) {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Shanghai",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(date);
}

function getEffectiveDailyReplacementCount(user: User, now = new Date()) {
  if (!user.replacement_daily_reset_at) {
    return 0;
  }

  const lastResetAt = new Date(user.replacement_daily_reset_at);
  if (Number.isNaN(lastResetAt.getTime())) {
    return 0;
  }

  return getShanghaiDateKey(lastResetAt) === getShanghaiDateKey(now)
    ? user.replacement_daily_count
    : 0;
}

function buildSuggestedPlan(currentPlan: PlanType) {
  return getNextPlan(currentPlan);
}

export function canGenerate(user: User): UsageCheckResult {
  const currentPlan = normalizePlanType(user.plan_type);
  const limits = PLAN_LIMITS[currentPlan];

  if (user.generation_count >= limits.generations) {
    return {
      allowed: false,
      reason: `${getPlanLabel(currentPlan)}当前最多支持 ${limits.generations} 次效果图生成，请升级后继续。`,
      currentPlan,
      suggestedPlan: buildSuggestedPlan(currentPlan),
    };
  }

  return {
    allowed: true,
    currentPlan,
  };
}

export function canReplace(user: User): UsageCheckResult {
  const currentPlan = normalizePlanType(user.plan_type);
  const limits = PLAN_LIMITS[currentPlan];
  const dailyReplacementCount = getEffectiveDailyReplacementCount(user);

  if (limits.replacements <= 0) {
    return {
      allowed: false,
      reason: `${getPlanLabel(currentPlan)}暂不支持商品替换与对比，请升级后继续。`,
      currentPlan,
      suggestedPlan: buildSuggestedPlan(currentPlan),
    };
  }

  if (user.replacement_count >= limits.replacements) {
    return {
      allowed: false,
      reason: `${getPlanLabel(currentPlan)}最多支持 ${limits.replacements} 次替换，请升级后继续。`,
      currentPlan,
      suggestedPlan: buildSuggestedPlan(currentPlan),
    };
  }

  if (dailyReplacementCount >= limits.dailyReplacements) {
    return {
      allowed: false,
      reason: `${getPlanLabel(currentPlan)}今日替换次数已用完，请明天再试或升级更高套餐。`,
      currentPlan,
      suggestedPlan: buildSuggestedPlan(currentPlan),
    };
  }

  return {
    allowed: true,
    currentPlan,
  };
}

export async function incrementGeneration(userId: string) {
  const supabase = createServiceRoleClient();
  const currentUser = await getAppUserById(userId, supabase);

  if (!currentUser) {
    throw new Error("User usage record not found.");
  }

  const { error } = await supabase
    .from("users")
    .update({
      generation_count: currentUser.generation_count + 1,
    })
    .eq("id", userId);

  if (error) {
    throw new Error(error.message);
  }
}

export async function incrementReplacement(userId: string) {
  const supabase = createServiceRoleClient();
  const currentUser = await getAppUserById(userId, supabase);

  if (!currentUser) {
    throw new Error("User replacement usage record not found.");
  }

  const now = new Date();
  const sameDayCount = getEffectiveDailyReplacementCount(currentUser, now);

  const { error } = await supabase
    .from("users")
    .update({
      replacement_count: currentUser.replacement_count + 1,
      replacement_daily_count: sameDayCount + 1,
      replacement_daily_reset_at: now.toISOString(),
    })
    .eq("id", userId);

  if (error) {
    throw new Error(error.message);
  }
}
