import { useState, useCallback, useEffect } from 'react';
import { View, Modal, Pressable, StyleSheet } from 'react-native';
import { Text } from 'react-native-paper';
import { Ionicons } from '@expo/vector-icons';
import { useTranslation } from 'react-i18next';
import { colors } from '@constants/colors';
import { font } from '@constants/typography';
import { sizes } from '@constants/sizes';

function getMonthName(year: number, month: number, locale: string): string {
  return new Intl.DateTimeFormat(locale, { month: 'long' }).format(new Date(year, month));
}

// First day of week per locale: 0 = Sunday, 1 = Monday
const LOCALE_FIRST_DAY: Record<string, number> = {
  en: 0,
  he: 0, // Israel starts on Sunday
  es: 1, // Spain / Latin America start on Monday
};

function getFirstDay(locale: string): number {
  return LOCALE_FIRST_DAY[locale] ?? 0;
}

function getDayLabels(locale: string): string[] {
  const firstDay = getFirstDay(locale);
  // Jan 7 2024 is a Sunday (dow 0); offset by firstDay to start the row correctly
  return Array.from({ length: 7 }, (_, i) =>
    new Intl.DateTimeFormat(locale, { weekday: 'short' }).format(new Date(2024, 0, 7 + firstDay + i))
  );
}

function pad(n: number): string {
  return String(n).padStart(2, '0');
}

export interface DatePickerModalProps {
  visible: boolean;
  value: string; // YYYY-MM-DD
  onSelect: (date: string) => void;
  onClose: () => void;
}

export function DatePickerModal({ visible, value, onSelect, onClose }: DatePickerModalProps): React.JSX.Element {
  const { t, i18n } = useTranslation();

  function parseValue(v: string): { year: number; month: number; day: number } {
    const m = v.match(/^(\d{4})-(\d{2})-(\d{2})$/);
    const now = new Date();
    return m
      ? { year: parseInt(m[1]), month: parseInt(m[2]) - 1, day: parseInt(m[3]) }
      : { year: now.getFullYear(), month: now.getMonth(), day: now.getDate() };
  }

  const init = parseValue(value);
  const [viewYear, setViewYear] = useState(init.year);
  const [viewMonth, setViewMonth] = useState(init.month);
  const [localSel, setLocalSel] = useState({ y: init.year, m: init.month, d: init.day });

  // Sync picker state each time the modal opens so form resets are reflected
  useEffect(() => {
    if (visible) {
      const { year, month, day } = parseValue(value);
      setViewYear(year);
      setViewMonth(month);
      setLocalSel({ y: year, m: month, d: day });
    }
  // value and visible are the only inputs that should trigger a re-sync
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [visible]);

  const daysInMonth = new Date(viewYear, viewMonth + 1, 0).getDate();
  const locale = i18n.language;
  const firstDay = getFirstDay(locale);
  // Shift the raw Sunday-based weekday so column 0 = locale's first day of week
  const firstDow = (new Date(viewYear, viewMonth, 1).getDay() - firstDay + 7) % 7;

  const prevMonth = useCallback(() => {
    setViewMonth((m) => {
      if (m === 0) { setViewYear((y) => y - 1); return 11; }
      return m - 1;
    });
  }, []);

  const nextMonth = useCallback(() => {
    setViewMonth((m) => {
      if (m === 11) { setViewYear((y) => y + 1); return 0; }
      return m + 1;
    });
  }, []);

  const pickDay = useCallback((day: number) => {
    setLocalSel({ y: viewYear, m: viewMonth, d: day });
  }, [viewYear, viewMonth]);

  const confirm = useCallback(() => {
    onSelect(`${localSel.y}-${pad(localSel.m + 1)}-${pad(localSel.d)}`);
    onClose();
  }, [localSel, onSelect, onClose]);

  // Build grid: leading empty cells + day numbers
  const cells: Array<number | null> = [
    ...Array.from({ length: firstDow }, () => null),
    ...Array.from({ length: daysInMonth }, (_, i) => i + 1),
  ];
  while (cells.length % 7 !== 0) cells.push(null);

  const isSelected = (day: number): boolean =>
    localSel.y === viewYear && localSel.m === viewMonth && localSel.d === day;

  const isToday = (day: number): boolean => {
    const now = new Date();
    return now.getFullYear() === viewYear && now.getMonth() === viewMonth && now.getDate() === day;
  };

  const dayLabels = getDayLabels(locale);
  const monthLabel = getMonthName(viewYear, viewMonth, locale);

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <Pressable style={styles.overlay} onPress={onClose}>
        <Pressable style={styles.card} onPress={(e) => e.stopPropagation()}>

          {/* Month nav */}
          <View style={styles.navRow}>
            <Pressable
              style={styles.navBtn}
              onPress={prevMonth}
              accessible
              accessibilityRole="button"
              accessibilityLabel={t('bills.prev_month')}
              accessibilityState={{ disabled: false }}
            >
              <Ionicons name="chevron-back" size={20} color={colors.textPrimary} />
            </Pressable>
            <Text style={styles.monthLabel}>{monthLabel} {viewYear}</Text>
            <Pressable
              style={styles.navBtn}
              onPress={nextMonth}
              accessible
              accessibilityRole="button"
              accessibilityLabel={t('bills.next_month')}
              accessibilityState={{ disabled: false }}
            >
              <Ionicons name="chevron-forward" size={20} color={colors.textPrimary} />
            </Pressable>
          </View>

          {/* Day-of-week headers */}
          <View style={styles.dowRow}>
            {dayLabels.map((d) => (
              <Text key={d} style={styles.dowLabel}>{d}</Text>
            ))}
          </View>

          {/* Day grid */}
          <View style={styles.grid}>
            {cells.map((day, idx) => (
              <View key={idx} style={styles.cell}>
                {day !== null && (
                  <Pressable
                    style={[styles.dayBtn, isSelected(day) && styles.dayBtnSelected, isToday(day) && !isSelected(day) && styles.dayBtnToday]}
                    onPress={() => pickDay(day)}
                    // hitSlop extends the effective tap area to 44×44 without affecting layout
                    hitSlop={{ top: 5, bottom: 5, left: 5, right: 5 }}
                    accessibilityRole="button"
                    accessibilityLabel={`${day} ${monthLabel} ${viewYear}`}
                    accessibilityState={{ selected: isSelected(day) }}
                  >
                    <Text style={[styles.dayText, isSelected(day) && styles.dayTextSelected, isToday(day) && !isSelected(day) && styles.dayTextToday]}>
                      {day}
                    </Text>
                  </Pressable>
                )}
              </View>
            ))}
          </View>

          {/* Actions */}
          <View style={styles.actions}>
            <Pressable
              style={styles.cancelBtn}
              onPress={onClose}
              accessible
              accessibilityRole="button"
              accessibilityLabel={t('common.cancel')}
              accessibilityState={{ disabled: false }}
            >
              <Text style={styles.cancelText}>{t('common.cancel')}</Text>
            </Pressable>
            <Pressable
              style={styles.confirmBtn}
              onPress={confirm}
              accessible
              accessibilityRole="button"
              accessibilityLabel={t('common.confirm')}
              accessibilityState={{ disabled: false }}
            >
              <Text style={styles.confirmText}>{t('common.confirm')}</Text>
            </Pressable>
          </View>

        </Pressable>
      </Pressable>
    </Modal>
  );
}

