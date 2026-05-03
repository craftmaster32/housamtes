import { useEffect, useCallback, useMemo } from 'react';
import { View, StyleSheet, Pressable, ActivityIndicator, FlatList } from 'react-native';
import { Text } from 'react-native-paper';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useAuthStore } from '@stores/authStore';
import { useSpendingStore, type CategorySpend, type MonthSpend } from '@stores/spendingStore';
import { useSettingsStore } from '@stores/settingsStore';
import { colors } from '@constants/colors';
import { font } from '@constants/typography';
import { sizes } from '@constants/sizes';

// ── Helpers ────────────────────────────────────────────────────────────────────

const BAR_MAX_H = 56;

function fmtFull(n: number, sym: string): string {
  return `${sym}${n.toFixed(2)}`;
}

function fmtShort(n: number, sym: string): string {
  if (n >= 1000) return `${sym}${(n / 1000).toFixed(1)}k`;
  return `${sym}${n.toFixed(0)}`;
}

function pctChange(current: number, previous: number): number | null {
  if (previous === 0) return null;
  return Math.round(((current - previous) / previous) * 100);
}

// ── Sub-components ─────────────────────────────────────────────────────────────

function InsightCard({
  insight,
  isLoading,
  onRefresh,
}: {
  insight: string | null;
  isLoading: boolean;
  onRefresh: () => void;
}): React.JSX.Element {
  return (
    <View style={styles.insightCard}>
      <View style={styles.insightCardDeco} />
      <View style={styles.insightCardPad}>
        <View style={styles.insightCardHeader}>
          <Text style={styles.insightCardLabel}>✨  AI INSIGHT</Text>
          <Pressable
            onPress={onRefresh}
            disabled={isLoading}
            accessible
            accessibilityRole="button"
            accessibilityLabel="Refresh insight"
          >
            {isLoading
              ? <ActivityIndicator color="rgba(255,255,255,0.7)" size="small" />
              : <Ionicons name="refresh-outline" size={16} color="rgba(255,255,255,0.70)" />
            }
          </Pressable>
        </View>
        {insight ? (
          <Text style={styles.insightCardText}>{insight}</Text>
        ) : (
          <Text style={styles.insightCardEmpty}>
            {isLoading ? 'Generating insight…' : 'No insight yet — add some bills first.'}
          </Text>
        )}
      </View>
    </View>
  );
}

function OverviewCard({
  current,
  previous,
  currency,
}: {
  current: MonthSpend;
  previous: MonthSpend | undefined;
  currency: string;
}): React.JSX.Element {
  const diff = previous ? current.houseTotal - previous.houseTotal : null;
  const pct  = previous ? pctChange(current.houseTotal, previous.houseTotal) : null;
  const isUp = diff !== null && diff > 0;
  const sharePct = current.houseTotal > 0
    ? Math.round((current.total / current.houseTotal) * 100)
    : 0;

  return (
    <View style={styles.overviewCard}>
      <Text style={styles.overviewMonth}>{current.label}</Text>

      <View style={styles.overviewRow}>
        {/* House */}
        <View style={styles.overviewBlock}>
          <Text style={styles.overviewLbl}>House total</Text>
          <Text style={styles.overviewAmt}>{fmtFull(current.houseTotal, currency)}</Text>
          {diff !== null && (
            <View style={[styles.overviewBadge, { backgroundColor: isUp ? colors.danger + '18' : colors.positive + '18' }]}>
              <Text style={[styles.overviewBadgeText, { color: isUp ? colors.danger : colors.positive }]}>
                {isUp ? '↑' : '↓'} {fmtShort(Math.abs(diff), currency)}
                {pct !== null ? `  ${Math.abs(pct)}%` : ''}
              </Text>
            </View>
          )}
        </View>

        <View style={styles.overviewDivider} />

        {/* My share */}
        <View style={styles.overviewBlock}>
          <Text style={styles.overviewLbl}>Your share</Text>
          <Text style={styles.overviewAmt}>{fmtFull(current.total, currency)}</Text>
          {sharePct > 0 && (
            <View style={[styles.overviewBadge, { backgroundColor: colors.primary + '12' }]}>
              <Text style={[styles.overviewBadgeText, { color: colors.primary }]}>
                {sharePct}% of house
              </Text>
            </View>
          )}
        </View>
      </View>

      {previous && (
        <Text style={styles.overviewCompare}>
          Compared to {previous.label}: house was {fmtShort(previous.houseTotal, currency)}, your share was {fmtShort(previous.total, currency)}
        </Text>
      )}
    </View>
  );
}

