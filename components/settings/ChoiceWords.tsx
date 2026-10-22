import { View, StyleSheet, Pressable } from 'react-native';
import { Text } from 'react-native-paper';
import { useThemedColors } from '@constants/colors';
import { font } from '@constants/typography';
import { mf, ms } from '@utils/responsive';
import { PenCircle } from '@components/shared/PenCircle';

export interface ChoiceWord<T extends string> {
  value: T;
  label: string;
}

interface ChoiceWordsProps<T extends string> {
  options: ChoiceWord<T>[];
  selected: T;
  onSelect: (value: T) => void;
  /** Read out by screen readers for the whole group, e.g. "Appearance". */
  groupLabel: string;
}

/** A short row of words; the chosen one is circled in blue pen. */
export function ChoiceWords<T extends string>({
  options,
  selected,
  onSelect,
  groupLabel,
}: ChoiceWordsProps<T>): React.JSX.Element {
  const c = useThemedColors();
  return (
    <View style={styles.row} accessibilityRole="radiogroup" accessibilityLabel={groupLabel}>
      {options.map((o) => {
        const on = o.value === selected;
        return (
          <Pressable
            key={o.value}
            onPress={() => onSelect(o.value)}
            style={({ pressed }) => [styles.word, pressed && !on && styles.pressed]}
            accessible
            accessibilityRole="radio"
            accessibilityState={{ selected: on }}
            accessibilityLabel={o.label}
          >
            {on && <PenCircle color={c.primary} style={styles.circle} />}
            <Text
              style={[
                styles.label,
                on ? styles.labelOn : null,
                { color: on ? c.textPrimary : c.textSecondary },
              ]}
            >
              {o.label}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: ms(2) },
  word: { minHeight: 44, justifyContent: 'center', paddingHorizontal: ms(9) },
  circle: {
    position: 'absolute',
    top: ms(8),
    bottom: ms(8),
    left: 0,
    right: 0,
    transform: [{ rotate: '-4deg' }],
  },
  label: { fontSize: mf(15), ...font.medium },
  labelOn: { ...font.semibold },
  pressed: { opacity: 0.6 },
});
