import { useState, useCallback, useEffect, useMemo } from 'react';
import { View, Modal, Pressable, StyleSheet } from 'react-native';
import { Text } from 'react-native-paper';
import { Ionicons } from '@expo/vector-icons';
import { useTranslation } from 'react-i18next';
import { useThemedColors, type ColorTokens } from '@constants/colors';
import { font } from '@constants/typography';
import { useHeadingFont } from '@hooks/useHeadingFont';
import { sizes } from '@constants/sizes';
import { isRTL, getFirstDayOfWeek } from '@lib/i18n';
import { useLanguageStore } from '@stores/languageStore';

import { mf, ms } from '@utils/responsive';
import { PenCircle } from '@components/shared/PenCircle';
function getMonthName(year: number, month: number, locale: string): string {
  return new Intl.DateTimeFormat(locale, { month: 'long' }).format(new Date(year, month));
}

function getDayLabels(locale: string): string[] {
  const firstDay = getFirstDayOfWeek(locale);
  // Jan 7 2024 is a Sunday (dow 0); offset by firstDay to start the row correctly
  return Array.from({ length: 7 }, (_, i) =>
    new Intl.DateTimeFormat(locale, { weekday: 'short' }).format(
      new Date(2024, 0, 7 + firstDay + i)
    )
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

export function DatePickerModal({
  visible,
  value,
  onSelect,
  onClose,
}: DatePickerModalProps): React.JSX.Element {
  const { t, i18n } = useTranslation();
  const c = useThemedColors();
  const styles = useMemo(() => makeStyles(c), [c]);
  const headingFont = useHeadingFont('semibold');
  const language = useLanguageStore((s) => s.language);
  const rtl = isRTL(language);

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
  const firstDay = getFirstDayOfWeek(locale);
  // Shift the raw Sunday-based weekday so column 0 = locale's first day of week
  const firstDow = (new Date(viewYear, viewMonth, 1).getDay() - firstDay + 7) % 7;

  const prevMonth = useCallback(() => {
    if (viewMonth === 0) {
      setViewYear((y) => y - 1);
      setViewMonth(11);
    } else {
      setViewMonth((m) => m - 1);
    }
  }, [viewMonth]);

  const nextMonth = useCallback(() => {
    if (viewMonth === 11) {
      setViewYear((y) => y + 1);
      setViewMonth(0);
    } else {
      setViewMonth((m) => m + 1);
    }
  }, [viewMonth]);

  const pickDay = useCallback(
    (day: number) => {
      setLocalSel({ y: viewYear, m: viewMonth, d: day });
    },
    [viewYear, viewMonth]
  );

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
              <Ionicons
                name={rtl ? 'chevron-forward' : 'chevron-back'}
                size={20}
                color={c.textPrimary}
              />
            </Pressable>
            <Text style={[styles.monthLabel, headingFont]}>
              {monthLabel} {viewYear}
            </Text>
            <Pressable
              style={styles.navBtn}
              onPress={nextMonth}
              accessible
              accessibilityRole="button"
              accessibilityLabel={t('bills.next_month')}
              accessibilityState={{ disabled: false }}
            >
              <Ionicons
                name={rtl ? 'chevron-back' : 'chevron-forward'}
                size={20}
                color={c.textPrimary}
              />
            </Pressable>
          </View>

          {/* Day-of-week headers */}
          <View style={styles.dowRow}>
            {dayLabels.map((d) => (
              <Text key={d} style={styles.dowLabel}>
                {d}
              </Text>
            ))}
          </View>

          {/* Day grid */}
          <View style={styles.grid}>
            {cells.map((day, idx) => (
              <View key={idx} style={styles.cell}>
                {day !== null && (
                  <Pressable
                    style={styles.dayBtn}
                    onPress={() => pickDay(day)}
                    // hitSlop extends the effective tap area to 44×44 without affecting layout
                    hitSlop={{ top: ms(5), bottom: ms(5), left: ms(5), right: ms(5) }}
                    accessibilityRole="button"
                    accessibilityLabel={`${day} ${monthLabel} ${viewYear}`}
                    accessibilityState={{ selected: isSelected(day) }}
                  >
                    {/* The chosen day is circled in pen. */}
                    {isSelected(day) && (
                      <PenCircle color={c.primary} style={styles.dayCircle} strokeWidth={2.5} />
                    )}
                    <Text
                      style={[
                        styles.dayText,
                        isSelected(day) && styles.dayTextSelected,
                        isToday(day) && !isSelected(day) && styles.dayTextToday,
                      ]}
                    >
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

const CELL = ms(40);

const makeStyles = (C: ColorTokens): ReturnType<typeof StyleSheet.create> =>
  StyleSheet.create({
    overlay: {
      flex: 1,
      backgroundColor: 'rgba(0,0,0,0.45)',
      justifyContent: 'center',
      alignItems: 'center',
      padding: ms(24),
    },
    card: {
      width: '100%',
      maxWidth: ms(340),
      backgroundColor: C.background,
      borderRadius: ms(26),
      padding: sizes.lg,
      gap: sizes.sm,
      shadowColor: '#000',
      shadowOffset: { width: 0, height: ms(12) },
      shadowOpacity: 0.18,
      shadowRadius: 28,
      elevation: 10,
    },
    navRow: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      marginBottom: ms(4),
    },
    navBtn: {
      width: 44,
      height: 44,
      borderRadius: 22,
      backgroundColor: C.surface,
      justifyContent: 'center',
      alignItems: 'center',
    },
    monthLabel: { fontSize: mf(22), letterSpacing: -0.4, color: C.textPrimary },
    dowRow: { flexDirection: 'row' },
    dowLabel: {
      width: CELL,
      textAlign: 'center',
      fontSize: mf(12),
      ...font.semibold,
      color: C.textSecondary,
      paddingVertical: ms(4),
    },
    grid: { flexDirection: 'row', flexWrap: 'wrap' },
    cell: { width: CELL, height: CELL, justifyContent: 'center', alignItems: 'center' },
    dayBtn: {
      width: ms(34),
      height: ms(34),
      borderRadius: ms(17),
      justifyContent: 'center',
      alignItems: 'center',
    },
    dayCircle: {
      position: 'absolute',
      top: -ms(1),
      bottom: -ms(1),
      left: -ms(3),
      right: -ms(3),
      transform: [{ rotate: '-8deg' }],
    },
    dayText: { fontSize: mf(15), ...font.semibold, color: C.textPrimary },
    dayTextSelected: { color: C.primary, ...font.extrabold },
    dayTextToday: { color: C.primary, ...font.extrabold, textDecorationLine: 'underline' },
    actions: {
      flexDirection: 'row',
      gap: sizes.sm,
      marginTop: ms(6),
      alignItems: 'center',
      justifyContent: 'flex-end',
    },
    cancelBtn: {
      minHeight: 44,
      paddingHorizontal: ms(16),
      alignItems: 'center',
      justifyContent: 'center',
    },
    cancelText: { fontSize: mf(16), ...font.bold, color: C.primary },
    confirmBtn: {
      minHeight: ms(50),
      paddingHorizontal: ms(26),
      borderRadius: ms(16),
      backgroundColor: C.primary,
      alignItems: 'center',
      justifyContent: 'center',
    },
    confirmText: { fontSize: mf(16), ...font.bold, color: C.white },
  });
