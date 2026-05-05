import { create } from 'zustand';

interface MorePopupStore {
  isOpen: boolean;
  open: () => void;
  close: () => void;
}

export const useMorePopupStore = create<MorePopupStore>()((set) => ({
  isOpen: false,
  open: (): void => set({ isOpen: true }),
  close: (): void => set({ isOpen: false }),
}));
