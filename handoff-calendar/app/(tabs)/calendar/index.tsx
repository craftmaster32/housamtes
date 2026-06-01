// app/(tabs)/calendar/index.tsx
// Calendar — v2 redesign.
// Same data flow as v1 (useEventsStore, useParkingStore, useRecurringBillsStore,
// useChoresStore, useCalendarSyncStore, usePersonalCalendar). Same recurring
// expansion, multi-day events, parking/bills/chores/personal overlays. New:
// dark theme via useThemedColors, `type` ladder, `Header` UI primitive,
// fade-up entrance, press scale on day cells + buttons, LinearTransition on
// the selected-day event list, haptics on day taps + month nav.

import { useState, useMemo, useCallback, useEffect } from 'react';
import { View, StyleSheet, ScrollView, Pressable, FlatList, TextInput, Modal, Platform, Alert, Keyboard } from 'react-native';
import { Text } from 'react-native-paper';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import Animated, { LinearTransition } from 'react-native-reanimated';
import { useEventsStore, HouseEvent, EventRecurrence, EventUpdates } from '@stores/eventsStore';
import { useParkingStore } from '@stores/parkingStore';
import { useHousematesStore } from '@stores/housematesStore';
import { resolveName } from '@utils/housemates';
import { useRecurringBillsStore, getNextDueDate } from '@stores/recurringBillsStore';
import { useChoresStore } from '@stores/choresStore';
import { useAuthStore } from '@stores/authStore';
import { useSettingsStore } from '@stores/settingsStore';
import { useCalendarSyncStore } from '@stores/calendarSyncStore';
import { usePersonalCalendar } from '@hooks/usePersonalCalendar';
import { openGoogleCalendar, downloadIcs } from '@utils/calendarWeb';
import { CalendarPicker } from '@components/shared/CalendarPicker';
import { TimePicker } from '@components/shared/TimePicker';
import { addWeeks, addMonths, addYears } from 'date-fns';
import { useThemedColors, type ColorTokens } from '@constants/colors';
import { Button, EmptyState, Header } from '@components/ui';
import { type } from '@constants/typography';
import { sizes } from '@constants/sizes';
import { useFadeInUp, usePressScale, useHaptic } from '@utils/animations';

// ── Types ─────────────────────────────────────────────────────────────────────
interface CalendarEvent {
  id: string;
  sourceId: string;
  date: string;
  endDate?: string;
  title: string;
  type: 'event' | 'parking' | 'parking-pending' | 'bill' | 'chore' | 'personal';
  detail?: string;
  createdBy?: string;
  startTime?: string;
  endTime?: string;
  notes?: string;
  recurrence?: EventRecurrence;
  person?: string;
}

const TYPE_META: Record<CalendarEvent['type'], { icon: string; color: string }> = {
  event:             { icon: '📅', color: '#6366f1' },
  parking:           { icon: '🚗', color: '#f59e0b' },
  'parking-pending': { icon: '🅿️', color: '#94a3b8' },
  bill:              { icon: '💰', color: '#ef4444' },
  chore:             { icon: '🧹', color: '#22c55e' },
  personal:          { icon: '👤', color: '#8b5cf6' },
};

const WEEKDAYS = ['Su', 'Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa'];
const MONTHS   = ['January','February','March','April','May','June','July','August','September','October','November','December'];
const SHORT_MONTHS = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];

function toYMD(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

function formatShortDate(ymd: string): string {
  const m = ymd.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!m) return ymd;
  return `${SHORT_MONTHS[parseInt(m[2]) - 1]} ${parseInt(m[3])}`;
}

function expandRecurringDates(
  startDate: string,
  recurrence: EventRecurrence,
  recurrenceEnd: string | undefined,
  from: Date,
  to: Date,
): string[] {
  const recEnd = recurrenceEnd ? new Date(recurrenceEnd + 'T00:00:00') : null;
  const dates: string[] = [];
  let current = new Date(startDate + 'T00:00:00');
  const advance = (): void => {
    if (recurrence === 'weekly') current = addWeeks(current, 1);
    else if (recurrence === 'monthly') current = addMonths(current, 1);
    else current = addYears(current, 1);
  };
  while (current < from) advance();
  while (current <= to) {
    if (recEnd && current > recEnd) break;
    dates.push(toYMD(current));
    advance();
  }
  return dates;
}

// ── Event Form Modal ──────────────────────────────────────────────────────────
interface EventFormModalProps {
  visible: boolean;
  initialDate: string;
  editingEvent?: HouseEvent;
  onClose: () => void;
}

const RECURRENCE_OPTIONS: Array<{ label: string; value: EventRecurrence | '' }> = [
  { label: 'None',    value: '' },
  { label: 'Weekly',  value: 'weekly' },
  { label: 'Monthly', value: 'monthly' },
  { label: 'Yearly',  value: 'yearly' },
];

