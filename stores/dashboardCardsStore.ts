import { create } from 'zustand';
import { devtools } from 'zustand/middleware';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { captureError } from '@lib/errorTracking';

// Cards that can appear in the dashboard carousel, in their canonical order.
export type DashboardCardKey = 'groceries' | 'chores' | 'votes' | 'parking' | 'bills';

export const ALL_DASHBOARD_CARDS: DashboardCardKey[] = [
  'groceries',
  'chores',
  'parking',
  'votes',
  'bills',
];

const DEFAULT_ENABLED: DashboardCardKey[] = ['groceries', 'chores', 'parking', 'votes'];
const STORAGE_KEY = 'dashboard_cards_v1';

interface DashboardCardsStore {
  enabled: DashboardCardKey[];
  hydrated: boolean;
  hydrate: () => Promise<void>;
  setEnabled: (key: DashboardCardKey, on: boolean) => void;
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
      hydrated: false,

      hydrate: async (): Promise<void> => {
        if (get().hydrated) return;
        try {
          const raw = await AsyncStorage.getItem(STORAGE_KEY);
          if (raw) {
            const parsed = JSON.parse(raw) as string[];
            const valid = ALL_DASHBOARD_CARDS.filter((k) => parsed.includes(k));
            set({ enabled: valid, hydrated: true });
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
        const next = order(current);
        set({ enabled: next });
        AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(next)).catch((err) =>
          captureError(err, { context: 'dashboard-cards-save' })
        );
      },
    }),
    { name: 'dashboard-cards-store' }
  )
);
