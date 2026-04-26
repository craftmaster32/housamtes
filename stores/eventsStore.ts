import { create } from 'zustand';
import { devtools } from 'zustand/middleware';
import { supabase } from '@lib/supabase';
import { captureError } from '@lib/errorTracking';
import { useAuthStore } from '@stores/authStore';

export interface HouseEvent {
  id: string;
  title: string;
  date: string;       // YYYY-MM-DD
  startTime?: string; // HH:MM
  endTime?: string;   // HH:MM
  createdBy: string; // user UUID
  createdAt: string;
}

interface EventsStore {
  events: HouseEvent[];
  isLoading: boolean;
  error: string | null;
  load: (houseId: string) => Promise<void>;
  unsubscribe: () => void;
  addEvent: (
    title: string,
    date: string,
    createdBy: string,
    houseId: string,
    startTime?: string,
    endTime?: string
  ) => Promise<string>;
  removeEvent: (id: string) => Promise<void>;
}

let _channel: ReturnType<typeof supabase.channel> | null = null;

export const useEventsStore = create<EventsStore>()(
  devtools(
    (set, get) => ({
      events: [],
      isLoading: true,
      error: null,
      load: async (houseId: string): Promise<void> => {
        if (houseId !== useAuthStore.getState().houseId) {
          console.warn('[events] house ID mismatch — aborting load');
          return;
        }
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
          set({ events, isLoading: false, error: null });
        } catch (err) {
          captureError(err, { store: 'events', houseId });
          set({ isLoading: false, error: 'Could not load events. Please try again.' });
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
      addEvent: async (title, date, createdBy, houseId, startTime, endTime): Promise<string> => {
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
        if (error) {
          captureError(error, { context: 'add-event', houseId });
          throw new Error('Could not save the event. Please try again.');
        }
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
        return event.id;
      },
      removeEvent: async (id): Promise<void> => {
        const { error } = await supabase.from('events').delete().eq('id', id);
        if (error) {
          captureError(error, { context: 'delete-event', eventId: id });
          throw new Error('Could not delete the event. Please try again.');
        }
        set({ events: get().events.filter((e) => e.id !== id) });
      },
    }),
    { name: 'events-store' }
  )
);
