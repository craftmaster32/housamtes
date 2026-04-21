import { create } from 'zustand';
import { devtools, persist, createJSONStorage } from 'zustand/middleware';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Platform, Alert } from 'react-native';

// expo-calendar is mobile-only — import lazily so web doesn't crash
// eslint-disable-next-line @typescript-eslint/no-explicit-any
let ExpoCalendar: typeof import('expo-calendar') | null = null;
if (Platform.OS !== 'web') {
  // eslint-disable-next-line @typescript-eslint/no-require-imports, @typescript-eslint/no-var-requires
  ExpoCalendar = require('expo-calendar') as typeof import('expo-calendar');
}

interface AutoSync {
  events: boolean;
  parking: boolean;
}

interface CalendarSyncStore {
  connected: boolean;
  autoSync: AutoSync;
  eventMap: Record<string, string>; // 'ev-{id}' | 'pk-{id}' → device calendar event ID

  connect: () => Promise<boolean>;
  disconnect: () => Promise<void>;
  setAutoSync: (key: keyof AutoSync, value: boolean) => void;

  syncHouseEvent: (params: {
    id: string;
    title: string;
    date: string;
    startTime?: string;
    endTime?: string;
    createdBy?: string;
  }) => Promise<void>;
  syncParkingPending: (params: {
    id: string;
    requestedBy: string;
    date: string;
    startTime?: string;
    endTime?: string;
  }) => Promise<void>;
  syncParkingApproved: (params: {
    id: string;
    requestedBy: string;
    date: string;
    startTime?: string;
    endTime?: string;
  }) => Promise<void>;
  removeCalendarEvent: (key: string) => Promise<void>;
}

function buildDates(
  date: string,
  startTime?: string,
  endTime?: string,
): { startDate: Date; endDate: Date; allDay: boolean } {
  const [year, month, day] = date.split('-').map(Number);
  if (startTime) {
    const [sh, sm] = startTime.split(':').map(Number);
    const startDate = new Date(year, month - 1, day, sh, sm, 0);
    const endDate = endTime
      ? ((): Date => { const [eh, em] = endTime.split(':').map(Number); return new Date(year, month - 1, day, eh, em, 0); })()
      : new Date(startDate.getTime() + 60 * 60 * 1000);
    return { startDate, endDate, allDay: false };
  }
  return {
    startDate: new Date(year, month - 1, day, 0, 0, 0),
    endDate: new Date(year, month - 1, day, 23, 59, 59),
    allDay: true,
  };
}

async function getWritableCalendarId(): Promise<string | null> {
  if (!ExpoCalendar) return null;
  if (Platform.OS === 'ios') {
    const cal = await ExpoCalendar.getDefaultCalendarAsync();
    return cal?.id ?? null;
  }
  const calendars = await ExpoCalendar.getCalendarsAsync(ExpoCalendar.EntityTypes.EVENT);
  const writable = calendars.find(
    (c) => c.allowsModifications && c.type !== ExpoCalendar.CalendarType.BIRTHDAYS
  );
  return writable?.id ?? null;
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type EventInput = Record<string, any>;

async function createOrUpdate(
  calendarId: string,
  existingId: string | undefined,
  params: EventInput,
): Promise<string> {
  if (!ExpoCalendar) return '';
  if (existingId) {
    try {
      await ExpoCalendar.updateEventAsync(existingId, params);
      return existingId;
    } catch {
      // Fall through to create if event was deleted externally
    }
  }
  return ExpoCalendar.createEventAsync(calendarId, params);
}

export const useCalendarSyncStore = create<CalendarSyncStore>()(
  devtools(
    persist(
      (set, get) => ({
        connected: false,
        autoSync: { events: true, parking: true },
        eventMap: {},

        connect: async (): Promise<boolean> => {
          if (!ExpoCalendar) return false;
          const { status } = await ExpoCalendar.requestCalendarPermissionsAsync();
          if (status !== 'granted') {
            Alert.alert(
              'Calendar access needed',
              'Go to Settings and allow calendar access to connect your calendar.',
            );
            return false;
          }
          set({ connected: true });
          return true;
        },

        disconnect: async (): Promise<void> => {
          const { eventMap } = get();
          if (ExpoCalendar) {
            await Promise.allSettled(
              Object.values(eventMap).map((id) => ExpoCalendar!.deleteEventAsync(id))
            );
          }
          set({ connected: false, eventMap: {} });
        },

        setAutoSync: (key, value): void => {
          set((s) => ({ autoSync: { ...s.autoSync, [key]: value } }));
        },

        syncHouseEvent: async ({ id, title, date, startTime, endTime, createdBy }): Promise<void> => {
          const { connected, autoSync, eventMap } = get();
          if (!connected || !autoSync.events) return;
          const calendarId = await getWritableCalendarId();
          if (!calendarId) return;
          const key = `ev-${id}`;
          const { startDate, endDate, allDay } = buildDates(date, startTime, endTime);
          const newId = await createOrUpdate(calendarId, eventMap[key], {
            title,
            startDate,
            endDate,
            allDay,
            notes: createdBy ? `Added by ${createdBy}` : 'House event',
            alarms: [{ relativeOffset: -30 }],
          });
          set((s) => ({ eventMap: { ...s.eventMap, [key]: newId } }));
        },

        syncParkingPending: async ({ id, requestedBy, date, startTime, endTime }): Promise<void> => {
          const { connected, autoSync, eventMap } = get();
          if (!connected || !autoSync.parking) return;
          const key = `pk-${id}`;
          if (eventMap[key]) return;
          const calendarId = await getWritableCalendarId();
          if (!calendarId) return;
          const { startDate, endDate, allDay } = buildDates(date, startTime, endTime);
          const newId = await ExpoCalendar!.createEventAsync(calendarId, {
            title: `🅿️ Parking – ${requestedBy} (pending)`,
            startDate,
            endDate,
            allDay,
            notes: 'Awaiting approval',
            alarms: [{ relativeOffset: -60 }],
          });
          set((s) => ({ eventMap: { ...s.eventMap, [key]: newId } }));
        },

        syncParkingApproved: async ({ id, requestedBy, date, startTime, endTime }): Promise<void> => {
          const { connected, autoSync, eventMap } = get();
          if (!connected || !autoSync.parking) return;
          const key = `pk-${id}`;
          const calendarId = await getWritableCalendarId();
          if (!calendarId) return;
          const { startDate, endDate, allDay } = buildDates(date, startTime, endTime);
          const newId = await createOrUpdate(calendarId, eventMap[key], {
            title: `🅿️ Parking – ${requestedBy}`,
            startDate,
            endDate,
            allDay,
            notes: 'Approved',
            alarms: [{ relativeOffset: -60 }],
          });
          set((s) => ({ eventMap: { ...s.eventMap, [key]: newId } }));
        },

        removeCalendarEvent: async (key): Promise<void> => {
          const { eventMap } = get();
          const deviceId = eventMap[key];
          if (!deviceId || !ExpoCalendar) return;
          try { await ExpoCalendar.deleteEventAsync(deviceId); } catch { /* already gone */ }
          set((s) => {
            const newMap = { ...s.eventMap };
            delete newMap[key];
            return { eventMap: newMap };
          });
        },
      }),
      {
        name: 'calendar-sync',
        storage: createJSONStorage(() => AsyncStorage),
      }
    ),
    { name: 'calendar-sync-store' }
  )
);
