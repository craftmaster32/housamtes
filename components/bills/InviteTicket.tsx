import { View, StyleSheet, Pressable } from 'react-native';
import { Text } from 'react-native-paper';
import { useTranslation } from 'react-i18next';
import { lightColors, useThemedColors } from '@constants/colors';
import { font } from '@constants/typography';
import { useHeadingFont } from '@hooks/useHeadingFont';
import { useHandFont } from '@hooks/useHandFont';
import { asWord } from '@utils/asWord';
import { mf, ms } from '@utils/responsive';

const P = lightColors;
const TICKET = '#F6D8D2';
const HOLES = 7;

interface InviteTicketProps {
  code: string;
  copied: boolean;
  onCopy: () => void;
}

/** The invite code as an admission ticket with a perforated stub. */
export function InviteTicket({ code, copied, onCopy }: InviteTicketProps): React.JSX.Element {
  const { t } = useTranslation();
  const c = useThemedColors();
  const heading = useHeadingFont('semibold');
  const hand = useHandFont();
  return (
    <View style={styles.ticket}>
      <View style={styles.main}>
        <Text style={styles.label}>{asWord(t('housemates.invite_section'))}</Text>
        <Text style={[styles.code, heading]} selectable>
          {code || '------'}
        </Text>
        <Text style={styles.hint}>{t('housemates.invite_body')}</Text>
      </View>
      <View style={styles.perf} pointerEvents="none">
        {Array.from({ length: HOLES }, (_, i) => (
          <View key={i} style={[styles.hole, { backgroundColor: c.background }]} />
        ))}
      </View>
      <Pressable
        style={({ pressed }) => [styles.stub, pressed && styles.pressed]}
        onPress={onCopy}
        accessibilityRole="button"
        accessibilityLabel={t('housemates.copy_code')}
      >
        <Text style={[styles.copy, hand]}>
          {copied ? t('housemates.copied') : t('housemates.copy_code')}
        </Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  ticket: {
    flexDirection: 'row',
    backgroundColor: TICKET,
    borderRadius: ms(8),
    shadowColor: '#000',
    shadowOffset: { width: 0, height: ms(2) },
    shadowOpacity: 0.12,
    shadowRadius: 5,
    elevation: 2,
  },
  main: { flex: 1, padding: ms(16), gap: ms(2) },
  label: { fontSize: mf(12.5), ...font.bold, color: '#8E2F28' },
  code: {
    fontSize: mf(32),
    lineHeight: mf(40),
    letterSpacing: 2,
    color: P.paperInk,
    writingDirection: 'ltr',
  },
  hint: { fontSize: mf(13), lineHeight: mf(18), ...font.regular, color: '#6E3A33' },
  perf: { width: ms(8), justifyContent: 'space-evenly', alignItems: 'center' },
  hole: { width: ms(7), height: ms(7), borderRadius: ms(4) },
  stub: { width: ms(92), alignItems: 'center', justifyContent: 'center', padding: ms(8) },
  pressed: { opacity: 0.6 },
  copy: { fontSize: mf(20), lineHeight: mf(23), color: P.primary, textAlign: 'center' },
});
