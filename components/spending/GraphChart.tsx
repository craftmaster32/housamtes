import { useId } from 'react';
import { View, StyleSheet, Pressable } from 'react-native';
import { Text } from 'react-native-paper';
import Svg, { Defs, Pattern, Path, Rect } from 'react-native-svg';
import { useTranslation } from 'react-i18next';
import type { MonthSpend } from '@stores/spendingStore';
import { lightColors } from '@constants/colors';
import { font } from '@constants/typography';
import { useHandFont } from '@hooks/useHandFont';
import { monthNameFromKey, localizedMonthLabel } from '@utils/dates';
import { PenCircle } from '@components/shared/PenCircle';
import { fmtShort, type SpendingView } from '@components/spending/spendingFormat';
import { mf, ms } from '@utils/responsive';

// Squared maths paper: light inks in both themes.
const P = lightColors;
const PAPER = '#FBFCFA';
const GRID = 'rgba(79,120,176,0.16)';
const BAR_MAX_H = ms(96);

/**
 * Pencil hatching. Each Svg defines its own copy: on iOS a pattern can only be
 * used inside the Svg that defines it.
 */
function Hatch({ id }: { id: string }): React.JSX.Element {
  return (
    <Defs>
      <Pattern id={id} width={6} height={6} patternUnits="userSpaceOnUse">
        <Path d="M0 6 L6 0" stroke="rgba(34,32,29,0.55)" strokeWidth={1.2} />
      </Pattern>
    </Defs>
  );
}

interface GraphChartProps {
  months: MonthSpend[];
  currency: string;
  selectedIdx: number;
  view: SpendingView;
  onSelectMonth: (idx: number) => void;
}

/**
 * The last six months as bars coloured in on squared paper. In the house view
 * your share is hatched in pencil at the bottom of each bar; the chosen month's
 * name is circled in pen.
 */
export function GraphChart({
  months,
  currency,
  selectedIdx,
  view,
  onSelectMonth,
}: GraphChartProps): React.JSX.Element {
  const { t, i18n } = useTranslation();
  const hand = useHandFont();
  // Unique per chart so two charts on one web page don't share pattern ids.
  const uid = `spend${useId().replace(/[^a-zA-Z0-9]/g, '')}`;
  const data = months.slice(0, 6).reverse();
  const personal = view === 'personal';
  const maxVal = Math.max(...data.map((m) => (personal ? m.total : m.houseTotal)), 1);

  return (
    <View style={styles.paper}>
      <Svg width="100%" height="100%" style={StyleSheet.absoluteFill} pointerEvents="none">
        <Defs>
          <Pattern id={`${uid}-grid`} width={14} height={14} patternUnits="userSpaceOnUse">
            <Path d="M14 0 H0 V14" stroke={GRID} strokeWidth={1} fill="none" />
          </Pattern>
        </Defs>
        <Rect width="100%" height="100%" fill={`url(#${uid}-grid)`} />
      </Svg>

      <Text style={[styles.title, hand]}>{t('spending.monthly_trend')}</Text>
      <View style={styles.bars}>
        {data.map((m, i) => {
          const idx = data.length - 1 - i;
          const on = idx === selectedIdx;
          const val = personal ? m.total : m.houseTotal;
          const h = Math.max((val / maxVal) * BAR_MAX_H, val > 0 ? 4 : 2);
          const shareH = !personal && m.houseTotal > 0 ? h * (m.total / m.houseTotal) : 0;
          return (
            <Pressable
              key={m.month}
              style={styles.col}
              onPress={() => onSelectMonth(idx)}
              accessibilityRole="button"
              accessibilityLabel={t('spending.view_month', {
                month: localizedMonthLabel(m.month, i18n.language),
              })}
              accessibilityState={{ selected: on }}
            >
              <Text style={[styles.amt, on && styles.amtOn]} numberOfLines={1}>
                {val > 0 ? fmtShort(val, currency) : ''}
              </Text>
              <View
                style={[
                  styles.bar,
                  { height: h, backgroundColor: on ? P.primary : 'rgba(79,120,176,0.45)' },
                ]}
              >
                {shareH > 0 && (
                  <Svg width="100%" height={shareH} style={styles.share}>
                    <Hatch id={`${uid}-bar${i}`} />
                    <Rect width="100%" height="100%" fill={`url(#${uid}-bar${i})`} />
                  </Svg>
                )}
              </View>
              <View style={styles.monthWrap}>
                {on && <PenCircle color={P.negative} style={styles.ring} strokeWidth={1.8} />}
                <Text style={[styles.month, hand, on && styles.monthOn]}>
                  {monthNameFromKey(m.month, i18n.language)}
                </Text>
              </View>
            </Pressable>
          );
        })}
      </View>
      {!personal && (
        <View style={styles.legend}>
          <View style={[styles.key, styles.keyHouse]} />
          <Text style={styles.legendText}>{t('spending.house_label')}</Text>
          <Svg width={12} height={12}>
            <Rect width={12} height={12} fill="rgba(79,120,176,0.45)" />
            <Hatch id={`${uid}-key`} />
            <Rect width={12} height={12} fill={`url(#${uid}-key)`} />
          </Svg>
          <Text style={styles.legendText}>{t('spending.your_share')}</Text>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  paper: {
    backgroundColor: PAPER,
    borderRadius: ms(6),
    padding: ms(16),
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: ms(2) },
    shadowOpacity: 0.12,
    shadowRadius: 6,
    elevation: 2,
  },
  title: { fontSize: mf(20), lineHeight: mf(24), color: P.paperMuted, marginBottom: ms(8) },
  bars: { flexDirection: 'row', alignItems: 'flex-end', gap: ms(8) },
  col: { flex: 1, alignItems: 'center' },
  amt: { fontSize: mf(10.5), ...font.semibold, color: P.paperMuted, marginBottom: ms(3) },
  amtOn: { color: P.paperInk, ...font.bold },
  bar: {
    width: '70%',
    borderTopLeftRadius: ms(3),
    borderTopRightRadius: ms(3),
    justifyContent: 'flex-end',
    overflow: 'hidden',
  },
  share: { position: 'absolute', bottom: 0, left: 0 },
  monthWrap: { marginTop: ms(6), paddingHorizontal: ms(6), paddingVertical: ms(2) },
  ring: {
    position: 'absolute',
    top: -ms(2),
    bottom: -ms(2),
    left: -ms(2),
    right: -ms(2),
    transform: [{ rotate: '-5deg' }],
  },
  month: { fontSize: mf(16), color: P.paperMuted },
  monthOn: { color: P.paperInk },
  legend: { flexDirection: 'row', alignItems: 'center', gap: ms(6), marginTop: ms(12) },
  key: { width: 12, height: 12 },
  keyHouse: { backgroundColor: P.primary },
  legendText: { fontSize: mf(12), ...font.medium, color: P.paperMuted, marginEnd: ms(8) },
});
