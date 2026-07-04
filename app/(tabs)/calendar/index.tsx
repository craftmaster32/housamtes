import { useState, useMemo, useCallback, useEffect, useRef } from 'react';
import {
  View,
  StyleSheet,
  ScrollView,
  Pressable,
  FlatList,
  TextInput,
  Modal,
  Platform,
  Keyboard,
  Animated,
} from 'react-native';
import { Text } from 'react-native-paper';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useTranslation } from 'react-i18next';
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
import { useLanguageStore } from '@stores/languageStore';
import { isRTL } from '@lib/i18n';
import { Alert } from '@lib/alert';
import { CalendarPicker } from '@components/shared/CalendarPicker';
import { TimePicker } from '@components/shared/TimePicker';
import { addWeeks, addMonths, addYears } from 'date-fns';
import { useThemedColors, type ColorTokens } from '@constants/colors';
import { font } from '@constants/typography';
import { sizes } from '@constants/sizes';

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
  event: { icon: '📅', color: '#6366f1' },
  parking: { icon: '🚗', color: '#f59e0b' },
  'parking-pending': { icon: '🅿️', color: '#94a3b8' },
  bill: { icon: '💰', color: '#ef4444' },
  chore: { icon: '🧹', color: '#22c55e' },
  personal: { icon: '👤', color: '#8b5cf6' },
};

const WEEKDAY_KEYS = [
  'weekday_su',
  'weekday_mo',
  'weekday_tu',
  'weekday_we',
  'weekday_th',
  'weekday_fr',
  'weekday_sa',
] as const;
const MONTH_KEYS = [
  'month_january',
  'month_february',
  'month_march',
  'month_april',
  'month_may',
  'month_june',
  'month_july',
  'month_august',
  'month_september',
  'month_october',
  'month_november',
  'month_december',
] as const;

function toYMD(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

function formatShortDate(ymd: string, lang: string): string {
  const m = ymd.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!m) return ymd;
  const locale = lang === 'he' ? 'he-IL' : lang === 'es' ? 'es-ES' : 'en-GB';
  return new Date(ymd + 'T12:00:00').toLocaleDateString(locale, { month: 'short', day: 'numeric' });
}

function expandRecurringDates(
  startDate: string,
  recurrence: EventRecurrence,
  recurrenceEnd: string | undefined,
  from: Date,
  to: Date
): string[] {
  const recEnd = recurrenceEnd ? new Date(recurrenceEnd + 'T00:00:00') : null;
  const dates: string[] = [];
  let current = new Date(startDate + 'T00:00:00');

  const advance = (): void => {
    if (recurrence === 'weekly') current = addWeeks(current, 1);
    else if (recurrence === 'monthly') current = addMonths(current, 1);
    else current = addYears(current, 1);
  };

  // Fast-forward to the first occurrence at or after 'from'
  while (current < from) advance();

  while (current <= to) {
    if (recEnd && current > recEnd) break;
    dates.push(toYMD(current));
    advance();
  }
  return dates;
}

// ── Event Form Modal (add + edit) ─────────────────────────────────────────────
interface EventFormModalProps {
  visible: boolean;
  initialDate: string;
  editingEvent?: HouseEvent;
  onClose: () => void;
}

function useRecurrenceOptions(): Array<{ label: string; value: EventRecurrence | '' }> {
  const { t } = useTranslation();
  return useMemo(
    () => [
      { label: t('calendar.repeat_none'), value: '' as const },
      { label: t('calendar.repeat_weekly'), value: 'weekly' as EventRecurrence },
      { label: t('calendar.repeat_monthly'), value: 'monthly' as EventRecurrence },
      { label: t('calendar.repeat_yearly'), value: 'yearly' as EventRecurrence },
    ],
    [t]
  );
}

