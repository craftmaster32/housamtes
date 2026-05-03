import { create } from 'zustand';
import { devtools } from 'zustand/middleware';
import { supabase } from '@lib/supabase';
import { captureError } from '@lib/errorTracking';
import { useAuthStore } from '@stores/authStore';

export type EventRecurrence = 'weekly' | 'monthly' | 'yearly';

export interface HouseEvent {
  id: string;
  title: string;
  date: string;             // YYYY-MM-DD
  endDate?: string;         // YYYY-MM-DD — for multi-day events
  startTime?: string;       // HH:MM
  endTime?: string;         // HH:MM
  notes?: string;
  recurrence?: EventRecurrence;
  recurrenceEnd?: string;   // YYYY-MM-DD — when recurrence stops
  createdBy: string;        // user UUID
  createdAt: string;
}

export interface AddEventPayload {
  title: string;
  date: string;
  createdBy: string;
  houseId: string;
  startTime?: string;
  endTime?: string;
  endDate?: string;
  notes?: string;
  recurrence?: EventRecurrence;
  recurrenceEnd?: string;
}

export interface EventUpdates {
  title: string;
  date: string;
  endDate?: string;
  startTime?: string;
  endTime?: string;
  notes?: string;
  recurrence?: EventRecurrence;
  recurrenceEnd?: string;
}

interface EventsStore {
  events: HouseEvent[];
  isLoading: boolean;
  error: string | null;
  load: (houseId: string) => Promise<void>;
  unsubscribe: () => void;
  addEvent: (payload: AddEventPayload) => Promise<string>;
  editEvent: (id: string, updates: EventUpdates) => Promise<void>;
  removeEvent: (id: string) => Promise<void>;
}

let _channel: ReturnType<typeof supabase.channel> | null = null;

function mapRow(r: Record<string, unknown>): HouseEvent {
  return {
    id: r.id as string,
    title: r.title as string,
    date: r.date as string,
    endDate: (r.end_date as string | null) ?? undefined,
    startTime: (r.start_time as string | null) ?? undefined,
    endTime: (r.end_time as string | null) ?? undefined,
    notes: (r.notes as string | null) ?? undefined,
    recurrence: (r.recurrence as EventRecurrence | null) ?? undefined,
    recurrenceEnd: (r.recurrence_end as string | null) ?? undefined,
    createdBy: r.created_by as string,
    createdAt: r.created_at as string,
  };
}

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
          set({ events: (data ?? []).map(mapRow), isLoading: false, error: null });
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

      addEvent: async (payload): Promise<string> => {
        const { title, date, createdBy, houseId, startTime, endTime, endDate, notes, recurrence, recurrenceEnd } = payload;
        try {
          const { data, error } = await supabase
            .from('events')
            .insert({
              house_id: houseId,
              title,
              date,
              created_by: createdBy,
              start_time: startTime ?? null,
              end_time: endTime ?? null,
              end_date: endDate ?? null,
              notes: notes ?? null,
              recurrence: recurrence ?? null,
              recurrence_end: recurrenceEnd ?? null,
            })
            .select()
            .single();
          if (error) throw error;
          const event = mapRow(data as Record<string, unknown>);
          const events = [...get().events, event].sort((a, b) => a.date.localeCompare(b.date));
          set({ events });
          return event.id;
        } catch (err) {
          captureError(err, { context: 'add-event', houseId });
          throw new Error('Could not save the event. Please try again.');
        }
      },

      editEvent: async (id, updates): Promise<void> => {
        try {
          const { error } = await supabase
            .from('events')
            .update({
              title: updates.title,
              date: updates.date,
              end_date: updates.endDate ?? null,
              start_time: updates.startTime ?? null,
              end_time: updates.endTime ?? null,
              notes: updates.notes ?? null,
              recurrence: updates.recurrence ?? null,
              recurrence_end: updates.recurrenceEnd ?? null,
            })
            .eq('id', id);
          if (error) throw error;
          set({
            events: get().events
              .map((e) => e.id === id ? {
                ...e,
                title: updates.title,
                date: updates.date,
                endDate: updates.endDate,
                startTime: updates.startTime,
                endTime: updates.endTime,
                notes: updates.notes,
                recurrence: updates.recurrence,
                recurrenceEnd: updates.recurrenceEnd,
              } : e)
              .sort((a, b) => a.date.localeCompare(b.date)),
          });
        } catch (err) {
          captureError(err, { context: 'edit-event', eventId: id });
          throw new Error('Could not update the event. Please try again.');
        }
      },

      removeEvent: async (id): Promise<void> => {
        try {
          const { error } = await supabase.from('events').delete().eq('id', id);
          if (error) throw error;
          set({ events: get().events.filter((e) => e.id !== id) });
        } catch (err) {
          captureError(err, { context: 'delete-event', eventId: id });
          throw new Error('Could not delete the event. Please try again.');
        }
      },
    }),
    { name: 'events-store' }
  )
);
