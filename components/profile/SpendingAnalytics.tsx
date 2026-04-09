import { useState, useEffect, useCallback } from 'react';
import { View, StyleSheet, ScrollView, Pressable } from 'react-native';
import { Text } from 'react-native-paper';
import { useSpendingStore, type MonthSpend } from '@stores/spendingStore';
import { colors } from '@constants/colors';
import { font } from '@constants/typography';
import { sizes } from '@constants/sizes';

interface Props {
  houseId: string;
  userName: string;
}

function fmt(amount: number): string {
  if (amount >= 1000) return `$${(amount / 1000).toFixed(1)}k`;
  return `$${amount.toFixed(0)}`;
}

function deltaLabel(current: number, prev: number): { text: string; up: boolean } | null {
  if (prev === 0) return null;
  const pct = Math.round(((current - prev) / prev) * 100);
  return { text: `${pct > 0 ? '+' : ''}${pct}% vs last month`, up: pct > 0 };
}

export function SpendingAnalytics({ houseId, userName }: Props): React.JSX.Element {
  const months    = useSpendingStore((s) => s.months);
  const isLoading = useSpendingStore((s) => s.isLoading);
  const load      = useSpendingStore((s) => s.load);

  const [selectedIdx, setSelectedIdx] = useState(0); // 0 = most recent

  useEffect(() => {
    if (houseId && userName) load(houseId, userName);
  }, [houseId, userName, load]);

  const current: MonthSpend | undefined = months[selectedIdx];
  const prev: MonthSpend | undefined    = months[selectedIdx + 1];
  const delta = current && prev ? deltaLabel(current.total, prev.total) : null;
  const maxBar = Math.max(...(current?.categories.map((c) => c.amount) ?? [1]));
  const maxMonthTotal = Math.max(...months.map((m) => m.total), 1);

  const selectMonth = useCallback((i: number) => setSelectedIdx(i), []);

  if (isLoading) {
    return (
      <View style={styles.card}>
        <Text style={styles.sectionTitle}>💸 My Spending</Text>
        <Text style={styles.empty}>Loading…</Text>
      </View>
    );
  }

  if (months.length === 0 || (current && current.categories.length === 0 && months.every((m) => m.total === 0))) {
    return (
      <View style={styles.card}>
        <Text style={styles.sectionTitle}>💸 My Spending</Text>
        <Text style={styles.empty}>No expenses recorded yet. Add bills to see your spending breakdown.</Text>
      </View>
    );
  }

  return (
    <View style={styles.card}>
      <Text style={styles.sectionTitle}>💸 My Spending</Text>

      {/* ── Month selector ─────────────────────────────────────────── */}
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.monthRow}
      >
        {months.map((m, i) => (
          <Pressable
            key={m.month}
            onPress={() => selectMonth(i)}
            style={[styles.monthPill, i === selectedIdx && styles.monthPillActive]}
          >
            <Text style={[styles.monthPillText, i === selectedIdx && styles.monthPillTextActive]}>
              {m.label}
            </Text>
          </Pressable>
        ))}
      </ScrollView>

      {/* ── Hero total ─────────────────────────────────────────────── */}
      {current && (
        <View style={styles.heroWrap}>
          <Text style={styles.heroAmount}>{fmt(current.total)}</Text>
          <Text style={styles.heroLabel}>{current.label}</Text>
          {delta && (
            <View style={[styles.deltaPill, delta.up ? styles.deltaPillUp : styles.deltaPillDown]}>
              <Text style={[styles.deltaText, delta.up ? styles.deltaTextUp : styles.deltaTextDown]}>
                {delta.up ? '↑' : '↓'} {delta.text}
              </Text>
            </View>
          )}
        </View>
      )}

      {/* ── Category bars ──────────────────────────────────────────── */}
      {current && current.categories.length > 0 && (
        <View style={styles.barsWrap}>
          {current.categories.map((cat) => (
            <View key={cat.name} style={styles.barRow}>
              <View style={styles.barMeta}>
                <Text style={styles.barIcon}>{cat.icon}</Text>
                <Text style={styles.barName} numberOfLines={1}>{cat.name}</Text>
              </View>
              <View style={styles.barTrack}>
                <View
                  style={[
                    styles.barFill,
                    { width: `${(cat.amount / maxBar) * 100}%` as `${number}%`, backgroundColor: cat.color },
                  ]}
                />
              </View>
              <Text style={styles.barAmount}>{fmt(cat.amount)}</Text>
            </View>
          ))}
        </View>
      )}

      {current && current.categories.length === 0 && (
        <Text style={styles.empty}>No spending in {current.label}.</Text>
      )}

      {/* ── 6-month mini trend ─────────────────────────────────────── */}
      {months.some((m) => m.total > 0) && (
        <View style={styles.trendWrap}>
          <Text style={styles.trendLabel}>6-Month Trend</Text>
          <View style={styles.trendBars}>
            {[...months].reverse().map((m, i) => {
              const reverseIdx = months.length - 1 - i;
              const isActive = reverseIdx === selectedIdx;
              const barH = Math.max((m.total / maxMonthTotal) * 44, m.total > 0 ? 4 : 2);
              return (
                <Pressable key={m.month} style={styles.trendBarCol} onPress={() => selectMonth(reverseIdx)}>
                  <View style={[styles.trendBarFill, { height: barH, backgroundColor: isActive ? colors.primary : colors.surfaceSecondary }]} />
                  <Text style={[styles.trendBarLabel, isActive && styles.trendBarLabelActive]}>
                    {m.label.slice(0, 3)}
                  </Text>
                </Pressable>
              );
            })}
          </View>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: colors.surface,
    borderRadius: sizes.borderRadiusLg,
    padding: sizes.lg,
    gap: sizes.md,
    borderWidth: 1,
    borderColor: colors.border,
    boxShadow: '0 4px 16px rgba(44,51,61,0.04)',
  } as never,
  sectionTitle: {
    fontSize: 17,
    ...font.bold,
    color: colors.textPrimary,
    letterSpacing: -0.3,
  },

  // Month selector
  monthRow: { gap: 8, paddingVertical: 2 },
  monthPill: {
    paddingHorizontal: 14, paddingVertical: 6,
    borderRadius: 9999, borderWidth: 1, borderColor: colors.border,
    backgroundColor: colors.surfaceSecondary,
  },
  monthPillActive:     { backgroundColor: colors.primary, borderColor: colors.primary },
  monthPillText:       { fontSize: 13, ...font.semibold, color: colors.textSecondary },
  monthPillTextActive: { color: '#FFFFFF' },

  // Hero
  heroWrap:   { alignItems: 'center', gap: 4, paddingVertical: 8 },
  heroAmount: { fontSize: 40, ...font.extrabold, color: colors.textPrimary, letterSpacing: -1.5 },
  heroLabel:  { fontSize: 14, ...font.regular, color: colors.textSecondary },
  deltaPill:  { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 9999, marginTop: 2 },
  deltaPillUp:   { backgroundColor: colors.negative + '15' },
  deltaPillDown: { backgroundColor: colors.positive + '15' },
  deltaText:     { fontSize: 12, ...font.semibold },
  deltaTextUp:   { color: colors.negative },
  deltaTextDown: { color: colors.positive },

  // Category bars
  barsWrap: { gap: 10 },
  barRow:   { flexDirection: 'row', alignItems: 'center', gap: 8 },
  barMeta:  { flexDirection: 'row', alignItems: 'center', gap: 6, width: 110 },
  barIcon:  { fontSize: 14 },
  barName:  { fontSize: 13, ...font.medium, color: colors.textPrimary, flex: 1 },
  barTrack: { flex: 1, height: 10, backgroundColor: colors.surfaceSecondary, borderRadius: 5, overflow: 'hidden' },
  barFill:  { height: '100%', borderRadius: 5 },
  barAmount:{ fontSize: 13, ...font.bold, color: colors.textPrimary, width: 48, textAlign: 'right' },

  // 6-month trend
  trendWrap:        { gap: 8, paddingTop: 4 },
  trendLabel:       { fontSize: 11, ...font.bold, color: colors.textSecondary, letterSpacing: 0.8, textTransform: 'uppercase' },
  trendBars:        { flexDirection: 'row', alignItems: 'flex-end', gap: 6, height: 60 },
  trendBarCol:      { flex: 1, alignItems: 'center', gap: 4, justifyContent: 'flex-end' },
  trendBarFill:     { width: '100%', borderRadius: 4, minHeight: 2 },
  trendBarLabel:    { fontSize: 10, ...font.regular, color: colors.textSecondary },
  trendBarLabelActive: { ...font.bold, color: colors.primary },

  empty: { fontSize: 14, ...font.regular, color: colors.textSecondary, textAlign: 'center', paddingVertical: 8 },
});
