import { create } from 'zustand';

interface DrawerStore {
  isOpen: boolean;
  open: () => void;
  close: () => void;
  toggle: () => void;
}

export const useDrawerStore = create<DrawerStore>()((set) => ({
  isOpen: false,
  open: (): void => set({ isOpen: true }),
  close: (): void => set({ isOpen: false }),
  toggle: (): void => set((s): { isOpen: boolean } => ({ isOpen: !s.isOpen })),
}));
