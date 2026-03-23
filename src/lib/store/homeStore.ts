import { create } from "zustand";
import type { Home, Room } from "@/lib/types";

interface HomeStoreState {
  homes: Home[];
  currentHome: Home | null;
  rooms: Room[];
  isLoading: boolean;
}

interface HomeStoreActions {
  setHomes: (homes: Home[]) => void;
  addHome: (home: Home) => void;
  updateHome: (homeId: string, updates: Partial<Home>) => void;
  removeHome: (homeId: string) => void;
  setHome: (home: Home) => void;
  setRooms: (rooms: Room[]) => void;
  addRoom: (room: Room) => void;
  updateRoom: (roomId: string, updates: Partial<Room>) => void;
  removeRoom: (roomId: string) => void;
  setLoading: (loading: boolean) => void;
  reset: () => void;
}

type HomeStore = HomeStoreState & HomeStoreActions;

const initialState: HomeStoreState = {
  homes: [],
  currentHome: null,
  rooms: [],
  isLoading: false,
};

export const useHomeStore = create<HomeStore>((set) => ({
  ...initialState,

  setHomes: (homes) => set({ homes }),

  addHome: (home) => set((state) => ({ homes: [...state.homes, home] })),

  updateHome: (homeId, updates) =>
    set((state) => ({
      homes: state.homes.map((home) => (home.id === homeId ? { ...home, ...updates } : home)),
    })),

  removeHome: (homeId) =>
    set((state) => ({
      homes: state.homes.filter((home) => home.id !== homeId),
    })),

  setHome: (home) => set({ currentHome: home }),

  setRooms: (rooms) => set({ rooms }),

  addRoom: (room) => set((state) => ({ rooms: [...state.rooms, room] })),

  updateRoom: (roomId, updates) =>
    set((state) => ({
      rooms: state.rooms.map((room) => (room.id === roomId ? { ...room, ...updates } : room)),
    })),

  removeRoom: (roomId) =>
    set((state) => ({
      rooms: state.rooms.filter((room) => room.id !== roomId),
    })),

  setLoading: (loading) => set({ isLoading: loading }),

  reset: () => set(initialState),
}));
