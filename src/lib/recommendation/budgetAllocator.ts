import type { BudgetAllocation, FurnishingPlanItem } from "@/lib/types";

// Category weights for budget allocation
// Larger items get more budget - quality difference matters most for big pieces
const CATEGORY_WEIGHTS: Record<string, number> = {
  sofa: 0.3,
  bed: 0.3,
  dining_table: 0.2,
  wardrobe: 0.2,
  coffee_table: 0.15,
  tv_cabinet: 0.15,
  curtain: 0.15,
  rug: 0.15,
  floor_lamp: 0.1,
  side_table: 0.1,
  painting: 0.1,
  pillow: 0.05,
  plant: 0.05,
};

const DEFAULT_WEIGHT = 0.1;

/**
 * Allocate remaining budget across unlocked categories.
 *
 * Steps:
 * 1. Sum all locked items' prices -> locked_total
 * 2. remaining = totalBudget - locked_total
 * 3. If remaining < 0, return error
 * 4. Collect unlocked categories and their weights
 * 5. Normalize weights so they sum to 1.0
 * 6. Allocate remaining budget proportionally
 * 7. For each category, compute price range (allocated +/- 30%)
 */
export function allocateBudget(
  totalBudget: number,
  items: FurnishingPlanItem[],
  unlockedCategories: string[],
): { success: boolean; allocations: BudgetAllocation[]; remaining: number; error?: string } {
  const lockedTotal = items
    .filter((item) => item.locked && item.price != null)
    .reduce((sum, item) => sum + (item.price ?? 0), 0);

  const remaining = totalBudget - lockedTotal;

  if (remaining < 0) {
    return {
      success: false,
      allocations: [],
      remaining,
      error: `Locked items exceed budget by ${Math.abs(remaining).toFixed(2)}`,
    };
  }

  if (unlockedCategories.length === 0) {
    return { success: true, allocations: [], remaining };
  }

  const rawWeights = unlockedCategories.map((category) => ({
    category,
    weight: CATEGORY_WEIGHTS[category] ?? DEFAULT_WEIGHT,
  }));

  const totalWeight = rawWeights.reduce((sum, entry) => sum + entry.weight, 0);

  const normalized = rawWeights.map((entry) => ({
    ...entry,
    weight: entry.weight / totalWeight,
  }));

  const allocations: BudgetAllocation[] = normalized.map((entry) => {
    const allocated = remaining * entry.weight;

    return {
      category: entry.category,
      weight: entry.weight,
      allocated_amount: Math.round(allocated * 100) / 100,
      price_range: {
        min: Math.round(allocated * 0.7 * 100) / 100,
        max: Math.round(allocated * 1.3 * 100) / 100,
      },
    };
  });

  return { success: true, allocations, remaining };
}