function MonthlyChart({
  months,
  currency,
}: {
  months: MonthSpend[];
  currency: string;
}): React.JSX.Element {
  const chartData = months.slice(0, 6).reverse();
  const maxHouse  = Math.max(...chartData.map((m) => m.houseTotal), 1);
  const current   = months[0];

  return (
    <View style={styles.chartCard}>
      <View style={styles.chartCardDeco} />
      <View style={styles.chartPad}>
        <Text style={styles.chartTitle}>MONTHLY TREND</Text>
        <View style={styles.barsRow}>
          {chartData.map((m) => {
            const isLatest  = m.month === current?.month;
            const houseBarH = Math.max((m.houseTotal / maxHouse) * BAR_MAX_H, m.houseTotal > 0 ? 4 : 2);
            const shareRatio = m.houseTotal > 0 ? m.total / m.houseTotal : 0;
            const shareBarH  = Math.round(houseBarH * shareRatio);

            return (
              <View key={m.month} style={styles.barCol}>
                <Text style={styles.barAmt}>{m.houseTotal > 0 ? fmtShort(m.houseTotal, currency) : ''}</Text>
                <View style={styles.barTrack}>
                  <View style={[styles.barFill, { height: houseBarH }, isLatest && styles.barFillLatest]} />
                  {shareBarH > 0 && (
                    <View style={[styles.barShareFill, { height: shareBarH }]} />
                  )}
                </View>
                <Text style={styles.barLbl}>{m.label.split(' ')[0].slice(0, 3)}</Text>
              </View>
            );
          })}
        </View>
        <View style={styles.chartLegend}>
          <View style={styles.legendItem}>
            <View style={[styles.legendDot, { backgroundColor: colors.white }]} />
            <Text style={styles.legendText}>House</Text>
          </View>
          <View style={styles.legendItem}>
            <View style={[styles.legendDot, { backgroundColor: 'rgba(255,255,255,0.38)' }]} />
            <Text style={styles.legendText}>Your share</Text>
          </View>
        </View>
      </View>
    </View>
  );
}

interface CategoryRowItem {
  cat: CategorySpend;
  myAmount: number;
  prevHouseAmount: number;
}

function CategoryRow({ item, currency }: { item: CategoryRowItem; currency: string }): React.JSX.Element {
  const { cat, myAmount, prevHouseAmount } = item;
  const pct = pctChange(cat.amount, prevHouseAmount);
  const isUp = pct !== null && pct > 0;

  return (
    <View style={styles.catRow}>
      <View style={[styles.catIcon, { backgroundColor: cat.color + '18' }]}>
        <Text style={styles.catIconText}>{cat.icon}</Text>
      </View>
      <View style={styles.catInfo}>
        <Text style={styles.catName}>{cat.name.charAt(0).toUpperCase() + cat.name.slice(1)}</Text>
        <Text style={styles.catSub}>
          House: {fmtShort(cat.amount, currency)}
          {myAmount > 0 ? `  ·  You: ${fmtShort(myAmount, currency)}` : ''}
        </Text>
      </View>
      {pct !== null && (
        <Text style={[styles.catPct, { color: isUp ? colors.danger : colors.positive }]}>
          {isUp ? '↑' : '↓'} {Math.abs(pct)}%
        </Text>
      )}
    </View>
  );
}

// ── Main screen ────────────────────────────────────────────────────────────────

