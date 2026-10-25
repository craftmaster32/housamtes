import { ActivityIndicator, StyleSheet, Pressable } from 'react-native';
import { Text } from 'react-native-paper';
import { useThemedColors } from '@constants/colors';
import { font } from '@constants/typography';
import { mf, ms } from '@utils/responsive';

interface SheetButtonProps {
  label: string;
  onPress: () => void;
  disabled?: boolean;
  /** Read out instead of the label, e.g. while it says "Saving…". */
  accessibilityLabel?: string;
  /** Shows a small spinner beside the label while something is saving. */
  loading?: boolean;
  testID?: string;
}

/** The big blue rounded button at the bottom of a sheet or form. */
export function SheetButton({
  label,
  onPress,
  disabled = false,
  accessibilityLabel,
  loading = false,
  testID,
}: SheetButtonProps): React.JSX.Element {
  const c = useThemedColors();
  return (
    <Pressable
      style={({ pressed }) => [
        styles.btn,
        { backgroundColor: c.primary },
        (disabled || pressed) && styles.dim,
      ]}
      onPress={onPress}
      disabled={disabled}
      testID={testID}
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel ?? label}
      accessibilityState={{ disabled, busy: loading }}
    >
      {loading && <ActivityIndicator size="small" color="#FFFFFF" />}
      <Text style={styles.text} numberOfLines={1}>
        {label}
      </Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  btn: {
    minHeight: 52,
    borderRadius: ms(17),
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row',
    gap: ms(8),
    paddingHorizontal: ms(16),
  },
  text: { fontSize: mf(16), ...font.semibold, color: '#FFFFFF' },
  dim: { opacity: 0.5 },
});
