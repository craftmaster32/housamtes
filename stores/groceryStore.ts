import { create } from 'zustand';
import { devtools } from 'zustand/middleware';
import { supabase } from '@lib/supabase';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { captureError } from '@lib/errorTracking';
import { useAuthStore } from '@stores/authStore';

const ACTIVE_RUN_KEY = 'grocery_active_run';
const RUN_MAX_AGE_MS = 4 * 60 * 60 * 1000;

export type AddMode = 'shared' | 'draft' | 'private';

export interface GroceryItem {
  id: string;
  name: string;
  quantity: string;
  boughtCount: number;
  addedBy: string; // user UUID
  isChecked: boolean;
  createdAt: string;
  isPersonal: boolean;
  isDraft: boolean;
}

export interface ShoppingRun {
  shopperId: string;   // user UUID
  shopperName: string; // display name for broadcast UI
  startedAt: string;
}

interface RunPayload {
  active: boolean;
  shopperId: string;
  shopperName: string;
  startedAt: string;
}

interface GroceryStore {
  items: GroceryItem[];
  isLoading: boolean;
  error: string | null;
  activeRun: ShoppingRun | null;
  load: (houseId: string) => Promise<void>;
  unsubscribe: () => void;
  addItem: (name: string, quantity: string, addedByUserId: string, houseId: string, mode?: AddMode) => Promise<void>;
  updateItem: (id: string, name: string, quantity: string) => Promise<void>;
  toggleItem: (id: string) => Promise<void>;
  incrementBought: (id: string) => Promise<void>;
  decrementBought: (id: string) => Promise<void>;
  deleteItem: (id: string) => Promise<void>;
  clearChecked: (houseId: string) => Promise<void>;
  publishDraftItems: (userId: string) => Promise<void>;
  startRun: (shopperId: string, shopperName: string) => Promise<void>;
  endRun: () => Promise<void>;
}

let _channel: ReturnType<typeof supabase.channel> | null = null;

