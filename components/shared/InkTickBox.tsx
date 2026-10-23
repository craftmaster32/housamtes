import { View, StyleSheet, Pressable } from 'react-native';
import Svg, { Path } from 'react-native-svg';
import { useThemedColors } from '@constants/colors';
import { ms } from '@utils/responsive';

interface InkTickBoxProps {
  checked: boolean;
  onChange: (checked: boolean) => void;
  /** Read out for the box, e.g. the setting's name. */
  accessibilityLabel: string;
  accessibilityHint?: string;
  disabled?: boolean;
}

/**
 * An on/off choice as a box drawn in ink, ticked in blue pen when on — used
 * instead of a phone switch on the paper-style pages.
 */
export function InkTickBox({
  checked,
  onChange,
  accessibilityLabel,
  accessibilityHint,
  disabled = false,
}: InkTickBoxProps): React.JSX.Element {
  const c = useThemedColors();
  return (
    <Pressable
      onPress={() => onChange(!checked)}
      disabled={disabled}
      style={({ pressed }) => [styles.hit, (pressed || disabled) && styles.dim]}
      accessibilityRole="checkbox"
      accessibilityState={{ checked, disabled }}
      accessibilityLabel={accessibilityLabel}
      accessibilityHint={accessibilityHint}
    >
      <View style={[styles.box, { borderColor: checked ? c.textPrimary : c.textSecondary }]}>
        {checked && (
          <Svg width={ms(26)} height={ms(26)} viewBox="0 0 26 26" style={styles.tick}>
            <Path
              d="M4 13 L10.5 20 L23 3"
              stroke={c.primary}
              strokeWidth={3}
              strokeLinecap="round"
              strokeLinejoin="round"
              fill="none"
            />
          </Svg>
        )}
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  hit: { width: 44, height: 44, alignItems: 'center', justifyContent: 'center' },
  dim: { opacity: 0.5 },
  box: {
    width: ms(22),
    height: ms(22),
    borderWidth: 2.2,
    borderRadius: ms(4),
    transform: [{ rotate: '-2deg' }],
  },
  tick: { position: 'absolute', left: 0, top: -ms(9) },
});
