import { StyleSheet, View } from 'react-native';
import { LanguageSwitcher, type LanguageSwitcherVariant } from './LanguageSwitcher';
import { ms } from '@utils/responsive';

interface FlowLanguageBarProps {
  variant?: LanguageSwitcherVariant;
  align?: 'start' | 'end';
}

// A one-line drop-in for the pre-login flow screens: a full-width row that holds
// the language switcher, aligned to the trailing edge by default. Keeps the chip
// placement and spacing consistent across welcome, signup, verify, login and the
// onboarding screens without each screen re-declaring the same layout style.
export function FlowLanguageBar({
  variant = 'onSurface',
  align = 'end',
}: FlowLanguageBarProps): React.JSX.Element {
  return (
    <View style={[styles.bar, align === 'start' ? styles.start : styles.end]}>
      <LanguageSwitcher variant={variant} />
    </View>
  );
}

const styles = StyleSheet.create({
  bar: { flexDirection: 'row', width: '100%', paddingVertical: ms(4) },
  start: { justifyContent: 'flex-start' },
  end: { justifyContent: 'flex-end' },
});