export const useGroceryStore = create<GroceryStore>()(
  devtools(
    (set, get) => ({
      items: [],
      isLoading: true,
      error: null,
      activeRun: null,

      load: async (houseId: string): Promise<void> => {
        if (houseId !== useAuthStore.getState().houseId) {
          console.warn('[grocery] house ID mismatch — aborting load');
          return;
        }
        try {
          try {
            const stored = await AsyncStorage.getItem(ACTIVE_RUN_KEY);
            if (stored) {
              const run = JSON.parse(stored) as ShoppingRun;
              if (Date.now() - new Date(run.startedAt).getTime() < RUN_MAX_AGE_MS) {
                set({ activeRun: run });
              } else {
                AsyncStorage.removeItem(ACTIVE_RUN_KEY).catch(() => {});
              }
            }
          } catch { /* ignore storage errors */ }

          const { data, error } = await supabase
            .from('grocery_items')
            .select('*')
            .eq('house_id', houseId)
            .order('created_at', { ascending: false });
          if (error) throw error;
          const items: GroceryItem[] = (data ?? []).map((r) => ({
            id: r.id,
            name: r.name,
            quantity: r.quantity ?? '',
            boughtCount: r.bought_count ?? 0,
            addedBy: r.added_by,
            isChecked: r.is_checked,
            createdAt: r.created_at,
            isPersonal: r.is_personal ?? false,
            isDraft: r.is_draft ?? false,
          }));
          set({ items, isLoading: false, error: null });
        } catch (err) {
          captureError(err, { store: 'grocery', houseId });
          set({ isLoading: false, error: 'Could not load groceries. Please try again.' });
        }

        if (_channel) { supabase.removeChannel(_channel); }
        _channel = supabase
          .channel(`grocery:${houseId}`)
          .on('postgres_changes', { event: '*', schema: 'public', table: 'grocery_items', filter: `house_id=eq.${houseId}` },
            () => { get().load(houseId); })
          .on('broadcast', { event: 'shopping_run' }, (msg: { payload: unknown }) => {
            const p = msg.payload as RunPayload;
            const newRun = p.active ? { shopperId: p.shopperId, shopperName: p.shopperName, startedAt: p.startedAt } : null;
            set({ activeRun: newRun });
            if (p.active && newRun) {
              AsyncStorage.setItem(ACTIVE_RUN_KEY, JSON.stringify(newRun)).catch(() => {});
            } else {
              AsyncStorage.removeItem(ACTIVE_RUN_KEY).catch(() => {});
            }
          })
          .subscribe();
      },

      unsubscribe: (): void => {
        if (_channel) { supabase.removeChannel(_channel); _channel = null; }
      },

      addItem: async (name, quantity, addedByUserId, houseId, mode = 'shared'): Promise<void> => {
        const isPersonal = mode !== 'shared';
        const isDraft    = mode === 'draft';
        const { data, error } = await supabase
          .from('grocery_items')
          .insert({ house_id: houseId, name, quantity, added_by: addedByUserId, is_personal: isPersonal, is_draft: isDraft })
          .select()
          .single();
        if (error) { captureError(error, { context: 'add-grocery', houseId }); throw new Error('Could not add the item. Please try again.'); }
        const item: GroceryItem = {
          id: data.id,
          name: data.name,
          quantity: data.quantity ?? '',
          boughtCount: 0,
          addedBy: data.added_by,
          isChecked: false,
          createdAt: data.created_at,
          isPersonal: data.is_personal ?? false,
          isDraft: data.is_draft ?? false,
        };
        set({ items: [item, ...get().items] });
      },

      updateItem: async (id, name, quantity): Promise<void> => {
        const { error } = await supabase
          .from('grocery_items')
          .update({ name, quantity })
          .eq('id', id);
        if (error) { captureError(error, { context: 'update-grocery' }); throw new Error('Could not update the item. Please try again.'); }
        set({ items: get().items.map((i) => (i.id === id ? { ...i, name, quantity } : i)) });
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

      publishDraftItems: async (userId: string): Promise<void> => {
        const draftIds = get().items
          .filter((i) => i.isDraft && i.addedBy === userId)
          .map((i) => i.id);
        if (draftIds.length === 0) return;
        try {
          const { error } = await supabase
            .from('grocery_items')
            .update({ is_personal: false, is_draft: false })
            .in('id', draftIds)
            .eq('added_by', userId)
            .eq('is_draft', true);
          if (error) {
            captureError(error, { context: 'publish-draft', userId });
            throw new Error('Could not share your list. Please try again.');
          }
          set({
            items: get().items.map((i) =>
              draftIds.includes(i.id) && i.addedBy === userId
                ? { ...i, isPersonal: false, isDraft: false }
                : i
            ),
          });
        } catch (err) {
          captureError(err, { context: 'publish-draft-exception', userId });
          throw err instanceof Error ? err : new Error('Could not share your list. Please try again.');
        }
      },

      startRun: async (shopperId: string, shopperName: string): Promise<void> => {
        const startedAt = new Date().toISOString();
        const run: ShoppingRun = { shopperId, shopperName, startedAt };
        set({ activeRun: run });
        AsyncStorage.setItem(ACTIVE_RUN_KEY, JSON.stringify(run)).catch(() => {});
        _channel?.send({
          type: 'broadcast',
          event: 'shopping_run',
          payload: { active: true, shopperId, shopperName, startedAt },
        }).catch(() => {});
      },

      endRun: async (): Promise<void> => {
        set({ activeRun: null });
        AsyncStorage.removeItem(ACTIVE_RUN_KEY).catch(() => {});
        _channel?.send({
          type: 'broadcast',
          event: 'shopping_run',
          payload: { active: false, shopperId: '', shopperName: '', startedAt: '' },
        }).catch(() => {});
      },
    }),
    { name: 'grocery-store' }
  )
);
