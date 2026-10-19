import { StyleSheet } from 'react-native';
import { type ColorTokens } from '@constants/colors';
import { font, heading } from '@constants/typography';
import { mf, ms } from '@utils/responsive';

export const CARD_H = ms(164);
export const CARD_GAP = ms(10);
// Hand-drawn pictures sit in the card's bottom trailing corner.
export const ART_INSET = ms(10);

// Locale strings like "PARKING" were written for the old all-caps labels; the
// new cards set labels in sentence case. Leaves mixed-case and caseless
// (Hebrew) strings alone.
export function sentenceCase(label: string): string {
  if (label !== label.toUpperCase() || label === label.toLowerCase()) return label;
  return label.charAt(0) + label.slice(1).toLowerCase();
}

// Glanceable widget cards: a small label, one big answer, one detail line.
export const makeCardStyles = (c: ColorTokens): ReturnType<typeof StyleSheet.create> =>
  StyleSheet.create({
    shell: {
      height: CARD_H,
      borderRadius: ms(24),
      paddingHorizontal: ms(14),
      paddingTop: ms(14),
      paddingBottom: ms(13),
      backgroundColor: c.surface,
      overflow: 'hidden',
    },
    pinnedShell: { borderWidth: 2, borderColor: c.primary },
    labelRow: { flexDirection: 'row', alignItems: 'center', gap: ms(6), minHeight: ms(20) },
    label: { flexShrink: 1, fontSize: mf(13.5), ...font.bold, color: c.textSecondary },
    labelMeta: {
      marginStart: 'auto',
      flexShrink: 0,
      fontSize: mf(12.5),
      ...font.semibold,
      color: c.textSecondary,
    },
    pinIcon: { marginStart: 'auto' },
    big: {
      ...heading.semibold,
      fontSize: mf(34),
      lineHeight: mf(38),
      letterSpacing: -1,
      color: c.textPrimary,
      marginTop: ms(22),
    },
    bigDenom: { fontSize: mf(22), color: c.textTertiary, letterSpacing: -0.4 },
    sub: { fontSize: mf(13.5), ...font.medium, color: c.textSecondary, marginTop: ms(4) },
    subAlert: { color: c.danger, ...font.bold },
    art: { position: 'absolute', bottom: ART_INSET, right: ART_INSET },
    artRTL: { position: 'absolute', bottom: ART_INSET, left: ART_INSET },

    groceryList: { marginTop: ms(8) },
    groceryRow: { flexDirection: 'row', alignItems: 'center', gap: ms(9), minHeight: ms(32) },
    groceryBox: {
      width: ms(20),
      height: ms(20),
      borderRadius: ms(7),
      borderWidth: 1.5,
      alignItems: 'center',
      justifyContent: 'center',
    },
    groceryName: { flex: 1, fontSize: mf(14.5), ...font.medium },
    groceryDone: { textDecorationLine: 'line-through' },
  });

export type CardStyles = ReturnType<typeof makeCardStyles>;
