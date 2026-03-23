import { create } from "zustand";
import type { BudgetAllocation, FurnishingPlan, FurnishingPlanItem } from "@/lib/types";

interface FurnishingStoreState {
  currentPlan: FurnishingPlan | null;
  items: FurnishingPlanItem[];
  budgetAllocations: BudgetAllocation[];
  isLoading: boolean;
}

interface FurnishingStoreActions {
  setPlan: (plan: FurnishingPlan) => void;
  setItems: (items: FurnishingPlanItem[]) => void;
  addItem: (item: FurnishingPlanItem) => void;
  updateItem: (itemId: string, updates: Partial<FurnishingPlanItem>) => void;
  removeItem: (itemId: string) => void;
  lockItem: (itemId: string) => void;
  unlockItem: (itemId: string) => void;
  markPurchased: (itemId: string) => void;
  setBudgetAllocations: (allocations: BudgetAllocation[]) => void;
  updateBudget: (newBudget: number) => void;
  getLockedTotal: () => number;
  getRemainingBudget: () => number;
  getPurchasedCount: () => number;
  getTotalCount: () => number;
  setLoading: (loading: boolean) => void;
  reset: () => void;
}

type FurnishingStore = FurnishingStoreState & FurnishingStoreActions;

const initialState: FurnishingStoreState = {
  currentPlan: null,
  items: [],
  budgetAllocations: [],
  isLoading: false,
};

export const useFurnishingStore = create<FurnishingStore>((set, get) => ({
  ...initialState,

  setPlan: (plan) => set({ currentPlan: plan }),

  setItems: (items) => set({ items }),

  addItem: (item) => set((state) => ({ items: [...state.items, item] })),

  updateItem: (itemId, updates) =>
    set((state) => ({
      items: state.items.map((item) => (item.id === itemId ? { ...item, ...updates } : item)),
    })),

  removeItem: (itemId) =>
    set((state) => ({
      items: state.items.filter((item) => item.id !== itemId),
    })),

  lockItem: (itemId) =>
    set((state) => ({
      items: state.items.map((item) => (item.id === itemId ? { ...item, locked: true } : item)),
    })),

  unlockItem: (itemId) =>
    set((state) => ({
      items: state.items.map((item) => (item.id === itemId ? { ...item, locked: false } : item)),
    })),

  markPurchased: (itemId) =>
    set((state) => ({
      items: state.items.map((item) =>
        item.id === itemId
          ? {
              ...item,
              status: "purchased" as const,
              purchased_at: new Date().toISOString(),
            }
          : item,
      ),
    })),

  setBudgetAllocations: (allocations) => set({ budgetAllocations: allocations }),

  updateBudget: (newBudget) =>
    set((state) => ({
      currentPlan: state.currentPlan ? { ...state.currentPlan, total_budget: newBudget } : null,
    })),

  getLockedTotal: () => {
    const { items } = get();
    return items
      .filter((item) => item.locked && item.price != null)
      .reduce((sum, item) => sum + (item.price ?? 0), 0);
  },

  getRemainingBudget: () => {
    const { currentPlan } = get();
    const lockedTotal = get().getLockedTotal();

    if (!currentPlan?.total_budget) {
      return 0;
    }

    return Math.max(0, currentPlan.total_budget - lockedTotal);
  },

  getPurchasedCount: () => {
    const { items } = get();
    return items.filter((item) => item.status === "purchased").length;
  },

  getTotalCount: () => {
    const { items } = get();
    return items.filter((item) => item.status !== "abandoned").length;
  },

  setLoading: (loading) => set({ isLoading: loading }),

  reset: () => set(initialState),
}));
