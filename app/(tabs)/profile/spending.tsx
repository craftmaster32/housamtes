import { useState, useEffect, useCallback, useMemo } from 'react';
import { View, StyleSheet, Pressable, ActivityIndicator, SectionList } from 'react-native';
import { Text } from 'react-native-paper';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router, useFocusEffect, Link } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useAuthStore } from '@stores/authStore';
import { useSpendingStore, type CategorySpend, type MonthSpend, type DrillDownItem } from '@stores/spendingStore';
import { useSettingsStore } from '@stores/settingsStore';
import { colors } from '@constants/colors';
import { font } from '@constants/typography';
import { sizes } from '@constants/sizes';

// ── Constants ──────────────────────────────────────────────────────────────────

const BAR_MAX_H = 56;

// Keyword-based matching so names like "Electricity Bill" or "Wifi" still land here
const HOUSE_BILL_KEYWORDS = [
  'rent', 'electric', 'water', 'internet', 'wifi', 'gas', 'tax',
  'arnona', 'insurance', 'maintenance', 'rates', 'mortgage',
  'strata', 'municipal', 'building', 'utilities', 'utility',
  'phone', 'broadband', 'council', 'body corporate',
];

// ── Helpers ────────────────────────────────────────────────────────────────────

function isHouseCat(name: string): boolean {
  const n = name.toLowerCase();
  return HOUSE_BILL_KEYWORDS.some((kw) => n.includes(kw));
}

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

// ── Types ──────────────────────────────────────────────────────────────────────

type ViewMode = 'house' | 'personal';

interface CategoryRowItem {
  cat: CategorySpend;
  myAmount: number;
  prevHouseAmount: number;
  sectionTotal: number;
  drillDownItems: DrillDownItem[];
}

interface SpendingSection {
  title: string;
  icon: string;
  total: number;
  data: CategoryRowItem[];
}

// ── Sub-components ─────────────────────────────────────────────────────────────

interface InsightCardProps {
  insight: string | null;
  error: string | null;
  isLoading: boolean;
  onRefresh: () => void;
}

function InsightCard({ insight, error, isLoading, onRefresh }: InsightCardProps): React.JSX.Element {
  return (
    <View style={styles.insightCard}>
      <View style={styles.insightCardDeco} />
      <View style={styles.insightCardPad}>
        <View style={styles.insightCardHeader}>
          <Text style={styles.insightCardLabel}>✨  AI INSIGHT</Text>
          <Pressable
            onPress={onRefresh}
            disabled={isLoading}
            style={styles.refreshBtn}
            accessible
            accessibilityRole="button"
            accessibilityLabel="Refresh insight"
            accessibilityState={{ disabled: isLoading }}
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
          <Text style={[styles.insightCardEmpty, error ? styles.insightCardError : null]}>
            {isLoading ? 'Generating insight…' : error ?? 'No insight yet — add some bills first.'}
          </Text>
        )}
      </View>
    </View>
  );
}

interface OverviewCardProps {
  current: MonthSpend;
  previous: MonthSpend | undefined;
  currency: string;
  viewMode: ViewMode;
}

