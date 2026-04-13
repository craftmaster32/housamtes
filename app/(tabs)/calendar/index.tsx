import { useState, useMemo, useCallback } from 'react';
import { View, StyleSheet, ScrollView, Pressable, FlatList, TextInput, Modal } from 'react-native';
import { Text } from 'react-native-paper';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useEventsStore } from '@stores/eventsStore';
import { useParkingStore } from '@stores/parkingStore';
import { useBillsStore } from '@stores/billsStore';
import { useChoresStore } from '@stores/choresStore';
import { useAuthStore } from '@stores/authStore';
import { CalendarPicker } from '@components/shared/CalendarPicker';
import { TimePicker } from '@components/shared/TimePicker';
import { colors } from '@constants/colors';
import { font } from '@constants/typography';
import { sizes } from '@constants/sizes';

// ── Types ─────────────────────────────────────────────────────────────────────
interface CalendarEvent {
  id: string;
  date: string;
  title: string;
  type: 'event' | 'parking' | 'bill' | 'chore';
  detail?: string;
  startTime?: string;
  endTime?: string;
}

const TYPE_META: Record<CalendarEvent['type'], { icon: string; color: string }> = {
  event:   { icon: '📅', color: '#6366f1' },
  parking: { icon: '🚗', color: '#f59e0b' },
  bill:    { icon: '💰', color: '#ef4444' },
  chore:   { icon: '🧹', color: '#22c55e' },
};

const WEEKDAYS = ['Su', 'Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa'];
const MONTHS   = ['January','February','March','April','May','June','July','August','September','October','November','December'];

