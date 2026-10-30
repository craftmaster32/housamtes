import { Pressable, StyleSheet } from 'react-native';
import { Text } from 'react-native-paper';
import { useThemedColors } from '@constants/colors';
import { font } from '@constants/typography';
import { mf } from '@utils/responsive';

interface TextLinkProps {
  label: string;
  onPress: () => void;
  /** Grey instead of blue, for the quieter way out. */
  muted?: boolean;
  /** Text before the blue words, e.g. "No account?". */
  lead?: string;
  disabled?: boolean;
  accessibilityLabel?: string;
}

/** A plain text link on the sign-in pages — blue words, no button around them. */
export function TextLink({
  label,
  onPress,
  muted = false,
  lead,
  disabled = false,
  accessibilityLabel,
}: TextLinkProps): React.JSX.Element {
  const c = useThemedColors();
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      style={({ pressed }) => [styles.link, (pressed || disabled) && styles.dim]}
      hitSlop={6}
      accessible
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel ?? label}
      accessibilityState={{ disabled }}
    >
      <Text style={[styles.text, { color: c.textSecondary }]}>
        {!!lead && `${lead} `}
        <Text style={[styles.strong, { color: muted ? c.textSecondary : c.primary }]}>{label}</Text>
      </Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  link: { alignSelf: 'center', minHeight: 44, justifyContent: 'center', paddingHorizontal: 8 },
  text: { fontSize: mf(15), ...font.regular, textAlign: 'center' },
  strong: { ...font.semibold },
  dim: { opacity: 0.55 },
});
