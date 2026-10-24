import { StyleSheet } from 'react-native';
import { type ColorTokens } from '@constants/colors';
import { font } from '@constants/typography';
import { mf, ms } from '@utils/responsive';

// Width of the swipe-to-delete panel. Kept in sync between the reveal animation
// and its style so the red panel slides in flush with the row's edge.
export const SWIPE_DELETE_WIDTH = ms(84);

// Rows sit on the brown paper bag (BagSlice), which stays light in dark mode,
// so text uses the bag's own inks rather than the theme's.
export function makeStyles(C: ColorTokens): ReturnType<typeof StyleSheet.create> {
  return StyleSheet.create({
    card: { paddingVertical: ms(10), gap: ms(8) },
    topRow: { flexDirection: 'row', alignItems: 'center', gap: ms(12) },
    // A square drawn in ink, a little crooked, like on a paper list.
    box: {
      width: ms(22),
      height: ms(22),
      borderWidth: 2.2,
      borderColor: C.kraftInk,
      borderRadius: ms(4),
      transform: [{ rotate: '-2deg' }],
    },
    // The tick overshoots the box, the way a pen tick does.
    tick: { position: 'absolute', left: 0, top: -ms(9) },
    boxSpacer: { width: ms(22) },
    main: { flex: 1, minWidth: 0, gap: ms(2) },
    nameRow: { flexDirection: 'row', alignItems: 'center', gap: ms(6), flexWrap: 'wrap' },
    name: { fontSize: mf(16.5), ...font.semibold, color: C.kraftInk, flexShrink: 1 },
    nameDone: { color: C.kraftMuted, textDecorationLine: 'line-through' },
    qty: { fontSize: mf(21), color: '#3B6FBF', writingDirection: 'ltr' },
    dup: { fontSize: mf(18), color: '#B84540' },
    metaRow: { flexDirection: 'row', alignItems: 'center', gap: ms(5) },
    faded: { opacity: 0.6 },

    counter: { flexDirection: 'row', alignItems: 'center', gap: ms(6) },
    ctrBtn: {
      width: 36,
      height: 36,
      borderRadius: 18,
      borderWidth: 1.8,
      borderColor: C.kraftInk,
      alignItems: 'center',
      justifyContent: 'center',
    },
    ctrBtnPlus: { backgroundColor: '#3B6FBF', borderColor: '#3B6FBF' },
    ctrBtnOff: { opacity: 0.35 },
    ctrBtnText: { fontSize: mf(18), ...font.semibold, color: C.kraftInk, lineHeight: mf(20) },
    ctrBtnTextPlus: { color: '#FFFFFF' },
    ctrText: { fontSize: mf(21), color: C.kraftInk, minWidth: ms(30), textAlign: 'center' },
    progressTrack: {
      height: 3,
      borderRadius: 2,
      backgroundColor: C.kraftRule,
      marginStart: ms(34),
      overflow: 'hidden',
    },
    progressFill: { height: 3, borderRadius: 2, backgroundColor: '#3B6FBF' },

    swipeLane: { width: SWIPE_DELETE_WIDTH },
    swipeDelete: {
      flex: 1,
      backgroundColor: C.danger,
      justifyContent: 'center',
      alignItems: 'center',
      gap: ms(3),
    },
    swipeDeleteText: { fontSize: mf(12), ...font.bold, color: '#FFFFFF' },
  });
}
