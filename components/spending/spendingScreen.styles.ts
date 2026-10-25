import { StyleSheet } from 'react-native';
import { type ColorTokens } from '@constants/colors';
import { font } from '@constants/typography';
import { mf, ms } from '@utils/responsive';

// Styles for the Spending Analysis screen (app/(tabs)/profile/spending.tsx).
export function makeStyles(C: ColorTokens): ReturnType<typeof StyleSheet.create> {
  return StyleSheet.create({
    root: { flex: 1, backgroundColor: C.background },
    header: { paddingHorizontal: ms(20), paddingTop: ms(8) },
    title: {
      fontSize: mf(36),
      lineHeight: mf(46),
      paddingBottom: ms(2),
      letterSpacing: -0.5,
      marginTop: ms(4),
      color: C.textPrimary,
    },
    scroll: { paddingHorizontal: ms(20), paddingTop: ms(8), paddingBottom: ms(60) },
    viewWords: { marginTop: ms(2), marginBottom: ms(10), marginStart: -ms(9) },
    note: { marginTop: ms(22) },
    section: {
      fontSize: mf(22),
      lineHeight: mf(29),
      color: C.textPrimary,
      marginTop: ms(30),
      marginBottom: ms(6),
    },
    // A group heading inside "Where it went": House Bills, then Lifestyle.
    group: {
      flexDirection: 'row',
      alignItems: 'baseline',
      justifyContent: 'space-between',
      marginTop: ms(18),
      marginBottom: ms(2),
    },
    groupTitle: { fontSize: mf(17), lineHeight: mf(23), color: C.textPrimary },
    groupTotal: { fontSize: mf(14), ...font.bold, color: C.textSecondary, writingDirection: 'ltr' },
    more: { minHeight: 44, justifyContent: 'center', alignSelf: 'flex-start' },
    moreText: { fontSize: mf(15), ...font.semibold, color: C.primary },
    pressed: { opacity: 0.6 },
    whoPaid: { marginTop: ms(26) },
    centered: {
      flex: 1,
      alignItems: 'center',
      justifyContent: 'center',
      padding: ms(24),
      gap: ms(8),
    },
    errorTitle: { fontSize: mf(22), color: C.textPrimary, textAlign: 'center' },
    muted: {
      fontSize: mf(13.5),
      lineHeight: mf(19),
      ...font.regular,
      color: C.textSecondary,
      textAlign: 'center',
    },
    retry: {
      minHeight: 48,
      paddingHorizontal: ms(28),
      borderRadius: ms(16),
      backgroundColor: C.primary,
      alignItems: 'center',
      justifyContent: 'center',
      marginTop: ms(8),
    },
    retryText: { fontSize: mf(15), ...font.semibold, color: '#FFFFFF' },
    empty: { alignItems: 'center', paddingVertical: ms(24), gap: ms(8) },
    emptyTitle: { fontSize: mf(22), lineHeight: mf(26), color: C.textPrimary, textAlign: 'center' },
  });
}
