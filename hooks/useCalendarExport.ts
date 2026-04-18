import { Platform, Alert } from 'react-native';
import * as ExpoCalendar from 'expo-calendar';

export interface ExportableEvent {
  title: string;
  date: string;      // YYYY-MM-DD
  startTime?: string; // HH:MM
  endTime?: string;   // HH:MM
  notes?: string;
}

async function getWritableCalendarId(): Promise<string | null> {
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

export function useCalendarExport(): { exportToDeviceCalendar: (event: ExportableEvent) => Promise<boolean> } {
  const exportToDeviceCalendar = async (event: ExportableEvent): Promise<boolean> => {
    const { status } = await ExpoCalendar.requestCalendarPermissionsAsync();
    if (status !== 'granted') {
      Alert.alert('Calendar access needed', 'Allow calendar access in Settings to add events to your phone.');
      return false;
    }

    const calendarId = await getWritableCalendarId();
    if (!calendarId) {
      Alert.alert('No calendar found', 'Could not find a calendar on this device.');
      return false;
    }

    const [year, month, day] = event.date.split('-').map(Number);
    let startDate: Date;
    let endDate: Date;
    let allDay = false;

    if (event.startTime) {
      const [sh, sm] = event.startTime.split(':').map(Number);
      startDate = new Date(year, month - 1, day, sh, sm, 0);
      if (event.endTime) {
        const [eh, em] = event.endTime.split(':').map(Number);
        endDate = new Date(year, month - 1, day, eh, em, 0);
      } else {
        endDate = new Date(startDate.getTime() + 60 * 60 * 1000);
      }
    } else {
      allDay = true;
      startDate = new Date(year, month - 1, day, 0, 0, 0);
      endDate = new Date(year, month - 1, day, 23, 59, 59);
    }

    try {
      await ExpoCalendar.createEventAsync(calendarId, {
        title: event.title,
        startDate,
        endDate,
        allDay,
        notes: event.notes,
        alarms: [{ relativeOffset: -30 }],
      });
      return true;
    } catch {
      Alert.alert('Could not add event', 'Something went wrong. Please try again.');
      return false;
    }
  };

  return { exportToDeviceCalendar };
}
