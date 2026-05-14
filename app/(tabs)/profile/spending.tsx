// app/(tabs)/profile/spending.v2.tsx
// V2 Spending Analysis — drop-in replacement for the existing screen.
// Same data contracts (useSpendingStore, useAuthStore, useSettingsStore).
// Adds: dark theme support, Reanimated bar transitions, count-up amounts,
// LayoutAnimation drill-downs, swipe-to-jump-month gesture, locale-aware
// currency formatting via constants/currencies.
//
// To roll out, rename to `spending.tsx` to replace the existing screen.
// All deps (Reanimated 3, Gesture Handler 2, Haptics) are already in the
// project's package.json — no installs required.

import { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import {
  View, StyleSheet, Pressable, ActivityIndicator, SectionList,
  LayoutAnimation, Platform, UIManager,
} from 'react-native';
import { Text } from 'react-native-paper';
import Animated, {
  useSharedValue, useAnimatedStyle, withTiming, withSpring,
  cancelAnimation, runOnJS, Easing,
} from 'react-native-reanimated';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router, useFocusEffect } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { useAuthStore } from '@stores/authStore';
import {
  useSpendingStore,
  type CategorySpend, type MonthSpend, type DrillDownItem,
} from '@stores/spendingStore';
import { useSettingsStore } from '@stores/settingsStore';
import { useThemedColors, type ColorTokens } from '@constants/colors';
import { font } from '@constants/typography';
import { sizes } from '@constants/sizes';
import {
  formatFull, formatShort, getCurrency,
  type CurrencyCode,
} from '@constants/currencies';

// Enable LayoutAnimation on Android.
if (Platform.OS === 'android' && UIManager.setLayoutAnimationEnabledExperimental) {
  UIManager.setLayoutAnimationEnabledExperimental(true);
}

// ── Constants ──────────────────────────────────────────────────────────────────

const BAR_MAX_H = 64;
const SWIPE_DISTANCE_THRESHOLD = 60;
const SWIPE_VELOCITY_THRESHOLD = 500;
const COUNT_UP_DURATION_MS = 900;

const HOUSE_BILL_KEYWORDS = [
  'rent', 'electric', 'water', 'internet', 'wifi', 'gas', 'tax',
  'arnona', 'insurance', 'maintenance', 'rates', 'mortgage',
  'strata', 'municipal', 'building', 'utilities', 'utility',
  'phone', 'broadband', 'council', 'body corporate',
];

function isHouseCat(name: string): boolean {
  const n = name.toLowerCase();
  return HOUSE_BILL_KEYWORDS.some((kw) => n.includes(kw));
}

function pctChange(current: number, previous: number): number | null {
  if (previous === 0) return null;
  return Math.round(((current - previous) / previous) * 100);
}

// ── Types ──────────────────────────────────────────────────────────────────────

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

// ── Hooks ──────────────────────────────────────────────────────────────────────

