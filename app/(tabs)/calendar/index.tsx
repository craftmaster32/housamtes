import { useState, useMemo, useCallback, useEffect } from 'react';
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
} from 'react-native';
import { Text } from 'react-native-paper';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import type { IoniconName } from '@/types/icons';
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
import { BackLink } from '@components/shared/BackLink';
import { parseRepeatText } from '@utils/repeatParser';
import {
  normalizeInterval,
  normalizeWeekdays,
  expandRecurrenceDates,
  expandRecurringSpanDays,
} from '@utils/events';
import { useThemedColors, type ColorTokens } from '@constants/colors';
import { font } from '@constants/typography';
import { useHeadingFont } from '@hooks/useHeadingFont';
import { sizes } from '@constants/sizes';

import { mf, ms } from '@utils/responsive';
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
  recurrenceInterval?: number;
  recurrenceDays?: number[];
  person?: string;
}

const TYPE_META: Record<CalendarEvent['type'], { icon: IoniconName; color: string }> = {
  event: { icon: 'calendar-outline', color: '#6366f1' },
  parking: { icon: 'car-outline', color: '#f59e0b' },
  'parking-pending': { icon: 'car-outline', color: '#94a3b8' },
  bill: { icon: 'cash-outline', color: '#ef4444' },
  chore: { icon: 'sparkles-outline', color: '#22c55e' },
  personal: { icon: 'person-outline', color: '#8b5cf6' },
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

// 'daily' → 'day', etc. — the singular noun used when composing repeat labels.
const UNIT_NOUN: Record<EventRecurrence, 'day' | 'week' | 'month' | 'year'> = {
  daily: 'day',
  weekly: 'week',
  monthly: 'month',
  yearly: 'year',
};

// A friendly label for a cadence: "Weekly" when interval is 1, otherwise
// "Every N weeks". `t` is the i18next translator.
function recurrenceLabel(
  t: (key: string, opts?: Record<string, unknown>) => string,
  recurrence: EventRecurrence,
  interval: number
): string {
  const step = normalizeInterval(interval);
  if (step === 1) return t(`calendar.repeat_${recurrence}`);
  const noun = UNIT_NOUN[recurrence];
  return t('calendar.repeat_every_n', {
    count: step,
    unit: t(`calendar.repeat_unit_${noun}s`),
  });
}

// ── Event Form Modal (add + edit) ─────────────────────────────────────────────
interface EventFormModalProps {
  visible: boolean;
  initialDate: string;
  editingEvent?: HouseEvent;
  onClose: () => void;
}

// A repeat preset is either "none", one of the units (interval 1), or "custom"
// (the caller reveals an interval builder).
type RepeatPreset = EventRecurrence | '' | 'custom';

function useRecurrenceOptions(): Array<{ label: string; value: RepeatPreset }> {
  const { t } = useTranslation();
  return useMemo(
    () => [
      { label: t('calendar.repeat_none'), value: '' as const },
      { label: t('calendar.repeat_daily'), value: 'daily' as const },
      { label: t('calendar.repeat_weekly'), value: 'weekly' as const },
      { label: t('calendar.repeat_monthly'), value: 'monthly' as const },
      { label: t('calendar.repeat_yearly'), value: 'yearly' as const },
      { label: t('calendar.repeat_custom'), value: 'custom' as const },
    ],
    [t]
  );
}

const CUSTOM_UNITS: EventRecurrence[] = ['daily', 'weekly', 'monthly', 'yearly'];
const MAX_INTERVAL = 99;

function EventFormModal({
  visible,
  initialDate,
  editingEvent,
  onClose,
}: EventFormModalProps): React.JSX.Element {
  const { t, i18n } = useTranslation();
  const C = useThemedColors();
  const formStyles = useMemo(() => makeFormStyles(C), [C]);
  const headingFont = useHeadingFont('bold');
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
  const [recurrenceInterval, setRecurrenceInterval] = useState(1);
  const [recurrenceDays, setRecurrenceDays] = useState<number[]>([]);
  const [customMode, setCustomMode] = useState(false);
  const [smartText, setSmartText] = useState('');
  const [smartFeedback, setSmartFeedback] = useState<{ ok: boolean; text: string } | null>(null);
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
      const interval = normalizeInterval(editingEvent.recurrenceInterval);
      setRecurrenceInterval(interval);
      setRecurrenceDays(
        editingEvent.recurrence === 'weekly' ? normalizeWeekdays(editingEvent.recurrenceDays) : []
      );
      // Show the custom builder when the saved cadence isn't a plain preset.
      setCustomMode(!!editingEvent.recurrence && interval > 1);
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
      setRecurrenceInterval(1);
      setRecurrenceDays([]);
      setCustomMode(false);
      setRecurrenceEnd('');
      setShowRecEnd(false);
    }
    setSmartText('');
    setSmartFeedback(null);
    setError('');
  }, [visible, editingEvent, initialDate]);

  const handleClose = useCallback((): void => {
    Keyboard.dismiss();
    onClose();
  }, [onClose]);

  const handleSave = useCallback(async (): Promise<void> => {
    if (saving) return; // guard against a double-tap creating two events
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
      // Interval only matters when repeating; a preset unit uses 1.
      const resolvedInterval = resolvedRec ? normalizeInterval(recurrenceInterval) : undefined;
      // The weekday set applies only to weekly repeats.
      const resolvedDays =
        resolvedRec === 'weekly' && recurrenceDays.length > 0
          ? normalizeWeekdays(recurrenceDays)
          : undefined;
      if (editingEvent) {
        const updates: EventUpdates = {
          title: title.trim(),
          date,
          endDate: resolvedEndDate,
          startTime: startTime || undefined,
          endTime: endTime || undefined,
          notes: notes || undefined,
          recurrence: resolvedRec,
          recurrenceInterval: resolvedInterval,
          recurrenceDays: resolvedDays,
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
          recurrenceInterval: resolvedInterval,
          recurrenceDays: resolvedDays,
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
    recurrenceInterval,
    recurrenceDays,
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
    saving,
  ]);

  const handleModalShow = useCallback((): void => {
    Keyboard.dismiss();
  }, []);

  // Which repeat chip reads as selected.
  const activePreset: RepeatPreset = customMode ? 'custom' : recurrence;

  const handlePreset = useCallback((value: RepeatPreset): void => {
    setSmartFeedback(null);
    if (value === 'custom') {
      setCustomMode(true);
      // Entering custom: make sure there's a unit and a meaningful interval so it
      // reads as a genuine custom cadence (e.g. "every 2 weeks").
      setRecurrence((prev) => prev || 'weekly');
      setRecurrenceInterval((prev) => (prev > 1 ? prev : 2));
      return;
    }
    setCustomMode(false);
    setRecurrence(value);
    setRecurrenceInterval(1);
    // The weekday set only applies to weekly repeats.
    if (value !== 'weekly') setRecurrenceDays([]);
  }, []);

  const adjustInterval = useCallback((delta: number): void => {
    setRecurrenceInterval((n) => Math.min(MAX_INTERVAL, Math.max(1, n + delta)));
  }, []);

  const toggleDay = useCallback((dow: number): void => {
    setSmartFeedback(null);
    setRecurrenceDays((prev) =>
      prev.includes(dow) ? prev.filter((d) => d !== dow) : [...prev, dow].sort((a, b) => a - b)
    );
  }, []);

  // Read the plain-English box, fill in what we understood, and report back.
  const handleApplySmart = useCallback((): void => {
    const parsed = parseRepeatText(smartText);
    if (!parsed.matched) {
      setSmartFeedback({ ok: false, text: t('calendar.repeat_smart_unrecognized') });
      return;
    }
    const parts: string[] = [];
    const days = normalizeWeekdays(parsed.recurrenceDays);
    if (parsed.recurrence) {
      const iv = Math.min(MAX_INTERVAL, normalizeInterval(parsed.recurrenceInterval));
      setRecurrence(parsed.recurrence);
      setRecurrenceInterval(iv);
      setRecurrenceDays(parsed.recurrence === 'weekly' ? days : []);
      setCustomMode(iv > 1);
      parts.push(recurrenceLabel(t, parsed.recurrence, iv));
    }
    if (days.length > 1) {
      parts.push(days.map((d) => t(`calendar.${WEEKDAY_KEYS[d]}`)).join(', '));
    } else if (parsed.date) {
      parts.push(formatShortDate(parsed.date, i18n.language));
    }
    if (parsed.date) {
      setDate(parsed.date);
      // A newly parsed start date can't sit after an existing "repeat until" date.
      if (recurrenceEnd && parsed.date > recurrenceEnd) {
        setRecurrenceEnd('');
        setShowRecEnd(false);
      }
    }
    if (parsed.startTime) {
      setStartTime(parsed.startTime);
      if (parsed.endTime) setEndTime(parsed.endTime);
      parts.push(parsed.endTime ? `${parsed.startTime} – ${parsed.endTime}` : parsed.startTime);
    }
    setError('');
    setSmartFeedback({ ok: true, text: parts.join(' · ') });
  }, [smartText, recurrenceEnd, t, i18n.language]);

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
          <Text style={[formStyles.title, headingFont]}>
            {isEditing ? t('calendar.edit_event') : t('calendar.add_event')}
          </Text>
          <Text style={formStyles.subtitle}>
            {isEditing ? t('calendar.edit_event_sub') : t('calendar.add_event_sub')}
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

            {/* Plain-English shortcut: type it, we fill the fields in. */}
            <View style={formStyles.smartRow}>
              <TextInput
                style={[formStyles.input, formStyles.smartInput]}
                value={smartText}
                onChangeText={(v) => {
                  setSmartText(v);
                  setSmartFeedback(null);
                }}
                placeholder={t('calendar.repeat_smart_placeholder')}
                placeholderTextColor={C.textSecondary}
                autoFocus={false}
                returnKeyType="done"
                onSubmitEditing={handleApplySmart}
                accessibilityLabel={t('calendar.repeat_smart_label')}
                accessibilityHint={t('calendar.repeat_smart_hint')}
              />
              <Pressable
                style={[formStyles.smartBtn, !smartText.trim() && formStyles.btnDisabled]}
                onPress={handleApplySmart}
                disabled={!smartText.trim()}
                accessibilityRole="button"
                accessibilityLabel={t('calendar.repeat_smart_apply')}
              >
                <Ionicons name="sparkles" size={14} color="#fff" />
                <Text style={formStyles.smartBtnText}>{t('calendar.repeat_smart_apply')}</Text>
              </Pressable>
            </View>
            {!!smartFeedback && (
              <Text
                style={[
                  formStyles.smartFeedback,
                  smartFeedback.ok ? formStyles.smartFeedbackOk : formStyles.smartFeedbackErr,
                ]}
              >
                {smartFeedback.ok
                  ? `${t('calendar.repeat_smart_understood')} ${smartFeedback.text}`
                  : smartFeedback.text}
              </Text>
            )}

            {/* Or pick a repeat cadence directly. */}
            <View style={formStyles.chipWrap} accessibilityRole="radiogroup">
              {RECURRENCE_OPTIONS.map(({ label, value }) => {
                const selected = activePreset === value;
                return (
                  <Pressable
                    key={value || 'none'}
                    style={[formStyles.chip, selected && formStyles.chipSelected]}
                    onPress={() => handlePreset(value)}
                    accessibilityRole="radio"
                    accessibilityState={{ selected }}
                  >
                    <Text
                      style={[formStyles.chipText, selected && formStyles.chipTextSelected]}
                      numberOfLines={1}
                    >
                      {label}
                    </Text>
                  </Pressable>
                );
              })}
            </View>

            {/* Custom builder: repeat every N days / weeks / months / years. */}
            {customMode && recurrence !== '' && (
              <View style={formStyles.customBox}>
                <View style={formStyles.customRow}>
                  <Text style={formStyles.customLabel}>{t('calendar.repeat_every')}</Text>
                  <View style={formStyles.stepper}>
                    <Pressable
                      style={[
                        formStyles.stepBtn,
                        recurrenceInterval <= 1 && formStyles.stepBtnDisabled,
                      ]}
                      onPress={() => adjustInterval(-1)}
                      disabled={recurrenceInterval <= 1}
                      accessibilityRole="button"
                      accessibilityLabel={t('calendar.repeat_interval_decrease')}
                    >
                      <Ionicons name="remove" size={18} color={C.primary} />
                    </Pressable>
                    <Text style={formStyles.stepValue}>{recurrenceInterval}</Text>
                    <Pressable
                      style={[
                        formStyles.stepBtn,
                        recurrenceInterval >= MAX_INTERVAL && formStyles.stepBtnDisabled,
                      ]}
                      onPress={() => adjustInterval(1)}
                      disabled={recurrenceInterval >= MAX_INTERVAL}
                      accessibilityRole="button"
                      accessibilityLabel={t('calendar.repeat_interval_increase')}
                    >
                      <Ionicons name="add" size={18} color={C.primary} />
                    </Pressable>
                  </View>
                </View>
                <View style={formStyles.chipWrap}>
                  {CUSTOM_UNITS.map((unit) => {
                    const selected = recurrence === unit;
                    return (
                      <Pressable
                        key={unit}
                        style={[formStyles.chip, selected && formStyles.chipSelected]}
                        onPress={() => setRecurrence(unit)}
                        accessibilityRole="radio"
                        accessibilityState={{ selected }}
                      >
                        <Text
                          style={[formStyles.chipText, selected && formStyles.chipTextSelected]}
                          numberOfLines={1}
                        >
                          {t(
                            `calendar.repeat_unit_${UNIT_NOUN[unit]}${
                              recurrenceInterval === 1 ? '' : 's'
                            }`
                          )}
                        </Text>
                      </Pressable>
                    );
                  })}
                </View>
                <Text style={formStyles.customSummary}>
                  {recurrenceLabel(t, recurrence, recurrenceInterval)}
                </Text>
              </View>
            )}

            {/* Weekly-only: pick the weekdays it lands on (e.g. Mon + Thu). */}
            {recurrence === 'weekly' && (
              <>
                <Text style={[formStyles.label, formStyles.labelGap]}>
                  {t('calendar.repeat_on_days')}{' '}
                  <Text style={formStyles.optional}>({t('common.optional')})</Text>
                </Text>
                <View style={formStyles.dayRow}>
                  {WEEKDAY_KEYS.map((key, dow) => {
                    const selected = recurrenceDays.includes(dow);
                    return (
                      <Pressable
                        key={key}
                        style={[formStyles.dayToggle, selected && formStyles.dayToggleSelected]}
                        onPress={() => toggleDay(dow)}
                        accessibilityRole="checkbox"
                        accessibilityState={{ checked: selected }}
                        accessibilityLabel={t(`calendar.${key}`)}
                      >
                        <Text
                          style={[
                            formStyles.dayToggleText,
                            selected && formStyles.dayToggleTextSelected,
                          ]}
                          numberOfLines={1}
                        >
                          {t(`calendar.${key}`)}
                        </Text>
                      </Pressable>
                    );
                  })}
                </View>
                {recurrenceDays.length === 0 && (
                  <Text style={formStyles.dayHint}>{t('calendar.repeat_on_days_hint')}</Text>
                )}
              </>
            )}

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
            <View style={{ height: ms(16) }} />
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
            title: bill.name,
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
      <View style={styles.flex}>
        <ScrollView
          contentContainerStyle={styles.scroll}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
        >
          <BackLink label={t('common.home')} />
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
              style={[styles.addBtn, { minHeight: ms(44) }]}
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
                { icon: IoniconName; color: string },
              ][]
            ).map(([type, meta]) => (
              <View key={type} style={styles.legendItem}>
                <View style={[styles.legendDot, { backgroundColor: meta.color }]} />
                <Text style={styles.legendLabel}>
                  {t(`calendar.legend_${type.replace('-', '_')}`)}
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
                style={[styles.addDayBtn, { minHeight: ms(44) }]}
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
                        <Ionicons
                          name={TYPE_META[item.type].icon}
                          size={16}
                          color={TYPE_META[item.type].color}
                        />
                      </View>
                      <View style={styles.eventInfo}>
                        <View style={styles.eventTitleRow}>
                          <Text style={styles.eventTitle} numberOfLines={isExpanded ? 0 : 1}>
                            {item.title}
                          </Text>
                          {item.recurrence && (
                            <View style={styles.recurrenceBadge}>
                              <Ionicons name="repeat" size={11} color="#6366f1" />
                              <Text style={styles.recurrenceBadgeText}>
                                {recurrenceLabel(t, item.recurrence, item.recurrenceInterval ?? 1)}
                              </Text>
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
                                  hitSlop={{ left: ms(7), right: ms(7) }}
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
                                  hitSlop={{ left: ms(7), right: ms(7) }}
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
                                hitSlop={{ left: ms(7), right: ms(7) }}
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
                                  hitSlop={{ left: ms(7), right: ms(7) }}
                                  onPress={() => handleEditEvent(item.sourceId)}
                                  accessibilityRole="button"
                                  accessibilityLabel={t('calendar.edit_event_btn')}
                                >
                                  <Ionicons name="pencil-outline" size={16} color={C.primary} />
                                </Pressable>
                                <Pressable
                                  style={styles.iconBtn}
                                  hitSlop={{ left: ms(7), right: ms(7) }}
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
                ItemSeparatorComponent={() => <View style={{ height: ms(8) }} />}
              />
            )}
          </View>
        </ScrollView>
      </View>

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
    scroll: { padding: sizes.md, paddingBottom: ms(60), gap: sizes.md },

    pageHeader: {
      flexDirection: 'row',
      alignItems: 'flex-start',
      justifyContent: 'space-between',
      paddingTop: ms(4),
    },
    pageTitle: { fontSize: mf(28), ...font.extrabold, color: C.textPrimary, letterSpacing: -0.8 },
    pageSubtitle: { fontSize: mf(13), ...font.regular, color: C.textSecondary, marginTop: ms(2) },
    addBtn: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: ms(6),
      backgroundColor: C.primary,
      paddingVertical: ms(11),
      paddingHorizontal: ms(16),
      borderRadius: ms(12),
      shadowColor: '#000',
      shadowOffset: { width: 0, height: ms(2) },
      shadowOpacity: 0.08,
      shadowRadius: 8,
      elevation: 2,
    },
    addBtnText: { fontSize: mf(14), ...font.semibold, color: '#fff' },

    monthHeader: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      paddingHorizontal: sizes.xs,
    },
    monthTitle: { fontSize: mf(20), ...font.extrabold, color: C.textPrimary, letterSpacing: -0.5 },
    navBtn: {
      width: ms(44),
      height: ms(44),
      justifyContent: 'center',
      alignItems: 'center',
      borderRadius: ms(22),
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
    weekRow: { flexDirection: 'row', marginBottom: ms(4) },
    weekDay: {
      flex: 1,
      textAlign: 'center',
      fontSize: mf(10),
      ...font.bold,
      color: C.textSecondary,
      letterSpacing: 0.5,
      paddingVertical: ms(4),
    },
    gridRow: { flexDirection: 'row' },

    dayCell: {
      flex: 1,
      alignItems: 'stretch',
      paddingVertical: ms(2),
      paddingHorizontal: ms(1),
      minHeight: ms(52),
    },
    dayInner: {
      width: ms(26),
      height: ms(26),
      borderRadius: ms(13),
      justifyContent: 'center',
      alignItems: 'center',
      alignSelf: 'center',
      marginBottom: ms(2),
    },
    daySelected: { backgroundColor: C.primary },
    dayToday: { backgroundColor: C.primary + '20' },
    dayNum: { fontSize: mf(12), ...font.medium, color: C.textPrimary },
    dayNumFaint: { color: C.textDisabled },
    dayNumSelected: { color: '#fff', ...font.bold },
    dayNumToday: { color: C.primary, ...font.bold },

    eventChip: {
      borderRadius: ms(3),
      paddingHorizontal: ms(3),
      paddingVertical: ms(1),
      marginBottom: ms(1),
    },
    eventChipText: { fontSize: mf(8), ...font.semibold, color: '#fff', lineHeight: mf(11) },
    moreChip: {
      fontSize: mf(8),
      ...font.regular,
      color: C.textSecondary,
      paddingHorizontal: ms(3),
    },

    legend: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      gap: ms(12),
      backgroundColor: C.surface,
      borderRadius: sizes.borderRadiusLg,
      borderWidth: 1,
      borderColor: C.border,
      padding: sizes.md,
    },
    legendItem: { flexDirection: 'row', alignItems: 'center', gap: ms(6) },
    legendDot: { width: ms(8), height: ms(8), borderRadius: ms(4) },
    legendLabel: { fontSize: mf(12), ...font.medium, color: C.textSecondary },

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
      marginBottom: ms(4),
    },
    eventsSectionTitle: { fontSize: mf(15), ...font.bold, color: C.textPrimary },
    addDayBtn: { flexDirection: 'row', alignItems: 'center', gap: ms(4) },
    addDayBtnText: { fontSize: mf(14), ...font.semibold, color: C.primary },
    emptyDay: { paddingVertical: sizes.lg, alignItems: 'center' },
    emptyDayText: {
      color: C.textSecondary,
      fontSize: mf(14),
      ...font.regular,
      textAlign: 'center',
    },

    eventRow: {
      flexDirection: 'row',
      alignItems: 'flex-start',
      gap: ms(10),
      backgroundColor: C.background,
      borderRadius: ms(10),
      padding: sizes.sm,
    },
    eventRowPersonal: { opacity: 0.75 },
    eventIconWrap: {
      width: ms(36),
      height: ms(36),
      borderRadius: ms(10),
      justifyContent: 'center',
      alignItems: 'center',
      marginTop: ms(2),
    },
    eventInfo: { flex: 1, gap: ms(2), minWidth: 0 },
    eventTitleRow: { flexDirection: 'row', alignItems: 'center', gap: ms(6), flexWrap: 'wrap' },
    eventTitle: { fontSize: mf(14), ...font.semibold, color: C.textPrimary, flex: 1 },
    recurrenceBadge: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: ms(3),
      backgroundColor: '#6366f120',
      paddingHorizontal: ms(6),
      paddingVertical: ms(2),
      borderRadius: ms(6),
    },
    recurrenceBadgeText: { fontSize: mf(10), ...font.semibold, color: '#6366f1' },
    eventTime: { fontSize: mf(12), ...font.semibold, color: C.primary },
    eventDetail: { fontSize: mf(12), ...font.regular, color: C.textSecondary },
    eventNotes: { fontSize: mf(12), ...font.regular, color: C.textSecondary, fontStyle: 'italic' },
    eventRight: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: ms(6),
      paddingTop: ms(2),
      flexShrink: 0,
    },
    eventActions: { flexDirection: 'row', alignItems: 'center', gap: ms(4), marginTop: ms(6) },
    typeBadge: { paddingHorizontal: ms(8), paddingVertical: ms(3), borderRadius: ms(8) },
    typeBadgeText: { fontSize: mf(11), ...font.semibold, textTransform: 'capitalize' },
    iconBtn: { width: ms(30), minHeight: ms(44), justifyContent: 'center', alignItems: 'center' },

    centered: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: ms(20) },
    errorBanner: {
      backgroundColor: C.negative + '15',
      borderRadius: ms(10),
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
      borderTopLeftRadius: ms(24),
      borderTopRightRadius: ms(24),
      padding: ms(24),
      paddingBottom: ms(40),
      gap: ms(12),
      maxHeight: '94%',
    },
    scroll: { flexGrow: 0 },
    handle: {
      width: ms(40),
      height: ms(4),
      borderRadius: ms(2),
      backgroundColor: C.border,
      alignSelf: 'center',
      marginBottom: ms(4),
    },
    title: { fontSize: mf(24), color: C.textPrimary, letterSpacing: -0.3 },
    subtitle: {
      fontSize: mf(12.5),
      ...font.medium,
      color: C.textSecondary,
      marginTop: ms(2),
      marginBottom: ms(2),
    },
    label: { fontSize: mf(13), ...font.semibold, color: C.textPrimary, marginBottom: ms(6) },
    labelGap: { marginTop: ms(14) },
    optional: { ...font.regular, color: C.textSecondary },
    input: {
      borderWidth: 1.5,
      borderColor: C.border,
      borderRadius: ms(12),
      paddingHorizontal: ms(14),
      paddingVertical: ms(12),
      fontSize: mf(15),
      ...font.regular,
      color: C.textPrimary,
      backgroundColor: C.surfaceSecondary,
    },
    notesInput: { minHeight: ms(80), paddingTop: ms(12) },
    addToggle: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: ms(6),
      alignSelf: 'flex-start',
      paddingVertical: ms(8),
      paddingHorizontal: ms(14),
      borderRadius: ms(20),
      borderWidth: 1,
      borderColor: C.primary,
      backgroundColor: C.secondary,
    },
    addToggleText: { fontSize: mf(14), ...font.medium, color: C.primary },
    clearLink: { alignSelf: 'flex-start', marginTop: ms(6) },
    clearLinkText: {
      fontSize: mf(12),
      ...font.regular,
      color: C.textSecondary,
      textDecorationLine: 'underline',
    },
    // Smart "describe it in words" box
    smartRow: { flexDirection: 'row', alignItems: 'center', gap: ms(8) },
    smartInput: { flex: 1, minWidth: 0, marginBottom: 0 },
    smartBtn: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: ms(5),
      backgroundColor: C.primary,
      paddingHorizontal: ms(14),
      borderRadius: ms(12),
      minHeight: ms(48),
    },
    smartBtnText: { fontSize: mf(13), ...font.semibold, color: '#fff' },
    smartFeedback: { fontSize: mf(12.5), ...font.medium, marginTop: ms(8) },
    smartFeedbackOk: { color: C.positive },
    smartFeedbackErr: { color: C.textSecondary },

    // Repeat cadence chips + custom builder
    chipWrap: { flexDirection: 'row', flexWrap: 'wrap', gap: ms(8), marginTop: ms(10) },
    chip: {
      paddingHorizontal: ms(14),
      paddingVertical: ms(9),
      minHeight: 44,
      justifyContent: 'center',
      borderRadius: ms(20),
      borderWidth: 1,
      borderColor: C.border,
      backgroundColor: C.surfaceSecondary,
    },
    chipSelected: { backgroundColor: C.primary, borderColor: C.primary },
    chipText: { fontSize: mf(12.5), ...font.semibold, color: C.textSecondary },
    chipTextSelected: { color: '#fff' },
    customBox: {
      marginTop: ms(12),
      padding: ms(14),
      borderRadius: ms(14),
      borderWidth: 1,
      borderColor: C.border,
      backgroundColor: C.surfaceSecondary,
      gap: ms(4),
    },
    customRow: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      gap: ms(12),
    },
    customLabel: { fontSize: mf(13.5), ...font.semibold, color: C.textPrimary },
    stepper: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: ms(6),
      backgroundColor: C.surface,
      borderRadius: ms(12),
      borderWidth: 1,
      borderColor: C.border,
      padding: ms(4),
    },
    stepBtn: {
      width: 44,
      height: 44,
      justifyContent: 'center',
      alignItems: 'center',
      borderRadius: ms(9),
    },
    stepBtnDisabled: { opacity: 0.35 },
    stepValue: {
      minWidth: ms(28),
      textAlign: 'center',
      fontSize: mf(16),
      ...font.bold,
      color: C.textPrimary,
    },
    customSummary: { fontSize: mf(12.5), ...font.medium, color: C.primary, marginTop: ms(8) },

    // Weekday multi-select (S M T W T F S)
    dayRow: { flexDirection: 'row', flexWrap: 'wrap', gap: ms(5) },
    dayToggle: {
      flexGrow: 1,
      flexBasis: 40,
      minWidth: 44,
      minHeight: 44,
      paddingVertical: ms(8),
      alignItems: 'center',
      justifyContent: 'center',
      borderRadius: ms(10),
      borderWidth: 1,
      borderColor: C.border,
      backgroundColor: C.surfaceSecondary,
    },
    dayToggleSelected: { backgroundColor: C.primary, borderColor: C.primary },
    dayToggleText: { fontSize: mf(11), ...font.semibold, color: C.textSecondary },
    dayToggleTextSelected: { color: '#fff' },
    dayHint: { fontSize: mf(11.5), ...font.regular, color: C.textSecondary, marginTop: ms(6) },

    errorText: { fontSize: mf(13), ...font.regular, color: C.negative },
    btns: { flexDirection: 'row', gap: ms(10), marginTop: ms(4) },
    btnOutline: {
      flex: 1,
      paddingVertical: ms(15),
      borderRadius: ms(14),
      borderWidth: 1.5,
      borderColor: C.border,
      alignItems: 'center',
    },
    btnOutlineText: { fontSize: mf(15), ...font.bold, color: C.textPrimary },
    btnPrimary: {
      flex: 1,
      paddingVertical: ms(15),
      borderRadius: ms(14),
      backgroundColor: C.primary,
      alignItems: 'center',
      shadowColor: C.primary,
      shadowOffset: { width: 0, height: ms(8) },
      shadowOpacity: 0.3,
      shadowRadius: 16,
      elevation: 6,
    },
    btnPrimaryText: { fontSize: mf(15), ...font.bold, color: '#fff' },
    btnDisabled: { opacity: 0.6 },
  });
}