function toYMD(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

// ── Add Event Modal ───────────────────────────────────────────────────────────
function AddEventModal({
  visible, initialDate, onClose,
}: {
  visible: boolean;
  initialDate: string;
  onClose: () => void;
}): React.JSX.Element {
  const addEvent = useEventsStore((s) => s.addEvent);
  const profile  = useAuthStore((s) => s.profile);
  const houseId  = useAuthStore((s) => s.houseId);

  const [title, setTitle]         = useState('');
  const [date, setDate]           = useState(initialDate);
  const [startTime, setStartTime] = useState('');
  const [endTime, setEndTime]     = useState('');
  const [saving, setSaving]       = useState(false);
  const [error, setError]         = useState('');

  const handleShow = useCallback((): void => {
    setTitle('');
    setDate(initialDate);
    setStartTime('');
    setEndTime('');
    setError('');
  }, [initialDate]);

  const handleSave = useCallback(async (): Promise<void> => {
    if (!title.trim()) { setError('Enter an event name'); return; }
    if (!date) { setError('Pick a date'); return; }
    setSaving(true);
    try {
      await addEvent(
        title.trim(),
        date,
        profile?.name ?? 'Someone',
        houseId ?? '',
        startTime || undefined,
        endTime || undefined,
      );
      setTitle('');
      setError('');
      onClose();
    } catch {
      setError('Could not save event. Try again.');
    } finally {
      setSaving(false);
    }
  }, [title, date, startTime, endTime, profile, houseId, addEvent, onClose]);

  return (
    <Modal
      visible={visible}
      transparent
      animationType="slide"
      onShow={handleShow}
      onRequestClose={onClose}
    >
      <Pressable style={styles.modalBackdrop} onPress={onClose}>
        <Pressable style={styles.modalSheet} onPress={() => {}}>
          <View style={styles.modalHandle} />
          <Text style={styles.modalTitle}>Add Event</Text>

          <ScrollView showsVerticalScrollIndicator={false} style={styles.modalScroll}>
            <Text style={styles.fieldLabel}>Event name</Text>
            <TextInput
              style={styles.fieldInput}
              value={title}
              onChangeText={(v) => { setTitle(v); setError(''); }}
              placeholder="e.g. House meeting, Inspection..."
              placeholderTextColor={colors.textSecondary}
              autoFocus
              returnKeyType="done"
              onSubmitEditing={handleSave}
            />

            <Text style={[styles.fieldLabel, { marginTop: 14 }]}>Date</Text>
            <CalendarPicker value={date} onChange={setDate} />

            <Text style={[styles.fieldLabel, { marginTop: 14 }]}>Start time (optional)</Text>
            <TimePicker value={startTime} onChange={setStartTime} />

            <Text style={[styles.fieldLabel, { marginTop: 14 }]}>End time (optional)</Text>
            <TimePicker value={endTime} onChange={setEndTime} />

            {!!error && <Text style={[styles.fieldError, { marginTop: 8 }]}>{error}</Text>}
          </ScrollView>

          <View style={styles.modalBtns}>
            <Pressable style={styles.modalBtnOutline} onPress={onClose} accessibilityRole="button">
              <Text style={styles.modalBtnOutlineText}>Cancel</Text>
            </Pressable>
            <Pressable
              style={[styles.modalBtnPrimary, saving && { opacity: 0.6 }]}
              onPress={handleSave}
              disabled={saving}
              accessibilityRole="button"
            >
              <Text style={styles.modalBtnPrimaryText}>{saving ? 'Saving…' : 'Save Event'}</Text>
            </Pressable>
          </View>
        </Pressable>
      </Pressable>
    </Modal>
  );
}

// ── Day Cell (with event labels) ──────────────────────────────────────────────
function DayCell({
  day, isToday, isSelected, isCurrentMonth, events, onPress,
}: {
  day: Date;
  isToday: boolean;
  isSelected: boolean;
  isCurrentMonth: boolean;
  events: Array<{ title: string; color: string }>;
  onPress: () => void;
}): React.JSX.Element {
  return (
    <Pressable style={styles.dayCell} onPress={onPress}>
      <View style={[
        styles.dayInner,
        isSelected && styles.daySelected,
        isToday && !isSelected && styles.dayToday,
      ]}>
        <Text style={[
          styles.dayNum,
          !isCurrentMonth && styles.dayNumFaint,
          isSelected && styles.dayNumSelected,
          isToday && !isSelected && styles.dayNumToday,
        ]}>
          {day.getDate()}
        </Text>
      </View>
      {events.slice(0, 2).map((ev, i) => (
        <View key={i} style={[styles.eventChip, { backgroundColor: ev.color }]}>
          <Text style={styles.eventChipText} numberOfLines={1}>{ev.title}</Text>
        </View>
      ))}
      {events.length > 2 && (
        <Text style={styles.moreChip}>+{events.length - 2}</Text>
      )}
    </Pressable>
  );
}

// ── Main screen ───────────────────────────────────────────────────────────────
export default function CalendarScreen(): React.JSX.Element {
  const events       = useEventsStore((s) => s.events);
  const removeEvent  = useEventsStore((s) => s.removeEvent);
  const reservations = useParkingStore((s) => s.reservations);
  const bills        = useBillsStore((s) => s.bills);
  const chores       = useChoresStore((s) => s.chores);
  const profile      = useAuthStore((s) => s.profile);

  const today = new Date();
  const [viewYear, setViewYear]   = useState(today.getFullYear());
  const [viewMonth, setViewMonth] = useState(today.getMonth());
  const [selectedDate, setSelectedDate] = useState(toYMD(today));
  const [showAdd, setShowAdd] = useState(false);

  const allEvents = useMemo((): CalendarEvent[] => {
    const list: CalendarEvent[] = [];
    for (const e of events) {
      list.push({ id: `ev-${e.id}`, date: e.date, title: e.title, type: 'event', detail: e.createdBy, startTime: e.startTime, endTime: e.endTime });
    }
    for (const r of reservations) {
      if (r.status === 'approved') {
        list.push({ id: `pk-${r.id}`, date: r.date, title: `Parking — ${r.requestedBy}`, type: 'parking', detail: r.note, startTime: r.startTime, endTime: r.endTime });
      }
    }
    for (const b of bills) {
      list.push({ id: `bl-${b.id}`, date: b.date, title: b.title, type: 'bill', detail: `₪${b.amount.toFixed(2)}` });
    }
    for (const c of chores) {
      if (c.recurrence === 'once' && c.recurrenceDay) {
        list.push({ id: `ch-${c.id}`, date: c.recurrenceDay, title: c.name, type: 'chore', detail: c.claimedBy ?? undefined });
      }
    }
    return list;
  }, [events, reservations, bills, chores]);

  const eventMap = useMemo((): Record<string, Array<{ title: string; color: string }>> => {
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

  const prevMonth = useCallback(() => {
    if (viewMonth === 0) { setViewYear((y) => y - 1); setViewMonth(11); }
    else setViewMonth((m) => m - 1);
  }, [viewMonth]);

  const nextMonth = useCallback(() => {
    if (viewMonth === 11) { setViewYear((y) => y + 1); setViewMonth(0); }
    else setViewMonth((m) => m + 1);
  }, [viewMonth]);

  const selectedEvents = useMemo(
    () => allEvents.filter((e) => e.date === selectedDate),
    [allEvents, selectedDate]
  );

  const todayStr = toYMD(today);
  const myName   = profile?.name ?? '';

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>

        {/* ── Page header ── */}
        <View style={styles.pageHeader}>
          <View>
            <Text style={styles.pageTitle}>Calendar</Text>
            <Text style={styles.pageSubtitle}>House schedule</Text>
          </View>
          <Pressable style={styles.addBtn} onPress={() => setShowAdd(true)} accessibilityRole="button">
            <Ionicons name="add" size={18} color="#fff" />
            <Text style={styles.addBtnText}>Add Event</Text>
          </Pressable>
        </View>

        {/* ── Month header ── */}
        <View style={styles.monthHeader}>
          <Pressable style={styles.navBtn} onPress={prevMonth} accessibilityRole="button">
            <Ionicons name="chevron-back" size={18} color={colors.primary} />
          </Pressable>
          <Text style={styles.monthTitle}>{MONTHS[viewMonth]} {viewYear}</Text>
          <Pressable style={styles.navBtn} onPress={nextMonth} accessibilityRole="button">
            <Ionicons name="chevron-forward" size={18} color={colors.primary} />
          </Pressable>
        </View>

        {/* ── Calendar grid ── */}
        <View style={styles.calCard}>
          <View style={styles.weekRow}>
            {WEEKDAYS.map((d) => (
              <Text key={d} style={styles.weekDay}>{d}</Text>
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
                    events={eventMap[ymd] ?? []}
                    onPress={() => setSelectedDate(ymd)}
                  />
                );
              })}
            </View>
          ))}
        </View>

        {/* ── Legend ── */}
        <View style={styles.legend}>
          {(Object.entries(TYPE_META) as [CalendarEvent['type'], { icon: string; color: string }][]).map(([type, meta]) => (
            <View key={type} style={styles.legendItem}>
              <View style={[styles.legendDot, { backgroundColor: meta.color }]} />
              <Text style={styles.legendLabel}>{meta.icon} {type.charAt(0).toUpperCase() + type.slice(1)}</Text>
            </View>
          ))}
        </View>

        {/* ── Selected day events ── */}
        <View style={styles.eventsSection}>
          <View style={styles.eventsSectionHeader}>
            <Text style={styles.eventsSectionTitle}>
              {selectedDate === todayStr
                ? 'Today'
                : new Date(selectedDate + 'T12:00:00').toLocaleDateString([], { weekday: 'short', month: 'short', day: 'numeric' })}
            </Text>
            <Pressable style={styles.addDayBtn} onPress={() => setShowAdd(true)} accessibilityRole="button">
              <Ionicons name="add-circle-outline" size={18} color={colors.primary} />
              <Text style={styles.addDayBtnText}>Add</Text>
            </Pressable>
          </View>

          {selectedEvents.length === 0 ? (
            <View style={styles.emptyDay}>
              <Text style={styles.emptyDayText}>Nothing scheduled — tap Add to create an event</Text>
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
                return (
                  <View style={styles.eventRow}>
                    <View style={[styles.eventIconWrap, { backgroundColor: TYPE_META[item.type].color + '20' }]}>
                      <Text style={styles.eventIcon}>{TYPE_META[item.type].icon}</Text>
                    </View>
                    <View style={styles.eventInfo}>
                      <Text style={styles.eventTitle}>{item.title}</Text>
                      {!!timeLabel && <Text style={styles.eventTime}>{timeLabel}</Text>}
                      {!!item.detail && <Text style={styles.eventDetail}>{item.detail}</Text>}
                    </View>
                    <View style={styles.eventRight}>
                      <View style={[styles.typeBadge, { backgroundColor: TYPE_META[item.type].color + '20' }]}>
                        <Text style={[styles.typeBadgeText, { color: TYPE_META[item.type].color }]}>
                          {item.type}
                        </Text>
                      </View>
                      {item.type === 'event' && item.detail === myName && (
                        <Pressable
                          onPress={() => removeEvent(item.id.replace('ev-', ''))}
                          hitSlop={8}
                          accessibilityRole="button"
                        >
                          <Ionicons name="trash-outline" size={16} color={colors.negative} />
                        </Pressable>
                      )}
                    </View>
                  </View>
                );
              }}
              ItemSeparatorComponent={() => <View style={{ height: 8 }} />}
            />
          )}
        </View>

      </ScrollView>

      <AddEventModal
        visible={showAdd}
        initialDate={selectedDate}
        onClose={() => setShowAdd(false)}
      />
    </SafeAreaView>
  );
}