/** Animates a number from its current displayed value to `target` over `duration` ms. */
function useCountUp(target: number, duration = COUNT_UP_DURATION_MS): number {
  const [display, setDisplay] = useState(target);
  const fromRef = useRef(target);
  const startRef = useRef<number | null>(null);
  const rafRef   = useRef<number | null>(null);

  useEffect(() => {
    fromRef.current  = display;
    startRef.current = null;
    if (rafRef.current != null) cancelAnimationFrame(rafRef.current);

    const tick = (t: number): void => {
      if (startRef.current == null) startRef.current = t;
      const p = Math.min(1, (t - startRef.current) / duration);
      const eased = 1 - Math.pow(1 - p, 3);
      const v = fromRef.current + (target - fromRef.current) * eased;
      setDisplay(v);
      if (p < 1) rafRef.current = requestAnimationFrame(tick);
    };
    rafRef.current = requestAnimationFrame(tick);

    return (): void => {
      if (rafRef.current != null) cancelAnimationFrame(rafRef.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [target, duration]);

  return display;
}

// ── Sub-components ─────────────────────────────────────────────────────────────

interface InsightCardProps {
  insight: string | null;
  isLoading: boolean;
  onRefresh: () => void;
  C: ColorTokens;
}

function InsightCard({ insight, isLoading, onRefresh, C }: InsightCardProps): React.JSX.Element {
  // Real refresh-spinning animation tied to isLoading.
  const rotation = useSharedValue(0);
  useEffect(() => {
    if (isLoading) {
      rotation.value = 0;
      rotation.value = withTiming(360, { duration: 900, easing: Easing.linear }, (finished) => {
        if (finished && isLoading) {
          // Loop while loading.
          rotation.value = 0;
        }
      });
    } else {
      cancelAnimation(rotation);
      rotation.value = withTiming(0, { duration: 200 });
    }
  }, [isLoading, rotation]);

  const spinStyle = useAnimatedStyle(() => ({
    transform: [{ rotate: `${rotation.value}deg` }],
  }));

  const s = makeStyles(C);

  return (
    <View style={s.insightCard}>
      <View style={s.insightCardDeco} />
      <View style={s.insightCardDecoSm} />
      <View style={s.insightCardPad}>
        <View style={s.insightCardHeader}>
          <View style={s.insightLabelRow}>
            <Ionicons name="sparkles" size={12} color={C.white} />
            <Text style={s.insightCardLabel}>AI INSIGHT</Text>
          </View>
          <Pressable
            onPress={onRefresh}
            disabled={isLoading}
            style={s.refreshBtn}
            accessible
            accessibilityRole="button"
            accessibilityLabel="Refresh insight"
            accessibilityState={{ disabled: isLoading }}
          >
            <Animated.View style={spinStyle}>
              <Ionicons name="refresh-outline" size={16} color="rgba(255,255,255,0.85)" />
            </Animated.View>
          </Pressable>
        </View>
        {insight ? (
          <Text style={s.insightCardText}>{insight}</Text>
        ) : (
          <Text style={s.insightCardEmpty}>
            {isLoading ? 'Generating insight…' : 'No insight yet — add some bills first.'}
          </Text>
        )}
      </View>
    </View>
  );
}

interface OverviewCardProps {
  current: MonthSpend;
  previous: MonthSpend | undefined;
  currencyCode: CurrencyCode;
  C: ColorTokens;
}

function OverviewCard({ current, previous, currencyCode, C }: OverviewCardProps): React.JSX.Element {
  const houseAnimated = useCountUp(current.houseTotal);
  const yourAnimated  = useCountUp(current.total);
  const diff = previous ? current.houseTotal - previous.houseTotal : null;
  const pct  = previous ? pctChange(current.houseTotal, previous.houseTotal) : null;
  const isUp = diff !== null && diff > 0;
  const sharePct = current.houseTotal > 0
    ? Math.round((current.total / current.houseTotal) * 100)
    : 0;
  const s = makeStyles(C);

  return (
    <View style={s.overviewCard}>
      <Text style={s.overviewMonth}>{current.label}</Text>
      <View style={s.overviewRow}>
        <View style={s.overviewBlock}>
          <Text style={s.overviewLbl}>House total</Text>
          <Text style={s.overviewAmt}>{formatFull(houseAnimated, currencyCode)}</Text>
          {diff !== null && (
            <View style={[s.overviewBadge, { backgroundColor: isUp ? C.danger + '24' : C.positive + '24' }]}>
              <Text style={[s.overviewBadgeText, { color: isUp ? C.danger : C.positive }]}>
                {isUp ? '↑' : '↓'} {formatShort(Math.abs(diff), currencyCode)}
                {pct !== null ? `  ${Math.abs(pct)}%` : ''}
              </Text>
            </View>
          )}
        </View>
        <View style={s.overviewDivider} />
        <View style={s.overviewBlock}>
          <Text style={s.overviewLbl}>Your share</Text>
          <Text style={s.overviewAmt}>{formatFull(yourAnimated, currencyCode)}</Text>
          {sharePct > 0 && (
            <View style={[s.overviewBadge, { backgroundColor: C.primary + '20' }]}>
              <Text style={[s.overviewBadgeText, { color: C.primary }]}>
                {sharePct}% of house
              </Text>
            </View>
          )}
        </View>
      </View>
      {previous && (
        <Text style={s.overviewCompare}>
          Compared to {previous.label}: house was {formatShort(previous.houseTotal, currencyCode)}, your share was {formatShort(previous.total, currencyCode)}
        </Text>
      )}
    </View>
  );
}

interface MonthlyChartProps {
  months: MonthSpend[];
  currencyCode: CurrencyCode;
  selectedIdx: number;
  onSelectMonth: (idx: number) => void;
  C: ColorTokens;
}

function MonthlyChart({ months, currencyCode, selectedIdx, onSelectMonth, C }: MonthlyChartProps): React.JSX.Element {
  const chartData = months.slice(0, 6).reverse();
  const maxHouse  = Math.max(...chartData.map((m) => m.houseTotal), 1);
  const s = makeStyles(C);

  return (
    <View style={s.chartCard}>
      <View style={s.chartCardDeco} />
      <View style={s.chartPad}>
        <Text style={s.chartTitle}>MONTHLY TREND — TAP A MONTH OR SWIPE</Text>
        <View style={s.barsRow}>
          {chartData.map((m, i) => {
            const monthsIdx  = chartData.length - 1 - i;
            const isSelected = monthsIdx === selectedIdx;
            const houseBarH  = Math.max((m.houseTotal / maxHouse) * BAR_MAX_H, m.houseTotal > 0 ? 4 : 2);
            const shareRatio = m.houseTotal > 0 ? m.total / m.houseTotal : 0;
            const shareBarH  = Math.round(houseBarH * shareRatio);

            return (
              <BarColumn
                key={m.month}
                month={m}
                isSelected={isSelected}
                houseBarH={houseBarH}
                shareBarH={shareBarH}
                currencyCode={currencyCode}
                onPress={() => onSelectMonth(monthsIdx)}
                C={C}
              />
            );
          })}
        </View>
        <View style={s.chartLegend}>
          <View style={s.legendItem}>
            <View style={[s.legendDot, { backgroundColor: C.white }]} />
            <Text style={s.legendText}>House</Text>
          </View>
          <View style={s.legendItem}>
            <View style={[s.legendDot, { backgroundColor: 'rgba(255,255,255,0.38)' }]} />
            <Text style={s.legendText}>Your share</Text>
          </View>
        </View>
      </View>
    </View>
  );
}

interface BarColumnProps {
  month: MonthSpend;
  isSelected: boolean;
  houseBarH: number;
  shareBarH: number;
  currencyCode: CurrencyCode;
  onPress: () => void;
  C: ColorTokens;
}

function BarColumn({
  month, isSelected, houseBarH, shareBarH, currencyCode, onPress, C,
}: BarColumnProps): React.JSX.Element {
  const houseH = useSharedValue(houseBarH);
  const shareH = useSharedValue(shareBarH);
  const sel    = useSharedValue(isSelected ? 1 : 0);
  const s = makeStyles(C);

  useEffect(() => {
    houseH.value = withSpring(houseBarH, { damping: 14, stiffness: 120 });
    shareH.value = withSpring(shareBarH, { damping: 14, stiffness: 120 });
  }, [houseBarH, shareBarH, houseH, shareH]);

  useEffect(() => {
    sel.value = withTiming(isSelected ? 1 : 0, { duration: 250 });
  }, [isSelected, sel]);

  const houseStyle = useAnimatedStyle(() => ({ height: houseH.value }));
  const shareStyle = useAnimatedStyle(() => ({ height: shareH.value }));

  return (
    <Pressable
      style={s.barCol}
      onPress={onPress}
      accessible
      accessibilityRole="button"
      accessibilityLabel={`View spending for ${month.label}`}
      accessibilityState={{ selected: isSelected }}
    >
      <Text style={[s.barAmt, isSelected && s.barAmtSelected]}>
        {month.houseTotal > 0 ? formatShort(month.houseTotal, currencyCode) : ''}
      </Text>
      <View style={[s.barTrack, isSelected && s.barTrackSelected]}>
        <Animated.View style={[s.barFill, houseStyle, isSelected && s.barFillSelected]} />
        {shareBarH > 0 && (
          <Animated.View style={[s.barShareFill, shareStyle]} />
        )}
      </View>
      <Text style={[s.barLbl, isSelected && s.barLblSelected]}>
        {month.label.split(' ')[0].slice(0, 3)}
      </Text>
      <View style={[s.barSelDot, { opacity: isSelected ? 1 : 0 }]} />
    </Pressable>
  );
}

interface CategoryRowProps {
  item: CategoryRowItem;
  currencyCode: CurrencyCode;
  isExpanded: boolean;
  onToggle: (name: string) => void;
  C: ColorTokens;
}

function CategoryRow({ item, currencyCode, isExpanded, onToggle, C }: CategoryRowProps): React.JSX.Element {
  const { cat, myAmount, prevHouseAmount, sectionTotal, drillDownItems } = item;
  const pct       = pctChange(cat.amount, prevHouseAmount);
  const isUp      = pct !== null && pct > 0;
  const barPct    = sectionTotal > 0 ? Math.round((cat.amount / sectionTotal) * 100) : 0;
  const canExpand = drillDownItems.length > 0;
  const s = makeStyles(C);

  // Animated chevron rotation + bar fill.
  const chevronRot = useSharedValue(isExpanded ? 180 : 0);
  const barWidth   = useSharedValue(0);

  useEffect(() => {
    chevronRot.value = withTiming(isExpanded ? 180 : 0, { duration: 250 });
  }, [isExpanded, chevronRot]);

  useEffect(() => {
    barWidth.value = withTiming(barPct, { duration: 500, easing: Easing.bezier(0.2, 0.7, 0.2, 1) });
  }, [barPct, barWidth]);

  const chevStyle = useAnimatedStyle(() => ({
    transform: [{ rotate: `${chevronRot.value}deg` }],
  }));
  const barStyle = useAnimatedStyle(() => ({
    width: `${barWidth.value}%` as `${number}%`,
  }));

  const handlePress = useCallback(() => {
    if (!canExpand) return;
    LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
    void Haptics.selectionAsync();
    onToggle(cat.name);
  }, [canExpand, onToggle, cat.name]);

  return (
    <Pressable
      style={s.catRow}
      onPress={canExpand ? handlePress : undefined}
      accessible
      accessibilityRole={canExpand ? 'button' : 'none'}
      accessibilityLabel={`${cat.name}, ${formatFull(cat.amount, currencyCode)}${canExpand ? ', tap to see details' : ''}`}
      accessibilityState={canExpand ? { expanded: isExpanded } : undefined}
    >
      <View style={[s.catIcon, { backgroundColor: cat.color + '24' }]}>
        <Text style={s.catIconText}>{cat.icon}</Text>
      </View>
      <View style={s.catInfo}>
        <View style={s.catTopRow}>
          <Text style={s.catName}>{cat.name.charAt(0).toUpperCase() + cat.name.slice(1)}</Text>
          <View style={s.catAmtGroup}>
            <Text style={s.catAmt}>{formatFull(cat.amount, currencyCode)}</Text>
            {pct !== null && (
              <Text style={[s.catPct, { color: isUp ? C.danger : C.positive }]}>
                {isUp ? '↑' : '↓'}{Math.abs(pct)}%
              </Text>
            )}
          </View>
          {canExpand && (
            <Animated.View style={[s.catChevron, chevStyle]}>
              <Ionicons name="chevron-down" size={16} color={C.textSecondary} />
            </Animated.View>
          )}
        </View>
        <View style={s.catBarTrack}>
          <Animated.View style={[s.catBarFill, { backgroundColor: cat.color }, barStyle]} />
        </View>
        {myAmount > 0 && (
          <Text style={s.catMyShare}>Your share: {formatFull(myAmount, currencyCode)}</Text>
        )}
        {isExpanded && drillDownItems.length > 0 && (
          <View style={s.drillDown}>
            {drillDownItems.map((d) => (
              <View key={d.id} style={s.drillDownRow}>
                <Text style={s.drillDownType}>{d.type === 'recurring' ? '↻' : '·'}</Text>
                <Text style={s.drillDownTitle} numberOfLines={1}>{d.title}</Text>
                <Text style={s.drillDownAmt}>{formatFull(d.amount, currencyCode)}</Text>
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
  currencyCode: CurrencyCode;
  C: ColorTokens;
}

function SpendingSectionHeader({ title, icon, total, currencyCode, C }: SectionHeaderProps): React.JSX.Element {
  const s = makeStyles(C);
  return (
    <View style={s.sectionHeader}>
      <Text style={s.sectionHeaderIcon}>{icon}</Text>
      <Text style={s.sectionHeaderTitle}>{title}</Text>
      <Text style={s.sectionHeaderTotal}>{formatFull(total, currencyCode)}</Text>
    </View>
  );
}

// ── Main screen ────────────────────────────────────────────────────────────────

export default function SpendingScreen(): React.JSX.Element {
  const C = useThemedColors();
  const s = makeStyles(C);

  const [selectedIdx, setSelectedIdx] = useState(0);
  const [expandedCategory, setExpandedCategory] = useState<string | null>(null);

  const profile        = useAuthStore((s) => s.profile);
  const houseId        = useAuthStore((s) => s.houseId);
  const months         = useSpendingStore((s) => s.months);
  const isLoading      = useSpendingStore((s) => s.isLoading);
  const error          = useSpendingStore((s) => s.error);
  const insight        = useSpendingStore((s) => s.insight);
  const insightLoading = useSpendingStore((s) => s.insightLoading);
  const load           = useSpendingStore((s) => s.load);
  const fetchInsight   = useSpendingStore((s) => s.fetchInsight);

  // Settings store may store either legacy symbol or new `currencyCode`.
  // Prefer the explicit code; fall back to symbol-derived default.
  const settings = useSettingsStore() as unknown as {
    currency?: string;
    currencyCode?: CurrencyCode;
  };
  const currencyCode: CurrencyCode = settings.currencyCode
    ?? (settings.currency ? deriveCodeFromSymbol(settings.currency) : 'ILS');
  const currency = getCurrency(currencyCode);

  const userName = profile?.name ?? '';

  useFocusEffect(
    useCallback(() => {
      if (houseId && userName) void load(houseId, userName);
    }, [houseId, userName, load])
  );

  useEffect(() => {
    if (months.length && houseId) {
      // Pass the symbol to keep wire-format compatible with the existing edge
      // function (which expects the symbol string).
      fetchInsight(houseId, userName, currency.symbol);
    }
  }, [months, houseId, userName, currency.symbol, fetchInsight]);

  const handleBack = useCallback(() => router.back(), []);

  const handleRefreshInsight = useCallback(() => {
    if (!houseId) return;
    useSpendingStore.setState({ insight: null, insightMonth: null });
    void fetchInsight(houseId, userName, currency.symbol);
  }, [houseId, userName, currency.symbol, fetchInsight]);

  const handleSelectMonth = useCallback((idx: number) => {
    setSelectedIdx(idx);
    setExpandedCategory(null);
    void Haptics.selectionAsync();
  }, []);

  const handleToggleCategory = useCallback((name: string) => {
    setExpandedCategory((prev) => prev === name ? null : name);
  }, []);

  // Swipe-to-jump-month — horizontal swipes on the main list move between
  // months. Right swipe → older, left swipe → newer.
  const swipeGesture = useMemo(() => Gesture.Pan()
    .activeOffsetX([-20, 20])
    .failOffsetY([-20, 20])
    .onEnd((e) => {
      'worklet';
      const dx = e.translationX;
      const vx = e.velocityX;
      const fast = Math.abs(vx) > SWIPE_VELOCITY_THRESHOLD;
      const far  = Math.abs(dx) > SWIPE_DISTANCE_THRESHOLD;
      if (!fast && !far) return;

      const direction: 'older' | 'newer' = dx < 0 ? 'newer' : 'older';
      runOnJS(navigateMonth)(direction);
    }),
  // eslint-disable-next-line react-hooks/exhaustive-deps
  []);

  const navigateMonth = useCallback((direction: 'older' | 'newer'): void => {
    setSelectedIdx((prev) => {
      const next = direction === 'older' ? prev + 1 : prev - 1;
      if (next < 0 || next >= months.length) return prev;
      void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      return next;
    });
    setExpandedCategory(null);
  }, [months.length]);

  const selectedMonth = months[selectedIdx];
  const previousMonth = months[selectedIdx + 1];

  const sections = useMemo((): SpendingSection[] => {
    if (!selectedMonth) return [];
    const houseBillCats = selectedMonth.houseCategories.filter((c) => isHouseCat(c.name));
    const lifestyleCats = selectedMonth.houseCategories.filter((c) => !isHouseCat(c.name));
    const houseBillTotal = houseBillCats.reduce((s, c) => s + c.amount, 0);
    const lifestyleTotal = lifestyleCats.reduce((s, c) => s + c.amount, 0);

    function toCatRow(cat: CategorySpend, sectionTotal: number): CategoryRowItem {
      const myAmount        = selectedMonth.categories.find((c) => c.name === cat.name)?.amount ?? 0;
      const prevHouseAmount = previousMonth?.houseCategories.find((c) => c.name === cat.name)?.amount ?? 0;
      const drillDownItems  = selectedMonth.billsByCategory[cat.name] ?? [];
      return { cat, myAmount, prevHouseAmount, sectionTotal, drillDownItems };
    }

    const result: SpendingSection[] = [];
    if (houseBillCats.length > 0) {
      result.push({
        title: 'House Bills', icon: '🏠', total: houseBillTotal,
        data: houseBillCats.map((c) => toCatRow(c, houseBillTotal)),
      });
    }
    if (lifestyleCats.length > 0) {
      result.push({
        title: 'Lifestyle', icon: '🛍️', total: lifestyleTotal,
        data: lifestyleCats.map((c) => toCatRow(c, lifestyleTotal)),
      });
    }
    return result;
  }, [selectedMonth, previousMonth]);

  const renderItem = useCallback(
    ({ item }: { item: CategoryRowItem }) => (
      <CategoryRow
        item={item}
        currencyCode={currencyCode}
        isExpanded={expandedCategory === item.cat.name}
        onToggle={handleToggleCategory}
        C={C}
      />
    ),
    [currencyCode, expandedCategory, handleToggleCategory, C],
  );

  const renderSectionHeader = useCallback(
    ({ section }: { section: SpendingSection }) => (
      <SpendingSectionHeader
        title={section.title}
        icon={section.icon}
        total={section.total}
        currencyCode={currencyCode}
        C={C}
      />
    ),
    [currencyCode, C],
  );

  const keyExtractor = useCallback((item: CategoryRowItem) => item.cat.name, []);

  const handleRetry = useCallback(() => {
    if (houseId && userName) void load(houseId, userName);
  }, [houseId, userName, load]);

  const handleJumpToCurrent = useCallback(() => {
    setSelectedIdx(0);
    void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
  }, []);

  const pageHeader = (
    <View style={s.header}>
      <Pressable
        onPress={handleBack}
        style={s.backBtn}
        accessible
        accessibilityRole="button"
        accessibilityLabel="Go back"
      >
        <Ionicons name="chevron-back" size={24} color={C.textPrimary} />
      </Pressable>
      <Text style={s.title}>Spending Analysis</Text>
      <View style={s.backBtn} />
    </View>
  );

  if (isLoading && months.length === 0) {
    return (
      <SafeAreaView style={s.container}>
        {pageHeader}
        <View style={s.centered}>
          <ActivityIndicator color={C.primary} />
        </View>
      </SafeAreaView>
    );
  }

  if (error && months.length === 0) {
    return (
      <SafeAreaView style={s.container}>
        {pageHeader}
        <View style={s.centered}>
          <Text style={s.errorTitle}>Could not load spending</Text>
          <Text style={s.errorText}>{error}</Text>
          <Pressable
            style={s.retryBtn}
            onPress={handleRetry}
            accessible
            accessibilityRole="button"
            accessibilityLabel="Retry loading spending data"
          >
            <Text style={s.retryBtnText}>Try again</Text>
          </Pressable>
        </View>
      </SafeAreaView>
    );
  }

  const listHeader = (
    <View style={s.listHeaderWrap}>
      <InsightCard insight={insight} isLoading={insightLoading} onRefresh={handleRefreshInsight} C={C} />

      {months.some((m) => m.houseTotal > 0) && (
        <MonthlyChart
          months={months}
          currencyCode={currencyCode}
          selectedIdx={selectedIdx}
          onSelectMonth={handleSelectMonth}
          C={C}
        />
      )}

      {selectedIdx > 0 && (
        <Pressable
          style={s.jumpBtn}
          onPress={handleJumpToCurrent}
          accessible
          accessibilityRole="button"
          accessibilityLabel="Jump to current month"
        >
          <Ionicons name="arrow-forward-circle-outline" size={16} color={C.primary} />
          <Text style={s.jumpBtnText}>Jump to current month</Text>
        </Pressable>
      )}

      {selectedMonth && selectedMonth.houseTotal > 0 && (
        <OverviewCard current={selectedMonth} previous={previousMonth} currencyCode={currencyCode} C={C} />
      )}

      {sections.length > 0 && (
        <Text style={s.breakdownTitle}>
          {selectedMonth?.label ?? ''} breakdown
        </Text>
      )}
    </View>
  );

  return (
    <SafeAreaView style={s.container}>
      {pageHeader}
      <GestureDetector gesture={swipeGesture}>
        <Animated.View style={s.flex1}>
          <SectionList<CategoryRowItem, SpendingSection>
            sections={sections}
            keyExtractor={keyExtractor}
            renderItem={renderItem}
            renderSectionHeader={renderSectionHeader}
            contentContainerStyle={s.scroll}
            stickySectionHeadersEnabled={false}
            ListHeaderComponent={listHeader}
            ListEmptyComponent={
              !isLoading ? (
                <View style={s.emptyState}>
                  <Text style={s.emptyTitle}>No spending yet</Text>
                  <Text style={s.emptyText}>
                    {selectedIdx === 0
                      ? 'Add some bills and they\'ll appear here.'
                      : `No spending recorded for ${selectedMonth?.label ?? 'this month'}.`}
                  </Text>
                </View>
              ) : null
            }
          />
        </Animated.View>
      </GestureDetector>
    </SafeAreaView>
  );
}

// ── Helpers ────────────────────────────────────────────────────────────────────

/**
 * Legacy migration: settingsStore stored just a symbol. Map back to a code.
 * Once `currencyCode` is wired in settingsStore, this is dead code — remove
 * with the migration PR.
 */
function deriveCodeFromSymbol(symbol: string): CurrencyCode {
  const map: Record<string, CurrencyCode> = {
    '₪': 'ILS', '$': 'USD', '€': 'EUR', '£': 'GBP',
    'A$': 'AUD', 'C$': 'CAD', 'Fr': 'CHF', '¥': 'JPY',
  };
  return map[symbol] ?? 'ILS';
}

// ── Styles ─────────────────────────────────────────────────────────────────────

function makeStyles(C: ColorTokens): ReturnType<typeof StyleSheet.create<Record<string, object>>> {
  const isDark = C.background !== '#F6F2EA';
  return StyleSheet.create({
    flex1: { flex: 1 },
    container: { flex: 1, backgroundColor: C.background },

    header: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      paddingHorizontal: sizes.md,
      paddingVertical: sizes.sm,
      borderBottomWidth: StyleSheet.hairlineWidth,
      borderBottomColor: C.border,
    },
    backBtn: { width: 44, height: 44, justifyContent: 'center', alignItems: 'center' },
    title: { fontSize: 17, ...font.bold, color: C.textPrimary },

    scroll: { padding: sizes.lg, paddingBottom: 60 },
    listHeaderWrap: { gap: sizes.md, marginBottom: sizes.sm },

    insightCard: {
      backgroundColor: C.primary,
      borderRadius: sizes.borderRadiusLg,
      overflow: 'hidden',
    },
    insightCardDeco: {
      position: 'absolute', top: -30, right: -16, width: 120, height: 120,
      borderRadius: 60, backgroundColor: 'rgba(255,255,255,0.09)',
    },
    insightCardDecoSm: {
      position: 'absolute', bottom: -40, left: -20, width: 90, height: 90,
      borderRadius: 45, backgroundColor: 'rgba(255,255,255,0.05)',
    },
    insightCardPad: { padding: 20, gap: 10 },
    insightCardHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
    insightLabelRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
    insightCardLabel: { fontSize: 11, ...font.extrabold, color: C.white, letterSpacing: 1.1, opacity: 0.9 },
    refreshBtn: {
      width: 32, height: 32, borderRadius: 999,
      backgroundColor: 'rgba(255,255,255,0.12)',
      justifyContent: 'center', alignItems: 'center',
    },
    insightCardText: { fontSize: 14, ...font.regular, color: C.white, lineHeight: 21 },
    insightCardEmpty: { fontSize: 13, ...font.regular, color: 'rgba(255,255,255,0.60)', fontStyle: 'italic' },

    overviewCard: {
      backgroundColor: C.surface,
      borderRadius: sizes.borderRadiusLg,
      padding: 20,
      gap: 14,
      ...(isDark
        ? { borderWidth: StyleSheet.hairlineWidth, borderColor: C.border }
        : { boxShadow: '0 2px 8px rgba(0,0,0,0.05)' }),
    } as never,
    overviewMonth: { fontSize: 13, ...font.semibold, color: C.textSecondary },
    overviewRow: { flexDirection: 'row', alignItems: 'flex-start', gap: sizes.md },
    overviewBlock: { flex: 1, gap: 4 },
    overviewLbl: { fontSize: 12, ...font.regular, color: C.textSecondary },
    overviewAmt: { fontSize: 26, ...font.extrabold, color: C.textPrimary, letterSpacing: -0.6 },
    overviewBadge: { alignSelf: 'flex-start', borderRadius: 8, paddingHorizontal: 8, paddingVertical: 3 },
    overviewBadgeText: { fontSize: 12, ...font.bold },
    overviewDivider: { width: 1, height: 56, backgroundColor: C.border, marginTop: 16 },
    overviewCompare: { fontSize: 12, ...font.regular, color: C.textSecondary, lineHeight: 18 },

    chartCard: {
      backgroundColor: C.primary,
      borderRadius: sizes.borderRadiusLg,
      overflow: 'hidden',
    },
    chartCardDeco: {
      position: 'absolute', bottom: -44, right: 16, width: 110, height: 110,
      borderRadius: 55, backgroundColor: 'rgba(255,255,255,0.06)',
    },
    chartPad: { padding: 20, gap: 14 },
    chartTitle: { fontSize: 11, ...font.extrabold, color: C.white, letterSpacing: 1.1, opacity: 0.88 },
    barsRow: { flexDirection: 'row', alignItems: 'flex-end', gap: 10, height: 110 },
    barCol: { flex: 1, minWidth: 44, alignItems: 'center', gap: 5, justifyContent: 'flex-end' },
    barAmt: { fontSize: 9, ...font.bold, color: 'rgba(255,255,255,0.65)', textAlign: 'center' },
    barAmtSelected: { color: C.white, fontSize: 10 },
    barTrack: {
      width: 18, height: BAR_MAX_H, borderRadius: 999,
      backgroundColor: 'rgba(255,255,255,0.14)',
      justifyContent: 'flex-end', overflow: 'hidden', position: 'relative',
    },
    barTrackSelected: { backgroundColor: 'rgba(255,255,255,0.22)' },
    barFill: { width: 18, borderRadius: 999, backgroundColor: 'rgba(255,255,255,0.30)' },
    barFillSelected: { backgroundColor: C.white },
    barShareFill: {
      position: 'absolute', bottom: 0, left: 0, right: 0,
      backgroundColor: 'rgba(255,255,255,0.56)', borderRadius: 999,
    },
    barLbl: { fontSize: 10, ...font.regular, color: 'rgba(255,255,255,0.70)' },
    barLblSelected: { color: C.white, ...font.bold },
    barSelDot: { width: 5, height: 5, borderRadius: 3, backgroundColor: C.white },
    chartLegend: { flexDirection: 'row', gap: sizes.md },
    legendItem: { flexDirection: 'row', alignItems: 'center', gap: 5 },
    legendDot: { width: 8, height: 8, borderRadius: 4 },
    legendText: { fontSize: 11, ...font.regular, color: 'rgba(255,255,255,0.80)' },

    jumpBtn: {
      flexDirection: 'row', alignItems: 'center', gap: 6,
      alignSelf: 'flex-end',
      paddingHorizontal: 16, paddingVertical: 12, minHeight: 44,
      backgroundColor: C.primary + '20', borderRadius: 22,
    },
    jumpBtnText: { fontSize: 13, ...font.semibold, color: C.primary },

    breakdownTitle: { fontSize: 16, ...font.bold, color: C.textPrimary, marginTop: 4 },

    sectionHeader: {
      flexDirection: 'row', alignItems: 'center', gap: 8,
      paddingVertical: sizes.sm, paddingHorizontal: 2, marginTop: sizes.sm,
    },
    sectionHeaderIcon: { fontSize: 16 },
    sectionHeaderTitle: { flex: 1, fontSize: 14, ...font.bold, color: C.textPrimary },
    sectionHeaderTotal: { fontSize: 14, ...font.bold, color: C.textSecondary },

    catRow: {
      flexDirection: 'row', alignItems: 'flex-start', gap: sizes.sm,
      backgroundColor: C.surface,
      borderRadius: sizes.borderRadius,
      padding: sizes.md,
      marginBottom: sizes.xs,
      ...(isDark
        ? { borderWidth: StyleSheet.hairlineWidth, borderColor: C.border }
        : { boxShadow: '0 1px 4px rgba(0,0,0,0.04)' }),
    } as never,
    catIcon: {
      width: 40, height: 40, borderRadius: 12,
      justifyContent: 'center', alignItems: 'center', marginTop: 2,
    },
    catIconText: { fontSize: 20 },
    catInfo: { flex: 1, gap: 4 },
    catTopRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
    catName: { fontSize: 14, ...font.semibold, color: C.textPrimary, flex: 1 },
    catAmtGroup: { alignItems: 'flex-end', gap: 1 },
    catAmt: { fontSize: 14, ...font.bold, color: C.textPrimary },
    catPct: { fontSize: 11, ...font.bold },
    catBarTrack: {
      height: 4, borderRadius: 2,
      backgroundColor: isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.06)',
      overflow: 'hidden',
    },
    catBarFill: { height: 4, borderRadius: 2 },
    catMyShare: { fontSize: 12, ...font.regular, color: C.textSecondary },
    catChevron: { marginLeft: 4 },

    drillDown: {
      marginTop: 8, paddingTop: 8,
      borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: C.border,
      gap: 6,
    },
    drillDownRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
    drillDownType: { width: 14, fontSize: 13, color: C.textSecondary, textAlign: 'center' },
    drillDownTitle: { flex: 1, fontSize: 13, ...font.regular, color: C.textSecondary },
    drillDownAmt: { fontSize: 13, ...font.semibold, color: C.textPrimary },

    centered: { flex: 1, justifyContent: 'center', alignItems: 'center', gap: sizes.sm, padding: sizes.lg },
    emptyState: { alignItems: 'center', paddingVertical: sizes.xl, gap: sizes.sm },
    emptyTitle: { fontSize: sizes.fontMd, ...font.bold, color: C.textPrimary },
    emptyText: { fontSize: sizes.fontSm, ...font.regular, color: C.textSecondary, textAlign: 'center' },
    errorTitle: { fontSize: sizes.fontMd, ...font.bold, color: C.textPrimary, textAlign: 'center' },
    errorText: { fontSize: sizes.fontSm, ...font.regular, color: C.textSecondary, textAlign: 'center' },
    retryBtn: {
      marginTop: sizes.sm, backgroundColor: C.primary,
      borderRadius: sizes.borderRadius,
      paddingHorizontal: sizes.lg, paddingVertical: sizes.sm,
      minHeight: 44, justifyContent: 'center', alignItems: 'center',
    },
    retryBtnText: { fontSize: sizes.fontSm, ...font.semibold, color: C.white },
  });
}