const CELL = 40;

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.45)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
  },
  card: {
    width: '100%',
    maxWidth: 340,
    backgroundColor: colors.white,
    borderRadius: 20,
    padding: sizes.lg,
    gap: sizes.sm,
  },
  navRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 4,
  },
  navBtn: {
    width: 44, height: 44, borderRadius: 10,
    backgroundColor: colors.surfaceSecondary,
    justifyContent: 'center', alignItems: 'center',
  },
  monthLabel: { fontSize: 16, ...font.bold, color: colors.textPrimary },
  dowRow: { flexDirection: 'row' },
  dowLabel: {
    width: CELL, textAlign: 'center',
    fontSize: 12, ...font.semibold, color: colors.textSecondary,
    paddingVertical: 4,
  },
  grid: { flexDirection: 'row', flexWrap: 'wrap' },
  cell: { width: CELL, height: CELL, justifyContent: 'center', alignItems: 'center' },
  dayBtn: {
    width: 34, height: 34, borderRadius: 17,
    justifyContent: 'center', alignItems: 'center',
  },
  dayBtnSelected: { backgroundColor: colors.primary },
  dayBtnToday: { borderWidth: 1.5, borderColor: colors.primary },
  dayText: { fontSize: 14, ...font.medium, color: colors.textPrimary },
  dayTextSelected: { color: colors.white, ...font.bold },
  dayTextToday: { color: colors.primary, ...font.bold },
  actions: { flexDirection: 'row', gap: sizes.sm, marginTop: 4 },
  cancelBtn: {
    flex: 1, paddingVertical: 12, minHeight: 44, borderRadius: 12,
    backgroundColor: colors.surfaceSecondary,
    alignItems: 'center', justifyContent: 'center',
  },
  cancelText: { fontSize: 15, ...font.semibold, color: colors.textPrimary },
  confirmBtn: {
    flex: 1, paddingVertical: 12, minHeight: 44, borderRadius: 12,
    backgroundColor: colors.primary,
    alignItems: 'center', justifyContent: 'center',
  },
  confirmText: { fontSize: 15, ...font.semibold, color: colors.white },
});
