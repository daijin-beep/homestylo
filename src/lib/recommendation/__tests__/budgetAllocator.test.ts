import { describe, expect, it } from "vitest";
import type { FurnishingPlanItem } from "@/lib/types";
import { allocateBudget } from "../budgetAllocator";

const makeItem = (overrides: Partial<FurnishingPlanItem>): FurnishingPlanItem => ({
  id: "test-id",
  plan_id: "plan-1",
  category: "sofa",
  source: "ai_recommended",
  locked: false,
  product_id: null,
  custom_name: null,
  custom_image_url: null,
  custom_source_url: null,
  custom_width_mm: null,
  custom_depth_mm: null,
  custom_height_mm: null,
  price: null,
  price_range_min: null,
  price_range_max: null,
  fit_status: "pending",
  fit_message: null,
  status: "recommended",
  purchased_at: null,
  sort_order: 0,
  created_at: new Date().toISOString(),
  ...overrides,
});

describe("allocateBudget", () => {
  it("allocates full budget when no items are locked", () => {
    const result = allocateBudget(50000, [], ["sofa", "coffee_table", "floor_lamp"]);
    expect(result.success).toBe(true);
    expect(result.remaining).toBe(50000);

    const total = result.allocations.reduce((sum, allocation) => sum + allocation.allocated_amount, 0);
    expect(total).toBeCloseTo(50000, 0);
  });

  it("subtracts locked items from budget before allocating", () => {
    const lockedSofa = makeItem({ locked: true, price: 15000, category: "sofa" });
    const result = allocateBudget(50000, [lockedSofa], ["coffee_table", "floor_lamp"]);
    expect(result.success).toBe(true);
    expect(result.remaining).toBe(35000);

    const total = result.allocations.reduce((sum, allocation) => sum + allocation.allocated_amount, 0);
    expect(total).toBeCloseTo(35000, 0);
  });

  it("returns error when locked items exceed budget", () => {
    const lockedSofa = makeItem({ locked: true, price: 60000, category: "sofa" });
    const result = allocateBudget(50000, [lockedSofa], ["coffee_table"]);
    expect(result.success).toBe(false);
    expect(result.remaining).toBe(-10000);
    expect(result.error).toBeDefined();
  });

  it("gives higher weight to sofa than painting", () => {
    const result = allocateBudget(10000, [], ["sofa", "painting"]);
    expect(result.success).toBe(true);

    const sofaAllocation = result.allocations.find((allocation) => allocation.category === "sofa");
    const paintingAllocation = result.allocations.find(
      (allocation) => allocation.category === "painting",
    );

    expect(sofaAllocation?.allocated_amount ?? 0).toBeGreaterThan(paintingAllocation?.allocated_amount ?? 0);
  });

  it("computes price range as +/-30% of allocation", () => {
    const result = allocateBudget(10000, [], ["sofa"]);
    const allocation = result.allocations[0];

    expect(allocation.price_range.min).toBeCloseTo(allocation.allocated_amount * 0.7, 0);
    expect(allocation.price_range.max).toBeCloseTo(allocation.allocated_amount * 1.3, 0);
  });

  it("handles empty unlocked categories", () => {
    const result = allocateBudget(50000, [], []);
    expect(result.success).toBe(true);
    expect(result.allocations).toHaveLength(0);
    expect(result.remaining).toBe(50000);
  });
});