function EventFormModal({ visible, initialDate, editingEvent, onClose }: EventFormModalProps): React.JSX.Element {
  const C = useThemedColors();
  const formStyles = useMemo(() => makeFormStyles(C), [C]);
  const haptic = useHaptic();

  const addEvent       = useEventsStore((s) => s.addEvent);
  const editEvent      = useEventsStore((s) => s.editEvent);
  const profile        = useAuthStore((s) => s.profile);
  const houseId        = useAuthStore((s) => s.houseId);
  const syncHouseEvent = useCalendarSyncStore((s) => s.syncHouseEvent);

  const [title, setTitle]               = useState('');
  const [date, setDate]                 = useState(initialDate);
  const [showEndDate, setShowEndDate]   = useState(false);
  const [endDate, setEndDate]           = useState('');
  const [startTime, setStartTime]       = useState('');
  const [endTime, setEndTime]           = useState('');
  const [notes, setNotes]               = useState('');
  const [recurrence, setRecurrence]     = useState<EventRecurrence | ''>('');
  const [showRecEnd, setShowRecEnd]     = useState(false);
  const [recurrenceEnd, setRecurrenceEnd] = useState('');
  const [saving, setSaving]             = useState(false);
  const [error, setError]               = useState('');

  useEffect(() => {
    if (!visible) return;
    if (editingEvent) {
      setTitle(editingEvent.title);
      setDate(editingEvent.date);
      setEndDate(editingEvent.endDate ?? '');
      setShowEndDate(!!editingEvent.endDate);
      setStartTime(editingEvent.startTime ?? '');
      setEndTime(editingEvent.endTime ?? '');
      setNotes(editingEvent.notes ?? '');
      setRecurrence(editingEvent.recurrence ?? '');
      setRecurrenceEnd(editingEvent.recurrenceEnd ?? '');
      setShowRecEnd(!!editingEvent.recurrenceEnd);
    } else {
      setTitle(''); setDate(initialDate); setEndDate(''); setShowEndDate(false);
      setStartTime(''); setEndTime(''); setNotes('');
      setRecurrence(''); setRecurrenceEnd(''); setShowRecEnd(false);
    }
    setError('');
  }, [visible, editingEvent, initialDate]);

  const handleClose = useCallback((): void => { Keyboard.dismiss(); onClose(); }, [onClose]);

  const handleSave = useCallback(async (): Promise<void> => {
    if (!title.trim()) { setError('Enter an event name'); return; }
    if (!date) { setError('Pick a date'); return; }
    if (showEndDate && endDate && endDate < date) { setError('End date must be on or after start date'); return; }
    setSaving(true);
    try {
      const resolvedEndDate = showEndDate && endDate ? endDate : undefined;
      const resolvedRecEnd  = recurrence && showRecEnd && recurrenceEnd ? recurrenceEnd : undefined;
      const resolvedRec     = recurrence || undefined;
      if (editingEvent) {
        const updates: EventUpdates = {
          title: title.trim(), date, endDate: resolvedEndDate,
          startTime: startTime || undefined, endTime: endTime || undefined,
          notes: notes || undefined, recurrence: resolvedRec, recurrenceEnd: resolvedRecEnd,
        };
        await editEvent(editingEvent.id, updates);
      } else {
        const eventId = await addEvent({
          title: title.trim(), date,
          createdBy: profile?.id ?? '', houseId: houseId ?? '',
          startTime: startTime || undefined, endTime: endTime || undefined,
          endDate: resolvedEndDate, notes: notes || undefined,
          recurrence: resolvedRec, recurrenceEnd: resolvedRecEnd,
        });
        syncHouseEvent({
          id: eventId, title: title.trim(), date,
          startTime: startTime || undefined, endTime: endTime || undefined,
          createdBy: profile?.id,
        }).catch(() => {});
      }
      haptic.success();
      handleClose();
    } catch {
      setError('Could not save event. Try again.');
    } finally {
      setSaving(false);
    }
  }, [title, date, showEndDate, endDate, startTime, endTime, notes, recurrence, showRecEnd, recurrenceEnd, editingEvent, addEvent, editEvent, profile, houseId, syncHouseEvent, handleClose, haptic]);

  const isEditing = !!editingEvent;

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={handleClose}>
      <Pressable style={formStyles.backdrop} onPress={handleClose}>
        <Pressable style={formStyles.sheet} onPress={() => {}}>
          <View style={formStyles.handle} />
          <Text style={[type.title, { color: C.textPrimary }]}>{isEditing ? 'Edit Event' : 'Add Event'}</Text>

          <ScrollView showsVerticalScrollIndicator={false} style={{ flexGrow: 0 }} keyboardShouldPersistTaps="handled">
            <Text style={[type.captionMed, formStyles.label, { color: C.textPrimary }]}>Event name</Text>
            <TextInput
              style={formStyles.input}
              value={title}
              onChangeText={(v) => { setTitle(v); setError(''); }}
              placeholder="e.g. House meeting, Inspection…"
              placeholderTextColor={C.textSecondary}
              returnKeyType="done"
              onSubmitEditing={handleSave}
            />

            <Text style={[type.captionMed, formStyles.label, formStyles.labelGap, { color: C.textPrimary }]}>Start date</Text>
            <CalendarPicker value={date} onChange={(v) => { setDate(v); setError(''); }} />

            <Text style={[type.captionMed, formStyles.label, formStyles.labelGap, { color: C.textPrimary }]}>
              End date <Text style={[type.bodySm, { color: C.textSecondary }]}>(optional)</Text>
            </Text>
            {showEndDate ? (
              <>
                <CalendarPicker value={endDate || date} onChange={setEndDate} />
                <Pressable
                  style={formStyles.clearLink}
                  onPress={() => { setShowEndDate(false); setEndDate(''); }}
                  accessibilityRole="button"
                >
                  <Text style={[type.caption, { color: C.textSecondary, textDecorationLine: 'underline' }]}>Remove end date</Text>
                </Pressable>
              </>
            ) : (
              <AddToggle
                onPress={() => { setShowEndDate(true); setEndDate(date); }}
                label="Add end date"
                C={C}
              />
            )}

            <Text style={[type.captionMed, formStyles.label, formStyles.labelGap, { color: C.textPrimary }]}>
              Start time <Text style={[type.bodySm, { color: C.textSecondary }]}>(optional)</Text>
            </Text>
            <TimePicker value={startTime} onChange={setStartTime} />

            <Text style={[type.captionMed, formStyles.label, formStyles.labelGap, { color: C.textPrimary }]}>
              End time <Text style={[type.bodySm, { color: C.textSecondary }]}>(optional)</Text>
            </Text>
            <TimePicker value={endTime} onChange={setEndTime} />

            <Text style={[type.captionMed, formStyles.label, formStyles.labelGap, { color: C.textPrimary }]}>
              Notes <Text style={[type.bodySm, { color: C.textSecondary }]}>(optional)</Text>
            </Text>
            <TextInput
              style={[formStyles.input, { minHeight: 80, paddingTop: 12 }]}
              value={notes}
              onChangeText={setNotes}
              placeholder="Any extra details…"
              placeholderTextColor={C.textSecondary}
              multiline
              numberOfLines={3}
              textAlignVertical="top"
            />

            <Text style={[type.captionMed, formStyles.label, formStyles.labelGap, { color: C.textPrimary }]}>Repeat</Text>
            <View style={formStyles.chips}>
              {RECURRENCE_OPTIONS.map(({ label, value }) => (
                <RecChip
                  key={value || 'none'}
                  label={label}
                  selected={recurrence === value}
                  onPress={() => setRecurrence(value)}
                  C={C}
                />
              ))}
            </View>

            {recurrence !== '' && (
              <>
                <Text style={[type.captionMed, formStyles.label, formStyles.labelGap, { color: C.textPrimary }]}>
                  Repeat until <Text style={[type.bodySm, { color: C.textSecondary }]}>(optional)</Text>
                </Text>
                {showRecEnd ? (
                  <>
                    <CalendarPicker value={recurrenceEnd || date} onChange={setRecurrenceEnd} />
                    <Pressable
                      style={formStyles.clearLink}
                      onPress={() => { setShowRecEnd(false); setRecurrenceEnd(''); }}
                      accessibilityRole="button"
                    >
                      <Text style={[type.caption, { color: C.textSecondary, textDecorationLine: 'underline' }]}>
                        No end date (repeat forever)
                      </Text>
                    </Pressable>
                  </>
                ) : (
                  <AddToggle onPress={() => setShowRecEnd(true)} label="Set an end date for repeating" C={C} />
                )}
              </>
            )}

            {!!error && <Text style={[type.bodySm, { color: C.negative, marginTop: 12 }]}>{error}</Text>}
            <View style={{ height: 16 }} />
          </ScrollView>

          <View style={formStyles.btns}>
            <Button variant="secondary" onPress={handleClose} fullWidth>Cancel</Button>
            <Button variant="primary" onPress={handleSave} loading={saving} disabled={saving} fullWidth haptic={null}>
              {isEditing ? 'Save Changes' : 'Save Event'}
            </Button>
          </View>
        </Pressable>
      </Pressable>
    </Modal>
  );
}

