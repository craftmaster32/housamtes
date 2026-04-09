import { create } from 'zustand';
import { devtools } from 'zustand/middleware';
import { supabase } from '@lib/supabase';

export interface GroceryItem {
  id: string;
  name: string;
  quantity: string;
  boughtCount: number;
  addedBy: string;
  isChecked: boolean;
  createdAt: string;
}

export interface ShoppingRun {
  shopperName: string;
  startedAt: string;
}

interface RunPayload {
  active: boolean;
  shopperName: string;
  startedAt: string;
}

interface GroceryStore {
  items: GroceryItem[];
  isLoading: boolean;
  activeRun: ShoppingRun | null;
  load: (houseId: string) => Promise<void>;
  unsubscribe: () => void;
  addItem: (name: string, quantity: string, addedBy: string, houseId: string) => Promise<void>;
  toggleItem: (id: string) => Promise<void>;
  incrementBought: (id: string) => Promise<void>;
  decrementBought: (id: string) => Promise<void>;
  deleteItem: (id: string) => Promise<void>;
  clearChecked: (houseId: string) => Promise<void>;
  startRun: (shopperName: string) => Promise<void>;
  endRun: () => Promise<void>;
}

let _channel: ReturnType<typeof supabase.channel> | null = null;

export const useGroceryStore = create<GroceryStore>()(
  devtools(
    (set, get) => ({
      items: [],
      isLoading: true,
      activeRun: null,

      load: async (houseId: string): Promise<void> => {
        try {
          const { data, error } = await supabase
            .from('grocery_items')
            .select('*')
            .eq('house_id', houseId)
            .order('created_at');
          if (error) throw error;
          const items: GroceryItem[] = (data ?? []).map((r) => ({
            id: r.id,
            name: r.name,
            quantity: r.quantity ?? '',
            boughtCount: r.bought_count ?? 0,
            addedBy: r.added_by,
            isChecked: r.is_checked,
            createdAt: r.created_at,
          }));
          set({ items, isLoading: false });
        } catch {
          set({ isLoading: false });
        }

        if (_channel) { supabase.removeChannel(_channel); }
        _channel = supabase
          .channel(`grocery:${houseId}`)
          .on('postgres_changes', { event: '*', schema: 'public', table: 'grocery_items', filter: `house_id=eq.${houseId}` },
            () => { get().load(houseId); })
          .on('broadcast', { event: 'shopping_run' }, (msg: { payload: unknown }) => {
            const p = msg.payload as RunPayload;
            set({ activeRun: p.active ? { shopperName: p.shopperName, startedAt: p.startedAt } : null });
          })
          .subscribe();
      },

      unsubscribe: (): void => {
        if (_channel) { supabase.removeChannel(_channel); _channel = null; }
      },

      addItem: async (name, quantity, addedBy, houseId): Promise<void> => {
        const { data, error } = await supabase
          .from('grocery_items')
          .insert({ house_id: houseId, name, quantity, added_by: addedBy })
          .select()
          .single();
        if (error) throw new Error(`Failed to add item: ${error.message}`);
        const item: GroceryItem = {
          id: data.id,
          name: data.name,
          quantity: data.quantity ?? '',
          boughtCount: 0,
          addedBy: data.added_by,
          isChecked: false,
          createdAt: data.created_at,
        };
        set({ items: [...get().items, item] });
      },

      toggleItem: async (id): Promise<void> => {
        const item = get().items.find((i) => i.id === id);
        if (!item) return;
        const newChecked = !item.isChecked;
        await supabase.from('grocery_items').update({ is_checked: newChecked }).eq('id', id);
        set({ items: get().items.map((i) => (i.id === id ? { ...i, isChecked: newChecked } : i)) });
      },

      incrementBought: async (id): Promise<void> => {
        const item = get().items.find((i) => i.id === id);
        if (!item) return;
        const max = parseInt(item.quantity, 10);
        const hasMax = !isNaN(max) && max > 1;
        const count = hasMax ? Math.min((item.boughtCount ?? 0) + 1, max) : (item.boughtCount ?? 0) + 1;
        const isChecked = hasMax ? count >= max : item.isChecked;
        await supabase.from('grocery_items').update({ bought_count: count, is_checked: isChecked }).eq('id', id);
        set({ items: get().items.map((i) => (i.id === id ? { ...i, boughtCount: count, isChecked } : i)) });
      },

      decrementBought: async (id): Promise<void> => {
        const item = get().items.find((i) => i.id === id);
        if (!item) return;
        const count = Math.max((item.boughtCount ?? 0) - 1, 0);
        const max = parseInt(item.quantity, 10);
        const hasMax = !isNaN(max) && max > 1;
        const isChecked = hasMax ? count >= max : item.isChecked;
        await supabase.from('grocery_items').update({ bought_count: count, is_checked: isChecked }).eq('id', id);
        set({ items: get().items.map((i) => (i.id === id ? { ...i, boughtCount: count, isChecked } : i)) });
      },

      deleteItem: async (id): Promise<void> => {
        await supabase.from('grocery_items').delete().eq('id', id);
        set({ items: get().items.filter((i) => i.id !== id) });
      },

      clearChecked: async (houseId: string): Promise<void> => {
        await supabase.from('grocery_items').delete().eq('house_id', houseId).eq('is_checked', true);
        set({ items: get().items.filter((i) => !i.isChecked) });
      },

      startRun: async (shopperName: string): Promise<void> => {
        const startedAt = new Date().toISOString();
        set({ activeRun: { shopperName, startedAt } });
        _channel?.send({
          type: 'broadcast',
          event: 'shopping_run',
          payload: { active: true, shopperName, startedAt },
        }).catch(() => {});
      },

      endRun: async (): Promise<void> => {
        set({ activeRun: null });
        _channel?.send({
          type: 'broadcast',
          event: 'shopping_run',
          payload: { active: false, shopperName: '', startedAt: '' },
        }).catch(() => {});
      },
    }),
    { name: 'grocery-store' }
  )
);
