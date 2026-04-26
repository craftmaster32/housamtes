import { useState, useCallback } from 'react';
import { View, Modal, Pressable, StyleSheet } from 'react-native';
import { Text } from 'react-native-paper';
import { Ionicons } from '@expo/vector-icons';
import { colors } from '@constants/colors';
import { font } from '@constants/typography';
import { sizes } from '@constants/sizes';

const MONTHS = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
];
const DAY_LABELS = ['Su', 'Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa'];

function pad(n: number): string {
  return String(n).padStart(2, '0');
}

interface DatePickerModalProps {
  visible: boolean;
  value: string; // YYYY-MM-DD
  onSelect: (date: string) => void;
  onClose: () => void;
}

export function DatePickerModal({ visible, value, onSelect, onClose }: DatePickerModalProps): React.JSX.Element {
  const parsed = value.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  const initYear = parsed ? parseInt(parsed[1]) : new Date().getFullYear();
  const initMonth = parsed ? parseInt(parsed[2]) - 1 : new Date().getMonth();
  const initDay = parsed ? parseInt(parsed[3]) : new Date().getDate();

  const [viewYear, setViewYear] = useState(initYear);
  const [viewMonth, setViewMonth] = useState(initMonth);
  const [localSel, setLocalSel] = useState({ y: initYear, m: initMonth, d: initDay });

  const daysInMonth = new Date(viewYear, viewMonth + 1, 0).getDate();
  const firstDow = new Date(viewYear, viewMonth, 1).getDay();

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
  // Pad to full rows
  while (cells.length % 7 !== 0) cells.push(null);

  const isSelected = (day: number): boolean =>
    localSel.y === viewYear && localSel.m === viewMonth && localSel.d === day;

  const isToday = (day: number): boolean => {
    const t = new Date();
    return t.getFullYear() === viewYear && t.getMonth() === viewMonth && t.getDate() === day;
  };

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <Pressable style={styles.overlay} onPress={onClose}>
        <Pressable style={styles.card} onPress={(e) => e.stopPropagation()}>

          {/* Month nav */}
          <View style={styles.navRow}>
            <Pressable style={styles.navBtn} onPress={prevMonth} accessibilityRole="button" accessibilityLabel="Previous month">
              <Ionicons name="chevron-back" size={20} color={colors.textPrimary} />
            </Pressable>
            <Text style={styles.monthLabel}>{MONTHS[viewMonth]} {viewYear}</Text>
            <Pressable style={styles.navBtn} onPress={nextMonth} accessibilityRole="button" accessibilityLabel="Next month">
              <Ionicons name="chevron-forward" size={20} color={colors.textPrimary} />
            </Pressable>
          </View>

          {/* Day-of-week headers */}
          <View style={styles.dowRow}>
            {DAY_LABELS.map((d) => (
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
                    accessibilityRole="button"
                    accessibilityLabel={`${day} ${MONTHS[viewMonth]} ${viewYear}`}
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
            <Pressable style={styles.cancelBtn} onPress={onClose} accessibilityRole="button">
              <Text style={styles.cancelText}>Cancel</Text>
            </Pressable>
            <Pressable style={styles.confirmBtn} onPress={confirm} accessibilityRole="button">
              <Text style={styles.confirmText}>Confirm</Text>
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
    width: 36, height: 36, borderRadius: 10,
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
    flex: 1, paddingVertical: 12, borderRadius: 12,
    backgroundColor: colors.surfaceSecondary,
    alignItems: 'center',
  },
  cancelText: { fontSize: 15, ...font.semibold, color: colors.textPrimary },
  confirmBtn: {
    flex: 1, paddingVertical: 12, borderRadius: 12,
    backgroundColor: colors.primary,
    alignItems: 'center',
  },
  confirmText: { fontSize: 15, ...font.semibold, color: colors.white },
});
