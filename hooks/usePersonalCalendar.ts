import { useState, useEffect } from 'react';
import { Platform } from 'react-native';
import { useCalendarSyncStore } from '@stores/calendarSyncStore';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
let ExpoCalendar: typeof import('expo-calendar') | null = null;
if (Platform.OS !== 'web') {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  ExpoCalendar = require('expo-calendar') as typeof import('expo-calendar');
}

export interface PersonalEvent {
  id: string;
  title: string;
  date: string;        // YYYY-MM-DD
  startTime?: string;  // HH:MM
  endTime?: string;    // HH:MM
}

function toYMD(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

function toHM(d: Date): string {
  return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
}

export function usePersonalCalendar(startDate: Date, endDate: Date): PersonalEvent[] {
  const connected = useCalendarSyncStore((s) => s.connected);
  const eventMap  = useCalendarSyncStore((s) => s.eventMap);
  const [events, setEvents] = useState<PersonalEvent[]>([]);

  useEffect(() => {
    if (!connected) { setEvents([]); return; }

    const syncedDeviceIds = new Set(Object.values(eventMap));
    let cancelled = false;

    async function load(): Promise<void> {
      try {
        if (!ExpoCalendar) return;
        const calendars = await ExpoCalendar.getCalendarsAsync(ExpoCalendar.EntityTypes.EVENT);
        if (!calendars.length || cancelled) return;
        const raw = await ExpoCalendar.getEventsAsync(
          calendars.map((c) => c.id),
          startDate,
          endDate,
        );
        if (cancelled) return;
        setEvents(
          raw
            .filter((e) => !syncedDeviceIds.has(e.id)) // hide house events synced to device
            .map((e) => {
              const start = new Date(e.startDate as string);
              const end   = new Date(e.endDate as string);
              return {
                id: `personal-${e.id}`,
                title: e.title,
                date: toYMD(start),
                startTime: e.allDay ? undefined : toHM(start),
                endTime:   e.allDay ? undefined : toHM(end),
              };
            })
        );
      } catch {
        setEvents([]);
      }
    }

    load().catch(() => {});
    return () => { cancelled = true; };
  }, [connected, eventMap, startDate, endDate]);

  return events;
}