function AddToggle({ onPress, label, C }: { onPress: () => void; label: string; C: ColorTokens }): React.JSX.Element {
  const press = usePressScale(0.96);
  return (
    <Animated.View style={press.animatedStyle}>
      <Pressable
        onPress={onPress}
        onPressIn={press.onPressIn}
        onPressOut={press.onPressOut}
        style={{
          flexDirection: 'row', alignItems: 'center', gap: 6,
          alignSelf: 'flex-start',
          paddingVertical: 8, paddingHorizontal: 14,
          borderRadius: 20, borderWidth: 1,
          borderColor: C.primary, backgroundColor: C.secondary,
          minHeight: 44,
        }}
        accessibilityRole="button"
      >
        <Ionicons name="add-circle-outline" size={17} color={C.primary} />
        <Text style={[type.bodyMdMed, { color: C.primary }]}>{label}</Text>
      </Pressable>
    </Animated.View>
  );
}

function RecChip({ label, selected, onPress, C }: { label: string; selected: boolean; onPress: () => void; C: ColorTokens }): React.JSX.Element {
  const press = usePressScale(0.94);
  return (
    <Animated.View style={press.animatedStyle}>
      <Pressable
        onPress={onPress}
        onPressIn={press.onPressIn}
        onPressOut={press.onPressOut}
        style={{
          paddingVertical: 8, paddingHorizontal: 16,
          borderRadius: 20, borderWidth: 1.5,
          borderColor: selected ? C.primary : C.border,
          backgroundColor: selected ? C.primary : C.surfaceSecondary,
          minHeight: 36,
        }}
        accessibilityRole="radio"
        accessibilityState={{ selected }}
      >
        <Text style={[type.labelSm, { color: selected ? '#fff' : C.textSecondary }]}>{label}</Text>
      </Pressable>
    </Animated.View>
  );
}

