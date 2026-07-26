import { useState, useMemo, useCallback } from 'react';
import { View, Pressable, StyleSheet } from 'react-native';
import { Text } from 'react-native-paper';
import { Ionicons } from '@expo/vector-icons';
import { useTranslation } from 'react-i18next';
import { useThemedColors, type ColorTokens } from '@constants/colors';
import { font } from '@constants/typography';
import { useLanguageStore } from '@stores/languageStore';
import { isRTL, getFirstDayOfWeek } from '@lib/i18n';

const MONTH_KEYS = [
  'cal_month_jan',
  'cal_month_feb',
  'cal_month_mar',
  'cal_month_apr',
  'cal_month_may',
  'cal_month_jun',
  'cal_month_jul',
  'cal_month_aug',
  'cal_month_sep',
  'cal_month_oct',
  'cal_month_nov',
  'cal_month_dec',
] as const;
const DAY_KEYS = [
  'cal_day_sun',
  'cal_day_mon',
  'cal_day_tue',
  'cal_day_wed',
  'cal_day_thu',
  'cal_day_fri',
  'cal_day_sat',
] as const;

function toYMD(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

interface CalendarPickerProps {
  value: string; // YYYY-MM-DD
  onChange: (d: string) => void;
}

export function CalendarPicker({ value, onChange }: CalendarPickerProps): React.JSX.Element {
  const { t } = useTranslation();
  const c = useThemedColors();
  const styles = useMemo(() => makeStyles(c), [c]);
  const language = useLanguageStore((s) => s.language);
  const rtl = isRTL(language);
  const firstDay = getFirstDayOfWeek(language);
  const today = new Date();
  const initDate = value ? new Date(value + 'T12:00:00') : today;
  const [viewYear, setViewYear] = useState(initDate.getFullYear());
  const [viewMonth, setViewMonth] = useState(initDate.getMonth());

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

  const grid = useMemo((): Date[] => {
    const first = new Date(viewYear, viewMonth, 1);
    const start = new Date(first);
    // Shift the leading day so column 0 is the locale's first day of the week.
    start.setDate(1 - ((first.getDay() - firstDay + 7) % 7));
    const days: Date[] = [];
    for (let i = 0; i < 35; i++) {
      const d = new Date(start);
      d.setDate(start.getDate() + i);
      days.push(d);
    }
    return days;
  }, [viewYear, viewMonth, firstDay]);

  // Weekday headers, rotated to begin on the locale's first day of week.
  const orderedDayKeys = useMemo(
    () => [...DAY_KEYS.slice(firstDay), ...DAY_KEYS.slice(0, firstDay)],
    [firstDay]
  );

  const todayStr = toYMD(today);

  return (
    <View style={styles.picker}>
      <View style={styles.header}>
        <Pressable
          onPress={prevMonth}
          style={styles.navBtn}
          accessibilityRole="button"
          accessibilityLabel={t('dashboard.prev_month')}
        >
          <Ionicons name={rtl ? 'chevron-forward' : 'chevron-back'} size={16} color={c.primary} />
        </Pressable>
        <Text style={styles.monthLabel}>
          {t(`dashboard.${MONTH_KEYS[viewMonth]}`)} {viewYear}
        </Text>
        <Pressable
          onPress={nextMonth}
          style={styles.navBtn}
          accessibilityRole="button"
          accessibilityLabel={t('dashboard.next_month')}
        >
          <Ionicons name={rtl ? 'chevron-back' : 'chevron-forward'} size={16} color={c.primary} />
        </Pressable>
      </View>

      <View style={styles.weekRow}>
        {orderedDayKeys.map((dk) => (
          <Text key={dk} style={styles.weekDay}>
            {t(`dashboard.${dk}`)}
          </Text>
        ))}
      </View>

      {[0, 1, 2, 3, 4].map((row) => (
        <View key={row} style={styles.gridRow}>
          {grid.slice(row * 7, row * 7 + 7).map((day, idx) => {
            const ymd = toYMD(day);
            const isSelected = ymd === value;
            const isToday = ymd === todayStr;
            const inMonth = day.getMonth() === viewMonth;
            const dayLabel = `${t(`dashboard.${MONTH_KEYS[day.getMonth()]}`)} ${day.getDate()}, ${day.getFullYear()}`;
            return (
              <Pressable
                key={idx}
                style={styles.dayCell}
                onPress={() => onChange(ymd)}
                // hitSlop lifts the effective tap target to ~44pt without changing the tight grid layout
                hitSlop={{ top: 6, bottom: 6 }}
                accessible
                accessibilityRole="button"
                accessibilityLabel={dayLabel}
                accessibilityState={{ selected: isSelected }}
              >
                <View
                  style={[
                    styles.dayInner,
                    isSelected && styles.daySelected,
                    isToday && !isSelected && styles.dayToday,
                  ]}
                >
                  <Text
                    style={[
                      styles.dayNum,
                      !inMonth && styles.dayFaint,
                      isSelected && styles.dayNumSelected,
                      isToday && !isSelected && styles.dayNumToday,
                    ]}
                  >
                    {day.getDate()}
                  </Text>
                </View>
              </Pressable>
            );
          })}
        </View>
      ))}
    </View>
  );
}

const makeStyles = (C: ColorTokens): ReturnType<typeof StyleSheet.create> =>
  StyleSheet.create({
    picker: {
      backgroundColor: C.surfaceSecondary,
      borderRadius: 14,
      borderWidth: 1,
      borderColor: C.border,
      padding: 10,
    },
    header: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      marginBottom: 6,
    },
    navBtn: {
      width: 44,
      height: 44,
      justifyContent: 'center',
      alignItems: 'center',
      borderRadius: 22,
      backgroundColor: C.surface,
    },
    monthLabel: { fontSize: 14, ...font.bold, color: C.textPrimary },
    weekRow: { flexDirection: 'row', marginBottom: 2 },
    weekDay: {
      flex: 1,
      textAlign: 'center',
      fontSize: 10,
      ...font.bold,
      color: C.textSecondary,
      paddingVertical: 2,
    },
    gridRow: { flexDirection: 'row' },
    dayCell: { flex: 1, alignItems: 'center', paddingVertical: 2 },
    dayInner: {
      width: 32,
      height: 32,
      borderRadius: 16,
      justifyContent: 'center',
      alignItems: 'center',
    },
    daySelected: { backgroundColor: C.primary },
    dayToday: { backgroundColor: C.primary + '20' },
    dayNum: { fontSize: 13, ...font.medium, color: C.textPrimary },
    dayFaint: { color: C.textDisabled },
    dayNumSelected: { color: '#fff', ...font.bold },
    dayNumToday: { color: C.primary, ...font.bold },
  });
