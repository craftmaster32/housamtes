import { useCallback } from 'react';
import { View, StyleSheet, Pressable } from 'react-native';
import { Text } from 'react-native-paper';
import { font } from '@constants/typography';
import { mf, ms } from '@utils/responsive';
import { useRecurringPalette } from './palette';

export interface ChoiceOption {
  id: string;
  name: string;
}

interface ChoiceChipsProps {
  label: string;
  options: ChoiceOption[];
  selected: string[];
  mode: 'single' | 'multi';
  onToggle: (id: string) => void;
}

/** A labelled row of chips (housemates, frequencies…) — pick one (radio) or several (checkbox). */
export function ChoiceChips({
  label,
  options,
  selected,
  mode,
  onToggle,
}: ChoiceChipsProps): React.JSX.Element {
  const p = useRecurringPalette();
  return (
    <View>
      <Text style={[styles.label, { color: p.muted }]}>{label}</Text>
      <View style={styles.row} accessibilityRole={mode === 'single' ? 'radiogroup' : undefined}>
        {options.map((option) => (
          <Chip
            key={option.id}
            option={option}
            isSelected={selected.includes(option.id)}
            mode={mode}
            onToggle={onToggle}
          />
        ))}
      </View>
    </View>
  );
}

interface ChipProps {
  option: ChoiceOption;
  isSelected: boolean;
  mode: 'single' | 'multi';
  onToggle: (id: string) => void;
}

function Chip({ option, isSelected, mode, onToggle }: ChipProps): React.JSX.Element {
  const p = useRecurringPalette();
  const handlePress = useCallback((): void => onToggle(option.id), [onToggle, option.id]);
  return (
    <Pressable
      onPress={handlePress}
      style={[
        styles.chip,
        { borderColor: p.border, backgroundColor: p.card },
        isSelected && { backgroundColor: p.primary, borderColor: p.primary },
      ]}
      accessible
      accessibilityRole={mode === 'single' ? 'radio' : 'checkbox'}
      accessibilityLabel={option.name}
      accessibilityState={mode === 'single' ? { selected: isSelected } : { checked: isSelected }}
    >
      <Text style={[styles.chipText, { color: isSelected ? p.onPrimary : p.text }]}>
        {option.name}
      </Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  label: { fontSize: mf(13), ...font.medium, marginBottom: ms(6) },
  row: { flexDirection: 'row', flexWrap: 'wrap', gap: ms(8) },
  chip: {
    minHeight: ms(44),
    paddingHorizontal: ms(16),
    borderRadius: ms(22),
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  chipText: { fontSize: mf(15), ...font.medium },
});
