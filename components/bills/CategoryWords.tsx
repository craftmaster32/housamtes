import { memo, useCallback } from 'react';
import { View, StyleSheet, Pressable, ScrollView } from 'react-native';
import { Text } from 'react-native-paper';
import { useThemedColors } from '@constants/colors';
import { font } from '@constants/typography';
import { mf, ms } from '@utils/responsive';

interface WordProps {
  wordKey: string;
  label: string;
  selected: boolean;
  onSelect: (key: string) => void;
}

const Word = memo(function Word({
  wordKey,
  label,
  selected,
  onSelect,
}: WordProps): React.JSX.Element {
  const c = useThemedColors();
  const handlePress = useCallback((): void => onSelect(wordKey), [onSelect, wordKey]);
  return (
    <Pressable
      onPress={handlePress}
      style={({ pressed }) => [styles.word, pressed && !selected && styles.pressed]}
      accessible
      accessibilityRole="radio"
      accessibilityState={{ selected }}
      accessibilityLabel={label}
    >
      {/* The chosen word gets circled by hand. */}
      {selected && <View style={[styles.circle, { borderColor: c.primary }]} />}
      <Text style={[styles.label, { color: selected ? c.textPrimary : c.textSecondary }]}>
        {label}
      </Text>
    </Pressable>
  );
});

interface CategoryWordsProps {
  items: { key: string; label: string }[];
  selected: string;
  onSelect: (key: string) => void;
}

// Category filter as a line of words; the chosen one is circled in pen.
export function CategoryWords({
  items,
  selected,
  onSelect,
}: CategoryWordsProps): React.JSX.Element {
  return (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      contentContainerStyle={styles.row}
      accessibilityRole="radiogroup"
    >
      {items.map((it) => (
        <Word
          key={it.key}
          wordKey={it.key}
          label={it.label}
          selected={selected === it.key}
          onSelect={onSelect}
        />
      ))}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  row: { gap: ms(10), paddingHorizontal: ms(6), alignItems: 'center' },
  word: { minHeight: 44, justifyContent: 'center', paddingHorizontal: ms(8) },
  label: { fontSize: mf(15), ...font.bold },
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
  pressed: { opacity: 0.6 },
});