export default function SpendingScreen(): React.JSX.Element {
  const profile        = useAuthStore((s) => s.profile);
  const houseId        = useAuthStore((s) => s.houseId);
  const months         = useSpendingStore((s) => s.months);
  const isLoading      = useSpendingStore((s) => s.isLoading);
  const insight        = useSpendingStore((s) => s.insight);
  const insightLoading = useSpendingStore((s) => s.insightLoading);
  const load           = useSpendingStore((s) => s.load);
  const fetchInsight   = useSpendingStore((s) => s.fetchInsight);
  const currency       = useSettingsStore((s) => s.currency);

  const userName = profile?.name ?? '';

  useEffect(() => {
    if (houseId && userName) load(houseId, userName);
  }, [houseId, userName, load]);

  useEffect(() => {
    if (months.length && houseId) fetchInsight(houseId, userName, currency);
  }, [months, houseId, userName, currency, fetchInsight]);

  const handleBack = useCallback(() => {
    router.back();
  }, []);

  const handleRefreshInsight = useCallback(() => {
    if (!houseId) return;
    useSpendingStore.setState({ insight: null, insightMonth: null });
    void fetchInsight(houseId, userName, currency);
  }, [houseId, userName, currency, fetchInsight]);

  const current  = months[0];
  const previous = months[1];

  // Build category rows: house categories this month, with user's share and prev month delta
  const categoryItems = useMemo((): CategoryRowItem[] => {
    if (!current) return [];
    return current.houseCategories.map((cat) => {
      const myAmount = current.categories.find((c) => c.name === cat.name)?.amount ?? 0;
      const prevHouseAmount = previous?.houseCategories.find((c) => c.name === cat.name)?.amount ?? 0;
      return { cat, myAmount, prevHouseAmount };
    });
  }, [current, previous]);

  const renderCategory = useCallback(({ item }: { item: CategoryRowItem }) => (
    <CategoryRow item={item} currency={currency} />
  ), [currency]);

  const keyExtractor = useCallback((item: CategoryRowItem) => item.cat.name, []);

  if (isLoading) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.header}>
          <Pressable onPress={handleBack} style={styles.backBtn} accessible accessibilityRole="button" accessibilityLabel="Go back">
            <Ionicons name="chevron-back" size={24} color={colors.textPrimary} />
          </Pressable>
          <Text style={styles.title}>Spending Analysis</Text>
          <View style={styles.backBtn} />
        </View>
        <View style={styles.centered}>
          <ActivityIndicator color={colors.primary} />
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <Pressable onPress={handleBack} style={styles.backBtn} accessible accessibilityRole="button" accessibilityLabel="Go back">
          <Ionicons name="chevron-back" size={24} color={colors.textPrimary} />
        </Pressable>
        <Text style={styles.title}>Spending Analysis</Text>
        <View style={styles.backBtn} />
      </View>

      <FlatList
        data={categoryItems}
        renderItem={renderCategory}
        keyExtractor={keyExtractor}
        contentContainerStyle={styles.scroll}
        ListHeaderComponent={
          <View style={styles.sections}>
            {/* AI Insight */}
            <InsightCard
              insight={insight}
              isLoading={insightLoading}
              onRefresh={handleRefreshInsight}
            />

            {/* Overview */}
            {current && current.houseTotal > 0 && (
              <OverviewCard current={current} previous={previous} currency={currency} />
            )}

            {/* Monthly chart */}
            {months.some((m) => m.houseTotal > 0) && (
              <MonthlyChart months={months} currency={currency} />
            )}

            {/* Categories header */}
            {categoryItems.length > 0 && (
              <Text style={styles.sectionTitle}>Categories this month</Text>
            )}
          </View>
        }
        ListEmptyComponent={
          !isLoading && current?.houseTotal === 0 ? (
            <View style={styles.emptyState}>
              <Text style={styles.emptyTitle}>No spending yet</Text>
              <Text style={styles.emptyText}>{'Add some bills and they\'ll appear here.'}</Text>
            </View>
          ) : null
        }
      />
    </SafeAreaView>
  );
}