// ── Day Cell — press scaled ──────────────────────────────────────────────────
function DayCell({
  day, isToday, isSelected, isCurrentMonth, events: dayEvents, onPress, C,
}: {
  day: Date;
  isToday: boolean;
  isSelected: boolean;
  isCurrentMonth: boolean;
  events: Array<{ title: string; color: string }>;
  onPress: () => void;
  C: ColorTokens;
}): React.JSX.Element {
  const s = useMemo(() => makeStyles(C), [C]);
  const press = usePressScale(0.92);
  return (
    <Pressable style={s.dayCell} onPress={onPress} onPressIn={press.onPressIn} onPressOut={press.onPressOut}>
      <Animated.View
        style={[
          s.dayInner,
          isSelected && s.daySelected,
          isToday && !isSelected && s.dayToday,
          press.animatedStyle,
        ]}
      >
        <Text style={[
          type.captionMed,
          { color: C.textPrimary },
          !isCurrentMonth && { color: C.textDisabled },
          isSelected && { color: '#fff', fontWeight: '700' },
          isToday && !isSelected && { color: C.primary, fontWeight: '700' },
        ]}>
          {day.getDate()}
        </Text>
      </Animated.View>
      {dayEvents.slice(0, 2).map((ev, i) => (
        <View key={i} style={[s.eventChip, { backgroundColor: ev.color }]}>
          <Text style={s.eventChipText} numberOfLines={1}>{ev.title}</Text>
        </View>
      ))}
      {dayEvents.length > 2 && (
        <Text style={s.moreChip}>+{dayEvents.length - 2}</Text>
      )}
    </Pressable>
  );
}

