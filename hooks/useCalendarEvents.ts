import { useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { useEventsStore } from '@stores/eventsStore';
import { useParkingStore } from '@stores/parkingStore';
import { useHousematesStore } from '@stores/housematesStore';
import { useRecurringBillsStore, getNextDueDate } from '@stores/recurringBillsStore';
import { useTasksStore } from '@stores/tasksStore';
import { useSettingsStore } from '@stores/settingsStore';
import { usePersonalCalendar } from '@hooks/usePersonalCalendar';
import { resolveName } from '@utils/housemates';
import { expandRecurrenceDates, expandRecurringSpanDays } from '@utils/events';
import { toYMD, type CalendarEvent } from '@components/calendar/calendarMeta';

/**
 * Everything that lands on the calendar between gridStart and gridEnd: house
 * events (repeats and multi-day spans expanded), parking, the next due date of
 * each recurring bill, tasks with a due date and the member's own calendar.
 */
export function useCalendarEvents(gridStart: Date, gridEnd: Date): CalendarEvent[] {
  const { t } = useTranslation();
  const events = useEventsStore((s) => s.events);
  const reservations = useParkingStore((s) => s.reservations);
  const recurringBills = useRecurringBillsStore((s) => s.bills);
  const recurringPayments = useRecurringBillsStore((s) => s.payments);
  const tasks = useTasksStore((s) => s.tasks);
  const housemates = useHousematesStore((s) => s.housemates);
  const currency = useSettingsStore((s) => s.currency);
  const showRecurringBillsOnCalendar = useSettingsStore((s) => s.showRecurringBillsOnCalendar);
  const personalEvents = usePersonalCalendar(gridStart, gridEnd);

  return useMemo((): CalendarEvent[] => {
    const list: CalendarEvent[] = [];

    // Expand window: grid + 2 extra months for recurring events
    const expandEnd = new Date(gridEnd);
    expandEnd.setMonth(expandEnd.getMonth() + 2);

    for (const e of events) {
      const base = {
        sourceId: e.id,
        title: e.title,
        type: 'event' as const,
        detail: resolveName(e.createdBy, housemates),
        createdBy: e.createdBy,
        startTime: e.startTime,
        endTime: e.endTime,
        endDate: e.endDate,
        notes: e.notes,
        recurrence: e.recurrence,
        recurrenceInterval: e.recurrenceInterval,
        recurrenceDays: e.recurrenceDays,
      };

      if (e.recurrence) {
        if (e.endDate && e.endDate > e.date) {
          const spanDays = Math.round(
            (new Date(e.endDate + 'T00:00:00').getTime() -
              new Date(e.date + 'T00:00:00').getTime()) /
              86400000
          );
          for (const day of expandRecurringSpanDays(e, spanDays, gridStart, expandEnd)) {
            list.push({ ...base, id: `ev-${e.id}-${day}`, date: day });
          }
        } else {
          for (const d of expandRecurrenceDates(e, gridStart, expandEnd)) {
            list.push({ ...base, id: `ev-${e.id}-${d}`, date: d });
          }
        }
      } else if (e.endDate && e.endDate > e.date) {
        const cur = new Date(e.date + 'T00:00:00');
        const end = new Date(e.endDate + 'T00:00:00');
        while (cur <= end) {
          list.push({ ...base, id: `ev-${e.id}-${toYMD(cur)}`, date: toYMD(cur) });
          cur.setDate(cur.getDate() + 1);
        }
      } else {
        list.push({ ...base, id: `ev-${e.id}`, date: e.date });
      }
    }

    for (const r of reservations) {
      const name = resolveName(r.requestedBy, housemates);
      if (r.status === 'approved' || r.status === 'pending') {
        const pending = r.status === 'pending';
        list.push({
          sourceId: r.id,
          id: `pk-${r.id}`,
          date: r.date,
          title: `${pending ? t('calendar.parking_pending') : t('calendar.legend_parking')} — ${name}`,
          type: pending ? 'parking-pending' : 'parking',
          detail: r.note,
          startTime: r.startTime,
          endTime: r.endTime,
          person: r.requestedBy,
        });
      }
    }

    if (showRecurringBillsOnCalendar) {
      for (const bill of recurringBills) {
        const nextDue = getNextDueDate(bill, recurringPayments);
        if (nextDue) {
          list.push({
            sourceId: `bl-${bill.id}`,
            id: `bl-${bill.id}`,
            date: nextDue,
            title: bill.name,
            type: 'bill',
            detail: `${currency}${bill.typicalAmount.toFixed(2)}`,
          });
        }
      }
    }

    // Chores were merged into Tasks: a task with a due date shows on its day
    // (as dated chores did), with who it's for.
    for (const tk of tasks) {
      if (tk.dueDate) {
        list.push({
          sourceId: tk.id,
          id: `ch-${tk.id}`,
          date: tk.dueDate,
          title: tk.title,
          type: 'chore',
          detail: tk.assignedTo ? resolveName(tk.assignedTo, housemates) : undefined,
        });
      }
    }

    for (const p of personalEvents) {
      list.push({
        sourceId: p.id,
        id: p.id,
        date: p.date,
        title: p.title,
        type: 'personal',
        startTime: p.startTime,
        endTime: p.endTime,
      });
    }

    return list;
  }, [
    events,
    reservations,
    recurringBills,
    recurringPayments,
    showRecurringBillsOnCalendar,
    tasks,
    currency,
    personalEvents,
    housemates,
    gridStart,
    gridEnd,
    t,
  ]);
}