function EventFormModal({
  visible,
  initialDate,
  editingEvent,
  onClose,
}: EventFormModalProps): React.JSX.Element {
  const { t } = useTranslation();
  const C = useThemedColors();
  const formStyles = useMemo(() => makeFormStyles(C), [C]);
  const RECURRENCE_OPTIONS = useRecurrenceOptions();

  const addEvent = useEventsStore((s) => s.addEvent);
  const editEvent = useEventsStore((s) => s.editEvent);
  const profile = useAuthStore((s) => s.profile);
  const houseId = useAuthStore((s) => s.houseId);
  const syncHouseEvent = useCalendarSyncStore((s) => s.syncHouseEvent);

  const [title, setTitle] = useState('');
  const [date, setDate] = useState(initialDate);
  const [showEndDate, setShowEndDate] = useState(false);
  const [endDate, setEndDate] = useState('');
  const [startTime, setStartTime] = useState('');
  const [endTime, setEndTime] = useState('');
  const [notes, setNotes] = useState('');
  const [recurrence, setRecurrence] = useState<EventRecurrence | ''>('');
  const [showRecEnd, setShowRecEnd] = useState(false);
  const [recurrenceEnd, setRecurrenceEnd] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

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
      setTitle('');
      setDate(initialDate);
      setEndDate('');
      setShowEndDate(false);
      setStartTime('');
      setEndTime('');
      setNotes('');
      setRecurrence('');
      setRecurrenceEnd('');
      setShowRecEnd(false);
    }
    setError('');
  }, [visible, editingEvent, initialDate]);

  const handleClose = useCallback((): void => {
    Keyboard.dismiss();
    onClose();
  }, [onClose]);

  const handleSave = useCallback(async (): Promise<void> => {
    if (!title.trim()) {
      setError(t('calendar.enter_event_name'));
      return;
    }
    if (!date) {
      setError(t('calendar.pick_date'));
      return;
    }
    if (showEndDate && endDate && endDate < date) {
      setError(t('calendar.end_date_error'));
      return;
    }
    setSaving(true);
    try {
      const resolvedEndDate = showEndDate && endDate ? endDate : undefined;
      const resolvedRecEnd = recurrence && showRecEnd && recurrenceEnd ? recurrenceEnd : undefined;
      const resolvedRec = recurrence || undefined;
      if (editingEvent) {
        const updates: EventUpdates = {
          title: title.trim(),
          date,
          endDate: resolvedEndDate,
          startTime: startTime || undefined,
          endTime: endTime || undefined,
          notes: notes || undefined,
          recurrence: resolvedRec,
          recurrenceEnd: resolvedRecEnd,
        };
        await editEvent(editingEvent.id, updates);
      } else {
        const eventId = await addEvent({
          title: title.trim(),
          date,
          createdBy: profile?.id ?? '',
          houseId: houseId ?? '',
          startTime: startTime || undefined,
          endTime: endTime || undefined,
          endDate: resolvedEndDate,
          notes: notes || undefined,
          recurrence: resolvedRec,
          recurrenceEnd: resolvedRecEnd,
        });
        syncHouseEvent({
          id: eventId,
          title: title.trim(),
          date,
          startTime: startTime || undefined,
          endTime: endTime || undefined,
          createdBy: profile?.id,
        }).catch(() => {});
      }
      handleClose();
    } catch {
      setError(t('calendar.save_error'));
    } finally {
      setSaving(false);
    }
  }, [
    title,
    date,
    showEndDate,
    endDate,
    startTime,
    endTime,
    notes,
    recurrence,
    showRecEnd,
    recurrenceEnd,
    editingEvent,
    addEvent,
    editEvent,
    profile,
    houseId,
    syncHouseEvent,
    handleClose,
    t,
  ]);

  const handleModalShow = useCallback((): void => {
    Keyboard.dismiss();
  }, []);

  const isEditing = !!editingEvent;

  return (
    <Modal
      visible={visible}
      transparent
      animationType="slide"
      onRequestClose={handleClose}
      onShow={handleModalShow}
    >
      <Pressable style={formStyles.backdrop} onPress={handleClose}>
        <Pressable style={formStyles.sheet} onPress={() => {}}>
          <View style={formStyles.handle} />
          <Text style={formStyles.title}>
            {isEditing ? t('calendar.edit_event') : t('calendar.add_event')}
          </Text>

          <ScrollView
            showsVerticalScrollIndicator={false}
            style={formStyles.scroll}
            keyboardShouldPersistTaps="handled"
          >
            <Text style={formStyles.label}>{t('calendar.event_name')}</Text>
            <TextInput
              style={formStyles.input}
              value={title}
              onChangeText={(v) => {
                setTitle(v);
                setError('');
              }}
              placeholder={t('calendar.event_name_placeholder')}
              placeholderTextColor={C.textSecondary}
              autoFocus={false}
              returnKeyType="done"
              onSubmitEditing={handleSave}
              accessibilityLabel={t('calendar.event_name')}
              accessibilityHint={t('calendar.event_name_hint')}
            />

            <Text style={[formStyles.label, formStyles.labelGap]}>{t('calendar.start_date')}</Text>
            <CalendarPicker
              value={date}
              onChange={(v) => {
                setDate(v);
                setError('');
              }}
            />

            <Text style={[formStyles.label, formStyles.labelGap]}>
              {t('calendar.end_date')}{' '}
              <Text style={formStyles.optional}>{t('calendar.end_date_hint')}</Text>
            </Text>
            {showEndDate ? (
              <>
                <CalendarPicker value={endDate || date} onChange={setEndDate} />
                <Pressable
                  style={formStyles.clearLink}
                  onPress={() => {
                    setShowEndDate(false);
                    setEndDate('');
                  }}
                  accessibilityRole="button"
                  accessibilityLabel={t('calendar.remove_end_date')}
                >
                  <Text style={formStyles.clearLinkText}>{t('calendar.remove_end_date')}</Text>
                </Pressable>
              </>
            ) : (
              <Pressable
                style={formStyles.addToggle}
                onPress={() => {
                  setShowEndDate(true);
                  setEndDate(date);
                }}
                accessibilityRole="button"
                accessibilityLabel={t('calendar.add_end_date')}
                accessibilityHint={t('calendar.add_end_date_hint')}
              >
                <Ionicons name="add-circle-outline" size={17} color={C.primary} />
                <Text style={formStyles.addToggleText}>{t('calendar.add_end_date')}</Text>
              </Pressable>
            )}

            <Text style={[formStyles.label, formStyles.labelGap]}>
              {t('calendar.start_time')}{' '}
              <Text style={formStyles.optional}>({t('common.optional')})</Text>
            </Text>
            <TimePicker value={startTime} onChange={setStartTime} />

            <Text style={[formStyles.label, formStyles.labelGap]}>
              {t('calendar.end_time')}{' '}
              <Text style={formStyles.optional}>({t('common.optional')})</Text>
            </Text>
            <TimePicker value={endTime} onChange={setEndTime} />

            <Text style={[formStyles.label, formStyles.labelGap]}>
              {t('calendar.notes')}{' '}
              <Text style={formStyles.optional}>({t('common.optional')})</Text>
            </Text>
            <TextInput
              style={[formStyles.input, formStyles.notesInput]}
              value={notes}
              onChangeText={setNotes}
              placeholder={t('calendar.notes_placeholder')}
              placeholderTextColor={C.textSecondary}
              autoFocus={false}
              multiline
              numberOfLines={3}
              textAlignVertical="top"
              accessibilityLabel={t('calendar.notes')}
              accessibilityHint={t('calendar.notes_hint')}
            />

            <Text style={[formStyles.label, formStyles.labelGap]}>{t('calendar.repeat')}</Text>
            <View style={formStyles.chips}>
              {RECURRENCE_OPTIONS.map(({ label, value }) => (
                <Pressable
                  key={value || 'none'}
                  style={[formStyles.chip, recurrence === value && formStyles.chipSelected]}
                  onPress={() => setRecurrence(value)}
                  accessibilityRole="radio"
                  accessibilityState={{ selected: recurrence === value }}
                >
                  <Text
                    style={[
                      formStyles.chipText,
                      recurrence === value && formStyles.chipTextSelected,
                    ]}
                  >
                    {label}
                  </Text>
                </Pressable>
              ))}
            </View>

            {recurrence !== '' && (
              <>
                <Text style={[formStyles.label, formStyles.labelGap]}>
                  {t('calendar.repeat_until')}{' '}
                  <Text style={formStyles.optional}>({t('common.optional')})</Text>
                </Text>
                {showRecEnd ? (
                  <>
                    <CalendarPicker value={recurrenceEnd || date} onChange={setRecurrenceEnd} />
                    <Pressable
                      style={formStyles.clearLink}
                      onPress={() => {
                        setShowRecEnd(false);
                        setRecurrenceEnd('');
                      }}
                      accessibilityRole="button"
                      accessibilityLabel={t('calendar.remove_repeat_end_date')}
                    >
                      <Text style={formStyles.clearLinkText}>{t('calendar.no_end_date')}</Text>
                    </Pressable>
                  </>
                ) : (
                  <Pressable
                    style={formStyles.addToggle}
                    onPress={() => setShowRecEnd(true)}
                    accessibilityRole="button"
                    accessibilityLabel={t('calendar.set_repeat_end_date')}
                    accessibilityHint={t('calendar.choose_repeat_end_hint')}
                  >
                    <Ionicons name="add-circle-outline" size={17} color={C.primary} />
                    <Text style={formStyles.addToggleText}>{t('calendar.set_end_date')}</Text>
                  </Pressable>
                )}
              </>
            )}

            {!!error && <Text style={[formStyles.errorText, formStyles.labelGap]}>{error}</Text>}
            <View style={{ height: 16 }} />
          </ScrollView>

          <View style={formStyles.btns}>
            <Pressable
              style={formStyles.btnOutline}
              onPress={handleClose}
              accessibilityRole="button"
            >
              <Text style={formStyles.btnOutlineText}>{t('calendar.cancel')}</Text>
            </Pressable>
            <Pressable
              style={[formStyles.btnPrimary, saving && formStyles.btnDisabled]}
              onPress={handleSave}
              disabled={saving}
              accessibilityRole="button"
            >
              <Text style={formStyles.btnPrimaryText}>
                {saving
                  ? t('calendar.saving')
                  : isEditing
                    ? t('calendar.save_changes')
                    : t('calendar.save_event')}
              </Text>
            </Pressable>
          </View>
        </Pressable>
      </Pressable>
    </Modal>
  );
}

