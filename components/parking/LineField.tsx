import { Pressable, StyleSheet, View } from 'react-native';
import { Text } from 'react-native-paper';
import { Ionicons } from '@expo/vector-icons';
import { useThemedColors } from '@constants/colors';
import { font } from '@constants/typography';
import { mf, ms } from '@utils/responsive';

interface LineFieldProps {
  label: string;
  /** What is written on the line, or '' for nothing chosen yet. */
  value: string;
  /** Grey stand-in when nothing is chosen, e.g. "--:--". */
  placeholder?: string;
  icon: 'calendar-outline' | 'time-outline';
  onPress: () => void;
  accessibilityHint?: string;
}

/**
 * A tappable form field written on a line, like `UnderlineInput` but opening a
 * picker (date or time) instead of the keyboard.
 */
export function LineField({
  label,
  value,
  placeholder = '',
  icon,
  onPress,
  accessibilityHint,
}: LineFieldProps): React.JSX.Element {
  const c = useThemedColors();
  return (
    <View>
      <Text style={[styles.label, { color: c.textSecondary }]}>{label}</Text>
      <Pressable
        style={({ pressed }) => [
          styles.line,
          { borderBottomColor: c.border },
          pressed && styles.pressed,
        ]}
        onPress={onPress}
        accessible
        accessibilityRole="button"
        accessibilityLabel={`${label}: ${value || placeholder}`}
        accessibilityHint={accessibilityHint}
      >
        <Text
          style={[styles.value, { color: value ? c.textPrimary : c.textTertiary }]}
          numberOfLines={1}
        >
          {value || placeholder}
        </Text>
        <Ionicons name={icon} size={18} color={c.textSecondary} />
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  label: { fontSize: mf(13.5), ...font.bold, marginBottom: ms(2) },
  line: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: ms(8),
    minHeight: 44,
    borderBottomWidth: 1.5,
    paddingVertical: ms(8),
  },
  value: { flex: 1, minWidth: 0, fontSize: mf(17), ...font.semibold },
  pressed: { opacity: 0.7 },
});