function OverviewCard({ current, previous, currency, viewMode }: OverviewCardProps): React.JSX.Element {
  const isPersonal   = viewMode === 'personal';
  const houseDiff    = previous ? current.houseTotal - previous.houseTotal : null;
  const housePct     = previous ? pctChange(current.houseTotal, previous.houseTotal) : null;
  const personalDiff = previous ? current.total - previous.total : null;
  const personalPct  = previous ? pctChange(current.total, previous.total) : null;
  const sharePct     = current.houseTotal > 0
    ? Math.round((current.total / current.houseTotal) * 100)
    : 0;

  const primaryDiff  = isPersonal ? personalDiff : houseDiff;
  const primaryPct   = isPersonal ? personalPct  : housePct;
  const isUp         = primaryDiff !== null && primaryDiff > 0;

  return (
    <View style={styles.overviewCard}>
      <Text style={styles.overviewMonth}>{current.label}</Text>
      <View style={styles.overviewRow}>
        <View style={styles.overviewBlock}>
          <Text style={styles.overviewLbl}>{isPersonal ? 'My spending' : 'House total'}</Text>
          <Text style={styles.overviewAmt}>
            {fmtFull(isPersonal ? current.total : current.houseTotal, currency)}
          </Text>
          {primaryDiff !== null && (
            <View style={[styles.overviewBadge, { backgroundColor: isUp ? colors.danger + '18' : colors.positive + '18' }]}>
              <Text style={[styles.overviewBadgeText, { color: isUp ? colors.danger : colors.positive }]}>
                {isUp ? '↑' : '↓'} {fmtShort(Math.abs(primaryDiff), currency)}
                {primaryPct !== null ? `  ${Math.abs(primaryPct)}%` : ''}
              </Text>
            </View>
          )}
        </View>
        <View style={styles.overviewDivider} />
        <View style={styles.overviewBlock}>
          <Text style={styles.overviewLbl}>{isPersonal ? 'House total' : 'Your share'}</Text>
          <Text style={styles.overviewAmt}>
            {fmtFull(isPersonal ? current.houseTotal : current.total, currency)}
          </Text>
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
          {isPersonal
            ? `Compared to ${previous.label}: you spent ${fmtShort(previous.total, currency)}, house was ${fmtShort(previous.houseTotal, currency)}`
            : `Compared to ${previous.label}: house was ${fmtShort(previous.houseTotal, currency)}, your share was ${fmtShort(previous.total, currency)}`
          }
        </Text>
      )}
    </View>
  );
}

interface MonthlyChartProps {
  months: MonthSpend[];
  currency: string;
  selectedIdx: number;
  onSelectMonth: (idx: number) => void;
  viewMode: ViewMode;
}

function MonthlyChart({ months, currency, selectedIdx, onSelectMonth, viewMode }: MonthlyChartProps): React.JSX.Element {
  const chartData  = months.slice(0, 6).reverse();
  const isPersonal = viewMode === 'personal';
  const maxVal     = Math.max(...chartData.map((m) => isPersonal ? m.total : m.houseTotal), 1);

  return (
    <View style={styles.chartCard}>
      <View style={styles.chartCardDeco} />
      <View style={styles.chartPad}>
        <Text style={styles.chartTitle}>MONTHLY TREND — TAP A MONTH</Text>
        <View style={styles.barsRow}>
          {chartData.map((m, i) => {
            const monthsIdx  = chartData.length - 1 - i;
            const isSelected = monthsIdx === selectedIdx;
            const mainVal    = isPersonal ? m.total : m.houseTotal;
            const barH       = Math.max((mainVal / maxVal) * BAR_MAX_H, mainVal > 0 ? 4 : 2);
            const shareBarH  = !isPersonal && m.houseTotal > 0
              ? Math.round(barH * (m.total / m.houseTotal))
              : 0;

            return (
              <Pressable
                key={m.month}
                style={styles.barCol}
                onPress={() => onSelectMonth(monthsIdx)}
                accessible
                accessibilityRole="button"
                accessibilityLabel={`View spending for ${m.label}`}
                accessibilityState={{ selected: isSelected }}
              >
                <Text style={[styles.barAmt, isSelected && styles.barAmtSelected]}>
                  {mainVal > 0 ? fmtShort(mainVal, currency) : ''}
                </Text>
                <View style={[styles.barTrack, isSelected && styles.barTrackSelected]}>
                  <View style={[
                    styles.barFill,
                    { height: barH },
                    isSelected && styles.barFillSelected,
                  ]} />
                  {shareBarH > 0 && (
                    <View style={[styles.barShareFill, { height: shareBarH }]} />
                  )}
                </View>
                <Text style={[styles.barLbl, isSelected && styles.barLblSelected]}>
                  {m.label.split(' ')[0].slice(0, 3)}
                </Text>
                {isSelected && <View style={styles.barSelDot} />}
              </Pressable>
            );
          })}
        </View>
        <View style={styles.chartLegend}>
          {isPersonal ? (
            <View style={styles.legendItem}>
              <View style={[styles.legendDot, { backgroundColor: colors.white }]} />
              <Text style={styles.legendText}>Personal</Text>
            </View>
          ) : (
            <>
              <View style={styles.legendItem}>
                <View style={[styles.legendDot, { backgroundColor: colors.white }]} />
                <Text style={styles.legendText}>House</Text>
              </View>
              <View style={styles.legendItem}>
                <View style={[styles.legendDot, { backgroundColor: 'rgba(255,255,255,0.38)' }]} />
                <Text style={styles.legendText}>Your share</Text>
              </View>
            </>
          )}
        </View>
      </View>
    </View>
  );
}