// ── Styles ────────────────────────────────────────────────────────────────────
const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  scroll: { padding: sizes.md, paddingBottom: 60, gap: sizes.md },

  pageHeader: { flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between', paddingTop: 4 },
  pageTitle: { fontSize: 28, ...font.extrabold, color: colors.textPrimary, letterSpacing: -0.8 },
  pageSubtitle: { fontSize: 13, ...font.regular, color: colors.textSecondary, marginTop: 2 },
  addBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    backgroundColor: colors.primary, paddingVertical: 11, paddingHorizontal: 16, borderRadius: 12,
    boxShadow: '0 4px 14px rgba(79,120,182,0.25)',
  } as never,
  addBtnText: { fontSize: 14, ...font.semibold, color: '#fff' },

  monthHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: sizes.xs },
  monthTitle: { fontSize: 20, ...font.extrabold, color: colors.textPrimary, letterSpacing: -0.5 },
  navBtn: { width: 40, height: 40, justifyContent: 'center', alignItems: 'center', borderRadius: 20, backgroundColor: colors.surfaceSecondary },

  calCard: { backgroundColor: colors.white, borderRadius: sizes.borderRadiusLg, borderWidth: 1, borderColor: colors.border, padding: sizes.sm, overflow: 'hidden' },
  weekRow: { flexDirection: 'row', marginBottom: 4 },
  weekDay: { flex: 1, textAlign: 'center', fontSize: 10, ...font.bold, color: colors.textSecondary, letterSpacing: 0.5, paddingVertical: 4 },
  gridRow: { flexDirection: 'row' },

  dayCell: { flex: 1, alignItems: 'stretch', paddingVertical: 2, paddingHorizontal: 1, minHeight: 52 },
  dayInner: { width: 26, height: 26, borderRadius: 13, justifyContent: 'center', alignItems: 'center', alignSelf: 'center', marginBottom: 2 },
  daySelected: { backgroundColor: colors.primary },
  dayToday: { backgroundColor: colors.primary + '20' },
  dayNum: { fontSize: 12, ...font.medium, color: colors.textPrimary },
  dayNumFaint: { color: colors.textDisabled },
  dayNumSelected: { color: colors.white, ...font.bold },
  dayNumToday: { color: colors.primary, ...font.bold },

  eventChip: { borderRadius: 3, paddingHorizontal: 3, paddingVertical: 1, marginBottom: 1 },
  eventChipText: { fontSize: 8, ...font.semibold, color: '#fff', lineHeight: 11 },
  moreChip: { fontSize: 8, ...font.regular, color: colors.textSecondary, paddingHorizontal: 3 },

  legend: { flexDirection: 'row', flexWrap: 'wrap', gap: 12, backgroundColor: colors.white, borderRadius: sizes.borderRadiusLg, borderWidth: 1, borderColor: colors.border, padding: sizes.md },
  legendItem: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  legendDot: { width: 8, height: 8, borderRadius: 4 },
  legendLabel: { fontSize: 12, ...font.medium, color: colors.textSecondary },

  eventsSection: { backgroundColor: colors.white, borderRadius: sizes.borderRadiusLg, borderWidth: 1, borderColor: colors.border, padding: sizes.md, gap: sizes.sm },
  eventsSectionHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 4 },
  eventsSectionTitle: { fontSize: 15, ...font.bold, color: colors.textPrimary },
  addDayBtn: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  addDayBtnText: { fontSize: 14, ...font.semibold, color: colors.primary },
  emptyDay: { paddingVertical: sizes.lg, alignItems: 'center' },
  emptyDayText: { color: colors.textSecondary, fontSize: 14, ...font.regular, textAlign: 'center' },
  eventRow: { flexDirection: 'row', alignItems: 'center', gap: 10, backgroundColor: colors.background, borderRadius: 10, padding: sizes.sm },
  eventIconWrap: { width: 36, height: 36, borderRadius: 10, justifyContent: 'center', alignItems: 'center' },
  eventIcon: { fontSize: 18 },
  eventInfo: { flex: 1 },
  eventTitle: { fontSize: 14, ...font.semibold, color: colors.textPrimary },
  eventTime: { fontSize: 12, ...font.semibold, color: colors.primary, marginTop: 1 },
  eventDetail: { fontSize: 12, ...font.regular, color: colors.textSecondary, marginTop: 1 },
  eventRight: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  typeBadge: { paddingHorizontal: 8, paddingVertical: 3, borderRadius: 8 },
  typeBadgeText: { fontSize: 11, ...font.semibold, textTransform: 'capitalize' },

  // ── Add Event Modal
  modalBackdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.45)', justifyContent: 'flex-end' },
  modalSheet: {
    backgroundColor: colors.white,
    borderTopLeftRadius: 24, borderTopRightRadius: 24,
    padding: 24, paddingBottom: 40, gap: 12,
    maxHeight: '92%',
  },
  modalScroll: { flexGrow: 0 },
  modalHandle: { width: 40, height: 4, borderRadius: 2, backgroundColor: colors.border, alignSelf: 'center', marginBottom: 4 },
  modalTitle: { fontSize: 20, ...font.extrabold, color: colors.textPrimary, letterSpacing: -0.5 },
  fieldLabel: { fontSize: 13, ...font.semibold, color: colors.textPrimary, marginBottom: 6 },
  fieldInput: { borderWidth: 1.5, borderColor: colors.border, borderRadius: 12, paddingHorizontal: 14, paddingVertical: 12, fontSize: 15, ...font.regular, color: colors.textPrimary, backgroundColor: colors.surfaceSecondary },
  fieldError: { fontSize: 13, ...font.regular, color: colors.negative },
  modalBtns: { flexDirection: 'row', gap: 10, marginTop: 4 },
  modalBtnOutline: { flex: 1, paddingVertical: 14, borderRadius: 12, borderWidth: 1.5, borderColor: colors.border, alignItems: 'center' },
  modalBtnOutlineText: { fontSize: 15, ...font.semibold, color: colors.textPrimary },
  modalBtnPrimary: { flex: 1, paddingVertical: 14, borderRadius: 12, backgroundColor: colors.primary, alignItems: 'center' },
  modalBtnPrimaryText: { fontSize: 15, ...font.semibold, color: '#fff' },
});
