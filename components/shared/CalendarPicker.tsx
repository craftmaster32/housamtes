import { useState, useMemo, useCallback } from 'react';
import { View, Pressable, StyleSheet } from 'react-native';
import { Text } from 'react-native-paper';
import { Ionicons } from '@expo/vector-icons';
import { useTranslation } from 'react-i18next';
import { colors } from '@constants/colors';
import { font } from '@constants/typography';
import { useLanguageStore } from '@stores/languageStore';
import { isRTL } from '@lib/i18n';

const MONTH_KEYS = ['cal_month_jan','cal_month_feb','cal_month_mar','cal_month_apr','cal_month_may','cal_month_jun','cal_month_jul','cal_month_aug','cal_month_sep','cal_month_oct','cal_month_nov','cal_month_dec'] as const;
const DAY_KEYS = ['cal_day_sun', 'cal_day_mon', 'cal_day_tue', 'cal_day_wed', 'cal_day_thu', 'cal_day_fri', 'cal_day_sat'] as const;

function toYMD(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

interface CalendarPickerProps {
  value: string;   // YYYY-MM-DD
  onChange: (d: string) => void;
}

export function CalendarPicker({ value, onChange }: CalendarPickerProps): React.JSX.Element {
  const { t } = useTranslation();
  const language = useLanguageStore((s) => s.language);
  const rtl = isRTL(language);
  const today = new Date();
  const initDate = value ? new Date(value + 'T12:00:00') : today;
  const [viewYear, setViewYear]   = useState(initDate.getFullYear());
  const [viewMonth, setViewMonth] = useState(initDate.getMonth());

  const prevMonth = useCallback((): void => {
    if (viewMonth === 0) { setViewYear((y) => y - 1); setViewMonth(11); }
    else setViewMonth((m) => m - 1);
  }, [viewMonth]);

  const nextMonth = useCallback((): void => {
    if (viewMonth === 11) { setViewYear((y) => y + 1); setViewMonth(0); }
    else setViewMonth((m) => m + 1);
  }, [viewMonth]);

  const grid = useMemo((): Date[] => {
    const first = new Date(viewYear, viewMonth, 1);
    const start = new Date(first);
    start.setDate(1 - first.getDay());
    const days: Date[] = [];
    for (let i = 0; i < 35; i++) {
      const d = new Date(start);
      d.setDate(start.getDate() + i);
      days.push(d);
    }
    return days;
  }, [viewYear, viewMonth]);

  const todayStr = toYMD(today);

  return (
    <View style={styles.picker}>
      <View style={styles.header}>
        <Pressable onPress={prevMonth} style={styles.navBtn} accessibilityRole="button" accessibilityLabel={t('dashboard.prev_month')}>
          <Ionicons name={rtl ? 'chevron-forward' : 'chevron-back'} size={16} color={colors.primary} />
        </Pressable>
        <Text style={styles.monthLabel}>{t(`dashboard.${MONTH_KEYS[viewMonth]}`)} {viewYear}</Text>
        <Pressable onPress={nextMonth} style={styles.navBtn} accessibilityRole="button" accessibilityLabel={t('dashboard.next_month')}>
          <Ionicons name={rtl ? 'chevron-back' : 'chevron-forward'} size={16} color={colors.primary} />
        </Pressable>
      </View>

      <View style={styles.weekRow}>
        {DAY_KEYS.map((dk) => (
          <Text key={dk} style={styles.weekDay}>{t(`dashboard.${dk}`)}</Text>
        ))}
      </View>

      {[0, 1, 2, 3, 4].map((row) => (
        <View key={row} style={styles.gridRow}>
          {grid.slice(row * 7, row * 7 + 7).map((day, idx) => {
            const ymd = toYMD(day);
            const isSelected = ymd === value;
            const isToday    = ymd === todayStr;
            const inMonth    = day.getMonth() === viewMonth;
            return (
              <Pressable
                key={idx}
                style={styles.dayCell}
                onPress={() => onChange(ymd)}
                accessibilityRole="button"
              >
                <View style={[
                  styles.dayInner,
                  isSelected && styles.daySelected,
                  isToday && !isSelected && styles.dayToday,
                ]}>
                  <Text style={[
                    styles.dayNum,
                    !inMonth && styles.dayFaint,
                    isSelected && styles.dayNumSelected,
                    isToday && !isSelected && styles.dayNumToday,
                  ]}>
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

const styles = StyleSheet.create({
  picker: { backgroundColor: colors.surfaceSecondary, borderRadius: 14, borderWidth: 1, borderColor: colors.border, padding: 10 },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 6 },
  navBtn: { width: 44, height: 44, justifyContent: 'center', alignItems: 'center', borderRadius: 22, backgroundColor: colors.white },
  monthLabel: { fontSize: 14, ...font.bold, color: colors.textPrimary },
  weekRow: { flexDirection: 'row', marginBottom: 2 },
  weekDay: { flex: 1, textAlign: 'center', fontSize: 10, ...font.bold, color: colors.textSecondary, paddingVertical: 2 },
  gridRow: { flexDirection: 'row' },
  dayCell: { flex: 1, alignItems: 'center', paddingVertical: 2 },
  dayInner: { width: 32, height: 32, borderRadius: 16, justifyContent: 'center', alignItems: 'center' },
  daySelected: { backgroundColor: colors.primary },
  dayToday: { backgroundColor: colors.primary + '20' },
  dayNum: { fontSize: 13, ...font.medium, color: colors.textPrimary },
  dayFaint: { color: colors.textDisabled },
  dayNumSelected: { color: colors.white, ...font.bold },
  dayNumToday: { color: colors.primary, ...font.bold },
});
