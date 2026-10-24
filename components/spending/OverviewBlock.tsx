import { View, StyleSheet } from 'react-native';
import { Text } from 'react-native-paper';
import { useTranslation } from 'react-i18next';
import type { MonthSpend } from '@stores/spendingStore';
import { useThemedColors } from '@constants/colors';
import { font } from '@constants/typography';
import { useHeadingFont } from '@hooks/useHeadingFont';
import { useHandFont } from '@hooks/useHandFont';
import { localizedMonthLabel } from '@utils/dates';
import { CountUpText } from '@components/shared/CountUpText';
import {
  fmtFull,
  fmtShort,
  pctChange,
  type SpendingView,
} from '@components/spending/spendingFormat';
import { mf, ms } from '@utils/responsive';

interface OverviewBlockProps {
  current: MonthSpend;
  previous: MonthSpend | undefined;
  currency: string;
  view: SpendingView;
}

/** The chosen month in two big numbers, with the change since last month in pen. */
export function OverviewBlock({
  current,
  previous,
  currency,
  view,
}: OverviewBlockProps): React.JSX.Element {
  const { t, i18n } = useTranslation();
  const c = useThemedColors();
  const heading = useHeadingFont('semibold');
  const hand = useHandFont();
  const personal = view === 'personal';
  const main = personal ? current.total : current.houseTotal;
  const other = personal ? current.houseTotal : current.total;
  const prevMain = previous ? (personal ? previous.total : previous.houseTotal) : null;
  const diff = prevMain !== null ? main - prevMain : null;
  const pct = prevMain !== null ? pctChange(main, prevMain) : null;
  const up = diff !== null && diff > 0;
  const sharePct =
    current.houseTotal > 0 ? Math.round((current.total / current.houseTotal) * 100) : 0;

  return (
    <View style={[styles.card, { backgroundColor: c.surface }]}>
      <Text style={[styles.month, hand, { color: c.textSecondary }]}>
        {localizedMonthLabel(current.month, i18n.language)}
      </Text>
      <View style={styles.row}>
        <View style={styles.block}>
          <Text style={[styles.label, { color: c.textSecondary }]}>
            {personal ? t('spending.my_spending') : t('spending.house_total')}
          </Text>
          <CountUpText
            style={[styles.amt, heading, { color: c.textPrimary }]}
            value={main}
            format={(n) => fmtFull(n, currency)}
          />
          {diff !== null && (
            <Text style={[styles.change, hand, { color: up ? c.negative : c.positive }]}>
              {up ? '↑' : '↓'} {fmtShort(Math.abs(diff), currency)}
              {pct !== null ? ` · ${Math.abs(pct)}%` : ''}
            </Text>
          )}
        </View>
        <View style={styles.block}>
          <Text style={[styles.label, { color: c.textSecondary }]}>
            {personal ? t('spending.house_total') : t('spending.your_share')}
          </Text>
          <CountUpText
            style={[styles.amt, heading, { color: c.primary }]}
            value={other}
            format={(n) => fmtFull(n, currency)}
          />
          {sharePct > 0 && (
            <Text style={[styles.change, hand, { color: c.primary }]}>
              {t('spending.pct_of_house', { pct: sharePct })}
            </Text>
          )}
        </View>
      </View>
      {previous && (
        <Text style={[styles.compare, { color: c.textSecondary }]}>
          {personal
            ? t('spending.compare_personal', {
                month: localizedMonthLabel(previous.month, i18n.language),
                spent: fmtShort(previous.total, currency),
                house: fmtShort(previous.houseTotal, currency),
              })
            : t('spending.compare_house', {
                month: localizedMonthLabel(previous.month, i18n.language),
                house: fmtShort(previous.houseTotal, currency),
                share: fmtShort(previous.total, currency),
              })}
        </Text>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  card: { borderRadius: ms(18), padding: ms(16), gap: ms(8) },
  month: { fontSize: mf(19), lineHeight: mf(22) },
  row: { flexDirection: 'row', gap: ms(16) },
  block: { flex: 1, minWidth: 0 },
  label: { fontSize: mf(12.5), ...font.semibold },
  amt: { fontSize: mf(26), lineHeight: mf(34), letterSpacing: -0.5 },
  change: { fontSize: mf(17), lineHeight: mf(20) },
  compare: { fontSize: mf(12.5), lineHeight: mf(18), ...font.regular },
});
