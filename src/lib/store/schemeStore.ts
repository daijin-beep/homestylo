import { create } from "zustand";
import type { EffectImage, RoomAnalysis, Scheme, SchemeProduct } from "@/lib/types";

export type SchemeStep =
  | "upload"
  | "analyze"
  | "import"
  | "style"
  | "generate"
  | "result"
  | "compare"
  | "accounting";

interface SchemeStoreState {
  currentScheme: Scheme | null;
  roomAnalysis: RoomAnalysis | null;
  candidateProducts: SchemeProduct[];
  schemeProducts: SchemeProduct[];
  effectImages: EffectImage[];
  isLoading: boolean;
  currentStep: SchemeStep;
}

interface SchemeStoreActions {
  setScheme: (scheme: Scheme) => void;
  setRoomAnalysis: (analysis: RoomAnalysis) => void;
  addCandidate: (product: SchemeProduct) => void;
  removeCandidate: (productId: string) => void;
  setSchemeProducts: (products: SchemeProduct[]) => void;
  addEffectImage: (image: EffectImage) => void;
  updateEffectImage: (id: string, updates: Partial<EffectImage>) => void;
  setStep: (step: SchemeStep) => void;
  setLoading: (loading: boolean) => void;
  reset: () => void;
}

type SchemeStore = SchemeStoreState & SchemeStoreActions;

const initialState: SchemeStoreState = {
  currentScheme: null,
  roomAnalysis: null,
  candidateProducts: [],
  schemeProducts: [],
  effectImages: [],
  isLoading: false,
  currentStep: "upload",
};

export const useSchemeStore = create<SchemeStore>((set) => ({
  ...initialState,

  setScheme: (scheme) => {
    set({ currentScheme: scheme });
  },

  setRoomAnalysis: (analysis) => {
    set({ roomAnalysis: analysis });
  },

  addCandidate: (product) => {
    set((state) => {
      const sameCategoryCandidates = state.candidateProducts.filter(
        (item) => item.category === product.category,
      );

      // Keep at most 3 user candidates per category.
      if (sameCategoryCandidates.length >= 3) {
        return state;
      }

      return {
        candidateProducts: [...state.candidateProducts, product],
      };
    });
  },

  removeCandidate: (productId) => {
    set((state) => ({
      candidateProducts: state.candidateProducts.filter(
        (item) => item.id !== productId && item.product_id !== productId,
      ),
    }));
  },

  setSchemeProducts: (products) => {
    set({ schemeProducts: products });
  },

  addEffectImage: (image) => {
    set((state) => ({ effectImages: [...state.effectImages, image] }));
  },

  updateEffectImage: (id, updates) => {
    set((state) => ({
      effectImages: state.effectImages.map((image) =>
        image.id === id ? { ...image, ...updates } : image,
      ),
    }));
  },

  setStep: (step) => {
    set({ currentStep: step });
  },

  setLoading: (loading) => {
    set({ isLoading: loading });
  },

  reset: () => {
    set(initialState);
  },
}));
