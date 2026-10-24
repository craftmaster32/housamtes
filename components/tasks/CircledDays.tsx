import { memo, useCallback } from 'react';
import { View, StyleSheet, Pressable } from 'react-native';
import { Text } from 'react-native-paper';
import { useThemedColors } from '@constants/colors';
import { font } from '@constants/typography';
import { mf, ms } from '@utils/responsive';
import { PenCircle } from '@components/shared/PenCircle';

interface DayProps {
  dayKey: string;
  label: string;
  accessibilityLabel?: string;
  selected: boolean;
  onSelect: (key: string) => void;
}

const Day = memo(function Day({
  dayKey,
  label,
  accessibilityLabel,
  selected,
  onSelect,
}: DayProps): React.JSX.Element {
  const c = useThemedColors();
  const handlePress = useCallback((): void => onSelect(dayKey), [onSelect, dayKey]);
  return (
    <Pressable
      onPress={handlePress}
      style={({ pressed }) => [styles.day, pressed && !selected && styles.pressed]}
      accessible
      accessibilityRole="radio"
      accessibilityState={{ selected }}
      accessibilityLabel={accessibilityLabel ?? label}
    >
      {/* The chosen day is circled in pen, like the date pop-up. */}
      {selected && <PenCircle color={c.primary} style={styles.circle} strokeWidth={2.2} />}
      <Text
        style={[
          styles.label,
          selected ? styles.labelOn : null,
          { color: selected ? c.primary : c.textSecondary },
        ]}
      >
        {label}
      </Text>
    </Pressable>
  );
});

interface CircledDaysProps {
  items: { key: string; label: string; accessibilityLabel?: string }[];
  columns: number;
  selected: string | null;
  onSelect: (key: string) => void;
}

/** A grid of days (weekday letters or 1–31); the chosen one is circled in pen. */
export function CircledDays({
  items,
  columns,
  selected,
  onSelect,
}: CircledDaysProps): React.JSX.Element {
  return (
    <View style={styles.grid} accessibilityRole="radiogroup">
      {items.map((it) => (
        <View key={it.key} style={{ width: `${100 / columns}%` as `${number}%` }}>
          <Day
            dayKey={it.key}
            label={it.label}
            accessibilityLabel={it.accessibilityLabel}
            selected={selected === it.key}
            onSelect={onSelect}
          />
        </View>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  grid: { flexDirection: 'row', flexWrap: 'wrap', marginTop: ms(4) },
  day: { height: 44, alignItems: 'center', justifyContent: 'center' },
  circle: {
    position: 'absolute',
    width: ms(38),
    height: ms(38),
    transform: [{ rotate: '-8deg' }],
  },
  label: { fontSize: mf(15), ...font.bold },
  labelOn: { ...font.extrabold },
  pressed: { opacity: 0.6 },
});
