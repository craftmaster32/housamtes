import { StyleSheet } from 'react-native';
import { font } from '@constants/typography';
import { mf, ms } from '@utils/responsive';

/** Form styles shared by the settle-up sheets — match the bill payment sheet. */
export const settleStyles = StyleSheet.create({
  body: { padding: ms(20), paddingBottom: ms(32), gap: ms(18) },
  twoCol: { flexDirection: 'row', gap: ms(12) },
  col: { flex: 1, minWidth: 0 },
  label: { fontSize: mf(13.5), ...font.bold, marginBottom: ms(2) },
  input: {
    minHeight: 44,
    borderBottomWidth: 1.5,
    paddingHorizontal: 0,
    paddingVertical: ms(8),
    fontSize: mf(17),
    ...font.semibold,
  },
  ltr: { writingDirection: 'ltr' },
  dateBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  dateText: { fontSize: mf(17), ...font.semibold },
  help: { fontSize: mf(14), ...font.medium, lineHeight: mf(20) },
  error: { fontSize: mf(14), ...font.medium },
  primaryBtn: {
    minHeight: ms(56),
    borderRadius: ms(18),
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: ms(16),
  },
  primaryText: { fontSize: mf(17), ...font.bold, textAlign: 'center' },
  dimmed: { opacity: 0.6 },
  tooMuch: { gap: ms(6) },
  tooMuchActions: { flexDirection: 'row', flexWrap: 'wrap', gap: ms(16) },
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
  iconBtn: { width: 44, height: 44, alignItems: 'center', justifyContent: 'center' },
});