// ── Styles ─────────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },

  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: sizes.md,
    paddingVertical: sizes.sm,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.border,
  },
  backBtn: { width: 40, height: 40, justifyContent: 'center' },
  title: { fontSize: 17, ...font.bold, color: colors.textPrimary },

  scroll: { padding: sizes.lg, paddingBottom: 60 },
  sections: { gap: sizes.md, marginBottom: sizes.md },

  // AI Insight card
  insightCard: {
    backgroundColor: colors.primary,
    borderRadius: sizes.borderRadiusLg,
    overflow: 'hidden',
  },
  insightCardDeco: {
    position: 'absolute',
    top: -30,
    right: -16,
    width: 120,
    height: 120,
    borderRadius: 60,
    backgroundColor: 'rgba(255,255,255,0.09)',
  },
  insightCardPad: { padding: 20, gap: 10 },
  insightCardHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  insightCardLabel: { fontSize: 11, ...font.extrabold, color: colors.white, letterSpacing: 1.1, opacity: 0.88 },
  insightCardText: { fontSize: 14, ...font.regular, color: colors.white, lineHeight: 21 },
  insightCardEmpty: { fontSize: 13, ...font.regular, color: 'rgba(255,255,255,0.60)', fontStyle: 'italic' },

  // Overview card
  overviewCard: {
    backgroundColor: colors.white,
    borderRadius: sizes.borderRadiusLg,
    padding: 20,
    gap: 14,
    boxShadow: '0 2px 8px rgba(0,0,0,0.05)',
  } as never,
  overviewMonth: { fontSize: 13, ...font.semibold, color: colors.textSecondary },
  overviewRow: { flexDirection: 'row', alignItems: 'flex-start', gap: sizes.md },
  overviewBlock: { flex: 1, gap: 4 },
  overviewLbl: { fontSize: 12, ...font.regular, color: colors.textSecondary },
  overviewAmt: { fontSize: 26, ...font.extrabold, color: colors.textPrimary, letterSpacing: -0.6 },
  overviewBadge: { alignSelf: 'flex-start', borderRadius: 8, paddingHorizontal: 8, paddingVertical: 3 },
  overviewBadgeText: { fontSize: 12, ...font.bold },
  overviewDivider: { width: 1, height: 56, backgroundColor: colors.border, marginTop: 16 },
  overviewCompare: { fontSize: 12, ...font.regular, color: colors.textSecondary, lineHeight: 18 },

  // Monthly chart
  chartCard: {
    backgroundColor: colors.primary,
    borderRadius: sizes.borderRadiusLg,
    overflow: 'hidden',
  },
  chartCardDeco: {
    position: 'absolute',
    bottom: -44,
    right: 16,
    width: 110,
    height: 110,
    borderRadius: 55,
    backgroundColor: 'rgba(255,255,255,0.06)',
  },
  chartPad: { padding: 20, gap: 14 },
  chartTitle: { fontSize: 11, ...font.extrabold, color: colors.white, letterSpacing: 1.1, opacity: 0.88 },
  barsRow: { flexDirection: 'row', alignItems: 'flex-end', gap: 10, height: 80 },
  barCol: { flex: 1, alignItems: 'center', gap: 6, justifyContent: 'flex-end' },
  barAmt: { fontSize: 10, ...font.bold, color: 'rgba(255,255,255,0.88)', textAlign: 'center' },
  barTrack: {
    width: 18,
    height: BAR_MAX_H,
    borderRadius: 999,
    backgroundColor: 'rgba(255,255,255,0.14)',
    justifyContent: 'flex-end',
    overflow: 'hidden',
    position: 'relative',
  },
  barFill: { width: 18, borderRadius: 999, backgroundColor: 'rgba(255,255,255,0.30)' },
  barFillLatest: { backgroundColor: colors.white },
  barShareFill: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: 'rgba(255,255,255,0.56)',
    borderRadius: 999,
  },
  barLbl: { fontSize: 10, ...font.regular, color: 'rgba(255,255,255,0.80)' },
  chartLegend: { flexDirection: 'row', gap: sizes.md },
  legendItem: { flexDirection: 'row', alignItems: 'center', gap: 5 },
  legendDot: { width: 8, height: 8, borderRadius: 4 },
  legendText: { fontSize: 11, ...font.regular, color: 'rgba(255,255,255,0.80)' },

  // Section title
  sectionTitle: { fontSize: 16, ...font.bold, color: colors.textPrimary },

  // Category rows
  catRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: sizes.sm,
    backgroundColor: colors.white,
    borderRadius: sizes.borderRadius,
    padding: sizes.md,
    marginBottom: sizes.xs,
    boxShadow: '0 1px 4px rgba(0,0,0,0.04)',
  } as never,
  catIcon: {
    width: 40,
    height: 40,
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
  },
  catIconText: { fontSize: 20 },
  catInfo: { flex: 1, gap: 2 },
  catName: { fontSize: 14, ...font.semibold, color: colors.textPrimary },
  catSub: { fontSize: 12, ...font.regular, color: colors.textSecondary },
  catPct: { fontSize: 13, ...font.bold },

  // States
  centered: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  emptyState: { alignItems: 'center', paddingVertical: sizes.xl, gap: sizes.sm },
  emptyTitle: { fontSize: sizes.fontMd, ...font.bold, color: colors.textPrimary },
  emptyText: { fontSize: sizes.fontSm, ...font.regular, color: colors.textSecondary, textAlign: 'center' },
});
