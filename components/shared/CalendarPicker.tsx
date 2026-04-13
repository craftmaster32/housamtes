import { useState, useMemo, useCallback } from 'react';
import { View, Pressable, StyleSheet } from 'react-native';
import { Text } from 'react-native-paper';
import { Ionicons } from '@expo/vector-icons';
import { colors } from '@constants/colors';
import { font } from '@constants/typography';

const WEEKDAYS = ['Su', 'Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa'];
const MONTHS   = ['January','February','March','April','May','June','July','August','September','October','November','December'];

function toYMD(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

interface CalendarPickerProps {
  value: string;   // YYYY-MM-DD
  onChange: (d: string) => void;
}

export function CalendarPicker({ value, onChange }: CalendarPickerProps): React.JSX.Element {
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
        <Pressable onPress={prevMonth} style={styles.navBtn} accessibilityRole="button">
          <Ionicons name="chevron-back" size={16} color={colors.primary} />
        </Pressable>
        <Text style={styles.monthLabel}>{MONTHS[viewMonth]} {viewYear}</Text>
        <Pressable onPress={nextMonth} style={styles.navBtn} accessibilityRole="button">
          <Ionicons name="chevron-forward" size={16} color={colors.primary} />
        </Pressable>
      </View>

      <View style={styles.weekRow}>
        {WEEKDAYS.map((d) => (
          <Text key={d} style={styles.weekDay}>{d}</Text>
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
  navBtn: { width: 32, height: 32, justifyContent: 'center', alignItems: 'center', borderRadius: 16, backgroundColor: colors.white },
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