// ── Main Screen ──────────────────────────────────────────────────────────────
export default function CalendarScreen(): React.JSX.Element {
  const events                       = useEventsStore((s) => s.events);
  const isLoading                    = useEventsStore((s) => s.isLoading);
  const storeError                   = useEventsStore((s) => s.error);
  const removeEvent                  = useEventsStore((s) => s.removeEvent);
  const reservations                 = useParkingStore((s) => s.reservations);
  const recurringBills               = useRecurringBillsStore((s) => s.bills);
  const recurringPayments            = useRecurringBillsStore((s) => s.payments);
  const chores                       = useChoresStore((s) => s.chores);
  const housemates                   = useHousematesStore((s) => s.housemates);
  const currency                     = useSettingsStore((s) => s.currency);
  const showRecurringBillsOnCalendar = useSettingsStore((s) => s.showRecurringBillsOnCalendar);

  const connected           = useCalendarSyncStore((s) => s.connected);
  const autoSync            = useCalendarSyncStore((s) => s.autoSync);
  const eventMap            = useCalendarSyncStore((s) => s.eventMap);
  const syncHouseEvent      = useCalendarSyncStore((s) => s.syncHouseEvent);
  const syncParkingApproved = useCalendarSyncStore((s) => s.syncParkingApproved);
  const syncParkingPending  = useCalendarSyncStore((s) => s.syncParkingPending);
  const connect             = useCalendarSyncStore((s) => s.connect);

  const C = useThemedColors();
  const styles = useMemo(() => makeStyles(C), [C]);
  const fadeStyle = useFadeInUp(0);
  const haptic = useHaptic();

  const today = new Date();
  const [viewYear, setViewYear]   = useState(today.getFullYear());
  const [viewMonth, setViewMonth] = useState(today.getMonth());
  const [selectedDate, setSelectedDate] = useState(toYMD(today));
  const [showForm, setShowForm]         = useState(false);
  const [editingEvent, setEditingEvent] = useState<HouseEvent | undefined>(undefined);

  const [gridStart, gridEnd] = useMemo(() => {
    const first = new Date(viewYear, viewMonth, 1);
    const start = new Date(first);
    start.setDate(1 - first.getDay());
    const end = new Date(start);
    end.setDate(start.getDate() + 41);
    end.setHours(23, 59, 59);
    return [start, end];
  }, [viewYear, viewMonth]);

  const personalEvents = usePersonalCalendar(gridStart, gridEnd);

  const allEvents = useMemo((): CalendarEvent[] => {
    const list: CalendarEvent[] = [];
    const expandEnd = new Date(gridEnd);
    expandEnd.setMonth(expandEnd.getMonth() + 2);

    for (const e of events) {
      const base = {
        sourceId: e.id, title: e.title,
        type: 'event' as const,
        detail: resolveName(e.createdBy, housemates),
        createdBy: e.createdBy, startTime: e.startTime, endTime: e.endTime,
        endDate: e.endDate, notes: e.notes, recurrence: e.recurrence,
      };
      if (e.recurrence) {
        const dates = expandRecurringDates(e.date, e.recurrence, e.recurrenceEnd, gridStart, expandEnd);
        if (e.endDate && e.endDate > e.date) {
          const spanDays = Math.round(
            (new Date(e.endDate + 'T00:00:00').getTime() - new Date(e.date + 'T00:00:00').getTime()) / 86400000
          );
          for (const d of dates) {
            const anchor = new Date(d + 'T00:00:00');
            for (let offset = 0; offset <= spanDays; offset++) {
              const cur = new Date(anchor);
              cur.setDate(anchor.getDate() + offset);
              list.push({ ...base, id: `ev-${e.id}-${toYMD(cur)}`, date: toYMD(cur) });
            }
          }
        } else {
          for (const d of dates) list.push({ ...base, id: `ev-${e.id}-${d}`, date: d });
        }
      } else if (e.endDate && e.endDate > e.date) {
        const start = new Date(e.date + 'T00:00:00');
        const end   = new Date(e.endDate + 'T00:00:00');
        const cur   = new Date(start);
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
      if (r.status === 'approved') {
        list.push({ sourceId: r.id, id: `pk-${r.id}`, date: r.date, title: `Parking — ${name}`, type: 'parking', detail: r.note, startTime: r.startTime, endTime: r.endTime, person: r.requestedBy });
      } else if (r.status === 'pending') {
        list.push({ sourceId: r.id, id: `pk-${r.id}`, date: r.date, title: `Parking — ${name} (pending)`, type: 'parking-pending', detail: r.note, startTime: r.startTime, endTime: r.endTime, person: r.requestedBy });
      }
    }

    if (showRecurringBillsOnCalendar) {
      for (const bill of recurringBills) {
        const nextDue = getNextDueDate(bill, recurringPayments);
        if (nextDue) {
          list.push({
            sourceId: `bl-${bill.id}`, id: `bl-${bill.id}`, date: nextDue,
            title: `${bill.icon} ${bill.name}`,
            type: 'bill',
            detail: `Due · ${currency}${bill.typicalAmount.toFixed(2)}`,
          });
        }
      }
    }

    for (const c of chores) {
      if (c.recurrence === 'once' && c.recurrenceDay) {
        list.push({ sourceId: c.id, id: `ch-${c.id}`, date: c.recurrenceDay, title: c.name, type: 'chore', detail: c.claimedBy ? resolveName(c.claimedBy, housemates) : undefined });
      }
    }

    for (const p of personalEvents) {
      list.push({ sourceId: p.id, id: p.id, date: p.date, title: p.title, type: 'personal', startTime: p.startTime, endTime: p.endTime });
    }

    return list;
  }, [events, reservations, recurringBills, recurringPayments, showRecurringBillsOnCalendar, chores, currency, personalEvents, housemates, gridStart, gridEnd]);

  const eventMap2 = useMemo((): Record<string, Array<{ title: string; color: string }>> => {
    const map: Record<string, Array<{ title: string; color: string }>> = {};
    for (const e of allEvents) {
      if (!map[e.date]) map[e.date] = [];
      map[e.date].push({ title: e.title, color: TYPE_META[e.type].color });
    }
    return map;
  }, [allEvents]);

  const grid = useMemo((): Date[] => {
    const first = new Date(viewYear, viewMonth, 1);
    const start = new Date(first);
    start.setDate(1 - first.getDay());
    const days: Date[] = [];
    for (let i = 0; i < 42; i++) {
      const d = new Date(start);
      d.setDate(start.getDate() + i);
      days.push(d);
    }
    return days;
  }, [viewYear, viewMonth]);

  const prevMonth = useCallback((): void => {
    haptic.tap();
    if (viewMonth === 0) { setViewYear((y) => y - 1); setViewMonth(11); }
    else setViewMonth((m) => m - 1);
  }, [viewMonth, haptic]);

  const nextMonth = useCallback((): void => {
    haptic.tap();
    if (viewMonth === 11) { setViewYear((y) => y + 1); setViewMonth(0); }
    else setViewMonth((m) => m + 1);
  }, [viewMonth, haptic]);

  const selectedEvents = useMemo(
    () => allEvents.filter((e) => e.date === selectedDate),
    [allEvents, selectedDate]
  );

  const todayStr = toYMD(today);

  const handleOpenAdd = useCallback((): void => {
    haptic.tap();
    setEditingEvent(undefined);
    setShowForm(true);
  }, [haptic]);

  const handleEditEvent = useCallback((sourceId: string): void => {
    const ev = events.find((e) => e.id === sourceId);
    if (ev) { setEditingEvent(ev); setShowForm(true); }
  }, [events]);

  const handleCloseForm = useCallback((): void => {
    setShowForm(false);
    setEditingEvent(undefined);
  }, []);

  const handleManualSync = useCallback(async (item: CalendarEvent): Promise<void> => {
    if (!connected) {
      const ok = await connect();
      if (!ok) return;
    }
    if (item.type === 'event') {
      await syncHouseEvent({ id: item.sourceId, title: item.title, date: item.date, startTime: item.startTime, endTime: item.endTime, createdBy: item.createdBy });
    } else if (item.type === 'parking') {
      await syncParkingApproved({ id: item.sourceId, requestedBy: resolveName(item.person ?? '', housemates), date: item.date, startTime: item.startTime, endTime: item.endTime });
    } else if (item.type === 'parking-pending') {
      await syncParkingPending({ id: item.sourceId, requestedBy: resolveName(item.person ?? '', housemates), date: item.date, startTime: item.startTime, endTime: item.endTime });
    }
  }, [connected, connect, syncHouseEvent, syncParkingApproved, syncParkingPending, housemates]);

  if (isLoading) {
    return (
      <SafeAreaView style={styles.container} edges={['top']}>
        <Header title="Calendar" />
        <View style={styles.centered}>
          <EmptyState mode="loading" title="Loading…" />
        </View>
      </SafeAreaView>
    );
  }

  const headerRight = (
    <AddEventBtn onPress={handleOpenAdd} C={C} />
  );

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <Header title="Calendar" right={headerRight} />
      <Animated.View style={[styles.flex, fadeStyle]}>
        <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">

          {!!storeError && (
            <View style={[styles.errorBanner, { backgroundColor: C.negative + '15', borderColor: C.negative + '40' }]}>
              <Text style={[type.bodySm, { color: C.negative }]}>{storeError}</Text>
            </View>
          )}

          {/* Blue hero — sync state */}
          <View style={styles.heroCard}>
            <View style={styles.heroDeco} />
            <View style={styles.heroDecoSm} />

            <View style={styles.heroTopRow}>
              <View style={styles.heroIcon}>
                <Ionicons name="calendar-outline" size={26} color="#fff" />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={[type.eyebrow, { color: 'rgba(255,255,255,0.78)' }]}>House schedule</Text>
                <Text style={[type.title, { color: '#fff' }]}>{MONTHS[viewMonth]} {viewYear}</Text>
              </View>
            </View>

            <Text style={[type.bodySm, { color: 'rgba(255,255,255,0.78)' }]}>
              {connected ? 'Synced with your calendar' : 'Tap any day to see events.'}
            </Text>
          </View>

          {/* Month nav */}
          <View style={styles.monthHeader}>
            <NavBtn icon="chevron-back" onPress={prevMonth} C={C} />
            <Text style={[type.subtitle, { color: C.textPrimary, flex: 1, textAlign: 'center' }]}>
              {MONTHS[viewMonth]} {viewYear}
            </Text>
            <NavBtn icon="chevron-forward" onPress={nextMonth} C={C} />
          </View>

          {/* Calendar grid */}
          <View style={[styles.calCard, { backgroundColor: C.surface, borderColor: C.border }]}>
            <View style={styles.weekRow}>
              {WEEKDAYS.map((d) => (
                <Text key={d} style={[type.caption, styles.weekDay, { color: C.textSecondary }]}>{d}</Text>
              ))}
            </View>
            {[0, 1, 2, 3, 4, 5].map((row) => (
              <View key={row} style={styles.gridRow}>
                {grid.slice(row * 7, row * 7 + 7).map((day, idx) => {
                  const ymd = toYMD(day);
                  return (
                    <DayCell
                      key={idx}
                      day={day}
                      isToday={ymd === todayStr}
                      isSelected={ymd === selectedDate}
                      isCurrentMonth={day.getMonth() === viewMonth}
                      events={eventMap2[ymd] ?? []}
                      onPress={() => { haptic.tap(); setSelectedDate(ymd); }}
                      C={C}
                    />
                  );
                })}
              </View>
            ))}
          </View>

          {/* Legend */}
          <View style={[styles.legend, { backgroundColor: C.surface, borderColor: C.border }]}>
            {(Object.entries(TYPE_META) as [CalendarEvent['type'], { icon: string; color: string }][]).map(([type_, meta]) => (
              <View key={type_} style={styles.legendItem}>
                <View style={[styles.legendDot, { backgroundColor: meta.color }]} />
                <Text style={[type.caption, { color: C.textSecondary }]}>
                  {meta.icon} {type_ === 'parking-pending' ? 'Parking (pending)' : type_.charAt(0).toUpperCase() + type_.slice(1)}
                </Text>
              </View>
            ))}
          </View>

          {/* Selected day */}
          <View style={[styles.eventsSection, { backgroundColor: C.surface, borderColor: C.border }]}>
            <View style={styles.eventsSectionHeader}>
              <Text style={[type.label, { color: C.textPrimary }]}>
                {selectedDate === todayStr
                  ? 'Today'
                  : new Date(selectedDate + 'T12:00:00').toLocaleDateString([], { weekday: 'short', month: 'short', day: 'numeric' })}
              </Text>
              <AddDayBtn onPress={handleOpenAdd} C={C} />
            </View>

            {selectedEvents.length === 0 ? (
              <View style={styles.emptyDay}>
                <Text style={[type.bodyMd, { color: C.textSecondary, textAlign: 'center' }]}>
                  Nothing scheduled — tap Add to create an event
                </Text>
              </View>
            ) : (
              <FlatList
                data={selectedEvents}
                keyExtractor={(e) => e.id}
                scrollEnabled={false}
                renderItem={({ item }) => {
                  const timeLabel = item.startTime
                    ? `${item.startTime}${item.endTime ? ` – ${item.endTime}` : ''}`
                    : null;
                  const dateRangeLabel = item.endDate && item.endDate !== item.date
                    ? `${formatShortDate(item.date)} – ${formatShortDate(item.endDate)}`
                    : null;
                  const syncKey = (item.type === 'parking' || item.type === 'parking-pending')
                    ? `pk-${item.sourceId}`
                    : `ev-${item.sourceId}-${item.date}`;
                  const alreadySynced = !!eventMap[syncKey];
                  const showSyncBtn = item.type === 'event' || item.type === 'parking' || item.type === 'parking-pending';
                  const hideSyncBtn = alreadySynced && (
                    (item.type === 'event' && connected && autoSync.events) ||
                    ((item.type === 'parking' || item.type === 'parking-pending') && connected && autoSync.parking)
                  );

                  return (
                    <Animated.View
                      layout={LinearTransition.springify().damping(18)}
                      style={[styles.eventRow, { backgroundColor: C.background }, item.type === 'personal' && { opacity: 0.75 }]}
                    >
                      <View style={[styles.eventIconWrap, { backgroundColor: TYPE_META[item.type].color + '20' }]}>
                        <Text style={{ fontSize: 18 }}>{TYPE_META[item.type].icon}</Text>
                      </View>
                      <View style={styles.eventInfo}>
                        <View style={styles.eventTitleRow}>
                          <Text style={[type.label, { color: C.textPrimary, flex: 1 }]} numberOfLines={2}>{item.title}</Text>
                          {item.recurrence && (
                            <View style={styles.recurrenceBadge}>
                              <Text style={[type.caption, { color: '#6366f1', fontWeight: '700' }]}>↻ {item.recurrence}</Text>
                            </View>
                          )}
                        </View>
                        {!!timeLabel && <Text style={[type.captionMed, { color: C.primary }]}>{timeLabel}</Text>}
                        {!!dateRangeLabel && <Text style={[type.captionMed, { color: C.primary }]}>{dateRangeLabel}</Text>}
                        {!!item.detail && <Text style={[type.caption, { color: C.textSecondary }]}>{item.detail}</Text>}
                        {!!item.notes && <Text style={[type.caption, { color: C.textSecondary, fontStyle: 'italic' }]} numberOfLines={2}>{item.notes}</Text>}
                      </View>
                      <View style={styles.eventRight}>
                        <View style={[styles.typeBadge, { backgroundColor: TYPE_META[item.type].color + '20' }]}>
                          <Text style={[type.caption, { color: TYPE_META[item.type].color, fontWeight: '600', textTransform: 'capitalize' }]}>
                            {item.type === 'parking-pending' ? 'pending' : item.type}
                          </Text>
                        </View>
                        {showSyncBtn && Platform.OS === 'web' ? (
                          <>
                            <ActionIcon
                              icon="logo-google" color={C.textSecondary}
                              onPress={() => openGoogleCalendar({ title: item.title, date: item.date, startTime: item.startTime, endTime: item.endTime })}
                              label="Add to Google Calendar"
                            />
                            <ActionIcon
                              icon="download-outline" color={C.textSecondary}
                              onPress={() => downloadIcs({ title: item.title, date: item.date, startTime: item.startTime, endTime: item.endTime })}
                              label="Download .ics file"
                            />
                          </>
                        ) : showSyncBtn && !hideSyncBtn ? (
                          <ActionIcon
                            icon={alreadySynced ? 'checkmark-circle' : 'calendar-outline'}
                            color={alreadySynced ? C.positive : C.textSecondary}
                            size={18}
                            onPress={() => handleManualSync(item).catch(() => {})}
                            label={alreadySynced ? 'Added to calendar' : 'Add to my calendar'}
                          />
                        ) : null}
                        {item.type === 'event' && (
                          <>
                            <ActionIcon
                              icon="pencil-outline" color={C.primary}
                              onPress={() => handleEditEvent(item.sourceId)}
                              label="Edit event"
                            />
                            <ActionIcon
                              icon="trash-outline" color={C.negative}
                              onPress={async () => {
                                try { haptic.warn(); await removeEvent(item.sourceId); }
                                catch { Alert.alert('Error', 'Could not remove event. Try again.'); }
                              }}
                              label="Delete event"
                            />
                          </>
                        )}
                      </View>
                    </Animated.View>
                  );
                }}
                ItemSeparatorComponent={() => <View style={{ height: 8 }} />}
              />
            )}
          </View>

        </ScrollView>
      </Animated.View>

      <EventFormModal
        visible={showForm}
        initialDate={selectedDate}
        editingEvent={editingEvent}
        onClose={handleCloseForm}
      />
    </SafeAreaView>
  );
}

