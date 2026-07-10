import { create } from 'zustand';
import { devtools } from 'zustand/middleware';

interface ProfilePopupStore {
  isOpen: boolean;
  open: () => void;
  close: () => void;
}

export const useProfilePopupStore = create<ProfilePopupStore>()(
  devtools(
    (set) => ({
      isOpen: false,
      open: (): void => set({ isOpen: true }),
      close: (): void => set({ isOpen: false }),
    }),
    { name: 'profile-popup-store' }
  )
);
