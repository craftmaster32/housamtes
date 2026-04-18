import { useState, useEffect, useCallback } from 'react';
import { View, StyleSheet, Pressable } from 'react-native';
import { Text } from 'react-native-paper';
import { useSpendingStore } from '@stores/spendingStore';
import { useSettingsStore } from '@stores/settingsStore';
import { colors } from '@constants/colors';
import { font } from '@constants/typography';
import { sizes } from '@constants/sizes';

interface Props {
  houseId: string;
  userName: string;
}

type Period = 3 | 6 | 12;

const PERIODS: { label: string; months: Period }[] = [
  { label: '3M', months: 3 },
  { label: '6M', months: 6 },
  { label: '12M', months: 12 },
];

const BAR_MAX_H = 64;

function fmtShort(n: number, currency: string): string {
  if (n >= 1000) return `${currency}${(n / 1000).toFixed(1)}k`;
  return `${currency}${n.toFixed(0)}`;
}

function fmtFull(n: number, currency: string): string {
  return `${currency}${n.toFixed(2)}`;
}

export function SpendingAnalytics({ houseId, userName }: Props): React.JSX.Element {
  const months    = useSpendingStore((s) => s.months);
  const isLoading = useSpendingStore((s) => s.isLoading);
  const load      = useSpendingStore((s) => s.load);
  const currency  = useSettingsStore((s) => s.currency);

  const [period, setPeriod] = useState<Period>(6);
  const selectPeriod = useCallback((p: Period) => setPeriod(p), []);

  useEffect(() => {
    if (houseId && userName) load(houseId, userName);
  }, [houseId, userName, load]);

  const current  = months[0];
  const previous = months[1];

  // Slice to period length then reverse for chronological (oldest → newest)
  const chartData = months.slice(0, period).reverse();
  const maxTotal  = Math.max(...chartData.map((m) => m.total), 1);

  const diff    = current && previous ? previous.total - current.total : null; // positive = spending down
  const isDown  = diff !== null && diff > 0;
  const diffAmt = diff !== null ? Math.abs(diff).toFixed(0) : null;
  const pct     = current && previous && previous.total > 0
    ? Math.round(Math.abs((current.total - previous.total) / previous.total) * 100)
    : null;

  const highest = chartData.length > 0
    ? chartData.reduce((a, b) => (b.total > a.total ? b : a))
    : null;
  const lowest = chartData.length > 0
    ? chartData.reduce((a, b) => (b.total < a.total ? b : a))
    : null;

  if (isLoading) {
    return (
      <View style={styles.card}>
        <View style={styles.decoCircle} />
        <View style={styles.pad}>
          <Text style={styles.labelText}>MY SPENDING</Text>
          <Text style={styles.loadingText}>Loading…</Text>
        </View>
      </View>
    );
  }

  if (!months.length || months.every((m) => m.total === 0)) {
    return (
      <View style={styles.card}>
        <View style={styles.decoCircle} />
        <View style={styles.pad}>
          <Text style={styles.labelText}>MY SPENDING</Text>
          <Text style={styles.amountText}>{currency}0.00</Text>
          <Text style={styles.emptyNote}>No expenses recorded yet.</Text>
        </View>
      </View>
    );
  }

  return (
    <View style={styles.card}>
      <View style={styles.decoCircle} />
      <View style={styles.decoCircleSm} />

      <View style={styles.pad}>
        {/* Header */}
        <View style={styles.headerRow}>
          <Text style={styles.labelText}>
            {current ? `${current.label.split(' ')[0].toUpperCase()} SPENDING` : 'MY SPENDING'}
          </Text>
          <View style={styles.pills}>
            {PERIODS.map((p) => (
              <Pressable
                key={p.label}
                style={[styles.pill, period === p.months && styles.pillActive]}
                onPress={() => selectPeriod(p.months)}
                accessibilityRole="button"
                accessibilityState={{ selected: period === p.months }}
              >
                <Text style={[styles.pillText, period === p.months && styles.pillTextActive]}>
                  {p.label}
                </Text>
              </Pressable>
            ))}
          </View>
        </View>

        {/* Amount + diff badge */}
        <View style={styles.amountRow}>
          <Text style={styles.amountText}>{current ? fmtFull(current.total, currency) : `${currency}0.00`}</Text>
          {diffAmt !== null && (
            <View style={styles.diffBadge}>
              <Text style={styles.diffBadgeText}>
                {isDown ? '↓' : '↑'} {isDown ? 'Down' : 'Up'} {currency}{diffAmt}
              </Text>
            </View>
          )}
        </View>

        {/* Bar chart */}
        <View style={styles.chartWrap}>
          <Text style={styles.chartLabel}>Past {period} months</Text>
          <View style={styles.barsRow}>
            {chartData.map((m) => {
              const isLatest = m.month === current?.month;
              const barH = Math.max((m.total / maxTotal) * BAR_MAX_H, m.total > 0 ? 4 : 2);
              return (
                <View key={m.month} style={styles.barCol}>
                  <Text style={styles.barAmt}>{m.total > 0 ? fmtShort(m.total, currency) : ''}</Text>
                  <View style={styles.barTrack}>
                    <View style={[styles.barFill, { height: barH }, isLatest && styles.barFillLatest]} />
                  </View>
                  <Text style={styles.barLbl}>{m.label.split(' ')[0].slice(0, 3)}</Text>
                </View>
              );
            })}
          </View>
          {highest && lowest && chartData.length > 1 && (
            <Text style={styles.chartNote}>
              Highest: {highest.label.split(' ')[0]} • Lowest: {lowest.label.split(' ')[0]}
            </Text>
          )}
        </View>

        {/* Month-over-month comparison */}
        {diff !== null && previous && (
          <View style={styles.compareRow}>
            <Text style={styles.compareAmt}>
              {isDown ? '↓' : '↑'} {fmtFull(Math.abs(diff), currency)} {isDown ? 'less' : 'more'}
            </Text>
            <Text style={styles.compareSub}>Compared to {previous.label.split(' ')[0]}</Text>
            {pct !== null && (
              <Text style={styles.comparePct}>{pct}% {isDown ? 'lower' : 'higher'} this month</Text>
            )}
          </View>
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: colors.primary,
    borderRadius: sizes.borderRadiusLg,
    overflow: 'hidden',
  },
  decoCircle: {
    position: 'absolute',
    top: -36,
    right: -18,
    width: 140,
    height: 140,
    borderRadius: 70,
    backgroundColor: 'rgba(255,255,255,0.10)',
  },
  decoCircleSm: {
    position: 'absolute',
    bottom: -54,
    right: 22,
    width: 118,
    height: 118,
    borderRadius: 59,
    backgroundColor: 'rgba(255,255,255,0.05)',
  },
  pad: { padding: 22, gap: 20 },

  headerRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  labelText: {
    fontSize: 12,
    ...font.extrabold,
    color: colors.white,
    letterSpacing: 0.96,
    textTransform: 'uppercase',
    opacity: 0.92,
  },
  pills: { flexDirection: 'row', gap: 8 },
  pill: {
    height: 30,
    minWidth: 44,
    borderRadius: 18,
    backgroundColor: 'rgba(255,255,255,0.14)',
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 12,
  },
  pillActive: { backgroundColor: 'rgba(255,255,255,0.24)' },
  pillText: { fontSize: 12, ...font.extrabold, color: 'rgba(255,255,255,0.88)', textAlign: 'center' },
  pillTextActive: { color: colors.white },

  amountRow: { flexDirection: 'row', alignItems: 'flex-end', justifyContent: 'space-between' },
  amountText: { fontSize: 42, ...font.extrabold, color: colors.white, letterSpacing: -1.26, lineHeight: 42 },
  diffBadge: {
    backgroundColor: 'rgba(255,255,255,0.14)',
    borderRadius: 18,
    paddingHorizontal: 10,
    paddingVertical: 8,
  },
  diffBadgeText: { fontSize: 12, ...font.extrabold, color: colors.white },

  chartWrap: { gap: 10 },
  chartLabel: { fontSize: 12, ...font.regular, color: 'rgba(255,255,255,0.84)' },
  barsRow: { flexDirection: 'row', alignItems: 'flex-end', gap: 12, height: 96 },
  barCol: { flex: 1, alignItems: 'center', gap: 8, justifyContent: 'flex-end' },
  barAmt: { fontSize: 11, ...font.bold, color: 'rgba(255,255,255,0.92)', textAlign: 'center' },
  barTrack: {
    width: 20,
    height: BAR_MAX_H,
    borderRadius: 999,
    backgroundColor: 'rgba(255,255,255,0.16)',
    justifyContent: 'flex-end',
    overflow: 'hidden',
  },
  barFill: { width: 20, borderRadius: 999, backgroundColor: 'rgba(255,255,255,0.32)' },
  barFillLatest: { backgroundColor: colors.white },
  barLbl: { fontSize: 11, ...font.regular, color: 'rgba(255,255,255,0.84)' },
  chartNote: { fontSize: 12, ...font.regular, color: colors.white, opacity: 0.84, textAlign: 'right' },

  compareRow: { alignItems: 'flex-start', gap: 2 },
  compareAmt: { fontSize: 16, ...font.extrabold, color: colors.white },
  compareSub: { fontSize: 12, ...font.regular, color: 'rgba(255,255,255,0.84)' },
  comparePct: { fontSize: 11, ...font.regular, color: 'rgba(255,255,255,0.80)' },

  loadingText: { fontSize: 14, ...font.regular, color: 'rgba(255,255,255,0.70)', marginTop: 8 },
  emptyNote:   { fontSize: 13, ...font.regular, color: 'rgba(255,255,255,0.60)', marginTop: 4 },
});
