import { Animated, StyleSheet, View } from 'react-native';
import { Text } from 'react-native-paper';
import { useTranslation } from 'react-i18next';
import { useThemedColors } from '@constants/colors';
import { useHandFont } from '@hooks/useHandFont';
import { useEasedValue } from '@hooks/useEasedValue';
import { mf, ms } from '@utils/responsive';

type Strength = 'weak' | 'fair' | 'strong';

function strengthOf(pw: string): Strength {
  const hasMinLength = pw.length >= 8;
  const hasUpper = /[A-Z]/.test(pw);
  const hasNumber = /[0-9]/.test(pw);
  const hasSpecial = /[^A-Za-z0-9]/.test(pw);
  const score = [hasMinLength, hasUpper, hasNumber, hasSpecial].filter(Boolean).length;
  if (!hasMinLength || score <= 1) return 'weak';
  if (score <= 3) return 'fair';
  return 'strong';
}

const SHARE: Record<Strength, number> = { weak: 1 / 3, fair: 2 / 3, strong: 1 };

interface PasswordStrengthProps {
  password: string;
}

/**
 * How strong the new password is: a thin line that slides to a third, two
 * thirds or all the way (red / amber / green), with the word handwritten.
 * Nothing shows until something is typed.
 */
export function PasswordStrength({ password }: PasswordStrengthProps): React.JSX.Element | null {
  const { t } = useTranslation();
  const c = useThemedColors();
  const hand = useHandFont();
  const strength = password.length > 0 ? strengthOf(password) : null;
  const share = useEasedValue(strength ? SHARE[strength] : 0);
  if (!strength) return null;
  const color = strength === 'weak' ? c.danger : strength === 'fair' ? c.warning : c.success;
  const width = share.interpolate({ inputRange: [0, 1], outputRange: ['0%', '100%'] });
  return (
    <View style={styles.row}>
      <View style={[styles.track, { backgroundColor: c.border }]}>
        <Animated.View style={[styles.fill, { backgroundColor: color, width }]} />
      </View>
      <Text style={[styles.label, hand, { color }]}>{t(`auth.strength_${strength}`)}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', gap: ms(10), marginTop: ms(8) },
  track: { flex: 1, height: 3, borderRadius: 2, overflow: 'hidden' },
  fill: { height: 3, borderRadius: 2 },
  label: { fontSize: mf(18), minWidth: ms(52) },
});
