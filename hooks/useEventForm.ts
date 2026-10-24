import { useState, useCallback, useEffect, type Dispatch, type SetStateAction } from 'react';
import { Keyboard } from 'react-native';
import { useTranslation } from 'react-i18next';
import {
  useEventsStore,
  type HouseEvent,
  type EventRecurrence,
  type EventUpdates,
} from '@stores/eventsStore';
import { useAuthStore } from '@stores/authStore';
import { useCalendarSyncStore } from '@stores/calendarSyncStore';
import { parseRepeatText } from '@utils/repeatParser';
import { normalizeInterval, normalizeWeekdays } from '@utils/events';
import { MAX_INTERVAL, type RepeatPreset } from '@components/calendar/RepeatFields';
import { WEEKDAY_KEYS, formatShortDate, recurrenceLabel } from '@components/calendar/calendarMeta';

interface UseEventFormArgs {
  visible: boolean;
  initialDate: string;
  editingEvent?: HouseEvent;
  onClose: () => void;
}

interface SmartFeedback {
  ok: boolean;
  text: string;
}

export interface EventForm {
  title: string;
  setTitle: Dispatch<SetStateAction<string>>;
  date: string;
  setDate: Dispatch<SetStateAction<string>>;
  showEndDate: boolean;
  setShowEndDate: Dispatch<SetStateAction<boolean>>;
  endDate: string;
  setEndDate: Dispatch<SetStateAction<string>>;
  startTime: string;
  setStartTime: Dispatch<SetStateAction<string>>;
  endTime: string;
  setEndTime: Dispatch<SetStateAction<string>>;
  notes: string;
  setNotes: Dispatch<SetStateAction<string>>;
  recurrence: EventRecurrence | '';
  setRecurrence: Dispatch<SetStateAction<EventRecurrence | ''>>;
  recurrenceInterval: number;
  setRecurrenceInterval: Dispatch<SetStateAction<number>>;
  recurrenceDays: number[];
  setRecurrenceDays: Dispatch<SetStateAction<number[]>>;
  customMode: boolean;
  setCustomMode: Dispatch<SetStateAction<boolean>>;
  smartText: string;
  setSmartText: Dispatch<SetStateAction<string>>;
  smartFeedback: SmartFeedback | null;
  setSmartFeedback: Dispatch<SetStateAction<SmartFeedback | null>>;
  showRecEnd: boolean;
  setShowRecEnd: Dispatch<SetStateAction<boolean>>;
  recurrenceEnd: string;
  setRecurrenceEnd: Dispatch<SetStateAction<string>>;
  saving: boolean;
  setSaving: Dispatch<SetStateAction<boolean>>;
  error: string;
  setError: Dispatch<SetStateAction<string>>;
  handleClose: () => void;
  handleSave: () => Promise<void>;
  handlePreset: (value: RepeatPreset) => void;
  adjustInterval: (delta: number) => void;
  toggleDay: (dow: number) => void;
  handleApplySmart: () => void;
  activePreset: RepeatPreset;
}

/** State and save logic for the add / edit event sheet. */
export function useEventForm({
  visible,
  initialDate,
  editingEvent,
  onClose,
}: UseEventFormArgs): EventForm {
  const { t, i18n } = useTranslation();
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
  const [smartFeedback, setSmartFeedback] = useState<SmartFeedback | null>(null);
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

  return {
    title,
    setTitle,
    date,
    setDate,
    showEndDate,
    setShowEndDate,
    endDate,
    setEndDate,
    startTime,
    setStartTime,
    endTime,
    setEndTime,
    notes,
    setNotes,
    recurrence,
    setRecurrence,
    recurrenceInterval,
    setRecurrenceInterval,
    recurrenceDays,
    setRecurrenceDays,
    customMode,
    setCustomMode,
    smartText,
    setSmartText,
    smartFeedback,
    setSmartFeedback,
    showRecEnd,
    setShowRecEnd,
    recurrenceEnd,
    setRecurrenceEnd,
    saving,
    setSaving,
    error,
    setError,
    handleClose,
    handleSave,
    handlePreset,
    adjustInterval,
    toggleDay,
    handleApplySmart,
    activePreset,
  };
}
