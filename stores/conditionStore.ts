import { create } from 'zustand';
import { devtools } from 'zustand/middleware';
import { supabase } from '@lib/supabase';

export type ConditionLevel = 'good' | 'fair' | 'poor';
export type EntryType = 'move_in' | 'update' | 'damage';

export interface ConditionEntry {
  id: string;
  area: string;
  condition: ConditionLevel;
  type: EntryType;
  description: string;
  recordedBy: string;
  date: string; // YYYY-MM-DD
  createdAt: string;
  photos: string[]; // data URLs (base64 JPEG)
}

interface ConditionStore {
  entries: ConditionEntry[];
  isLoading: boolean;
  load: (houseId: string) => Promise<void>;
  unsubscribe: () => void;
  add: (entry: Omit<ConditionEntry, 'id' | 'createdAt'>, houseId: string) => Promise<void>;
  remove: (id: string) => Promise<void>;
}

let _channel: ReturnType<typeof supabase.channel> | null = null;

export const useConditionStore = create<ConditionStore>()(
  devtools(
    (set, get) => ({
      entries: [],
      isLoading: true,
      load: async (houseId: string): Promise<void> => {
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
          set({ entries, isLoading: false });
        } catch {
          set({ isLoading: false });
        }

        if (_channel) { supabase.removeChannel(_channel); }
        _channel = supabase
          .channel(`condition:${houseId}`)
          .on('postgres_changes', { event: '*', schema: 'public', table: 'condition_entries', filter: `house_id=eq.${houseId}` },
            () => { get().load(houseId); })
          .subscribe();
      },
      unsubscribe: (): void => {
        if (_channel) { supabase.removeChannel(_channel); _channel = null; }
      },
      add: async (data, houseId): Promise<void> => {
        const { data: inserted, error } = await supabase
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
        if (error) throw new Error(`Failed to add entry: ${error.message}`);
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
        await supabase.from('condition_entries').delete().eq('id', id);
        set({ entries: get().entries.filter((e) => e.id !== id) });
      },
    }),
    { name: 'condition-store' }
  )
);

export const PRESET_AREAS = [
  { label: 'Living Room', icon: '🛋️' },
  { label: 'Kitchen', icon: '🍳' },
  { label: 'Bathroom', icon: '🚿' },
  { label: 'Master Bedroom', icon: '🛏️' },
  { label: 'Bedroom 2', icon: '🛏️' },
  { label: 'Bedroom 3', icon: '🛏️' },
  { label: 'Hallway', icon: '🚪' },
  { label: 'Balcony/Garden', icon: '🌿' },
  { label: 'Appliances', icon: '⚙️' },
  { label: 'Other', icon: '📝' },
];

export const CONDITION_CONFIG: Record<ConditionLevel, { label: string; color: string; icon: string }> = {
  good: { label: 'Good', color: '#22c55e', icon: '✅' },
  fair: { label: 'Fair', color: '#f59e0b', icon: '⚠️' },
  poor: { label: 'Poor / Damaged', color: '#ef4444', icon: '❌' },
};

export const ENTRY_TYPE_CONFIG: Record<EntryType, { label: string; color: string }> = {
  move_in: { label: 'Move-in', color: '#6366f1' },
  update: { label: 'Update', color: '#3b82f6' },
  damage: { label: 'Damage', color: '#ef4444' },
};