// ── Day Cell ──────────────────────────────────────────────────────────────────
function DayCell({
  day,
  isToday,
  isSelected,
  isCurrentMonth,
  events: dayEvents,
  onPress,
}: {
  day: Date;
  isToday: boolean;
  isSelected: boolean;
  isCurrentMonth: boolean;
  events: Array<{ title: string; color: string }>;
  onPress: () => void;
}): React.JSX.Element {
  const C = useThemedColors();
  const s = useMemo(() => makeStyles(C), [C]);
  return (
    <Pressable style={s.dayCell} onPress={onPress}>
      <View style={[s.dayInner, isSelected && s.daySelected, isToday && !isSelected && s.dayToday]}>
        <Text
          style={[
            s.dayNum,
            !isCurrentMonth && s.dayNumFaint,
            isSelected && s.dayNumSelected,
            isToday && !isSelected && s.dayNumToday,
          ]}
        >
          {day.getDate()}
        </Text>
      </View>
      {dayEvents.slice(0, 2).map((ev, i) => (
        <View key={i} style={[s.eventChip, { backgroundColor: ev.color }]}>
          <Text style={s.eventChipText} numberOfLines={1}>
            {ev.title}
          </Text>
        </View>
      ))}
      {dayEvents.length > 2 && <Text style={s.moreChip}>+{dayEvents.length - 2}</Text>}
    </Pressable>
  );
}

