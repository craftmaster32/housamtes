import { create } from 'zustand';
import { devtools } from 'zustand/middleware';
import { supabase } from '@lib/supabase';
import { notifyHousemates } from '@lib/notifyHousemates';
import { captureError } from '@lib/errorTracking';
import { useAuthStore } from '@stores/authStore';

export type Recurrence = 'once' | 'weekly' | 'monthly';

export interface Chore {
  id: string;
  name: string;
  claimedBy: string | null; // user UUID
  recurrence: Recurrence;
  recurrenceDay: string | null;
  isComplete: boolean;
  completedAt: string | null;
  createdAt: string;
}

interface ChoresStore {
  chores: Chore[];
  isLoading: boolean;
  error: string | null;
  clearError: () => void;
  load: (houseId: string) => Promise<void>;
  unsubscribe: () => void;
  addChore: (
    name: string,
    recurrence: Recurrence,
    recurrenceDay: string | null,
    houseId: string
  ) => Promise<void>;
  toggleChore: (id: string) => Promise<void>;
  claimChore: (id: string, userId: string) => Promise<void>;
  unclaimChore: (id: string) => Promise<void>;
  deleteChore: (id: string) => Promise<void>;
  resetAll: (houseId: string) => Promise<void>;
}

let _channel: ReturnType<typeof supabase.channel> | null = null;
let _channelHouseId: string | null = null;
// Bumped on every load() and unsubscribe(). An in-flight load compares its own
// sequence number against this before committing state or (re)subscribing, so a
// stale load can neither overwrite newer data nor recreate a channel after cleanup.
let _loadSeq = 0;

