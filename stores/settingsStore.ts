import { create } from 'zustand';
import { devtools, persist, createJSONStorage } from 'zustand/middleware';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { type CurrencyCode, currencyFromSymbol } from '@constants/currencies';

export type ThemeMode = 'light' | 'dark' | 'system';

export interface FeatureConfig {
  key: string;
  label: string;
  icon: string;
  description: string;
  enabled: boolean;
}

export interface CurrencyOption {
  symbol: string;
  label: string;
}

export const CURRENCIES: CurrencyOption[] = [
  { symbol: '₪', label: 'Israeli Shekel (₪)' },
  { symbol: '$', label: 'US Dollar ($)' },
  { symbol: '€', label: 'Euro (€)' },
  { symbol: '£', label: 'British Pound (£)' },
  { symbol: 'A$', label: 'Australian Dollar (A$)' },
  { symbol: 'C$', label: 'Canadian Dollar (C$)' },
  { symbol: 'Fr', label: 'Swiss Franc (Fr)' },
  { symbol: '¥', label: 'Japanese Yen (¥)' },
];

export const DEFAULT_FEATURES: FeatureConfig[] = [
  {
    key: 'parking',
    label: 'Parking',
    icon: '🚗',
    description: 'Track who has which parking spot',
    enabled: true,
  },
  {
    key: 'grocery',
    label: 'Grocery List',
    icon: '🛒',
    description: 'Shared shopping list for the house',
    enabled: true,
  },
  {
    key: 'grocery_draft',
    label: 'Grocery Draft Mode',
    icon: '📝',
    description: 'Privately compose your shopping list before sharing it with the house',
    enabled: true,
  },
  {
    key: 'chores',
    label: 'Chores',
    icon: '🧹',
    description: 'Assign and track household chores',
    enabled: true,
  },
  {
    key: 'chat',
    label: 'House Chat',
    icon: '💬',
    description: 'Group chat for your housemates',
    enabled: true,
  },
  {
    key: 'voting',
    label: 'House Votes',
    icon: '🗳️',
    description: 'Make group decisions together',
    enabled: true,
  },
  {
    key: 'maintenance',
    label: 'Maintenance',
    icon: '🔧',
    description: 'Log repairs and maintenance jobs',
    enabled: true,
  },
  {
    key: 'condition',
    label: 'House Condition',
    icon: '🏠',
    description: 'Track the condition of rooms and items',
    enabled: true,
  },
];

const ALL_FEATURE_KEYS = DEFAULT_FEATURES.map((f) => f.key);

export type AppTheme = 'dark' | 'light';

interface SettingsStore {
  features: FeatureConfig[];
  dashboardWidgets: string[];
  /** @deprecated use currencyCode instead */
  currency: string;
  currencyCode: CurrencyCode;
  showRecurringBillsOnCalendar: boolean;
  theme: AppTheme;
  themeMode: ThemeMode;
  toggleFeature: (key: string) => void;
  toggleDashboardWidget: (key: string) => void;
  setCurrency: (currency: string) => void;
  setCurrencyCode: (code: CurrencyCode) => void;
  toggleShowRecurringBillsOnCalendar: () => void;
  setTheme: (theme: AppTheme) => void;
  setThemeMode: (mode: ThemeMode) => void;
  isEnabled: (key: string) => boolean;
  isDashboardWidget: (key: string) => boolean;
}

export const useSettingsStore = create<SettingsStore>()(
  devtools(
    persist(
      (set, get) => ({
        features: DEFAULT_FEATURES,
        dashboardWidgets: ALL_FEATURE_KEYS,
        currency: '₪',
        currencyCode: 'ILS' as CurrencyCode,
        showRecurringBillsOnCalendar: true,
        theme: 'dark' as AppTheme,
        themeMode: 'system' as ThemeMode,

        toggleFeature: (key: string): void => {
          set((s) => ({
            features: s.features.map((f) =>
              f.key === key ? { ...f, enabled: !f.enabled } : f
            ),
          }));
        },

        setCurrency: (currency: string): void => {
          set({ currency, currencyCode: currencyFromSymbol(currency) });
        },

        setCurrencyCode: (code: CurrencyCode): void => {
          set({ currencyCode: code });
        },

        setThemeMode: (mode: ThemeMode): void => {
          set({ themeMode: mode });
        },

        toggleShowRecurringBillsOnCalendar: (): void => {
          set((s) => ({ showRecurringBillsOnCalendar: !s.showRecurringBillsOnCalendar }));
        },

        toggleDashboardWidget: (key: string): void => {
          set((s) => ({
            dashboardWidgets: s.dashboardWidgets.includes(key)
              ? s.dashboardWidgets.filter((k) => k !== key)
              : [...s.dashboardWidgets, key],
          }));
        },

        setTheme: (theme: AppTheme): void => {
          set({ theme });
        },

        isEnabled: (key: string): boolean => {
          return get().features.find((f) => f.key === key)?.enabled ?? false;
        },

        isDashboardWidget: (key: string): boolean => {
          const { dashboardWidgets, features } = get();
          const enabled = features.find((f) => f.key === key)?.enabled ?? false;
          return enabled && dashboardWidgets.includes(key);
        },
      }),
      {
        name: 'housemates-settings',
        storage: createJSONStorage(() => AsyncStorage),
        version: 4,
        migrate: (state: unknown, fromVersion: number): SettingsStore => {
          let next = { ...(state as SettingsStore) };
          if (fromVersion < 2) {
            const hasGroceryDraft = next.features?.some((f) => f.key === 'grocery_draft');
            if (!hasGroceryDraft) {
              const groceryIndex = next.features?.findIndex((f) => f.key === 'grocery') ?? -1;
              const entry: FeatureConfig = {
                key: 'grocery_draft',
                label: 'Grocery Draft Mode',
                icon: '📝',
                description: 'Privately compose your shopping list before sharing it with the house',
                enabled: true,
              };
              const features = [...(next.features ?? [])];
              features.splice(groceryIndex + 1, 0, entry);
              next = { ...next, features };
            }
          }
          if (fromVersion < 3 && !next.theme) {
            next = { ...next, theme: 'dark' };
          }
          if (fromVersion < 4) {
            if (!next.currencyCode) {
              next = { ...next, currencyCode: currencyFromSymbol(next.currency) };
            }
            if (!next.themeMode) {
              next = { ...next, themeMode: 'system' };
            }
          }
          return next;
        },
      }
    ),
    { name: 'settings-store' }
  )
);