interface CategoryRowProps {
  item: CategoryRowItem;
  currency: string;
  isExpanded: boolean;
  onToggle: (name: string) => void;
}

function CategoryRow({ item, currency, isExpanded, onToggle }: CategoryRowProps): React.JSX.Element {
  const { cat, myAmount, prevHouseAmount, sectionTotal, drillDownItems } = item;
  const pct       = pctChange(cat.amount, prevHouseAmount);
  const isUp      = pct !== null && pct > 0;
  const barPct    = sectionTotal > 0 ? Math.round((cat.amount / sectionTotal) * 100) : 0;
  const canExpand = drillDownItems.length > 0;

  const handlePress = useCallback(() => {
    if (canExpand) onToggle(cat.name);
  }, [canExpand, onToggle, cat.name]);

  return (
    <Pressable
      style={styles.catRow}
      onPress={canExpand ? handlePress : undefined}
      accessible
      accessibilityRole={canExpand ? 'button' : 'none'}
      accessibilityLabel={`${cat.name}, ${fmtFull(cat.amount, currency)}${canExpand ? ', tap to see details' : ''}`}
      accessibilityState={canExpand ? { expanded: isExpanded } : undefined}
    >
      <View style={[styles.catIcon, { backgroundColor: cat.color + '18' }]}>
        <Text style={styles.catIconText}>{cat.icon}</Text>
      </View>
      <View style={styles.catInfo}>
        <View style={styles.catTopRow}>
          <Text style={styles.catName}>{cat.name.charAt(0).toUpperCase() + cat.name.slice(1)}</Text>
          <View style={styles.catAmtGroup}>
            <Text style={styles.catAmt}>{fmtFull(cat.amount, currency)}</Text>
            {pct !== null && (
              <Text style={[styles.catPct, { color: isUp ? colors.danger : colors.positive }]}>
                {isUp ? '↑' : '↓'}{Math.abs(pct)}%
              </Text>
            )}
          </View>
          {canExpand && (
            <Ionicons
              name={isExpanded ? 'chevron-up' : 'chevron-down'}
              size={16}
              color={colors.textSecondary}
              style={styles.catChevron}
            />
          )}
        </View>
        <View style={styles.catBarTrack}>
          <View style={[styles.catBarFill, { width: `${barPct}%` as `${number}%`, backgroundColor: cat.color }]} />
        </View>
        {myAmount > 0 && (
          <Text style={styles.catMyShare}>Your share: {fmtFull(myAmount, currency)}</Text>
        )}
        {isExpanded && drillDownItems.length > 0 && (
          <View style={styles.drillDown}>
            {drillDownItems.map((d) => d.type === 'bill' ? (
              <Link key={d.id} href={{ pathname: '/(tabs)/bills/[id]', params: { id: d.id } }} asChild>
                <Pressable
                  style={styles.drillDownRow}
                  hitSlop={{ top: 4, bottom: 4, left: 8, right: 8 }}
                  accessible
                  accessibilityRole="link"
                  accessibilityLabel={`Open bill: ${d.title}`}
                >
                  <Text style={styles.drillDownType}>·</Text>
                  <Text style={styles.drillDownTitle} numberOfLines={1}>{d.title}</Text>
                  <Text style={styles.drillDownAmt}>{fmtFull(d.amount, currency)}</Text>
                  <Ionicons name="chevron-forward" size={12} color={colors.textSecondary} />
                </Pressable>
              </Link>
            ) : (
              <View key={d.id} style={styles.drillDownRow} accessible accessibilityRole="none">
                <Text style={styles.drillDownType}>↻</Text>
                <Text style={styles.drillDownTitle} numberOfLines={1}>{d.title}</Text>
                <Text style={styles.drillDownAmt}>{fmtFull(d.amount, currency)}</Text>
              </View>
            ))}
          </View>
        )}
      </View>
    </Pressable>
  );
}