// ── Reusable mini buttons ────────────────────────────────────────────────────
function NavBtn({ icon, onPress, C }: { icon: React.ComponentProps<typeof Ionicons>['name']; onPress: () => void; C: ColorTokens }): React.JSX.Element {
  const press = usePressScale(0.9);
  return (
    <Animated.View style={press.animatedStyle}>
      <Pressable
        onPress={onPress}
        onPressIn={press.onPressIn}
        onPressOut={press.onPressOut}
        style={{
          width: 40, height: 40, borderRadius: 20,
          justifyContent: 'center', alignItems: 'center',
          backgroundColor: C.surfaceSecondary,
        }}
        accessibilityRole="button"
      >
        <Ionicons name={icon} size={18} color={C.primary} />
      </Pressable>
    </Animated.View>
  );
}

function AddEventBtn({ onPress, C }: { onPress: () => void; C: ColorTokens }): React.JSX.Element {
  const press = usePressScale(0.94);
  return (
    <Animated.View style={press.animatedStyle}>
      <Pressable
        onPress={onPress}
        onPressIn={press.onPressIn}
        onPressOut={press.onPressOut}
        style={{
          flexDirection: 'row', alignItems: 'center', gap: 4,
          backgroundColor: C.primary,
          paddingVertical: 8, paddingHorizontal: 12,
          borderRadius: 12, minHeight: 36,
        }}
        accessibilityRole="button"
        accessibilityLabel="Add event"
      >
        <Ionicons name="add" size={18} color="#fff" />
        <Text style={[type.labelSm, { color: '#fff' }]}>Add</Text>
      </Pressable>
    </Animated.View>
  );
}

