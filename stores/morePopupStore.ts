import { create } from 'zustand';
import { devtools } from 'zustand/middleware';

interface MorePopupStore {
  isOpen: boolean;
  open: () => void;
  close: () => void;
}

export const useMorePopupStore = create<MorePopupStore>()(
  devtools(
    (set) => ({
      isOpen: false,
      open: (): void => set({ isOpen: true }),
      close: (): void => set({ isOpen: false }),
    }),
    { name: 'more-popup-store' }
  )
);
