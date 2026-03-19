import { create } from "zustand";
import type { PlanType, User } from "@/lib/types";

interface UserStoreState {
  user: User | null;
  isAuthenticated: boolean;
}

interface UserStoreActions {
  setUser: (user: User | null) => void;
  updatePlan: (plan: PlanType) => void;
}

type UserStore = UserStoreState & UserStoreActions;

export const useUserStore = create<UserStore>((set) => ({
  user: null,
  isAuthenticated: false,

  setUser: (user) => {
    set({
      user,
      isAuthenticated: Boolean(user),
    });
  },

  updatePlan: (plan) => {
    set((state) => {
      if (!state.user) {
        return state;
      }

      return {
        user: {
          ...state.user,
          plan_type: plan,
        },
      };
    });
  },
}));