// ── Main Screen ───────────────────────────────────────────────────────────────
export default function CalendarScreen(): React.JSX.Element {
  const { t, i18n } = useTranslation();
  const language = useLanguageStore((s) => s.language);
  const rtl = isRTL(language);
  const events = useEventsStore((s) => s.events);
  const isLoading = useEventsStore((s) => s.isLoading);
  const storeError = useEventsStore((s) => s.error);
  const removeEvent = useEventsStore((s) => s.removeEvent);
  const reservations = useParkingStore((s) => s.reservations);
  const recurringBills = useRecurringBillsStore((s) => s.bills);
  const recurringPayments = useRecurringBillsStore((s) => s.payments);
  const chores = useChoresStore((s) => s.chores);
  const housemates = useHousematesStore((s) => s.housemates);
  const currency = useSettingsStore((s) => s.currency);
  const showRecurringBillsOnCalendar = useSettingsStore((s) => s.showRecurringBillsOnCalendar);

  const connected = useCalendarSyncStore((s) => s.connected);
  const autoSync = useCalendarSyncStore((s) => s.autoSync);
  const eventMap = useCalendarSyncStore((s) => s.eventMap);
  const syncHouseEvent = useCalendarSyncStore((s) => s.syncHouseEvent);
  const syncParkingApproved = useCalendarSyncStore((s) => s.syncParkingApproved);
  const syncParkingPending = useCalendarSyncStore((s) => s.syncParkingPending);
  const connect = useCalendarSyncStore((s) => s.connect);

  const C = useThemedColors();
  const styles = useMemo(() => makeStyles(C), [C]);
  const fadeAnim = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    Animated.timing(fadeAnim, { toValue: 1, duration: 250, useNativeDriver: true }).start();
  }, [fadeAnim]);

  const today = new Date();
  const [viewYear, setViewYear] = useState(today.getFullYear());
  const [viewMonth, setViewMonth] = useState(today.getMonth());
  const [selectedDate, setSelectedDate] = useState(toYMD(today));
  const [showForm, setShowForm] = useState(false);
  const [editingEvent, setEditingEvent] = useState<HouseEvent | undefined>(undefined);
  const [expandedEventId, setExpandedEventId] = useState<string | null>(null);

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
      };

      if (e.recurrence) {
        const dates = expandRecurringDates(
          e.date,
          e.recurrence,
          e.recurrenceEnd,
          gridStart,
          expandEnd
        );
        if (e.endDate && e.endDate > e.date) {
          const spanDays = Math.round(
            (new Date(e.endDate + 'T00:00:00').getTime() -
              new Date(e.date + 'T00:00:00').getTime()) /
              86400000
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
          for (const d of dates) {
            list.push({ ...base, id: `ev-${e.id}-${d}`, date: d });
          }
        }
      } else if (e.endDate && e.endDate > e.date) {
        const start = new Date(e.date + 'T00:00:00');
        const end = new Date(e.endDate + 'T00:00:00');
        const cur = new Date(start);
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
        list.push({
          sourceId: r.id,
          id: `pk-${r.id}`,
          date: r.date,
          title: `Parking — ${name}`,
          type: 'parking',
          detail: r.note,
          startTime: r.startTime,
          endTime: r.endTime,
          person: r.requestedBy,
        });
      } else if (r.status === 'pending') {
        list.push({
          sourceId: r.id,
          id: `pk-${r.id}`,
          date: r.date,
          title: `Parking — ${name} (pending)`,
          type: 'parking-pending',
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
            title: `${bill.icon} ${bill.name}`,
            type: 'bill',
            detail: `Due · ${currency}${bill.typicalAmount.toFixed(2)}`,
          });
        }
      }
    }

    for (const c of chores) {
      if (c.recurrence === 'once' && c.recurrenceDay) {
        list.push({
          sourceId: c.id,
          id: `ch-${c.id}`,
          date: c.recurrenceDay,
          title: c.name,
          type: 'chore',
          detail: c.claimedBy ? resolveName(c.claimedBy, housemates) : undefined,
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
    chores,
    currency,
    personalEvents,
    housemates,
    gridStart,
    gridEnd,
  ]);

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
    if (viewMonth === 0) {
      setViewYear((y) => y - 1);
      setViewMonth(11);
    } else setViewMonth((m) => m - 1);
  }, [viewMonth]);

  const nextMonth = useCallback((): void => {
    if (viewMonth === 11) {
      setViewYear((y) => y + 1);
      setViewMonth(0);
    } else setViewMonth((m) => m + 1);
  }, [viewMonth]);

  const selectedEvents = useMemo(
    () => allEvents.filter((e) => e.date === selectedDate),
    [allEvents, selectedDate]
  );

  const todayStr = toYMD(today);

  const handleOpenAdd = useCallback((): void => {
    setEditingEvent(undefined);
    setShowForm(true);
  }, []);

  const handleEditEvent = useCallback(
    (sourceId: string): void => {
      const ev = events.find((e) => e.id === sourceId);
      if (ev) {
        setEditingEvent(ev);
        setShowForm(true);
      }
    },
    [events]
  );

  const handleCloseForm = useCallback((): void => {
    setShowForm(false);
    setEditingEvent(undefined);
  }, []);

  const handleManualSync = useCallback(
    async (item: CalendarEvent): Promise<void> => {
      if (!connected) {
        const ok = await connect();
        if (!ok) return;
      }
      if (item.type === 'event') {
        await syncHouseEvent({
          id: item.sourceId,
          title: item.title,
          date: item.date,
          startTime: item.startTime,
          endTime: item.endTime,
          createdBy: item.createdBy,
        });
      } else if (item.type === 'parking') {
        await syncParkingApproved({
          id: item.sourceId,
          requestedBy: resolveName(item.person ?? '', housemates),
          date: item.date,
          startTime: item.startTime,
          endTime: item.endTime,
        });
      } else if (item.type === 'parking-pending') {
        await syncParkingPending({
          id: item.sourceId,
          requestedBy: resolveName(item.person ?? '', housemates),
          date: item.date,
          startTime: item.startTime,
          endTime: item.endTime,
        });
      }
    },
    [connected, connect, syncHouseEvent, syncParkingApproved, syncParkingPending, housemates]
  );

  if (isLoading) {
    return (
      <SafeAreaView style={styles.container} edges={['top']}>
        <View style={styles.centered}>
          <Text style={styles.emptyDayText}>{t('calendar.loading')}</Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <Animated.View style={[styles.flex, { opacity: fadeAnim }]}>
        <ScrollView
          contentContainerStyle={styles.scroll}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
        >
          {!!storeError && (
            <View style={styles.errorBanner}>
              <Text style={styles.errorBannerText}>{storeError}</Text>
            </View>
          )}

          {/* Header */}
          <View style={styles.pageHeader}>
            <View>
              <Text style={styles.pageTitle}>{t('calendar.title')}</Text>
              <Text style={styles.pageSubtitle}>
                {connected ? t('calendar.synced_subtitle') : t('calendar.house_schedule')}
              </Text>
            </View>
            <Pressable
              style={[styles.addBtn, { minHeight: 44 }]}
              onPress={handleOpenAdd}
              accessible
              accessibilityRole="button"
            >
              <Ionicons name="add" size={18} color="#fff" />
              <Text style={styles.addBtnText}>{t('calendar.add_event')}</Text>
            </Pressable>
          </View>

          {/* Month nav */}
          <View style={styles.monthHeader}>
            <Pressable
              style={styles.navBtn}
              onPress={prevMonth}
              accessibilityRole="button"
              accessibilityLabel={t('dashboard.prev_month')}
            >
              <Ionicons
                name={rtl ? 'chevron-forward' : 'chevron-back'}
                size={18}
                color={C.primary}
              />
            </Pressable>
            <Text style={styles.monthTitle}>
              {t(`calendar.${MONTH_KEYS[viewMonth]}`)} {viewYear}
            </Text>
            <Pressable
              style={styles.navBtn}
              onPress={nextMonth}
              accessibilityRole="button"
              accessibilityLabel={t('dashboard.next_month')}
            >
              <Ionicons
                name={rtl ? 'chevron-back' : 'chevron-forward'}
                size={18}
                color={C.primary}
              />
            </Pressable>
          </View>

          {/* Calendar grid */}
          <View style={styles.calCard}>
            <View style={styles.weekRow}>
              {WEEKDAY_KEYS.map((key) => (
                <Text key={key} style={styles.weekDay}>
                  {t(`calendar.${key}`)}
                </Text>
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
                      onPress={() => {
                        setSelectedDate(ymd);
                        setExpandedEventId(null);
                      }}
                    />
                  );
                })}
              </View>
            ))}
          </View>

          {/* Legend */}
          <View style={styles.legend}>
            {(
              Object.entries(TYPE_META) as [
                CalendarEvent['type'],
                { icon: string; color: string },
              ][]
            ).map(([type, meta]) => (
              <View key={type} style={styles.legendItem}>
                <View style={[styles.legendDot, { backgroundColor: meta.color }]} />
                <Text style={styles.legendLabel}>
                  {meta.icon} {t(`calendar.legend_${type.replace('-', '_')}`)}
                </Text>
              </View>
            ))}
          </View>

          {/* Selected day */}
          <View style={styles.eventsSection}>
            <View style={styles.eventsSectionHeader}>
              <Text style={styles.eventsSectionTitle}>
                {selectedDate === todayStr
                  ? t('calendar.today')
                  : new Date(selectedDate + 'T12:00:00').toLocaleDateString(i18n.language, {
                      weekday: 'short',
                      month: 'short',
                      day: 'numeric',
                    })}
              </Text>
              <Pressable
                style={[styles.addDayBtn, { minHeight: 44 }]}
                onPress={handleOpenAdd}
                accessible
                accessibilityRole="button"
                hitSlop={8}
              >
                <Ionicons name="add-circle-outline" size={18} color={C.primary} />
                <Text style={styles.addDayBtnText}>{t('calendar.add')}</Text>
              </Pressable>
            </View>

            {selectedEvents.length === 0 ? (
              <View style={styles.emptyDay}>
                <Text style={styles.emptyDayText}>{t('calendar.nothing_scheduled')}</Text>
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
                  const dateRangeLabel =
                    item.endDate && item.endDate !== item.date
                      ? `${formatShortDate(item.date, i18n.language)} – ${formatShortDate(item.endDate, i18n.language)}`
                      : null;
                  const syncKey =
                    item.type === 'parking' || item.type === 'parking-pending'
                      ? `pk-${item.sourceId}`
                      : `ev-${item.sourceId}-${item.date}`;
                  const alreadySynced = !!eventMap[syncKey];
                  const showSyncBtn =
                    item.type === 'event' ||
                    item.type === 'parking' ||
                    item.type === 'parking-pending';
                  const hideSyncBtn =
                    alreadySynced &&
                    ((item.type === 'event' && connected && autoSync.events) ||
                      ((item.type === 'parking' || item.type === 'parking-pending') &&
                        connected &&
                        autoSync.parking));

                  const isExpanded = expandedEventId === item.id;

                  return (
                    <Pressable
                      style={[styles.eventRow, item.type === 'personal' && styles.eventRowPersonal]}
                      onPress={() => setExpandedEventId(isExpanded ? null : item.id)}
                      accessibilityRole="button"
                      accessibilityLabel={
                        isExpanded
                          ? t('calendar.collapse', { title: item.title })
                          : t('calendar.expand', { title: item.title })
                      }
                      accessibilityState={{ expanded: isExpanded }}
                    >
                      <View
                        style={[
                          styles.eventIconWrap,
                          { backgroundColor: TYPE_META[item.type].color + '20' },
                        ]}
                      >
                        <Text style={styles.eventIcon}>{TYPE_META[item.type].icon}</Text>
                      </View>
                      <View style={styles.eventInfo}>
                        <View style={styles.eventTitleRow}>
                          <Text style={styles.eventTitle} numberOfLines={isExpanded ? 0 : 1}>
                            {item.title}
                          </Text>
                          {item.recurrence && (
                            <View style={styles.recurrenceBadge}>
                              <Text style={styles.recurrenceBadgeText}>↻ {item.recurrence}</Text>
                            </View>
                          )}
                        </View>
                        {isExpanded && !!timeLabel && (
                          <Text style={styles.eventTime}>{timeLabel}</Text>
                        )}
                        {isExpanded && !!dateRangeLabel && (
                          <Text style={styles.eventTime}>{dateRangeLabel}</Text>
                        )}
                        {isExpanded && !!item.detail && (
                          <Text style={styles.eventDetail}>{item.detail}</Text>
                        )}
                        {isExpanded && !!item.notes && (
                          <Text style={styles.eventNotes}>{item.notes}</Text>
                        )}
                        {isExpanded && (
                          <View style={styles.eventActions}>
                            {showSyncBtn && Platform.OS === 'web' ? (
                              <>
                                <Pressable
                                  style={styles.iconBtn}
                                  hitSlop={{ left: 7, right: 7 }}
                                  onPress={() =>
                                    openGoogleCalendar({
                                      title: item.title,
                                      date: item.date,
                                      startTime: item.startTime,
                                      endTime: item.endTime,
                                    })
                                  }
                                  accessibilityRole="button"
                                  accessibilityLabel={t('calendar.add_to_google')}
                                >
                                  <Ionicons name="logo-google" size={16} color={C.textSecondary} />
                                </Pressable>
                                <Pressable
                                  style={styles.iconBtn}
                                  hitSlop={{ left: 7, right: 7 }}
                                  onPress={() =>
                                    downloadIcs({
                                      title: item.title,
                                      date: item.date,
                                      startTime: item.startTime,
                                      endTime: item.endTime,
                                    })
                                  }
                                  accessibilityRole="button"
                                  accessibilityLabel={t('calendar.download_ics')}
                                >
                                  <Ionicons
                                    name="download-outline"
                                    size={16}
                                    color={C.textSecondary}
                                  />
                                </Pressable>
                              </>
                            ) : showSyncBtn && !hideSyncBtn ? (
                              <Pressable
                                style={styles.iconBtn}
                                hitSlop={{ left: 7, right: 7 }}
                                onPress={async () => {
                                  try {
                                    await handleManualSync(item);
                                  } catch {
                                    Alert.alert(
                                      t('calendar.sync_failed_title'),
                                      t('calendar.sync_failed_body')
                                    );
                                  }
                                }}
                                accessibilityRole="button"
                                accessibilityLabel={
                                  alreadySynced
                                    ? t('calendar.added_to_calendar')
                                    : t('calendar.add_to_my_calendar')
                                }
                              >
                                <Ionicons
                                  name={alreadySynced ? 'checkmark-circle' : 'calendar-outline'}
                                  size={18}
                                  color={alreadySynced ? C.positive : C.textSecondary}
                                />
                              </Pressable>
                            ) : null}
                            {item.type === 'event' && (
                              <>
                                <Pressable
                                  style={styles.iconBtn}
                                  hitSlop={{ left: 7, right: 7 }}
                                  onPress={() => handleEditEvent(item.sourceId)}
                                  accessibilityRole="button"
                                  accessibilityLabel={t('calendar.edit_event_btn')}
                                >
                                  <Ionicons name="pencil-outline" size={16} color={C.primary} />
                                </Pressable>
                                <Pressable
                                  style={styles.iconBtn}
                                  hitSlop={{ left: 7, right: 7 }}
                                  onPress={async () => {
                                    try {
                                      await removeEvent(item.sourceId);
                                    } catch {
                                      Alert.alert(
                                        t('calendar.remove_error_title'),
                                        t('calendar.remove_error_body')
                                      );
                                    }
                                  }}
                                  accessibilityRole="button"
                                  accessibilityLabel={t('calendar.delete_event')}
                                >
                                  <Ionicons name="trash-outline" size={16} color={C.negative} />
                                </Pressable>
                              </>
                            )}
                          </View>
                        )}
                      </View>
                      <View style={styles.eventRight}>
                        <View
                          style={[
                            styles.typeBadge,
                            { backgroundColor: TYPE_META[item.type].color + '20' },
                          ]}
                        >
                          <Text
                            style={[styles.typeBadgeText, { color: TYPE_META[item.type].color }]}
                          >
                            {item.type === 'parking-pending' ? 'pending' : item.type}
                          </Text>
                        </View>
                        <Ionicons
                          name={isExpanded ? 'chevron-up' : 'chevron-down'}
                          size={14}
                          color={C.textSecondary}
                        />
                      </View>
                    </Pressable>
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

// ── Styles ────────────────────────────────────────────────────────────────────
function makeStyles(C: ColorTokens) {
  return StyleSheet.create({
    flex: { flex: 1 },
    container: { flex: 1, backgroundColor: C.background },
    scroll: { padding: sizes.md, paddingBottom: 60, gap: sizes.md },

    pageHeader: {
      flexDirection: 'row',
      alignItems: 'flex-start',
      justifyContent: 'space-between',
      paddingTop: 4,
    },
    pageTitle: { fontSize: 28, ...font.extrabold, color: C.textPrimary, letterSpacing: -0.8 },
    pageSubtitle: { fontSize: 13, ...font.regular, color: C.textSecondary, marginTop: 2 },
    addBtn: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 6,
      backgroundColor: C.primary,
      paddingVertical: 11,
      paddingHorizontal: 16,
      borderRadius: 12,
      shadowColor: '#000',
      shadowOffset: { width: 0, height: 2 },
      shadowOpacity: 0.08,
      shadowRadius: 8,
      elevation: 2,
    },
    addBtnText: { fontSize: 14, ...font.semibold, color: '#fff' },

    monthHeader: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      paddingHorizontal: sizes.xs,
    },
    monthTitle: { fontSize: 20, ...font.extrabold, color: C.textPrimary, letterSpacing: -0.5 },
    navBtn: {
      width: 44,
      height: 44,
      justifyContent: 'center',
      alignItems: 'center',
      borderRadius: 22,
      backgroundColor: C.surfaceSecondary,
    },

    calCard: {
      backgroundColor: C.surface,
      borderRadius: sizes.borderRadiusLg,
      borderWidth: 1,
      borderColor: C.border,
      padding: sizes.sm,
      overflow: 'hidden',
    },
    weekRow: { flexDirection: 'row', marginBottom: 4 },
    weekDay: {
      flex: 1,
      textAlign: 'center',
      fontSize: 10,
      ...font.bold,
      color: C.textSecondary,
      letterSpacing: 0.5,
      paddingVertical: 4,
    },
    gridRow: { flexDirection: 'row' },

    dayCell: {
      flex: 1,
      alignItems: 'stretch',
      paddingVertical: 2,
      paddingHorizontal: 1,
      minHeight: 52,
    },
    dayInner: {
      width: 26,
      height: 26,
      borderRadius: 13,
      justifyContent: 'center',
      alignItems: 'center',
      alignSelf: 'center',
      marginBottom: 2,
    },
    daySelected: { backgroundColor: C.primary },
    dayToday: { backgroundColor: C.primary + '20' },
    dayNum: { fontSize: 12, ...font.medium, color: C.textPrimary },
    dayNumFaint: { color: C.textDisabled },
    dayNumSelected: { color: '#fff', ...font.bold },
    dayNumToday: { color: C.primary, ...font.bold },

    eventChip: { borderRadius: 3, paddingHorizontal: 3, paddingVertical: 1, marginBottom: 1 },
    eventChipText: { fontSize: 8, ...font.semibold, color: '#fff', lineHeight: 11 },
    moreChip: { fontSize: 8, ...font.regular, color: C.textSecondary, paddingHorizontal: 3 },

    legend: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      gap: 12,
      backgroundColor: C.surface,
      borderRadius: sizes.borderRadiusLg,
      borderWidth: 1,
      borderColor: C.border,
      padding: sizes.md,
    },
    legendItem: { flexDirection: 'row', alignItems: 'center', gap: 6 },
    legendDot: { width: 8, height: 8, borderRadius: 4 },
    legendLabel: { fontSize: 12, ...font.medium, color: C.textSecondary },

    eventsSection: {
      backgroundColor: C.surface,
      borderRadius: sizes.borderRadiusLg,
      borderWidth: 1,
      borderColor: C.border,
      padding: sizes.md,
      gap: sizes.sm,
    },
    eventsSectionHeader: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      marginBottom: 4,
    },
    eventsSectionTitle: { fontSize: 15, ...font.bold, color: C.textPrimary },
    addDayBtn: { flexDirection: 'row', alignItems: 'center', gap: 4 },
    addDayBtnText: { fontSize: 14, ...font.semibold, color: C.primary },
    emptyDay: { paddingVertical: sizes.lg, alignItems: 'center' },
    emptyDayText: { color: C.textSecondary, fontSize: 14, ...font.regular, textAlign: 'center' },

    eventRow: {
      flexDirection: 'row',
      alignItems: 'flex-start',
      gap: 10,
      backgroundColor: C.background,
      borderRadius: 10,
      padding: sizes.sm,
    },
    eventRowPersonal: { opacity: 0.75 },
    eventIconWrap: {
      width: 36,
      height: 36,
      borderRadius: 10,
      justifyContent: 'center',
      alignItems: 'center',
      marginTop: 2,
    },
    eventIcon: { fontSize: 18 },
    eventInfo: { flex: 1, gap: 2, minWidth: 0 },
    eventTitleRow: { flexDirection: 'row', alignItems: 'center', gap: 6, flexWrap: 'wrap' },
    eventTitle: { fontSize: 14, ...font.semibold, color: C.textPrimary, flex: 1 },
    recurrenceBadge: {
      backgroundColor: '#6366f120',
      paddingHorizontal: 6,
      paddingVertical: 2,
      borderRadius: 6,
    },
    recurrenceBadgeText: { fontSize: 10, ...font.semibold, color: '#6366f1' },
    eventTime: { fontSize: 12, ...font.semibold, color: C.primary },
    eventDetail: { fontSize: 12, ...font.regular, color: C.textSecondary },
    eventNotes: { fontSize: 12, ...font.regular, color: C.textSecondary, fontStyle: 'italic' },
    eventRight: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 6,
      paddingTop: 2,
      flexShrink: 0,
    },
    eventActions: { flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 6 },
    typeBadge: { paddingHorizontal: 8, paddingVertical: 3, borderRadius: 8 },
    typeBadgeText: { fontSize: 11, ...font.semibold, textTransform: 'capitalize' },
    iconBtn: { width: 30, minHeight: 44, justifyContent: 'center', alignItems: 'center' },

    centered: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 20 },
    errorBanner: {
      backgroundColor: C.negative + '15',
      borderRadius: 10,
      padding: sizes.sm,
      borderWidth: 1,
      borderColor: C.negative + '40',
    },
    errorBannerText: { fontSize: sizes.fontSm, ...font.regular, color: C.negative },
  });
}

