import { useState, useEffect, useCallback, useMemo } from 'react';
import { View, StyleSheet } from 'react-native';
import { Text } from 'react-native-paper';
import { format } from 'date-fns';
import { useTranslation } from 'react-i18next';
import { useThemedColors } from '@constants/colors';
import { getDateFnsLocale } from '@utils/dates';
import { DatePickerModal } from '@components/bills/DatePickerModal';
import { LineField } from '@components/parking/LineField';
import { TimePickerModal } from '@components/parking/TimePickerModal';

import { mf, ms } from '@utils/responsive';
export interface ReminderDateTimeFieldProps {
  /** Resets to the next rounded default (now + 30 min) whenever this flips to true. */
  visible: boolean;
  /** Must be a stable reference (e.g. a useState setter or useCallback) — an inline function re-triggers the reset effect on every render. */
  onChange: (remindAtIso: string | null) => void;
}

function pad(n: number): string {
  return String(n).padStart(2, '0');
}

// Derives both the date and rounded time from a single Date instance so they
// never drift apart across a midnight boundary (e.g. date="today" + time
// rolled into "00:15" from two separate `new Date()` calls).
function nextRoundedDefault(): { date: string; time: string } {
  const now = new Date();
  now.setMinutes(now.getMinutes() + 30);
  return {
    date: `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`,
    time: `${pad(now.getHours())}:${pad(Math.floor(now.getMinutes() / 5) * 5)}`,
  };
}

function toIso(date: string, time: string): string | null {
  if (!date || !time) return null;
  const [y, m, d] = date.split('-').map(Number);
  const [h, min] = time.split(':').map(Number);
  const dt = new Date(y, (m ?? 1) - 1, d ?? 1, h ?? 0, min ?? 0);
  return isNaN(dt.getTime()) ? null : dt.toISOString();
}

export function ReminderDateTimeField({
  visible,
  onChange,
}: ReminderDateTimeFieldProps): React.JSX.Element {
  const { t, i18n } = useTranslation();
  const C = useThemedColors();
  const s = useMemo(() => makeStyles(), []);

  const initial = nextRoundedDefault();
  const [date, setDate] = useState(initial.date);
  const [time, setTime] = useState(initial.time);
  const [showDatePicker, setShowDatePicker] = useState(false);

  const remindAtIso = useMemo(() => toIso(date, time), [date, time]);

  // Declared before the visible-reset effect so, within the same commit, the
  // reset effect's onChange call (with the freshly reset value) always runs
  // last — this is what prevents a stale/past remindAtIso from being the one
  // the parent ends up with when the modal reopens.
  useEffect(() => {
    onChange(remindAtIso);
  }, [remindAtIso, onChange]);

  useEffect(() => {
    if (visible) {
      const next = nextRoundedDefault();
      setDate(next.date);
      setTime(next.time);
      onChange(toIso(next.date, next.time));
    }
  }, [visible, onChange]);

  const isFuture = remindAtIso !== null && new Date(remindAtIso).getTime() > Date.now();

  const dateFnsLocale = getDateFnsLocale(i18n.language);
  const [dy, dm, dd] = date.split('-').map(Number);
  const displayDate = format(new Date(dy, (dm ?? 1) - 1, dd ?? 1), 'EEE, MMM d', {
    locale: dateFnsLocale,
  });

  const openDatePicker = useCallback(() => setShowDatePicker(true), []);
  const closeDatePicker = useCallback(() => setShowDatePicker(false), []);

  const [showTimePicker, setShowTimePicker] = useState(false);
  const openTimePicker = useCallback(() => setShowTimePicker(true), []);
  const closeTimePicker = useCallback(() => setShowTimePicker(false), []);
  const clearTime = useCallback(() => {
    setTime('');
    setShowTimePicker(false);
  }, []);

  // Date and time written on lines, like the Parking reserve form.
  return (
    <>
      <View style={s.row}>
        <View style={s.col}>
          <LineField
            label={t('grocery.reminder_date')}
            value={displayDate}
            icon="calendar-outline"
            onPress={openDatePicker}
            accessibilityHint={t('bills.pick_date')}
          />
        </View>
        <View style={s.col}>
          <LineField
            label={t('grocery.reminder_time')}
            value={time}
            placeholder="--:--"
            icon="time-outline"
            onPress={openTimePicker}
          />
        </View>
      </View>

      {!isFuture && (
        <Text style={[s.errorText, { color: C.danger }]}>
          {t('grocery.reminder_must_be_future')}
        </Text>
      )}

      <DatePickerModal
        visible={showDatePicker}
        value={date}
        onSelect={setDate}
        onClose={closeDatePicker}
      />
      <TimePickerModal
        visible={showTimePicker}
        title={t('grocery.reminder_time')}
        value={time || nextRoundedDefault().time}
        onSelect={setTime}
        onClear={clearTime}
        onClose={closeTimePicker}
      />
    </>
  );
}

function makeStyles(): ReturnType<typeof StyleSheet.create> {
  return StyleSheet.create({
    row: { flexDirection: 'row', gap: ms(16) },
    col: { flex: 1 },
    errorText: { fontSize: mf(12.5) },
  });
}
