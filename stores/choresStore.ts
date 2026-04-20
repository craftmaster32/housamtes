import { create } from 'zustand';
import { devtools } from 'zustand/middleware';
import { supabase } from '@lib/supabase';

export type Recurrence = 'once' | 'weekly' | 'monthly';

export interface Chore {
  id: string;
  name: string;
  claimedBy: string | null;
  recurrence: Recurrence;
  recurrenceDay: string | null;
  isComplete: boolean;
  completedAt: string | null;
  createdAt: string;
}

interface ChoresStore {
  chores: Chore[];
  isLoading: boolean;
  load: (houseId: string) => Promise<void>;
  unsubscribe: () => void;
  addChore: (name: string, recurrence: Recurrence, recurrenceDay: string | null, houseId: string) => Promise<void>;
  toggleChore: (id: string) => Promise<void>;
  claimChore: (id: string, name: string) => Promise<void>;
  unclaimChore: (id: string) => Promise<void>;
  deleteChore: (id: string) => Promise<void>;
  resetAll: (houseId: string) => Promise<void>;
}

let _channel: ReturnType<typeof supabase.channel> | null = null;

export const useChoresStore = create<ChoresStore>()(
  devtools(
    (set, get) => ({
      chores: [],
      isLoading: true,
      load: async (houseId: string): Promise<void> => {
        try {
          const { data, error } = await supabase
            .from('chores')
            .select('*')
            .eq('house_id', houseId)
            .order('created_at');
          if (error) throw error;
          const chores: Chore[] = (data ?? []).map((r) => ({
            id: r.id,
            name: r.title,
            claimedBy: r.assigned_to ?? null,
            recurrence: (r.recurrence ?? 'once') as Recurrence,
            recurrenceDay: r.recurrence_day ?? null,
            isComplete: r.is_done,
            completedAt: r.completed_at ?? null,
            createdAt: r.created_at,
          }));
          set({ chores, isLoading: false });
        } catch {
          set({ isLoading: false });
        }

        if (_channel) { supabase.removeChannel(_channel); }
        _channel = supabase
          .channel(`chores:${houseId}`)
          .on('postgres_changes', { event: '*', schema: 'public', table: 'chores', filter: `house_id=eq.${houseId}` },
            () => { get().load(houseId); })
          .subscribe();
      },
      unsubscribe: (): void => {
        if (_channel) { supabase.removeChannel(_channel); _channel = null; }
      },
      addChore: async (name, recurrence, recurrenceDay, houseId): Promise<void> => {
        const { data, error } = await supabase
          .from('chores')
          .insert({ house_id: houseId, title: name, recurrence, recurrence_day: recurrenceDay ?? null })
          .select()
          .single();
        if (error) throw new Error(`Failed to add chore: ${error.message}`);
        const chore: Chore = {
          id: data.id,
          name: data.title,
          claimedBy: null,
          recurrence: (data.recurrence ?? 'once') as Recurrence,
          recurrenceDay: data.recurrence_day ?? null,
          isComplete: false,
          completedAt: null,
          createdAt: data.created_at,
        };
        set({ chores: [...get().chores, chore] });
      },
      toggleChore: async (id): Promise<void> => {
        const chore = get().chores.find((c) => c.id === id);
        if (!chore) return;
        const isDone = !chore.isComplete;
        const completedAt = isDone ? new Date().toISOString() : null;
        const { error } = await supabase.from('chores').update({ is_done: isDone, completed_at: completedAt }).eq('id', id);
        if (error) throw new Error(`Failed to update chore: ${error.message}`);
        set({
          chores: get().chores.map((c) =>
            c.id === id ? { ...c, isComplete: isDone, completedAt } : c
          ),
        });
      },
      claimChore: async (id, name): Promise<void> => {
        const { error } = await supabase.from('chores').update({ assigned_to: name }).eq('id', id);
        if (error) throw new Error(`Failed to claim chore: ${error.message}`);
        set({ chores: get().chores.map((c) => (c.id === id ? { ...c, claimedBy: name } : c)) });
      },
      unclaimChore: async (id): Promise<void> => {
        const { error } = await supabase.from('chores').update({ assigned_to: null }).eq('id', id);
        if (error) throw new Error(`Failed to unclaim chore: ${error.message}`);
        set({ chores: get().chores.map((c) => (c.id === id ? { ...c, claimedBy: null } : c)) });
      },
      deleteChore: async (id): Promise<void> => {
        const { error } = await supabase.from('chores').delete().eq('id', id);
        if (error) throw new Error(`Failed to delete chore: ${error.message}`);
        set({ chores: get().chores.filter((c) => c.id !== id) });
      },
      resetAll: async (houseId: string): Promise<void> => {
        const { error } = await supabase.from('chores').update({ is_done: false, assigned_to: null, completed_at: null }).eq('house_id', houseId);
        if (error) throw new Error(`Failed to reset chores: ${error.message}`);
        set({
          chores: get().chores.map((c) => ({ ...c, isComplete: false, completedAt: null, claimedBy: null })),
        });
      },
    }),
    { name: 'chores-store' }
  )
);