function makeFormStyles(C: ColorTokens): ReturnType<typeof StyleSheet.create> {
  return StyleSheet.create({
    backdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.45)', justifyContent: 'flex-end' },
    sheet: {
      backgroundColor: C.surface,
      borderTopLeftRadius: 24,
      borderTopRightRadius: 24,
      padding: 24,
      paddingBottom: 40,
      gap: 12,
      maxHeight: '94%',
    },
    scroll: { flexGrow: 0 },
    handle: {
      width: 40,
      height: 4,
      borderRadius: 2,
      backgroundColor: C.border,
      alignSelf: 'center',
      marginBottom: 4,
    },
    title: { fontSize: 20, ...font.extrabold, color: C.textPrimary, letterSpacing: -0.5 },
    label: { fontSize: 13, ...font.semibold, color: C.textPrimary, marginBottom: 6 },
    labelGap: { marginTop: 14 },
    optional: { ...font.regular, color: C.textSecondary },
    input: {
      borderWidth: 1.5,
      borderColor: C.border,
      borderRadius: 12,
      paddingHorizontal: 14,
      paddingVertical: 12,
      fontSize: 15,
      ...font.regular,
      color: C.textPrimary,
      backgroundColor: C.surfaceSecondary,
    },
    notesInput: { minHeight: 80, paddingTop: 12 },
    addToggle: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 6,
      alignSelf: 'flex-start',
      paddingVertical: 8,
      paddingHorizontal: 14,
      borderRadius: 20,
      borderWidth: 1,
      borderColor: C.primary,
      backgroundColor: C.secondary,
    },
    addToggleText: { fontSize: 14, ...font.medium, color: C.primary },
    clearLink: { alignSelf: 'flex-start', marginTop: 6 },
    clearLinkText: {
      fontSize: 12,
      ...font.regular,
      color: C.textSecondary,
      textDecorationLine: 'underline',
    },
    chips: { flexDirection: 'row', gap: 8, flexWrap: 'wrap' },
    chip: {
      paddingVertical: 8,
      paddingHorizontal: 16,
      borderRadius: 20,
      borderWidth: 1.5,
      borderColor: C.border,
      backgroundColor: C.surfaceSecondary,
    },
    chipSelected: { backgroundColor: C.primary, borderColor: C.primary },
    chipText: { fontSize: 14, ...font.semibold, color: C.textSecondary },
    chipTextSelected: { color: '#fff' },
    errorText: { fontSize: 13, ...font.regular, color: C.negative },
    btns: { flexDirection: 'row', gap: 10, marginTop: 4 },
    btnOutline: {
      flex: 1,
      paddingVertical: 14,
      borderRadius: 12,
      borderWidth: 1.5,
      borderColor: C.border,
      alignItems: 'center',
    },
    btnOutlineText: { fontSize: 15, ...font.semibold, color: C.textPrimary },
    btnPrimary: {
      flex: 1,
      paddingVertical: 14,
      borderRadius: 12,
      backgroundColor: C.primary,
      alignItems: 'center',
    },
    btnPrimaryText: { fontSize: 15, ...font.semibold, color: '#fff' },
    btnDisabled: { opacity: 0.6 },
  });
}
