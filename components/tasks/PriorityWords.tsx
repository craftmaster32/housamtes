import { View, StyleSheet, Pressable } from 'react-native';
import { Text } from 'react-native-paper';
import { useTranslation } from 'react-i18next';
import { useThemedColors, type ColorPalette } from '@constants/colors';
import { font } from '@constants/typography';
import type { TaskPriority } from '@stores/tasksStore';
import { mf, ms } from '@utils/responsive';

const PRIORITIES: TaskPriority[] = ['low', 'medium', 'high'];

/** Priority dot colours, shared by the form and the task lines. */
export function priorityColor(p: TaskPriority, c: ColorPalette): string {
  return p === 'high' ? c.danger : p === 'medium' ? c.warning : c.success;
}

interface PriorityWordsProps {
  selected: TaskPriority;
  onSelect: (p: TaskPriority) => void;
}

/** Low · Medium · High as words with their colour dot; the chosen one is circled in pen. */
export function PriorityWords({ selected, onSelect }: PriorityWordsProps): React.JSX.Element {
  const { t } = useTranslation();
  const c = useThemedColors();
  return (
    <View style={styles.row} accessibilityRole="radiogroup">
      {PRIORITIES.map((p) => {
        const on = selected === p;
        return (
          <Pressable
            key={p}
            onPress={() => onSelect(p)}
            style={({ pressed }) => [styles.word, pressed && !on && styles.pressed]}
            accessible
            accessibilityRole="radio"
            accessibilityState={{ selected: on }}
            accessibilityLabel={t(`tasks.priority_${p}`)}
          >
            {on && <View style={[styles.circle, { borderColor: c.primary }]} />}
            <View style={[styles.dot, { backgroundColor: priorityColor(p, c) }]} />
            <Text style={[styles.label, { color: on ? c.textPrimary : c.textSecondary }]}>
              {t(`tasks.priority_${p}`)}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', flexWrap: 'wrap', gap: ms(10), alignItems: 'center' },
  word: {
    minHeight: 44,
    flexDirection: 'row',
    alignItems: 'center',
    gap: ms(6),
    paddingHorizontal: ms(10),
  },
  circle: {
    position: 'absolute',
    top: ms(7),
    bottom: ms(7),
    left: 0,
    right: 0,
    borderWidth: 2,
    borderRadius: 999,
    transform: [{ rotate: '-3deg' }],
  },
  dot: { width: ms(8), height: ms(8), borderRadius: ms(4) },
  label: { fontSize: mf(15), ...font.bold },
  pressed: { opacity: 0.6 },
});
