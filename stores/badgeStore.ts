import AsyncStorage from '@react-native-async-storage/async-storage';
import { create } from 'zustand';

const STORAGE_KEY = 'badge_last_seen_v1';

// Feature keys that show badges
export type BadgeFeature = 'parking' | 'grocery' | 'chores' | 'bills' | 'voting' | 'maintenance' | 'announcements';

interface BadgeStore {
  lastSeen: Record<BadgeFeature, string>; // ISO timestamp
  loaded: boolean;
  load: () => Promise<void>;
  markSeen: (feature: BadgeFeature) => Promise<void>;
}

const EPOCH = '2020-01-01T00:00:00.000Z';

const defaultLastSeen = (): Record<BadgeFeature, string> => ({
  parking: EPOCH,
  grocery: EPOCH,
  chores: EPOCH,
  bills: EPOCH,
  voting: EPOCH,
  maintenance: EPOCH,
  announcements: EPOCH,
});

export const useBadgeStore = create<BadgeStore>()((set, get) => ({
  lastSeen: defaultLastSeen(),
  loaded: false,

  load: async (): Promise<void> => {
    if (get().loaded) return;
    try {
      const raw = await AsyncStorage.getItem(STORAGE_KEY);
      if (raw) {
        const parsed = JSON.parse(raw) as Partial<Record<BadgeFeature, string>>;
        set({ lastSeen: { ...defaultLastSeen(), ...parsed }, loaded: true });
      } else {
        // First run: mark everything as seen NOW so old data doesn't produce badges
        const now = new Date().toISOString();
        const seen = Object.fromEntries(
          Object.keys(defaultLastSeen()).map((k) => [k, now])
        ) as Record<BadgeFeature, string>;
        await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(seen));
        set({ lastSeen: seen, loaded: true });
      }
    } catch {
      set({ loaded: true });
    }
  },

  markSeen: async (feature: BadgeFeature): Promise<void> => {
    const now = new Date().toISOString();
    const updated = { ...get().lastSeen, [feature]: now };
    set({ lastSeen: updated });
    try {
      await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(updated));
    } catch {
      // non-fatal
    }
  },
}));

// ── Selectors — count items created after lastSeen, not by me ─────────────────
export function countNew(items: Array<{ createdAt: string; [k: string]: unknown }>, lastSeen: string, myName: string, authorKey = 'author'): number {
  return items.filter(
    (item) =>
      item.createdAt > lastSeen &&
      (item[authorKey] as string | undefined) !== myName
  ).length;
}

export function countNewSimple(items: Array<{ createdAt: string }>, lastSeen: string): number {
  return items.filter((item) => item.createdAt > lastSeen).length;
}
