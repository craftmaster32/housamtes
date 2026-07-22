import type * as React from 'react';
import { create } from 'zustand';
import { devtools } from 'zustand/middleware';
import type { Ionicons } from '@expo/vector-icons';
import { supabase } from '@lib/supabase';
import { captureError } from '@lib/errorTracking';
import { useAuthStore } from '@stores/authStore';
import type { ExpenseCategoryRow } from '../types/database';

type IoniconName = React.ComponentProps<typeof Ionicons>['name'];

export interface ExpenseCategory {
  id: string;
  name: string;
  icon: string; // stored value — a new Ionicon name, or a legacy emoji (resolve with resolveCategoryIcon)
  color: string;
  isDefault: boolean;
  sortOrder: number;
}

// Icons offered in the category picker (new categories store these Ionicon names).
export const CATEGORY_PICKER_ICONS: IoniconName[] = [
  'home-outline',
  'bed-outline',
  'key-outline',
  'business-outline',
  'flash-outline',
  'water-outline',
  'flame-outline',
  'wifi-outline',
  'tv-outline',
  'thermometer-outline',
  'cart-outline',
  'pizza-outline',
  'fast-food-outline',
  'nutrition-outline',
  'cafe-outline',
  'beer-outline',
  'restaurant-outline',
  'wine-outline',
  'ice-cream-outline',
  'car-outline',
  'bus-outline',
  'airplane-outline',
  'train-outline',
  'bicycle-outline',
  'speedometer-outline',
  'sparkles-outline',
  'film-outline',
  'game-controller-outline',
  'musical-notes-outline',
  'medkit-outline',
  'medical-outline',
  'body-outline',
  'bag-handle-outline',
  'cash-outline',
  'card-outline',
  'cube-outline',
  'basket-outline',
  'paw-outline',
  'book-outline',
  'school-outline',
  'briefcase-outline',
  'construct-outline',
  'leaf-outline',
  'phone-portrait-outline',
  'barbell-outline',
  'gift-outline',
  'globe-outline',
  'pricetag-outline',
];

const PICKER_ICON_SET = new Set<string>(CATEGORY_PICKER_ICONS);

// Categories created before the icon switch stored an emoji. Map the known ones
// to a matching Ionicon so existing data keeps rendering.
const LEGACY_CATEGORY_ICONS: Record<string, IoniconName> = {
  '🏠': 'home-outline',
  '🛋️': 'bed-outline',
  '🔑': 'key-outline',
  '🏗️': 'business-outline',
  '⚡': 'flash-outline',
  '💧': 'water-outline',
  '🔥': 'flame-outline',
  '📶': 'wifi-outline',
  '📺': 'tv-outline',
  '🌡️': 'thermometer-outline',
  '🛒': 'cart-outline',
  '🍕': 'pizza-outline',
  '🍔': 'fast-food-outline',
  '🥗': 'nutrition-outline',
  '☕': 'cafe-outline',
  '🍺': 'beer-outline',
  '🍜': 'restaurant-outline',
  '🥡': 'fast-food-outline',
  '🍣': 'restaurant-outline',
  '🧃': 'nutrition-outline',
  '🚗': 'car-outline',
  '🚌': 'bus-outline',
  '✈️': 'airplane-outline',
  '🚂': 'train-outline',
  '🛵': 'bicycle-outline',
  '⛽': 'speedometer-outline',
  '🎉': 'sparkles-outline',
  '🎬': 'film-outline',
  '🎮': 'game-controller-outline',
  '🎵': 'musical-notes-outline',
  '🏥': 'medkit-outline',
  '💊': 'medical-outline',
  '🦷': 'medkit-outline',
  '🧘': 'body-outline',
  '🛍️': 'bag-handle-outline',
  '💰': 'cash-outline',
  '💳': 'card-outline',
  '📦': 'cube-outline',
  '🧹': 'sparkles-outline',
  '🧺': 'basket-outline',
  '🐾': 'paw-outline',
  '📚': 'book-outline',
  '🎓': 'school-outline',
  '💼': 'briefcase-outline',
  '🔧': 'construct-outline',
  '🌿': 'leaf-outline',
  '📱': 'phone-portrait-outline',
  '🏋️': 'barbell-outline',
  '🎁': 'gift-outline',
  '🌐': 'globe-outline',
};

// Default icon for a brand-new category / unknown stored value.
export const DEFAULT_CATEGORY_ICON: IoniconName = 'pricetag-outline';

// Resolve whatever is stored in a category's `icon` field (a new Ionicon name or
// a legacy emoji) to a renderable Ionicon name.
export function resolveCategoryIcon(stored: string | null | undefined): IoniconName {
  if (stored && PICKER_ICON_SET.has(stored)) return stored as IoniconName;
  if (stored && LEGACY_CATEGORY_ICONS[stored]) return LEGACY_CATEGORY_ICONS[stored];
  return DEFAULT_CATEGORY_ICON;
}

export const PRESET_COLORS = [
  '#8B5CF6',
  '#3B6FBF',
  '#4FB071',
  '#E0B24D',
  '#D9534F',
  '#06B6D4',
  '#EC4899',
  '#64748B',
  '#10B981',
  '#8D8F8F',
];

