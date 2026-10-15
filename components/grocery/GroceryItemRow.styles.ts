import { StyleSheet } from 'react-native';
import { type ColorTokens } from '@constants/colors';
import { font } from '@constants/typography';
import { mf, ms } from '@utils/responsive';

// Width of the swipe-to-delete panel. Kept in sync between the reveal animation
// and its style so the red panel slides in flush with the card edge.
export const SWIPE_DELETE_WIDTH = ms(84);

const RADIUS = ms(20);

export function makeStyles(C: ColorTokens, isDark: boolean) {
  return StyleSheet.create({
    card: {
      backgroundColor: C.surface,
      borderRadius: RADIUS,
      paddingVertical: ms(12),
      paddingHorizontal: ms(12),
      gap: ms(10),
      // Light mode floats on a soft shadow; dark mode needs a hairline instead.
      borderWidth: isDark ? 1 : 0,
      borderColor: C.border,
      shadowColor: '#1F2A44',
      shadowOffset: { width: 0, height: ms(3) },
      shadowOpacity: isDark ? 0 : 0.06,
      shadowRadius: 10,
      elevation: isDark ? 0 : 1,
    },
    cardDone: { backgroundColor: C.surfaceSecondary, shadowOpacity: 0, elevation: 0 },
    cardPersonal: {
      backgroundColor: isDark ? 'rgba(124,58,237,0.12)' : '#F6F1FD',
      borderWidth: 1,
      borderColor: 'rgba(167,139,250,0.35)',
    },

    topRow: { flexDirection: 'row', alignItems: 'center', gap: ms(12) },
    tile: {
      width: ms(46),
      height: ms(46),
      borderRadius: ms(14),
      alignItems: 'center',
      justifyContent: 'center',
      flexShrink: 0,
    },
    main: { flex: 1, minWidth: 0, gap: ms(5) },
    nameRow: { flexDirection: 'row', alignItems: 'center', gap: ms(8), minWidth: 0 },
    name: {
      fontSize: mf(16),
      ...font.semibold,
      color: C.textPrimary,
      flexShrink: 1,
      lineHeight: mf(21),
    },
    nameDone: { textDecorationLine: 'line-through', color: C.textSecondary, ...font.medium },
    qtyPill: {
      paddingHorizontal: ms(8),
      paddingVertical: ms(2),
      borderRadius: ms(10),
      flexShrink: 0,
    },
    qtyPillText: { fontSize: mf(12), ...font.bold },
    metaRow: { flexDirection: 'row', alignItems: 'center', gap: ms(6), minWidth: 0 },

    dupBadge: {
      backgroundColor: C.warningTint,
      borderRadius: ms(8),
      paddingHorizontal: ms(7),
      paddingVertical: ms(2),
    },
    dupBadgeText: { fontSize: mf(11), ...font.semibold, color: C.textPrimary },

    check: {
      width: ms(42),
      height: ms(42),
      borderRadius: ms(21),
      borderWidth: 2,
      borderColor: isDark ? 'rgba(255,255,255,0.22)' : '#C9D2DF',
      alignItems: 'center',
      justifyContent: 'center',
      flexShrink: 0,
    },
    checkOn: { backgroundColor: C.positive, borderColor: C.positive },

    counter: { flexDirection: 'row', alignItems: 'center', gap: ms(4), flexShrink: 0 },
    ctrBtn: {
      width: ms(40),
      height: ms(40),
      borderRadius: ms(20),
      backgroundColor: C.surfaceSecondary,
      alignItems: 'center',
      justifyContent: 'center',
    },
    ctrBtnPlus: { backgroundColor: C.primary },
    ctrBtnOff: { opacity: 0.35 },
    ctrBtnText: { fontSize: mf(18), ...font.bold, color: C.textPrimary, lineHeight: mf(22) },
    ctrBtnTextPlus: { color: '#FFFFFF' },
    ctrText: {
      fontSize: mf(14),
      ...font.bold,
      color: C.textPrimary,
      minWidth: ms(34),
      textAlign: 'center',
      fontVariant: ['tabular-nums'],
    },

    progressTrack: {
      height: ms(6),
      borderRadius: ms(3),
      backgroundColor: C.surfaceSecondary,
      overflow: 'hidden',
    },
    progressFill: { height: '100%', borderRadius: ms(3), backgroundColor: C.positive },

    swipeLane: { width: SWIPE_DELETE_WIDTH },
    swipeDelete: {
      flex: 1,
      backgroundColor: C.danger,
      justifyContent: 'center',
      alignItems: 'center',
      gap: ms(3),
      borderTopRightRadius: RADIUS,
      borderBottomRightRadius: RADIUS,
    },
    swipeDeleteText: { fontSize: mf(12), ...font.bold, color: '#FFFFFF' },
  });
}
