import { create } from 'zustand';
import { devtools } from 'zustand/middleware';

// Which edge the triggering avatar sits on, so the dropdown opens on the same
// side instead of always flying out to the right. 'start' = leading edge
// (left in LTR, right in RTL), 'end' = trailing edge.
export type PopupAnchor = 'start' | 'end';

interface ProfilePopupStore {
  isOpen: boolean;
  anchor: PopupAnchor;
  open: (anchor?: PopupAnchor) => void;
  close: () => void;
}

export const useProfilePopupStore = create<ProfilePopupStore>()(
  devtools(
    (set) => ({
      isOpen: false,
      anchor: 'end',
      open: (anchor: PopupAnchor = 'end'): void => set({ isOpen: true, anchor }),
      close: (): void => set({ isOpen: false }),
    }),
    { name: 'profile-popup-store' }
  )
);