const DEFAULTS: Omit<ExpenseCategory, 'id'>[] = [
  { name: 'Rent', icon: 'home-outline', color: '#8B5CF6', isDefault: true, sortOrder: 0 },
  { name: 'Electricity', icon: 'flash-outline', color: '#F59E0B', isDefault: true, sortOrder: 1 },
  { name: 'Water', icon: 'water-outline', color: '#3B6FBF', isDefault: true, sortOrder: 2 },
  { name: 'Internet', icon: 'wifi-outline', color: '#06B6D4', isDefault: true, sortOrder: 3 },
  { name: 'Groceries', icon: 'cart-outline', color: '#4FB071', isDefault: true, sortOrder: 4 },
  { name: 'Outside Food', icon: 'pizza-outline', color: '#E0B24D', isDefault: true, sortOrder: 5 },
  { name: 'Transport', icon: 'car-outline', color: '#64748B', isDefault: true, sortOrder: 6 },
  {
    name: 'Entertainment',
    icon: 'sparkles-outline',
    color: '#EC4899',
    isDefault: true,
    sortOrder: 7,
  },
  { name: 'Health', icon: 'medkit-outline', color: '#10B981', isDefault: true, sortOrder: 8 },
  { name: 'Other', icon: 'cube-outline', color: '#8D8F8F', isDefault: true, sortOrder: 99 },
];

function toCategory(r: ExpenseCategoryRow): ExpenseCategory {
  return {
    id: r.id,
    name: r.name,
    icon: r.icon,
    color: r.color,
    isDefault: r.is_default,
    sortOrder: r.sort_order,
  };
}

interface ExpenseCategoriesStore {
  categories: ExpenseCategory[];
  isLoading: boolean;
  error: string | null;
  load: (houseId: string) => Promise<void>;
  seedDefaults: (houseId: string) => Promise<void>;
  add: (cat: Pick<ExpenseCategory, 'name' | 'icon' | 'color'>, houseId: string) => Promise<void>;
  update: (id: string, changes: Pick<ExpenseCategory, 'name' | 'icon' | 'color'>) => Promise<void>;
  remove: (id: string) => Promise<void>;
  clearError: () => void;
}

export const useExpenseCategoriesStore = create<ExpenseCategoriesStore>()(
  devtools(
    (set, get) => ({
      categories: [],
      isLoading: false,
      error: null,

      load: async (houseId: string): Promise<void> => {
        if (houseId !== useAuthStore.getState().houseId) {
          console.warn('[expense-categories] house ID mismatch — aborting load');
          return;
        }
        set({ isLoading: true, error: null });
        try {
          const { data, error } = await supabase
            .from('expense_categories')
            .select('*')
            .eq('house_id', houseId)
            .order('sort_order');
          if (error) throw error;
          if (!data || data.length === 0) {
            await get().seedDefaults(houseId);
            return;
          }
          set({
            categories: data.map(toCategory),
            isLoading: false,
            error: null,
          });
        } catch (err) {
          captureError(err, {
            store: 'expense-categories',
            houseId,
            userId: useAuthStore.getState().user?.id ?? '',
          });
          set({ isLoading: false, error: 'Could not load your categories. Please try again.' });
        }
      },

      seedDefaults: async (houseId: string): Promise<void> => {
        const rows = DEFAULTS.map((d) => ({
          house_id: houseId,
          name: d.name,
          icon: d.icon,
          color: d.color,
          is_default: true,
          sort_order: d.sortOrder,
        }));
        const { data, error } = await supabase
          .from('expense_categories')
          .upsert(rows, { onConflict: 'house_id,name' })
          .select();
        // Without this check a failed seed silently left the category list empty.
        if (error) {
          captureError(error, {
            context: 'seed-default-categories',
            houseId,
            userId: useAuthStore.getState().user?.id ?? '',
          });
          // Reset the spinner here too so a direct caller can't get stuck on it
          set({ isLoading: false });
          throw new Error('Could not set up your categories. Please try again.');
        }
        set({
          categories: (data ?? []).map(toCategory),
          isLoading: false,
          error: null,
        });
      },

      add: async (cat, houseId): Promise<void> => {
        const { data, error } = await supabase
          .from('expense_categories')
          .insert({
            house_id: houseId,
            name: cat.name,
            icon: cat.icon,
            color: cat.color,
            is_default: false,
            sort_order: 50,
          })
          .select()
          .single();
        if (error) {
          captureError(error, { context: 'add-category', houseId });
          throw new Error('Could not save the category. Please try again.');
        }
        set({ categories: [...get().categories, toCategory(data)] });
      },

      update: async (id, changes): Promise<void> => {
        const { error } = await supabase
          .from('expense_categories')
          .update({ name: changes.name, icon: changes.icon, color: changes.color })
          .eq('id', id);
        if (error) {
          captureError(error, { context: 'update-category', categoryId: id });
          throw new Error('Could not update the category. Please try again.');
        }
        set({
          categories: get().categories.map((c) => (c.id === id ? { ...c, ...changes } : c)),
        });
      },

      remove: async (id): Promise<void> => {
        const { error } = await supabase.from('expense_categories').delete().eq('id', id);
        if (error) {
          captureError(error, { context: 'delete-category', categoryId: id });
          throw new Error('Could not delete the category. Please try again.');
        }
        set({ categories: get().categories.filter((c) => c.id !== id) });
      },

      clearError: (): void => {
        set({ error: null });
      },
    }),
    { name: 'expense-categories-store' }
  )
);
