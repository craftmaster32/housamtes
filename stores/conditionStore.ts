import type * as React from 'react';
import { create } from 'zustand';
import { devtools } from 'zustand/middleware';
import type { Ionicons } from '@expo/vector-icons';
import { supabase } from '@lib/supabase';
import { captureError } from '@lib/errorTracking';
import { useAuthStore } from '@stores/authStore';

type IoniconName = React.ComponentProps<typeof Ionicons>['name'];

export type ConditionLevel = 'good' | 'fair' | 'poor';
export type EntryType = 'move_in' | 'update' | 'damage';

export interface ConditionEntry {
  id: string;
  area: string;
  condition: ConditionLevel;
  type: EntryType;
  description: string;
  recordedBy: string; // user UUID
  date: string; // YYYY-MM-DD
  createdAt: string;
  photos: string[]; // data URLs (base64 JPEG)
}

interface ConditionStore {
  entries: ConditionEntry[];
  isLoading: boolean;
  error: string | null;
  clearError: () => void;
  load: (houseId: string) => Promise<void>;
  unsubscribe: () => void;
  add: (entry: Omit<ConditionEntry, 'id' | 'createdAt'>, houseId: string) => Promise<void>;
  remove: (id: string) => Promise<void>;
}

let _channel: ReturnType<typeof supabase.channel> | null = null;
let _channelHouseId: string | null = null;
// Bumped on every load() and unsubscribe(). An in-flight load compares its own
// sequence number against this before committing state or (re)subscribing, so a
// stale load can neither overwrite newer data nor recreate a channel after cleanup.
let _loadSeq = 0;

export const useConditionStore = create<ConditionStore>()(
  devtools(
    (set, get) => ({
      entries: [],
      isLoading: true,
      error: null,
      clearError: (): void => set({ error: null }),
      load: async (houseId: string): Promise<void> => {
        if (houseId !== useAuthStore.getState().houseId) {
          console.warn('[condition] house ID mismatch — aborting load');
          set({ isLoading: false });
          return;
        }
        const seq = ++_loadSeq;
        try {
          const { data, error } = await supabase
            .from('condition_entries')
            .select('*')
            .eq('house_id', houseId)
            .order('date', { ascending: false });
          if (error) throw error;
          const entries: ConditionEntry[] = (data ?? []).map((r) => ({
            id: r.id,
            area: r.area,
            condition: r.condition as ConditionLevel,
            type: r.type as EntryType,
            description: r.description ?? '',
            recordedBy: r.recorded_by,
            date: r.date,
            createdAt: r.created_at,
            photos: r.photos ?? [],
          }));
          // A newer load (or unsubscribe) superseded this one — drop its result.
          if (seq !== _loadSeq) return;
          set({ entries, isLoading: false, error: null });
        } catch (err) {
          captureError(err, { store: 'condition', houseId });
          // A newer load (or unsubscribe) superseded this one — drop its result.
          if (seq !== _loadSeq) return;
          set({ isLoading: false, error: 'Could not load condition entries. Please try again.' });
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
          .channel(`condition:${houseId}`)
          .on(
            'postgres_changes',
            {
              event: '*',
              schema: 'public',
              table: 'condition_entries',
              filter: `house_id=eq.${houseId}`,
            },
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
      add: async (data, houseId): Promise<void> => {
        let inserted;
        try {
          const res = await supabase
            .from('condition_entries')
            .insert({
              house_id: houseId,
              area: data.area,
              condition: data.condition,
              type: data.type,
              description: data.description,
              recorded_by: data.recordedBy,
              date: data.date,
              photos: data.photos,
            })
            .select()
            .single();
          if (res.error) throw res.error;
          inserted = res.data;
        } catch (err) {
          captureError(err, { context: 'add-condition-entry', houseId });
          throw new Error('Could not save the entry. Please try again.');
        }
        const entry: ConditionEntry = {
          id: inserted.id,
          area: inserted.area,
          condition: inserted.condition as ConditionLevel,
          type: inserted.type as EntryType,
          description: inserted.description ?? '',
          recordedBy: inserted.recorded_by,
          date: inserted.date,
          createdAt: inserted.created_at,
          photos: inserted.photos ?? [],
        };
        set({ entries: [entry, ...get().entries] });
      },
      remove: async (id): Promise<void> => {
        try {
          const { error } = await supabase.from('condition_entries').delete().eq('id', id);
          if (error) throw error;
        } catch (err) {
          captureError(err, { context: 'delete-condition-entry', entryId: id });
          throw new Error('Could not delete the entry. Please try again.');
        }
        set({ entries: get().entries.filter((e) => e.id !== id) });
      },
    }),
    { name: 'condition-store' }
  )
);

export const PRESET_AREAS: { label: string; icon: IoniconName }[] = [
  { label: 'Living Room', icon: 'tv-outline' },
  { label: 'Kitchen', icon: 'restaurant-outline' },
  { label: 'Bathroom', icon: 'water-outline' },
  { label: 'Master Bedroom', icon: 'bed-outline' },
  { label: 'Bedroom 2', icon: 'bed-outline' },
  { label: 'Bedroom 3', icon: 'bed-outline' },
  { label: 'Hallway', icon: 'enter-outline' },
  { label: 'Balcony/Garden', icon: 'leaf-outline' },
  { label: 'Appliances', icon: 'construct-outline' },
  { label: 'Other', icon: 'document-text-outline' },
];

export const CONDITION_CONFIG: Record<
  ConditionLevel,
  { label: string; color: string; icon: string }
> = {
  good: { label: 'Good', color: '#22c55e', icon: '✅' },
  fair: { label: 'Fair', color: '#f59e0b', icon: '⚠️' },
  poor: { label: 'Poor / Damaged', color: '#ef4444', icon: '❌' },
};

export const ENTRY_TYPE_CONFIG: Record<EntryType, { label: string; color: string }> = {
  move_in: { label: 'Move-in', color: '#6366f1' },
  update: { label: 'Update', color: '#3b82f6' },
  damage: { label: 'Damage', color: '#ef4444' },
};
