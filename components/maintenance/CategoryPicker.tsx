import { useMemo } from 'react';
import { View, StyleSheet, Pressable } from 'react-native';
import { Text } from 'react-native-paper';
import { Ionicons } from '@expo/vector-icons';
import { MAINTENANCE_CATEGORIES } from '@stores/maintenanceStore';
import { useThemedColors, type ColorTokens } from '@constants/colors';
import { sizes } from '@constants/sizes';
import { font } from '@constants/typography';

interface CategoryPickerProps {
  value: string;
  onChange: (category: string) => void;
}

const makeStyles = (C: ColorTokens) =>
  StyleSheet.create({
    chipRow: { flexDirection: 'row', flexWrap: 'wrap', gap: sizes.xs },
    chip: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: 4,
      paddingHorizontal: sizes.sm,
      paddingVertical: 6,
      minHeight: sizes.touchTarget,
      borderRadius: sizes.borderRadiusFull,
      borderWidth: 1,
      borderColor: C.border,
      backgroundColor: C.surface,
    },
    chipActive: { backgroundColor: C.primary, borderColor: C.primary },
    chipText: { fontSize: sizes.fontSm, ...font.medium, color: C.textPrimary },
    chipTextActive: { color: '#fff' },
  });

export const CategoryPicker: React.FC<CategoryPickerProps> = ({ value, onChange }) => {
  const C = useThemedColors();
  const styles = useMemo(() => makeStyles(C), [C]);

  return (
    <View style={styles.chipRow}>
      {MAINTENANCE_CATEGORIES.map((c) => (
        <Pressable
          key={c.label}
          style={[styles.chip, value === c.label && styles.chipActive]}
          onPress={() => onChange(c.label)}
          accessible
          accessibilityRole="radio"
          accessibilityLabel={c.label}
          accessibilityState={{ selected: value === c.label }}
        >
          <Ionicons name={c.icon} size={14} color={value === c.label ? '#fff' : C.textSecondary} />
          <Text style={[styles.chipText, value === c.label && styles.chipTextActive]}>
            {c.label}
          </Text>
        </Pressable>
      ))}
    </View>
  );
};