export const useChoresStore = create<ChoresStore>()(
  devtools(
    (set, get) => ({
      chores: [],
      isLoading: true,
      error: null,
      clearError: (): void => set({ error: null }),
      load: async (houseId: string): Promise<void> => {
        if (houseId !== useAuthStore.getState().houseId) {
          console.warn('[chores] house ID mismatch — aborting load');
          set({ isLoading: false });
          return;
        }
        const seq = ++_loadSeq;
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
          // A newer load (or unsubscribe) superseded this one — drop its result.
          if (seq !== _loadSeq) return;
          set({ chores, isLoading: false, error: null });
        } catch (err) {
          captureError(err, { store: 'chores', houseId });
          // A newer load (or unsubscribe) superseded this one — drop its result.
          if (seq !== _loadSeq) return;
          set({ isLoading: false, error: 'Could not load chores. Please try again.' });
        }

        // Superseded by a newer load or an unsubscribe while fetching — leave the
        // existing subscription (if any) untouched and never recreate one here.
        if (seq !== _loadSeq) return;
        // Already subscribed for this house: realtime-triggered reloads must not
        // tear the channel down and recreate it on every event.
        if (_channel && _channelHouseId === houseId) return;
        if (_channel) {
          supabase.removeChannel(_channel);
        }
        _channelHouseId = houseId;
        _channel = supabase
          .channel(`chores:${houseId}`)
          .on(
            'postgres_changes',
            { event: '*', schema: 'public', table: 'chores', filter: `house_id=eq.${houseId}` },
            () => {
              get().load(houseId);
            }
          )
          .subscribe();
      },
      unsubscribe: (): void => {
        // Invalidate any in-flight load so it cannot resubscribe after this cleanup.
        _loadSeq++;
        if (_channel) {
          supabase.removeChannel(_channel);
          _channel = null;
          _channelHouseId = null;
        }
      },
      addChore: async (name, recurrence, recurrenceDay, houseId): Promise<void> => {
        let chore: Chore;
        try {
          const res = await supabase
            .from('chores')
            .insert({
              house_id: houseId,
              title: name,
              recurrence,
              recurrence_day: recurrenceDay ?? null,
            })
            .select()
            .single();
          if (res.error) throw res.error;
          chore = {
            id: res.data.id,
            name: res.data.title,
            claimedBy: null,
            recurrence: (res.data.recurrence ?? 'once') as Recurrence,
            recurrenceDay: res.data.recurrence_day ?? null,
            isComplete: false,
            completedAt: null,
            createdAt: res.data.created_at,
          };
        } catch (err) {
          captureError(err, { context: 'add-chore', houseId });
          throw new Error('Could not save the chore. Please try again.');
        }
        set({ chores: [...get().chores, chore] });
        const userId = useAuthStore.getState().profile?.id ?? '';
        const displayName = useAuthStore.getState().profile?.name ?? 'Someone';
        if (userId) {
          void notifyHousemates({
            houseId,
            excludeUserId: userId,
            title: '🧹 New chore added',
            body: `${displayName} added "${name}". Time to pitch in!`,
            data: { screen: 'chores' },
            notificationType: 'chore_overdue',
          }).catch((err) => captureError(err, { context: 'notify-chore-added', houseId }));
        }
      },
      toggleChore: async (id): Promise<void> => {
        const chore = get().chores.find((c) => c.id === id);
        if (!chore) return;
        const isDone = !chore.isComplete;
        const completedAt = isDone ? new Date().toISOString() : null;
        try {
          const { error } = await supabase
            .from('chores')
            .update({ is_done: isDone, completed_at: completedAt })
            .eq('id', id);
          if (error) throw error;
        } catch (err) {
          captureError(err, { context: 'toggle-chore', choreId: id });
          throw new Error('Could not update the chore. Please try again.');
        }
        set({
          chores: get().chores.map((c) =>
            c.id === id ? { ...c, isComplete: isDone, completedAt } : c
          ),
        });
        if (isDone) {
          const houseId = useAuthStore.getState().houseId;
          const userId = useAuthStore.getState().profile?.id ?? '';
          const displayName = useAuthStore.getState().profile?.name ?? 'Someone';
          if (houseId && userId) {
            void notifyHousemates({
              houseId,
              excludeUserId: userId,
              title: '✅ Chore done!',
              body: `${displayName} finished "${chore.name}". One less thing to worry about 🎉`,
              data: { screen: 'chores' },
              notificationType: 'chore_overdue',
            }).catch((err) => captureError(err, { context: 'notify-chore-done', houseId }));
          }
        }
      },
      claimChore: async (id, userId): Promise<void> => {
        try {
          const { error } = await supabase
            .from('chores')
            .update({ assigned_to: userId })
            .eq('id', id);
          if (error) throw error;
        } catch (err) {
          captureError(err, { context: 'claim-chore', choreId: id, userId });
          throw new Error('Could not claim the chore. Please try again.');
        }
        set({ chores: get().chores.map((c) => (c.id === id ? { ...c, claimedBy: userId } : c)) });
      },
      unclaimChore: async (id): Promise<void> => {
        try {
          const { error } = await supabase
            .from('chores')
            .update({ assigned_to: null })
            .eq('id', id);
          if (error) throw error;
        } catch (err) {
          captureError(err, { context: 'unclaim-chore', choreId: id });
          throw new Error('Could not unclaim the chore. Please try again.');
        }
        set({ chores: get().chores.map((c) => (c.id === id ? { ...c, claimedBy: null } : c)) });
      },
      deleteChore: async (id): Promise<void> => {
        try {
          const { error } = await supabase.from('chores').delete().eq('id', id);
          if (error) throw error;
        } catch (err) {
          captureError(err, { context: 'delete-chore', choreId: id });
          throw new Error('Could not delete the chore. Please try again.');
        }
        set({ chores: get().chores.filter((c) => c.id !== id) });
      },
      resetAll: async (houseId: string): Promise<void> => {
        try {
          const { error } = await supabase
            .from('chores')
            .update({ is_done: false, assigned_to: null, completed_at: null })
            .eq('house_id', houseId);
          if (error) throw error;
        } catch (err) {
          captureError(err, { context: 'reset-chores', houseId });
          throw new Error('Could not reset chores. Please try again.');
        }
        set({
          chores: get().chores.map((c) => ({
            ...c,
            isComplete: false,
            completedAt: null,
            claimedBy: null,
          })),
        });
      },
    }),
    { name: 'chores-store' }
  )
);
