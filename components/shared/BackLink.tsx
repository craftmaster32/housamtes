import { StyleSheet, Pressable } from 'react-native';
import { Text } from 'react-native-paper';
import { Ionicons } from '@expo/vector-icons';
import { useTranslation } from 'react-i18next';
import { goBack } from '@stores/navigationStore';
import { useColors } from '@hooks/useColors';
import { useLanguageStore } from '@stores/languageStore';
import { isRTL } from '@lib/i18n';
import { font } from '@constants/typography';
import { mf, ms } from '@utils/responsive';

interface BackLinkProps {
  // What the button says it goes to — name the real destination (e.g. Home).
  label: string;
}

// A labelled back control (chevron + destination name) that walks one step back
// through the navigation we built (goBack). Drop it at the top-left of a screen
// that otherwise has no back affordance. The label should name where back
// actually lands, so on a main section it reads "Home".
export function BackLink({ label }: BackLinkProps): React.JSX.Element {
  const c = useColors();
  const { t } = useTranslation();
  const rtl = isRTL(useLanguageStore((s) => s.language));

  return (
    <Pressable
      onPress={() => goBack()}
      // The row auto-reverses in RTL (I18nManager on native, CSS direction on
      // web), so keep a plain row and only flip the chevron glyph below.
      style={styles.btn}
      hitSlop={12}
      accessible
      accessibilityRole="button"
      accessibilityLabel={`${t('common.back')} — ${label}`}
    >
      <Ionicons name={rtl ? 'chevron-forward' : 'chevron-back'} size={20} color={c.primary} />
      <Text style={[styles.text, { color: c.primary }]}>{label}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  btn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: ms(2),
    alignSelf: 'flex-start',
    minHeight: ms(40),
    paddingEnd: ms(8),
  },
  text: { fontSize: mf(15), ...font.semibold },
});