interface SectionHeaderProps {
  title: string;
  icon: string;
  total: number;
  currency: string;
}

function SpendingSectionHeader({ title, icon, total, currency }: SectionHeaderProps): React.JSX.Element {
  return (
    <View style={styles.sectionHeader}>
      <Text style={styles.sectionHeaderIcon}>{icon}</Text>
      <Text style={styles.sectionHeaderTitle}>{title}</Text>
      <Text style={styles.sectionHeaderTotal}>{fmtFull(total, currency)}</Text>
    </View>
  );
}

// ── Main screen ────────────────────────────────────────────────────────────────

export default function SpendingScreen(): React.JSX.Element {
  const [selectedIdx, setSelectedIdx] = useState(0);
  const [expandedCategory, setExpandedCategory] = useState<string | null>(null);
  const [viewMode, setViewMode] = useState<ViewMode>('house');

  const profile        = useAuthStore((s) => s.profile);
  const houseId        = useAuthStore((s) => s.houseId);
  const months         = useSpendingStore((s) => s.months);
  const isLoading      = useSpendingStore((s) => s.isLoading);
  const error          = useSpendingStore((s) => s.error);
  const insight        = useSpendingStore((s) => s.insight);
  const insightError   = useSpendingStore((s) => s.insightError);
  const insightLoading = useSpendingStore((s) => s.insightLoading);
  const load           = useSpendingStore((s) => s.load);
  const fetchInsight   = useSpendingStore((s) => s.fetchInsight);
  const currency       = useSettingsStore((s) => s.currency);

  const userName = profile?.name ?? '';

  // Reload every time the screen comes into focus (picks up bill category edits etc.)
  useFocusEffect(
    useCallback(() => {
      if (houseId && userName) void load(houseId, userName);
    }, [houseId, userName, load])
  );

  useEffect(() => {
    if (months.length && houseId) fetchInsight(houseId, userName, currency);
  }, [months, houseId, userName, currency, fetchInsight]);

  const handleBack = useCallback(() => {
    router.back();
  }, []);

  const handleRefreshInsight = useCallback(() => {
    if (!houseId) return;
    useSpendingStore.setState({ insight: null, insightError: null, insightMonth: null });
    void fetchInsight(houseId, userName, currency);
  }, [houseId, userName, currency, fetchInsight]);

  const handleSelectMonth = useCallback((idx: number) => {
    setSelectedIdx(idx);
    setExpandedCategory(null);
  }, []);

  const handleToggleCategory = useCallback((name: string) => {
    setExpandedCategory((prev) => prev === name ? null : name);
  }, []);

  const handleSetHouseView = useCallback((): void => {
    setViewMode('house');
    setExpandedCategory(null);
  }, []);

  const handleSetPersonalView = useCallback((): void => {
    setViewMode('personal');
    setExpandedCategory(null);
  }, []);

  const selectedMonth = months[selectedIdx];
  const previousMonth = months[selectedIdx + 1];

  const sections = useMemo((): SpendingSection[] => {
    if (!selectedMonth) return [];

    const sourceCats    = viewMode === 'house' ? selectedMonth.houseCategories : selectedMonth.categories;
    const prevCats      = viewMode === 'house' ? previousMonth?.houseCategories : previousMonth?.categories;

    const houseBillCats = sourceCats.filter((c) => isHouseCat(c.name));
    const lifestyleCats = sourceCats.filter((c) => !isHouseCat(c.name));
    const houseBillTotal = houseBillCats.reduce((s, c) => s + c.amount, 0);
    const lifestyleTotal  = lifestyleCats.reduce((s, c) => s + c.amount, 0);

    function toCatRow(cat: CategorySpend, sectionTotal: number): CategoryRowItem {
      const myAmount = viewMode === 'house'
        ? (selectedMonth.categories.find((c) => c.name === cat.name)?.amount ?? 0)
        : 0;
      const prevHouseAmount = prevCats?.find((c) => c.name === cat.name)?.amount ?? 0;
      const drillDownItems  = selectedMonth.billsByCategory[cat.name] ?? [];
      return { cat, myAmount, prevHouseAmount, sectionTotal, drillDownItems };
    }

    const result: SpendingSection[] = [];
    if (houseBillCats.length > 0) {
      result.push({
        title: 'House Bills',
        icon: '🏠',
        total: houseBillTotal,
        data: houseBillCats.map((c) => toCatRow(c, houseBillTotal)),
      });
    }
    if (lifestyleCats.length > 0) {
      result.push({
        title: 'Lifestyle',
        icon: '🛍️',
        total: lifestyleTotal,
        data: lifestyleCats.map((c) => toCatRow(c, lifestyleTotal)),
      });
    }
    return result;
  }, [selectedMonth, previousMonth, viewMode]);

  const renderItem = useCallback(
    ({ item }: { item: CategoryRowItem }) => (
      <CategoryRow
        item={item}
        currency={currency}
        isExpanded={expandedCategory === item.cat.name}
        onToggle={handleToggleCategory}
      />
    ),
    [currency, expandedCategory, handleToggleCategory],
  );

  const renderSectionHeader = useCallback(
    ({ section }: { section: SpendingSection }) => (
      <SpendingSectionHeader
        title={section.title}
        icon={section.icon}
        total={section.total}
        currency={currency}
      />
    ),
    [currency],
  );

  const keyExtractor = useCallback((item: CategoryRowItem) => item.cat.name, []);

  const handleRetry = useCallback(() => {
    if (houseId && userName) void load(houseId, userName);
  }, [houseId, userName, load]);

  const handleJumpToCurrent = useCallback(() => setSelectedIdx(0), []);

  const pageHeader = (
    <View style={styles.header}>
      <Pressable
        onPress={handleBack}
        style={styles.backBtn}
        accessible
        accessibilityRole="button"
        accessibilityLabel="Go back"
      >
        <Ionicons name="chevron-back" size={24} color={colors.textPrimary} />
      </Pressable>
      <Text style={styles.title}>Spending Analysis</Text>
      <View style={styles.backBtn} />
    </View>
  );

  if (isLoading && months.length === 0) {
    return (
      <SafeAreaView style={styles.container}>
        {pageHeader}
        <View style={styles.centered}>
          <ActivityIndicator color={colors.primary} />
        </View>
      </SafeAreaView>
    );
  }

  if (error && months.length === 0) {
    return (
      <SafeAreaView style={styles.container}>
        {pageHeader}
        <View style={styles.centered}>
          <Text style={styles.errorTitle}>Could not load spending</Text>
          <Text style={styles.errorText}>{error}</Text>
          <Pressable
            style={styles.retryBtn}
            onPress={handleRetry}
            accessible
            accessibilityRole="button"
            accessibilityLabel="Retry loading spending data"
          >
            <Text style={styles.retryBtnText}>Try again</Text>
          </Pressable>
        </View>
      </SafeAreaView>
    );
  }

  const listHeader = (
    <View style={styles.listHeaderWrap}>
      <InsightCard
        insight={insight}
        error={insightError}
        isLoading={insightLoading}
        onRefresh={handleRefreshInsight}
      />

      {/* Toggle controls chart, overview, and breakdown */}
      <View style={styles.viewToggleWrap}>
        <View style={styles.viewToggle}>
          <Pressable
            style={[styles.viewToggleBtn, viewMode === 'house' && styles.viewToggleBtnActive]}
            onPress={handleSetHouseView}
            accessibilityRole="tab"
            accessibilityState={{ selected: viewMode === 'house' }}
            accessibilityLabel="Show all house spending"
          >
            <Text style={[styles.viewToggleBtnText, viewMode === 'house' && styles.viewToggleBtnTextActive]}>
              House
            </Text>
          </Pressable>
          <Pressable
            style={[styles.viewToggleBtn, viewMode === 'personal' && styles.viewToggleBtnActive]}
            onPress={handleSetPersonalView}
            accessibilityRole="tab"
            accessibilityState={{ selected: viewMode === 'personal' }}
            accessibilityLabel="Show my personal spending"
          >
            <Text style={[styles.viewToggleBtnText, viewMode === 'personal' && styles.viewToggleBtnTextActive]}>
              Personal
            </Text>
          </Pressable>
        </View>
      </View>

      {months.some((m) => (viewMode === 'house' ? m.houseTotal : m.total) > 0) && (
        <MonthlyChart
          months={months}
          currency={currency}
          selectedIdx={selectedIdx}
          onSelectMonth={handleSelectMonth}
          viewMode={viewMode}
        />
      )}

      {selectedIdx > 0 && (
        <Pressable
          style={styles.jumpBtn}
          onPress={handleJumpToCurrent}
          accessible
          accessibilityRole="button"
          accessibilityLabel="Jump to current month"
        >
          <Ionicons name="arrow-forward-circle-outline" size={16} color={colors.primary} />
          <Text style={styles.jumpBtnText}>Jump to current month</Text>
        </Pressable>
      )}

      {selectedMonth && (viewMode === 'house' ? selectedMonth.houseTotal : selectedMonth.total) > 0 && (
        <OverviewCard current={selectedMonth} previous={previousMonth} currency={currency} viewMode={viewMode} />
      )}

      {sections.length > 0 && (
        <Text style={styles.breakdownTitle}>
          {selectedMonth?.label ?? ''} breakdown
        </Text>
      )}
    </View>
  );

  return (
    <SafeAreaView style={styles.container}>
      {pageHeader}
      <SectionList<CategoryRowItem, SpendingSection>
        sections={sections}
        keyExtractor={keyExtractor}
        renderItem={renderItem}
        renderSectionHeader={renderSectionHeader}
        contentContainerStyle={styles.scroll}
        stickySectionHeadersEnabled={false}
        ListHeaderComponent={listHeader}
        ListEmptyComponent={
          !isLoading ? (
            <View style={styles.emptyState}>
              <Text style={styles.emptyTitle}>No spending yet</Text>
              <Text style={styles.emptyText}>
                {selectedIdx === 0
                  ? 'Add some bills and they\'ll appear here.'
                  : `No spending recorded for ${selectedMonth?.label ?? 'this month'}.`}
              </Text>
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
  backBtn: { width: 44, height: 44, justifyContent: 'center', alignItems: 'center' },
  title: { fontSize: 17, ...font.bold, color: colors.textPrimary },

  scroll: { padding: sizes.lg, paddingBottom: 60 },
  listHeaderWrap: { gap: sizes.md, marginBottom: sizes.sm },

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
  refreshBtn: { width: 44, height: 44, justifyContent: 'center', alignItems: 'center' },
  insightCardText: { fontSize: 14, ...font.regular, color: colors.white, lineHeight: 21 },
  insightCardEmpty: { fontSize: 13, ...font.regular, color: 'rgba(255,255,255,0.60)', fontStyle: 'italic' },
  insightCardError: { color: 'rgba(255,255,255,0.84)', fontStyle: 'normal' },

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
  barsRow: { flexDirection: 'row', alignItems: 'flex-end', gap: 10, height: 100 },
  barCol: { flex: 1, minWidth: 44, alignItems: 'center', gap: 5, justifyContent: 'flex-end' },
  barAmt: { fontSize: 9, ...font.bold, color: 'rgba(255,255,255,0.65)', textAlign: 'center' },
  barAmtSelected: { color: colors.white, fontSize: 10 },
  barTrack: {
    width: 18,
    height: BAR_MAX_H,
    borderRadius: 999,
    backgroundColor: 'rgba(255,255,255,0.14)',
    justifyContent: 'flex-end',
    overflow: 'hidden',
    position: 'relative',
  },
  barTrackSelected: { backgroundColor: 'rgba(255,255,255,0.22)' },
  barFill: { width: 18, borderRadius: 999, backgroundColor: 'rgba(255,255,255,0.30)' },
  barFillSelected: { backgroundColor: colors.white },
  barShareFill: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: 'rgba(255,255,255,0.56)',
    borderRadius: 999,
  },
  barLbl: { fontSize: 10, ...font.regular, color: 'rgba(255,255,255,0.70)' },
  barLblSelected: { color: colors.white, ...font.bold },
  barSelDot: {
    width: 5,
    height: 5,
    borderRadius: 3,
    backgroundColor: colors.white,
  },
  chartLegend: { flexDirection: 'row', gap: sizes.md },
  legendItem: { flexDirection: 'row', alignItems: 'center', gap: 5 },
  legendDot: { width: 8, height: 8, borderRadius: 4 },
  legendText: { fontSize: 11, ...font.regular, color: 'rgba(255,255,255,0.80)' },

  // Jump-to-current button
  jumpBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    alignSelf: 'flex-end',
    paddingHorizontal: 16,
    paddingVertical: 12,
    minHeight: 44,
    backgroundColor: colors.primary + '12',
    borderRadius: 22,
  },
  jumpBtnText: { fontSize: 13, ...font.semibold, color: colors.primary },

  breakdownTitle: { fontSize: 16, ...font.bold, color: colors.textPrimary, marginTop: 4 },
  viewToggleWrap: { alignItems: 'flex-end' },
  viewToggle: {
    flexDirection: 'row',
    backgroundColor: colors.surfaceSecondary,
    borderRadius: 10,
    padding: 3,
    borderWidth: 1,
    borderColor: colors.border,
  },
  viewToggleBtn: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 8,
    justifyContent: 'center',
    alignItems: 'center',
    minHeight: 44,
  },
  viewToggleBtnActive: { backgroundColor: colors.primary },
  viewToggleBtnText: { fontSize: 13, ...font.semibold, color: colors.textSecondary },
  viewToggleBtnTextActive: { color: colors.white },

  // Section headers
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingVertical: sizes.sm,
    paddingHorizontal: 2,
    marginTop: sizes.sm,
  },
  sectionHeaderIcon: { fontSize: 16 },
  sectionHeaderTitle: { flex: 1, fontSize: 14, ...font.bold, color: colors.textPrimary },
  sectionHeaderTotal: { fontSize: 14, ...font.bold, color: colors.textSecondary },

  // Category rows
  catRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
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
    marginTop: 2,
  },
  catIconText: { fontSize: 20 },
  catInfo: { flex: 1, gap: 4 },
  catTopRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  catName: { fontSize: 14, ...font.semibold, color: colors.textPrimary, flex: 1 },
  catAmtGroup: { alignItems: 'flex-end', gap: 1 },
  catAmt: { fontSize: 14, ...font.bold, color: colors.textPrimary },
  catPct: { fontSize: 11, ...font.bold },
  catBarTrack: {
    height: 4,
    borderRadius: 2,
    backgroundColor: 'rgba(0,0,0,0.06)',
    overflow: 'hidden',
  },
  catBarFill: { height: 4, borderRadius: 2 },
  catMyShare: { fontSize: 12, ...font.regular, color: colors.textSecondary },
  catChevron: { marginLeft: 4 },

  // Drill-down accordion
  drillDown: {
    marginTop: 8,
    paddingTop: 8,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: 'rgba(0,0,0,0.08)',
    gap: 6,
  },
  drillDownRow: { flexDirection: 'row', alignItems: 'center', gap: 8, minHeight: 44, paddingVertical: 4 },
  drillDownType: { width: 14, fontSize: 13, color: colors.textSecondary, textAlign: 'center' },
  drillDownTitle: { flex: 1, fontSize: 13, ...font.regular, color: colors.textSecondary },
  drillDownAmt: { fontSize: 13, ...font.semibold, color: colors.textPrimary },

  // States
  centered: { flex: 1, justifyContent: 'center', alignItems: 'center', gap: sizes.sm, padding: sizes.lg },
  emptyState: { alignItems: 'center', paddingVertical: sizes.xl, gap: sizes.sm },
  emptyTitle: { fontSize: sizes.fontMd, ...font.bold, color: colors.textPrimary },
  emptyText: { fontSize: sizes.fontSm, ...font.regular, color: colors.textSecondary, textAlign: 'center' },
  errorTitle: { fontSize: sizes.fontMd, ...font.bold, color: colors.textPrimary, textAlign: 'center' },
  errorText: { fontSize: sizes.fontSm, ...font.regular, color: colors.textSecondary, textAlign: 'center' },
  retryBtn: {
    marginTop: sizes.sm,
    backgroundColor: colors.primary,
    borderRadius: sizes.borderRadius,
    paddingHorizontal: sizes.lg,
    paddingVertical: sizes.sm,
    minHeight: 44,
    justifyContent: 'center',
    alignItems: 'center',
  },
  retryBtnText: { fontSize: sizes.fontSm, ...font.semibold, color: colors.white },
});
