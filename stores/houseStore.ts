import { create } from 'zustand';
import { devtools } from 'zustand/middleware';
import type { House, HouseMemberWithProfile } from '../types/database';

interface HouseStore {
  house: House | null;
  members: HouseMemberWithProfile[];
  isLoading: boolean;
  error: string | null;
  setHouse: (house: House | null) => void;
  setMembers: (members: HouseMemberWithProfile[]) => void;
  setLoading: (loading: boolean) => void;
  setError: (error: string | null) => void;
  clearError: () => void;
}

export const useHouseStore = create<HouseStore>()(
  devtools(
    (set) => ({
      house: null,
      members: [],
      isLoading: false,
      error: null,
      setHouse: (house) => set({ house }),
      setMembers: (members) => set({ members }),
      setLoading: (isLoading) => set({ isLoading }),
      setError: (error) => set({ error }),
      clearError: () => set({ error: null }),
    }),
    { name: 'house-store' }
  )
);
