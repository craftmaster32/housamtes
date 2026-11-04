import { StyleSheet } from 'react-native';
import { font } from '@constants/typography';
import { mf, ms } from '@utils/responsive';

/** Form styles shared by the settle-up sheets — match the bill payment sheet. */
export const settleStyles = StyleSheet.create({
  body: { padding: ms(20), paddingBottom: ms(32), gap: ms(18) },
  label: { fontSize: mf(13.5), ...font.bold, marginBottom: ms(2) },
  error: { fontSize: mf(14), ...font.medium },
  dimmed: { opacity: 0.6 },
  inlineRow: { flexDirection: 'row', alignItems: 'center', gap: ms(8) },
  nothing: { paddingVertical: ms(8) },
  listEnd: { height: ms(12) },
  listShrink: { flexShrink: 1 },
  // A button that stays visible at the bottom of a sheet, above the list.
  stickyFooter: {
    paddingHorizontal: ms(20),
    paddingTop: ms(12),
    paddingBottom: ms(28),
    borderTopWidth: StyleSheet.hairlineWidth,
    gap: ms(8),
  },
  linkBtn: { minHeight: 44, justifyContent: 'center' },
  linkText: { fontSize: mf(15), ...font.bold },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: ms(10),
    minHeight: 44,
    paddingVertical: ms(8),
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  listItem: { marginHorizontal: ms(20) },
  rowText: { flex: 1, minWidth: 0 },
  rowTitle: { fontSize: mf(16), ...font.bold },
  rowSub: { fontSize: mf(13.5), ...font.medium, marginTop: ms(2) },
  rowAmount: { fontSize: mf(16), ...font.extrabold, writingDirection: 'ltr' },
});
