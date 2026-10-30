import { useCallback } from 'react';
import { View, StyleSheet, Pressable } from 'react-native';
import { Text } from 'react-native-paper';
import { font } from '@constants/typography';
import { UserAvatar } from '@components/shared/UserAvatar';
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
  /** Options are housemates: show each one's avatar in the chip. */
  avatars?: boolean;
}

/** A labelled row of chips (housemates, frequencies…) — pick one (radio) or several (checkbox). */
export function ChoiceChips({
  label,
  options,
  selected,
  mode,
  onToggle,
  avatars = false,
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
            avatar={avatars}
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
  avatar: boolean;
}

/** A single selectable chip, announced as a radio or checkbox. */
function Chip({ option, isSelected, mode, onToggle, avatar }: ChipProps): React.JSX.Element {
  const p = useRecurringPalette();
  const handlePress = useCallback((): void => onToggle(option.id), [onToggle, option.id]);
  return (
    <Pressable
      onPress={handlePress}
      style={({ pressed }) => [
        styles.chip,
        avatar && styles.chipWithAvatar,
        { backgroundColor: p.card, borderColor: isSelected ? p.primary : 'transparent' },
        pressed && styles.pressed,
      ]}
      accessible
      accessibilityRole={mode === 'single' ? 'radio' : 'checkbox'}
      accessibilityLabel={option.name}
      accessibilityState={mode === 'single' ? { selected: isSelected } : { checked: isSelected }}
    >
      {avatar && <UserAvatar userId={option.id} size={22} />}
      <Text style={[styles.chipText, { color: isSelected ? p.text : p.muted }]}>{option.name}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  label: { fontSize: mf(13.5), ...font.bold, marginBottom: ms(8) },
  row: { flexDirection: 'row', flexWrap: 'wrap', gap: ms(8) },
  // The chosen chip is ringed in blue rather than filled.
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: ms(7),
    minHeight: 44,
    paddingHorizontal: ms(16),
    borderRadius: 22,
    borderWidth: 2,
    justifyContent: 'center',
  },
  chipWithAvatar: { paddingStart: ms(10) },
  chipText: { fontSize: mf(15), ...font.bold },
  pressed: { opacity: 0.7 },
});
