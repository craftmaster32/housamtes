import { StyleSheet } from 'react-native';
import { type ColorTokens } from '@constants/colors';
import { font } from '@constants/typography';
import { mf, ms } from '@utils/responsive';

// Shared by every "Around the house" row. Rows sit in one soft card, separated
// by hairlines, like a native iPhone list.
export const makeStyles = (c: ColorTokens, isDark: boolean): ReturnType<typeof StyleSheet.create> =>
  StyleSheet.create({
    editBtn: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: ms(4),
      minHeight: 44,
      paddingHorizontal: ms(4),
    },
    editText: { fontSize: mf(15), ...font.medium, color: isDark ? c.primaryLight : c.primary },

    group: {
      backgroundColor: c.surface,
      borderRadius: ms(22),
      borderWidth: 1,
      borderColor: isDark ? c.border : 'transparent',
      overflow: 'hidden',
    },
    separator: { height: StyleSheet.hairlineWidth, backgroundColor: c.border, marginStart: ms(52) },

    row: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: ms(14),
      minHeight: ms(62),
      paddingVertical: ms(12),
      paddingStart: ms(16),
      paddingEnd: ms(14),
    },
    rowPressed: { backgroundColor: c.surfaceSecondary },
    leading: { width: ms(22), alignItems: 'center' },
    main: { flex: 1, minWidth: 0 },
    title: { fontSize: mf(16), ...font.semibold, color: c.textPrimary, lineHeight: mf(21) },
    sub: { fontSize: mf(14), ...font.regular, color: c.textSecondary, marginTop: ms(2) },
    subAlert: { color: c.danger, ...font.semibold },
    trailingText: {
      fontSize: mf(14),
      ...font.semibold,
      color: c.textSecondary,
      fontVariant: ['tabular-nums'],
    },

    pill: {
      minHeight: ms(34),
      paddingHorizontal: ms(14),
      borderRadius: ms(17),
      backgroundColor: c.primaryTint,
      alignItems: 'center',
      justifyContent: 'center',
    },
    pillText: {
      fontSize: mf(14),
      ...font.semibold,
      color: isDark ? c.primaryLight : c.primaryDark,
    },

    // Grocery preview: tick items off without leaving home.
    groceryItems: { paddingStart: ms(52), paddingEnd: ms(14), paddingBottom: ms(8) },
    groceryRow: { flexDirection: 'row', alignItems: 'center', gap: ms(10), minHeight: 44 },
    groceryBox: {
      width: ms(22),
      height: ms(22),
      borderRadius: ms(11),
      borderWidth: 2,
      alignItems: 'center',
      justifyContent: 'center',
    },
    groceryName: { flex: 1, fontSize: mf(15), ...font.regular },
    groceryDone: { textDecorationLine: 'line-through' },

    empty: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: ms(12),
      minHeight: ms(62),
      paddingHorizontal: ms(16),
    },
    emptyText: { flex: 1, fontSize: mf(15), ...font.medium, color: c.textSecondary },
  });

export type DashboardListStyles = ReturnType<typeof makeStyles>;