function AddDayBtn({ onPress, C }: { onPress: () => void; C: ColorTokens }): React.JSX.Element {
  const press = usePressScale(0.94);
  return (
    <Animated.View style={press.animatedStyle}>
      <Pressable
        onPress={onPress}
        onPressIn={press.onPressIn}
        onPressOut={press.onPressOut}
        style={{ flexDirection: 'row', alignItems: 'center', gap: 4, minHeight: 36, paddingHorizontal: 4 }}
        accessibilityRole="button"
      >
        <Ionicons name="add-circle-outline" size={18} color={C.primary} />
        <Text style={[type.labelSm, { color: C.primary }]}>Add</Text>
      </Pressable>
    </Animated.View>
  );
}

function ActionIcon({
  icon, color, size = 16, onPress, label,
}: {
  icon: React.ComponentProps<typeof Ionicons>['name'];
  color: string; size?: number;
  onPress: () => void; label: string;
}): React.JSX.Element {
  const press = usePressScale(0.85);
  return (
    <Animated.View style={press.animatedStyle}>
      <Pressable
        onPress={onPress}
        onPressIn={press.onPressIn}
        onPressOut={press.onPressOut}
        style={{ minWidth: 44, minHeight: 44, justifyContent: 'center', alignItems: 'center' }}
        accessibilityRole="button"
        accessibilityLabel={label}
      >
        <Ionicons name={icon} size={size} color={color} />
      </Pressable>
    </Animated.View>
  );
}

