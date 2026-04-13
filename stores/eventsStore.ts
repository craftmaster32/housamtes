import { create } from 'zustand';
import { devtools } from 'zustand/middleware';
import { supabase } from '@lib/supabase';

export interface HouseEvent {
  id: string;
  title: string;
  date: string;       // YYYY-MM-DD
  startTime?: string; // HH:MM
  endTime?: string;   // HH:MM
  createdBy: string;
  createdAt: string;
}

interface EventsStore {
  events: HouseEvent[];
  isLoading: boolean;
  load: (houseId: string) => Promise<void>;
  unsubscribe: () => void;
  addEvent: (
    title: string,
    date: string,
    createdBy: string,
    houseId: string,
    startTime?: string,
    endTime?: string
  ) => Promise<void>;
  removeEvent: (id: string) => Promise<void>;
}

let _channel: ReturnType<typeof supabase.channel> | null = null;

export const useEventsStore = create<EventsStore>()(
  devtools(
    (set, get) => ({
      events: [],
      isLoading: true,
      load: async (houseId: string): Promise<void> => {
        try {
          const { data, error } = await supabase
            .from('events')
            .select('*')
            .eq('house_id', houseId)
            .order('date');
          if (error) throw error;
          const events: HouseEvent[] = (data ?? []).map((r) => ({
            id: r.id,
            title: r.title,
            date: r.date,
            startTime: r.start_time ?? undefined,
            endTime: r.end_time ?? undefined,
            createdBy: r.created_by,
            createdAt: r.created_at,
          }));
          set({ events, isLoading: false });
        } catch {
          set({ isLoading: false });
        }

        if (_channel) { supabase.removeChannel(_channel); }
        _channel = supabase
          .channel(`events:${houseId}`)
          .on('postgres_changes', { event: '*', schema: 'public', table: 'events', filter: `house_id=eq.${houseId}` },
            () => { get().load(houseId); })
          .subscribe();
      },
      unsubscribe: (): void => {
        if (_channel) { supabase.removeChannel(_channel); _channel = null; }
      },
      addEvent: async (title, date, createdBy, houseId, startTime, endTime): Promise<void> => {
        const { data, error } = await supabase
          .from('events')
          .insert({
            house_id: houseId,
            title,
            date,
            created_by: createdBy,
            start_time: startTime ?? null,
            end_time: endTime ?? null,
          })
          .select()
          .single();
        if (error) throw new Error(`Failed to add event: ${error.message}`);
        const event: HouseEvent = {
          id: data.id,
          title: data.title,
          date: data.date,
          startTime: data.start_time ?? undefined,
          endTime: data.end_time ?? undefined,
          createdBy: data.created_by,
          createdAt: data.created_at,
        };
        const events = [...get().events, event].sort((a, b) => a.date.localeCompare(b.date));
        set({ events });
      },
      removeEvent: async (id): Promise<void> => {
        await supabase.from('events').delete().eq('id', id);
        set({ events: get().events.filter((e) => e.id !== id) });
      },
    }),
    { name: 'events-store' }
  )
);
