import { View, StyleSheet, Pressable } from 'react-native';
import { Text } from 'react-native-paper';
import { Ionicons } from '@expo/vector-icons';
import { useThemedColors } from '@constants/colors';
import { font } from '@constants/typography';
import { useHandFont } from '@hooks/useHandFont';
import { useLanguageStore } from '@stores/languageStore';
import { isRTL } from '@lib/i18n';
import { mf, ms } from '@utils/responsive';

interface SettingsLineProps {
  label: string;
  sub?: string;
  /** The current choice, handwritten on the line (e.g. "₪ Shekel"). */
  value?: string;
  onPress?: () => void;
  disabled?: boolean;
  /** Last line in its card: no rule under it. */
  last?: boolean;
  /** Something to show on the right instead of the value or the arrow. */
  right?: React.ReactNode;
}

/** One settings row written on a line: label, optional grey hint, and the
 *  current choice in handwriting (or an arrow when it opens a page). */
export function SettingsLine({
  label,
  sub,
  value,
  onPress,
  disabled = false,
  last = false,
  right,
}: SettingsLineProps): React.JSX.Element {
  const c = useThemedColors();
  const hand = useHandFont();
  const rtl = isRTL(useLanguageStore((s) => s.language));
  const tappable = !!onPress && !disabled;

  const body = (
    <>
      <View style={styles.text}>
        <Text style={[styles.label, { color: c.textPrimary }]}>{label}</Text>
        {sub ? <Text style={[styles.sub, { color: c.textSecondary }]}>{sub}</Text> : null}
      </View>
      {right ??
        (value ? (
          <Text
            style={[styles.value, hand, { color: tappable ? c.primary : c.textSecondary }]}
            numberOfLines={1}
          >
            {value}
          </Text>
        ) : tappable ? (
          <Ionicons
            name={rtl ? 'chevron-back' : 'chevron-forward'}
            size={18}
            color={c.textTertiary}
          />
        ) : null)}
    </>
  );

  const lineStyle = [styles.line, !last && { borderBottomColor: c.border, ...styles.ruled }];

  if (!onPress) {
    // Interactive content in right (e.g. ChoiceWords radios) must stay
    // individually focusable, so only group plain label/value rows.
    const group = !right;
    return (
      <View
        style={lineStyle}
        accessible={group}
        accessibilityLabel={group ? (value ? `${label}, ${value}` : label) : undefined}
      >
        {body}
      </View>
    );
  }
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      style={({ pressed }) => [...lineStyle, pressed && tappable && styles.pressed]}
      accessible
      accessibilityRole="button"
      accessibilityLabel={value ? `${label}, ${value}` : label}
      accessibilityHint={sub}
      accessibilityState={{ disabled }}
    >
      {body}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  line: {
    minHeight: ms(58),
    flexDirection: 'row',
    alignItems: 'center',
    gap: ms(12),
    paddingVertical: ms(10),
  },
  ruled: { borderBottomWidth: 1.5 },
  text: { flex: 1, minWidth: 0 },
  label: { fontSize: mf(15.5), ...font.semibold },
  sub: { fontSize: mf(13), ...font.regular, marginTop: ms(2) },
  value: { fontSize: mf(21), maxWidth: '68%', paddingEnd: ms(4), writingDirection: 'ltr' },
  pressed: { opacity: 0.6 },
});
