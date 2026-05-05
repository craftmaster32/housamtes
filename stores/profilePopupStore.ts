import { create } from 'zustand';

interface ProfilePopupStore {
  isOpen: boolean;
  open: () => void;
  close: () => void;
}

export const useProfilePopupStore = create<ProfilePopupStore>()((set) => ({
  isOpen: false,
  open: (): void => set({ isOpen: true }),
  close: (): void => set({ isOpen: false }),
}));