// ── Styles ──────────────────────────────────────────────────────────────────
function makeStyles(C: ColorTokens) {
  const isDark = C.background !== '#F6F2EA';
  return StyleSheet.create({
    flex:      { flex: 1 },
    container: { flex: 1, backgroundColor: C.background },
    scroll:    { padding: sizes.md, paddingBottom: 60, gap: sizes.md },

    // Hero
    heroCard: {
      backgroundColor: C.primary,
      borderRadius: sizes.borderRadiusLg,
      padding: sizes.lg, gap: 14,
      position: 'relative', overflow: 'hidden',
    },
    heroDeco: {
      position: 'absolute', top: -40, right: -30, width: 160, height: 160,
      borderRadius: 80, backgroundColor: 'rgba(255,255,255,0.07)',
    },
    heroDecoSm: {
      position: 'absolute', bottom: -50, left: -20, width: 110, height: 110,
      borderRadius: 55, backgroundColor: 'rgba(255,255,255,0.05)',
    },
    heroTopRow: { flexDirection: 'row', alignItems: 'center', gap: sizes.sm },
    heroIcon: {
      width: 48, height: 48, borderRadius: 14,
      backgroundColor: 'rgba(255,255,255,0.16)',
      justifyContent: 'center', alignItems: 'center',
    },

    monthHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: sizes.xs, gap: sizes.sm },

    calCard: {
      borderRadius: sizes.borderRadiusLg, borderWidth: 1,
      padding: sizes.sm, overflow: 'hidden',
      ...(isDark
        ? {}
        : {
            shadowColor: '#000', shadowOffset: { width: 0, height: 2 },
            shadowOpacity: 0.05, shadowRadius: 6, elevation: 1,
          }),
    } as never,
    weekRow:  { flexDirection: 'row', marginBottom: 4 },
    weekDay:  { flex: 1, textAlign: 'center', fontWeight: '700', letterSpacing: 0.5, paddingVertical: 4 },
    gridRow:  { flexDirection: 'row' },

    dayCell:  { flex: 1, alignItems: 'stretch', paddingVertical: 2, paddingHorizontal: 1, minHeight: 52 },
    dayInner: { width: 28, height: 28, borderRadius: 14, justifyContent: 'center', alignItems: 'center', alignSelf: 'center', marginBottom: 2 },
    daySelected: { backgroundColor: C.primary },
    dayToday:    { backgroundColor: C.primary + '20' },

    eventChip:     { borderRadius: 3, paddingHorizontal: 3, paddingVertical: 1, marginBottom: 1 },
    eventChipText: { fontSize: 8, fontWeight: '600', color: '#fff', lineHeight: 11 },
    moreChip:      { fontSize: 8, color: C.textSecondary, paddingHorizontal: 3 },

    legend: {
      flexDirection: 'row', flexWrap: 'wrap', gap: 12,
      borderRadius: sizes.borderRadiusLg, borderWidth: 1, padding: sizes.md,
    },
    legendItem: { flexDirection: 'row', alignItems: 'center', gap: 6 },
    legendDot:  { width: 8, height: 8, borderRadius: 4 },

    eventsSection: {
      borderRadius: sizes.borderRadiusLg, borderWidth: 1,
      padding: sizes.md, gap: sizes.sm,
    },
    eventsSectionHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 4 },
    emptyDay: { paddingVertical: sizes.lg, alignItems: 'center' },

    eventRow: {
      flexDirection: 'row', alignItems: 'flex-start', gap: 10,
      borderRadius: 10, padding: sizes.sm,
    },
    eventIconWrap: { width: 36, height: 36, borderRadius: 10, justifyContent: 'center', alignItems: 'center', marginTop: 2 },
    eventInfo:     { flex: 1, gap: 2 },
    eventTitleRow: { flexDirection: 'row', alignItems: 'center', gap: 6, flexWrap: 'wrap' },
    recurrenceBadge: { backgroundColor: '#6366f120', paddingHorizontal: 6, paddingVertical: 2, borderRadius: 6 },
    eventRight:    { flexDirection: 'row', alignItems: 'center', gap: 4, paddingTop: 2 },
    typeBadge:     { paddingHorizontal: 8, paddingVertical: 3, borderRadius: 8 },

    centered:    { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 20 },
    errorBanner: { borderRadius: 10, padding: sizes.sm, borderWidth: 1 },
  });
}

function makeFormStyles(C: ColorTokens) {
  return StyleSheet.create({
    backdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.45)', justifyContent: 'flex-end' },
    sheet: {
      backgroundColor: C.surface,
      borderTopLeftRadius: 24, borderTopRightRadius: 24,
      padding: 24, paddingBottom: 40, gap: 12,
      maxHeight: '94%',
    },
    handle: { width: 40, height: 4, borderRadius: 2, backgroundColor: C.border, alignSelf: 'center', marginBottom: 4 },
    label:    { marginBottom: 6, textTransform: 'none' as const, letterSpacing: 0 },
    labelGap: { marginTop: 14 },
    input: {
      borderWidth: 1.5, borderColor: C.border, borderRadius: 12,
      paddingHorizontal: 14, paddingVertical: 12,
      fontSize: 15, color: C.textPrimary,
      backgroundColor: C.surfaceSecondary,
    },
    clearLink: { alignSelf: 'flex-start', marginTop: 6 },
    chips:     { flexDirection: 'row', gap: 8, flexWrap: 'wrap' },
    btns:      { flexDirection: 'row', gap: 10, marginTop: 4 },
  });
}
