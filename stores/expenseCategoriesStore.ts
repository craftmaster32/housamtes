import { create } from 'zustand';
import { devtools } from 'zustand/middleware';
import { supabase } from '@lib/supabase';

export interface ExpenseCategory {
  id: string;
  name: string;
  icon: string;
  color: string;
  isDefault: boolean;
  sortOrder: number;
}

export const PRESET_COLORS = [
  '#8B5CF6', '#3B6FBF', '#4FB071', '#E0B24D',
  '#D9534F', '#06B6D4', '#EC4899', '#64748B', '#10B981', '#8D8F8F',
];

const DEFAULTS: Omit<ExpenseCategory, 'id'>[] = [
  { name: 'Rent',         icon: '🏠', color: '#8B5CF6', isDefault: true, sortOrder: 0 },
  { name: 'Electricity',  icon: '⚡', color: '#F59E0B', isDefault: true, sortOrder: 1 },
  { name: 'Water',        icon: '💧', color: '#3B6FBF', isDefault: true, sortOrder: 2 },
  { name: 'Internet',     icon: '📶', color: '#06B6D4', isDefault: true, sortOrder: 3 },
  { name: 'Groceries',    icon: '🛒', color: '#4FB071', isDefault: true, sortOrder: 4 },
  { name: 'Outside Food', icon: '🍕', color: '#E0B24D', isDefault: true, sortOrder: 5 },
  { name: 'Transport',    icon: '🚗', color: '#64748B', isDefault: true, sortOrder: 6 },
  { name: 'Entertainment',icon: '🎉', color: '#EC4899', isDefault: true, sortOrder: 7 },
  { name: 'Health',       icon: '🏥', color: '#10B981', isDefault: true, sortOrder: 8 },
  { name: 'Other',        icon: '📦', color: '#8D8F8F', isDefault: true, sortOrder: 99 },
];

interface ExpenseCategoriesStore {
  categories: ExpenseCategory[];
  isLoading: boolean;
  load: (houseId: string) => Promise<void>;
  seedDefaults: (houseId: string) => Promise<void>;
  add: (cat: Pick<ExpenseCategory, 'name' | 'icon' | 'color'>, houseId: string) => Promise<void>;
  update: (id: string, changes: Pick<ExpenseCategory, 'name' | 'icon' | 'color'>) => Promise<void>;
  remove: (id: string) => Promise<void>;
}

export const useExpenseCategoriesStore = create<ExpenseCategoriesStore>()(
  devtools(
    (set, get) => ({
      categories: [],
      isLoading: false,

      load: async (houseId: string): Promise<void> => {
        set({ isLoading: true });
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
            categories: data.map((r) => ({
              id: r.id,
              name: r.name,
              icon: r.icon,
              color: r.color,
              isDefault: r.is_default,
              sortOrder: r.sort_order,
            })),
            isLoading: false,
          });
        } catch {
          set({ isLoading: false });
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
        const { data } = await supabase
          .from('expense_categories')
          .upsert(rows, { onConflict: 'house_id,name' })
          .select();
        set({
          categories: (data ?? []).map((r) => ({
            id: r.id, name: r.name, icon: r.icon,
            color: r.color, isDefault: r.is_default, sortOrder: r.sort_order,
          })),
          isLoading: false,
        });
      },

      add: async (cat, houseId): Promise<void> => {
        const { data, error } = await supabase
          .from('expense_categories')
          .insert({ house_id: houseId, name: cat.name, icon: cat.icon, color: cat.color, is_default: false, sort_order: 50 })
          .select()
          .single();
        if (error) throw new Error(`Failed to add category: ${error.message}`);
        set({
          categories: [...get().categories, {
            id: data.id, name: data.name, icon: data.icon,
            color: data.color, isDefault: false, sortOrder: 50,
          }],
        });
      },

      update: async (id, changes): Promise<void> => {
        const { error } = await supabase
          .from('expense_categories')
          .update({ name: changes.name, icon: changes.icon, color: changes.color })
          .eq('id', id);
        if (error) throw new Error(`Failed to update category: ${error.message}`);
        set({
          categories: get().categories.map((c) => c.id === id ? { ...c, ...changes } : c),
        });
      },

      remove: async (id): Promise<void> => {
        const { error } = await supabase.from('expense_categories').delete().eq('id', id);
        if (error) throw new Error(`Failed to delete category: ${error.message}`);
        set({ categories: get().categories.filter((c) => c.id !== id) });
      },
    }),
    { name: 'expense-categories-store' }
  )
);
