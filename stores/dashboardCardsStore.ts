import { create } from 'zustand';
import { devtools } from 'zustand/middleware';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { captureError } from '@lib/errorTracking';

// Cards that can appear in the dashboard carousel, in their canonical order.
export type DashboardCardKey =
  | 'parking'
  | 'groceries'
  | 'chores'
  | 'votes'
  | 'washer'
  | 'dryer'
  | 'dishwasher';

export const ALL_DASHBOARD_CARDS: DashboardCardKey[] = [
  'parking',
  'groceries',
  'chores',
  'votes',
  'washer',
  'dryer',
  'dishwasher',
];

const DEFAULT_ENABLED: DashboardCardKey[] = ['parking', 'groceries', 'chores', 'votes'];
const DEFAULT_PINNED: DashboardCardKey | null = null;
const STORAGE_KEY = 'dashboard_cards_v2';

interface Persisted {
  enabled: DashboardCardKey[];
  pinned: DashboardCardKey | null;
}

interface DashboardCardsStore {
  enabled: DashboardCardKey[];
  // When set (and enabled), this card is pinned to the left and the rest carousel.
  pinned: DashboardCardKey | null;
  hydrated: boolean;
  hydrate: () => Promise<void>;
  setEnabled: (key: DashboardCardKey, on: boolean) => void;
  setPinned: (key: DashboardCardKey | null) => void;
}

// Keep the stored list in canonical order regardless of toggle order.
function order(keys: Iterable<DashboardCardKey>): DashboardCardKey[] {
  const set = new Set(keys);
  return ALL_DASHBOARD_CARDS.filter((k) => set.has(k));
}

export const useDashboardCardsStore = create<DashboardCardsStore>()(
  devtools(
    (set, get) => ({
      enabled: DEFAULT_ENABLED,
      pinned: DEFAULT_PINNED,
      hydrated: false,

      hydrate: async (): Promise<void> => {
        if (get().hydrated) return;
        try {
          const raw = await AsyncStorage.getItem(STORAGE_KEY);
          if (raw) {
            const parsed = JSON.parse(raw) as Partial<Persisted>;
            const enabled = ALL_DASHBOARD_CARDS.filter((k) => parsed.enabled?.includes(k));
            const pinned = parsed.pinned && enabled.includes(parsed.pinned) ? parsed.pinned : null;
            set({ enabled, pinned, hydrated: true });
            return;
          }
        } catch (err) {
          captureError(err, { context: 'dashboard-cards-hydrate' });
        }
        set({ hydrated: true });
      },

      setEnabled: (key, on): void => {
        const current = new Set(get().enabled);
        if (on) current.add(key);
        else current.delete(key);
        const enabled = order(current);
        // A removed card can no longer be the pinned one.
        const prevPinned = get().pinned;
        const pinned = prevPinned && enabled.includes(prevPinned) ? prevPinned : null;
        set({ enabled, pinned });
        persist({ enabled, pinned });
      },

      setPinned: (key): void => {
        const pinned = key && get().enabled.includes(key) ? key : null;
        set({ pinned });
        persist({ enabled: get().enabled, pinned });
      },
    }),
    { name: 'dashboard-cards-store' }
  )
);

function persist(state: Persisted): void {
  AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(state)).catch((err) =>
    captureError(err, { context: 'dashboard-cards-save' })
  );
}
