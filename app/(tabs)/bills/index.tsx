// app/(tabs)/bills/index.tsx
// Bills list — v2 redesign.
// Same data flow as v1 (useBillsStore, useRecurringBillsStore, useHousematesStore,
// useSettingsStore, useBadgeStore). Same edge of preserved behavior:
//   • Settle Up detailed section + sort-by-date list.
// New: dark-theme blue hero with count-up amounts, fade-up entrance, spring
// press scale on every bill row, layout transitions on sort, animated Settle Up
// accordion, and the new `type` ladder + `Header` UI primitive throughout.

import { useState, useCallback, useMemo, useEffect } from 'react';
import {
  View, SectionList, ScrollView, StyleSheet, Pressable,
  useWindowDimensions, Platform,
} from 'react-native';
import { Image } from 'expo-image';
import { Text } from 'react-native-paper';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router, useFocusEffect, useLocalSearchParams } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { Ionicons } from '@expo/vector-icons';
import Animated, { LinearTransition } from 'react-native-reanimated';
import {
  useBillsStore, calculateAllNetBalances, calculateSimplifiedBalancesForUser,
  settleDebts, type Bill,
} from '@stores/billsStore';
import { useRecurringBillsStore, calculateFairness } from '@stores/recurringBillsStore';
import { useAuthStore } from '@stores/authStore';
import { useHousematesStore } from '@stores/housematesStore';
import { useSettingsStore } from '@stores/settingsStore';
import { useBadgeStore } from '@stores/badgeStore';
import { resolveName } from '@utils/housemates';
import { HouseholdTab } from '@components/bills/HouseholdTab';
import { useThemedColors, type ColorTokens } from '@constants/colors';
import { formatFull } from '@constants/currencies';
import { Pill, EmptyState, Header } from '@components/ui';
import { type } from '@constants/typography';
import { sizes } from '@constants/sizes';
import {
  useFadeInUp, useCountUp, useExpandable, usePressScale,
} from '@utils/animations';

type BillFilter = 'recurring' | 'one-off';

// ── Category icons ────────────────────────────────────────────────────────────
const CATEGORY_ICONS: Record<string, React.ComponentProps<typeof Ionicons>['name']> = {
  food: 'fast-food-outline',
  groceries: 'cart-outline',
  transport: 'car-outline',
  utilities: 'flash-outline',
  rent: 'home-outline',
  entertainment: 'musical-notes-outline',
  health: 'medkit-outline',
  travel: 'airplane-outline',
  shopping: 'bag-outline',
  internet: 'wifi-outline',
  phone: 'phone-portrait-outline',
  default: 'receipt-outline',
};
function getCategoryIcon(category: string): React.ComponentProps<typeof Ionicons>['name'] {
  return CATEGORY_ICONS[(category ?? '').toLowerCase()] ?? CATEGORY_ICONS.default;
}

// ── Date label ────────────────────────────────────────────────────────────────
function formatDateLabel(dateStr: string): string {
  const today = new Date();
  const pad = (n: number): string => String(n).padStart(2, '0');
  const todayStr = `${today.getFullYear()}-${pad(today.getMonth() + 1)}-${pad(today.getDate())}`;
  const yest = new Date(today);
  yest.setDate(yest.getDate() - 1);
  const yestStr = `${yest.getFullYear()}-${pad(yest.getMonth() + 1)}-${pad(yest.getDate())}`;
  if (dateStr === todayStr) return 'Today';
  if (dateStr === yestStr) return 'Yesterday';
  return new Date(dateStr + 'T12:00:00').toLocaleDateString([], {
    weekday: 'short', month: 'short', day: 'numeric',
  });
}

// ── Bill row card — press-scaled + layout-animated ─────────────────────────────
function BillCard({ bill, C }: { bill: Bill; C: ColorTokens }): React.JSX.Element {
  const currencyCode = useSettingsStore((s) => s.currencyCode);
  const housemates = useHousematesStore((s) => s.housemates);
  const share = bill.amount / Math.max(bill.splitBetween.length, 1);
  const icon  = getCategoryIcon(bill.category ?? '');
  const press = usePressScale(0.97);
  const styles = useMemo(() => makeStyles(C), [C]);

  return (
    <Animated.View style={press.animatedStyle} layout={LinearTransition.springify().damping(18)}>
      <Pressable
        style={[styles.billCard, { backgroundColor: C.surface, borderColor: C.border }]}
        onPress={() => router.push(`/(tabs)/bills/${bill.id}`)}
        onPressIn={press.onPressIn}
        onPressOut={press.onPressOut}
        accessibilityRole="button"
        accessibilityLabel={`${bill.title}, ${formatFull(bill.amount, currencyCode)}`}
      >
        <View style={[styles.billIconWrap, {
          backgroundColor: bill.settled ? C.surfaceSecondary : C.primary + '14',
        }]}>
          <Ionicons
            name={icon} size={18}
            color={bill.settled ? C.textSecondary : C.primary}
          />
        </View>
        <View style={styles.billInfo}>
          <Text
            style={[type.label, { color: bill.settled ? C.textSecondary : C.textPrimary }]}
            numberOfLines={1}
          >
            {bill.title}
          </Text>
          <Text style={[type.caption, { color: C.textSecondary }]} numberOfLines={1}>
            Paid by {resolveName(bill.paidBy, housemates)} · {formatFull(share, currencyCode)} each
          </Text>
        </View>
        <View style={styles.billRight}>
          {bill.settled && (
            <Pill tone="success" size="sm" style={styles.settledBadge}>Settled</Pill>
          )}
          <Text style={[type.amountLg, { color: bill.settled ? C.textSecondary : C.textPrimary }]}>
            {formatFull(bill.amount, currencyCode)}
          </Text>
          <Ionicons name="chevron-forward" size={14} color={C.textSecondary} />
        </View>
      </Pressable>
    </Animated.View>
  );
}

// ── Settle Amount — count-up amount inside a settle row ────────────────────────
function SettleAmount({ amount, code, C }: { amount: number; code: string; C: ColorTokens }): React.JSX.Element {
  const display = useCountUp(amount, { formatter: (n) => formatFull(n, code), duration: 600 });
  return <Text style={[type.amountLg, { color: C.textPrimary, marginLeft: 'auto' }]}>{display}</Text>;
}

// ── Settle Up panel — preserved layout, count-up amounts ───────────────────────
function SettleUpPanel({ C }: { C: ColorTokens }): React.JSX.Element {
  const currencyCode = useSettingsStore((s) => s.currencyCode);
  const bills        = useBillsStore((s) => s.bills);
  const housemates   = useHousematesStore((s) => s.housemates);
  const avatarById   = new Map(housemates.map((h) => [h.id, h.avatarUrl]));
  const householdBills = useRecurringBillsStore((s) => s.bills);
  const payments       = useRecurringBillsStore((s) => s.payments);
  const styles = useMemo(() => makeStyles(C), [C]);

  const sharedNet         = calculateAllNetBalances(bills.filter((b) => !b.settled));
  const householdFairness = calculateFairness(householdBills, payments);
  const combined = new Map<string, number>(sharedNet);
  for (const { person, balance } of householdFairness) {
    combined.set(person, (combined.get(person) ?? 0) + balance);
  }
  const settlements = settleDebts(new Map(combined));

  if (settlements.length === 0) {
    return (
      <View style={styles.settleAllGood}>
        <Ionicons name="checkmark-circle" size={20} color={C.positive} />
        <Text style={[type.label, { color: C.positive }]}>Everyone is settled up!</Text>
      </View>
    );
  }

  return (
    <View style={styles.settleList}>
      {settlements.map((s, idx) => {
        const fromName = resolveName(s.from, housemates);
        const toName   = resolveName(s.to, housemates);
        return (
          <View key={idx} style={[styles.settleRow, { backgroundColor: C.background, borderColor: C.border }]}>
            <View style={[styles.settleAvatar, { backgroundColor: C.primary + '22' }]}>
              {avatarById.get(s.from)
                ? <Image source={{ uri: avatarById.get(s.from) }} style={styles.settleAvatarImg} contentFit="cover" />
                : <Text style={[type.labelSm, { color: C.primary }]}>{fromName[0]?.toUpperCase()}</Text>
              }
            </View>
            <Text style={[type.bodyMdMed, { color: C.textPrimary }]}>{fromName}</Text>
            <Ionicons name="arrow-forward" size={12} color={C.textSecondary} style={styles.settleArrow} />
            <View style={[styles.settleAvatar, { backgroundColor: C.primary + '22' }]}>
              {avatarById.get(s.to)
                ? <Image source={{ uri: avatarById.get(s.to) }} style={styles.settleAvatarImg} contentFit="cover" />
                : <Text style={[type.labelSm, { color: C.primary }]}>{toName[0]?.toUpperCase()}</Text>
              }
            </View>
            <Text style={[type.bodyMdMed, { color: C.textPrimary }]}>{toName}</Text>
            <SettleAmount amount={s.amount} code={currencyCode} C={C} />
          </View>
        );
      })}
    </View>
  );
}

// ── Main screen ───────────────────────────────────────────────────────────────
export default function BillsScreen(): React.JSX.Element {
  const C = useThemedColors();
  const { t } = useTranslation();
  const { width } = useWindowDimensions();
  const styles = useMemo(() => makeStyles(C), [C]);
  const isWide = width >= 680;

  const markSeen = useBadgeStore((s) => s.markSeen);
  useFocusEffect(useCallback(() => { markSeen('bills').catch(() => {}); }, [markSeen]));

  const bills        = useBillsStore((s) => s.bills);
  const isLoading    = useBillsStore((s) => s.isLoading);
  const error        = useBillsStore((s) => s.error);
  const loadBills    = useBillsStore((s) => s.load);
  const profile      = useAuthStore((s) => s.profile);
  const houseId      = useAuthStore((s) => s.houseId) ?? '';
  const currencyCode = useSettingsStore((s) => s.currencyCode);

  const [filter, setFilter] = useState<BillFilter>('one-off');
  const { openRecurring }   = useLocalSearchParams<{ openRecurring?: string }>();
  useEffect(() => {
    if (openRecurring === '1') setFilter('recurring');
  }, [openRecurring]);
  const [showSettle, setShowSettle] = useState(false);
  const settleExpand = useExpandable(showSettle);

  const householdBills = useRecurringBillsStore((s) => s.bills);
  const payments       = useRecurringBillsStore((s) => s.payments);

  const myId = profile?.id ?? '';
  const activeBills = bills.filter((b) => !b.settled);

  const combinedNet = new Map<string, number>(calculateAllNetBalances(activeBills));
  for (const { person, balance } of calculateFairness(householdBills, payments)) {
    combinedNet.set(person, (combinedNet.get(person) ?? 0) + balance);
  }
  const sharedBalances = calculateSimplifiedBalancesForUser(combinedNet, myId);
  const totalOwed  = sharedBalances.filter((b) => b.amount > 0).reduce((s, b) => s + b.amount, 0);
  const totalOwe   = sharedBalances.filter((b) => b.amount < 0).reduce((s, b) => s + Math.abs(b.amount), 0);
  const netBalance = totalOwed - totalOwe;

  // Count-up amounts on the hero card.
  const displayOwed = useCountUp(totalOwed,             { formatter: (n) => formatFull(n, currencyCode), duration: 700 });
  const displayOwe  = useCountUp(totalOwe,              { formatter: (n) => formatFull(n, currencyCode), duration: 700 });
  const displayNet  = useCountUp(Math.abs(netBalance),  { formatter: (n) => formatFull(n, currencyCode), duration: 700 });

  // Entrance fade-up for the whole screen.
  const fadeStyle = useFadeInUp(0);

  // Sort-by-date — preserved (newest first).
  const billSections = useMemo(() => {
    const sorted = [...bills].sort((a, b) => (b.date ?? '').localeCompare(a.date ?? ''));
    const groups: Record<string, Bill[]> = {};
    for (const bill of sorted) {
      const key = bill.date || 'Unknown';
      if (!groups[key]) groups[key] = [];
      groups[key].push(bill);
    }
    return Object.entries(groups).map(([date, data]) => ({
      title: formatDateLabel(date),
      data,
    }));
  }, [bills]);

  const renderBill = useCallback(
    ({ item }: { item: Bill }): React.JSX.Element => <BillCard bill={item} C={C} />,
    [C]
  );

  if (isLoading) {
    return (
      <SafeAreaView style={styles.container} edges={['top']}>
        <Header title="Bills" />
        <View style={styles.centered}>
          <EmptyState mode="loading" title="Loading bills…" />
        </View>
      </SafeAreaView>
    );
  }

  if (error) {
    return (
      <SafeAreaView style={styles.container} edges={['top']}>
        <Header title="Bills" />
        <View style={styles.centered}>
          <EmptyState
            mode="error"
            icon="alert-circle-outline"
            title={t('bills.load_error')}
            message={error}
            actionLabel={t('bills.retry')}
            onAction={() => loadBills(houseId)}
          />
        </View>
      </SafeAreaView>
    );
  }

  // Sticky top section — page title, filter tabs, and the Add expense CTA.
  const topBar = (
    <View style={[styles.topBar, isWide && styles.topBarWide]}>
      <View style={styles.pageHeader}>
        <View style={styles.pageTitleBlock}>
          <Text style={[type.displayMd, { color: C.textPrimary }]}>Bills</Text>
          <Text style={[type.bodySm, { color: C.textSecondary }]}>Expenses & balances</Text>
        </View>
        <AddBtn onPress={() => router.push('/(tabs)/bills/add')} label={t('bills.add_expense')} C={C} />
      </View>

      <View style={[styles.filterRow, { backgroundColor: C.surfaceSecondary, borderColor: C.border }]}>
        <FilterTab
          active={filter === 'one-off'}
          icon="receipt-outline"
          label="One-off"
          count={bills.length}
          onPress={() => setFilter('one-off')}
          C={C}
        />
        <FilterTab
          active={filter === 'recurring'}
          icon="repeat-outline"
          label="Recurring"
          onPress={() => setFilter('recurring')}
          C={C}
        />
      </View>
    </View>
  );

  // Hero card — net balance with count-up. Same blue treatment as the spending hero.
  const ListHeader = (
    <View style={[styles.listHeaderWrap, isWide && styles.listHeaderWrapWide]}>

      <BalanceHero
        netBalance={netBalance}
        displayOwed={displayOwed}
        displayOwe={displayOwe}
        displayNet={displayNet}
        C={C}
      />

      {/* ── Settle Up — preserved detailed section, animated expand ─────── */}
      <SettleUpCard
        showSettle={showSettle}
        onToggle={() => setShowSettle((v) => !v)}
        expand={settleExpand}
        C={C}
      />

      {/* Recurring household bills */}
      {filter === 'recurring' && (
        <View style={styles.householdWrap}>
          <HouseholdTab />
        </View>
      )}

      {/* One-off list eyebrow */}
      {filter === 'one-off' && bills.length > 0 && (
        <View style={styles.listCountRow}>
          <Text style={[type.eyebrow, { color: C.textSecondary }]}>All expenses</Text>
          <View style={[styles.countPill, { backgroundColor: C.surfaceSecondary, borderColor: C.border }]}>
            <Text style={[type.captionMed, { color: C.textSecondary }]}>{bills.length}</Text>
          </View>
        </View>
      )}
    </View>
  );

  if (filter === 'recurring') {
    return (
      <SafeAreaView style={styles.container} edges={['top']}>
        {topBar}
        <Animated.View style={[styles.flex, fadeStyle]}>
          <ScrollView
            style={styles.flex}
            showsVerticalScrollIndicator={false}
            contentContainerStyle={styles.listContent}
            keyboardShouldPersistTaps="handled"
          >
            {ListHeader}
          </ScrollView>
        </Animated.View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      {topBar}
      <Animated.View style={[styles.flex, fadeStyle]}>
        <SectionList<Bill>
          style={styles.flex}
          sections={billSections}
          keyExtractor={(item) => item.id}
          renderItem={renderBill}
          showsVerticalScrollIndicator={false}
          contentContainerStyle={styles.listContent}
          stickySectionHeadersEnabled={false}
          ListHeaderComponent={ListHeader}
          renderSectionHeader={({ section }) => (
            <View style={styles.sectionDateHeader}>
              <Text style={[type.eyebrow, { color: C.textSecondary }]}>{section.title}</Text>
            </View>
          )}
          ItemSeparatorComponent={() => <View style={{ height: 8 }} />}
          SectionSeparatorComponent={() => <View style={{ height: 4 }} />}
          ListEmptyComponent={
            <EmptyState
              icon="receipt-outline"
              title="No expenses yet"
              message="Tap Add Expense to record your first shared spend"
            />
          }
        />
      </Animated.View>
    </SafeAreaView>
  );
}

// ── Sub-components ───────────────────────────────────────────────────────────

function AddBtn({ onPress, label, C }: { onPress: () => void; label: string; C: ColorTokens }): React.JSX.Element {
  const press = usePressScale(0.95);
  return (
    <Animated.View style={press.animatedStyle}>
      <Pressable
        style={[styles_addBtn.btn, { backgroundColor: C.primary }]}
        onPress={onPress}
        onPressIn={press.onPressIn}
        onPressOut={press.onPressOut}
        accessibilityRole="button"
        accessibilityLabel="Add new expense"
      >
        <Ionicons name="add" size={18} color="#fff" />
        <Text style={[type.label, { color: '#fff' }]}>{label}</Text>
      </Pressable>
    </Animated.View>
  );
}

const styles_addBtn = StyleSheet.create({
  btn: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    paddingVertical: 11, paddingHorizontal: 16, borderRadius: 12,
    shadowColor: '#4F78B6',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.25, shadowRadius: 8, elevation: 6,
  },
});

interface FilterTabProps {
  active: boolean;
  icon: React.ComponentProps<typeof Ionicons>['name'];
  label: string;
  count?: number;
  onPress: () => void;
  C: ColorTokens;
}

function FilterTab({ active, icon, label, count, onPress, C }: FilterTabProps): React.JSX.Element {
  const press = usePressScale(0.96);
  return (
    <Animated.View style={[{ flex: 1 }, press.animatedStyle]}>
      <Pressable
        style={[styles_filterTab.tab, active && { backgroundColor: C.primary }]}
        onPress={onPress}
        onPressIn={press.onPressIn}
        onPressOut={press.onPressOut}
        accessibilityRole="tab"
        accessibilityState={{ selected: active }}
      >
        <Ionicons name={icon} size={14} color={active ? '#fff' : C.textSecondary} />
        <Text style={[type.labelSm, { color: active ? '#fff' : C.textSecondary }]}>{label}</Text>
        {count !== undefined && active && (
          <View style={styles_filterTab.badge}>
            <Text style={[type.caption, { color: '#fff', fontWeight: '700' }]}>{count}</Text>
          </View>
        )}
      </Pressable>
    </Animated.View>
  );
}

const styles_filterTab = StyleSheet.create({
  tab: {
    flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    gap: 6, paddingVertical: 10, borderRadius: 11, minHeight: 44,
  },
  badge: { backgroundColor: 'rgba(255,255,255,0.3)', borderRadius: 8, paddingHorizontal: 6, paddingVertical: 1 },
});

// ── Balance Hero — blue card, count-up, decoration ────────────────────────────
interface BalanceHeroProps {
  netBalance: number;
  displayOwed: string;
  displayOwe: string;
  displayNet: string;
  C: ColorTokens;
}

function BalanceHero({ netBalance, displayOwed, displayOwe, displayNet, C }: BalanceHeroProps): React.JSX.Element {
  const isOwed = netBalance > 0;
  const isSettled = netBalance === 0;
  const styles = useMemo(() => makeStyles(C), [C]);

  return (
    <View style={styles.heroCard}>
      <View style={styles.heroDeco} />
      <View style={styles.heroDecoSm} />
      <Text style={[type.eyebrow, styles.heroEyebrow]}>Your balance</Text>

      <View style={styles.heroRow}>
        <View style={styles.heroBlock}>
          <Text style={[type.bodySm, styles.heroLbl]}>Owed to you</Text>
          <Text style={[type.displayMd, styles.heroAmtPositive]}>{displayOwed}</Text>
        </View>

        <View style={styles.heroDivider} />

        <View style={styles.heroBlock}>
          <Text style={[type.bodySm, styles.heroLbl]}>You owe</Text>
          <Text style={[type.displayMd, styles.heroAmtNegative]}>{displayOwe}</Text>
        </View>
      </View>

      <View style={styles.heroNetRow}>
        <Text style={[type.bodySm, styles.heroLbl]}>Net</Text>
        <Text style={[type.title, {
          color: '#fff',
          letterSpacing: -0.4,
        }]}>
          {isSettled ? 'All settled' : `${isOwed ? '+' : '−'}${displayNet}`}
        </Text>
        {!isSettled && (
          <View style={[styles.heroNetTag, {
            backgroundColor: isOwed ? 'rgba(255,255,255,0.18)' : 'rgba(255,255,255,0.10)',
          }]}>
            <Text style={[type.captionMed, { color: '#fff' }]}>
              {isOwed ? "You're owed" : 'You owe'}
            </Text>
          </View>
        )}
      </View>
    </View>
  );
}

// ── Settle Up card — animated expand with rotating chevron ────────────────────
interface SettleUpCardProps {
  showSettle: boolean;
  onToggle: () => void;
  expand: ReturnType<typeof useExpandable>;
  C: ColorTokens;
}

function SettleUpCard({ showSettle, onToggle, expand, C }: SettleUpCardProps): React.JSX.Element {
  const press = usePressScale(0.99);
  const styles = useMemo(() => makeStyles(C), [C]);
  return (
    <Animated.View style={press.animatedStyle}>
      <Pressable
        style={[styles.settleCard, {
          borderColor: showSettle ? C.positive + '60' : C.positive + '35',
          backgroundColor: C.surface,
        }]}
        onPress={onToggle}
        onPressIn={press.onPressIn}
        onPressOut={press.onPressOut}
        accessibilityRole="button"
        accessibilityLabel="Toggle settle up"
        accessibilityState={{ expanded: showSettle }}
      >
        <View style={styles.settleCardHeader}>
          <View style={[styles.settleIconWrap, { backgroundColor: C.positive + '18' }]}>
            <Ionicons name="swap-horizontal-outline" size={16} color={C.positive} />
          </View>
          <Text style={[type.label, { color: C.textPrimary, flex: 1 }]}>Settle Up</Text>
          <Text style={[type.bodySm, { color: C.textSecondary }]}>
            {showSettle ? 'Hide' : 'See transfers'}
          </Text>
          <Animated.View style={expand.caretStyle}>
            <Ionicons name="chevron-down" size={16} color={C.textSecondary} />
          </Animated.View>
        </View>
        {showSettle && (
          <Animated.View style={[styles.settleContent, expand.containerStyle]}>
            <Text style={[type.bodySm, { color: C.textSecondary }]}>
              Minimum transfers to clear all balances
            </Text>
            <SettleUpPanel C={C} />
          </Animated.View>
        )}
      </Pressable>
    </Animated.View>
  );
}

// ── Styles ────────────────────────────────────────────────────────────────────
function makeStyles(C: ColorTokens) {
  const isDark = C.background !== '#F6F2EA';
  return StyleSheet.create({
    container:   { flex: 1, backgroundColor: C.background },
    flex:        { flex: 1 },
    centered:    { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 20 },
    listContent: {
      paddingBottom: Platform.OS === 'web' ? sizes.bottomTabBarHeight : sizes.bottomTabContentPadding,
    },

    topBar:     { paddingHorizontal: sizes.md, paddingTop: 4, paddingBottom: 4, gap: 12 },
    topBarWide: { paddingHorizontal: sizes.lg },
    listHeaderWrap:     { paddingHorizontal: sizes.md, paddingTop: 12, gap: 14 },
    listHeaderWrapWide: { paddingHorizontal: sizes.lg },

    // Page header
    pageHeader:     { flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between' },
    pageTitleBlock: { gap: 2 },

    // Filter tabs
    filterRow: {
      flexDirection: 'row', gap: 8,
      borderRadius: 14, padding: 4, borderWidth: 1,
    },

    // ── Hero card — blue gradient with decoration
    heroCard: {
      backgroundColor: C.primary,
      borderRadius: sizes.borderRadiusLg,
      padding: 20, gap: 14, position: 'relative', overflow: 'hidden',
    },
    heroDeco: {
      position: 'absolute', top: -40, right: -30, width: 160, height: 160,
      borderRadius: 80, backgroundColor: 'rgba(255,255,255,0.07)',
    },
    heroDecoSm: {
      position: 'absolute', bottom: -50, left: -20, width: 110, height: 110,
      borderRadius: 55, backgroundColor: 'rgba(255,255,255,0.05)',
    },
    heroEyebrow: { color: 'rgba(255,255,255,0.85)' },
    heroRow:     { flexDirection: 'row', gap: sizes.md, alignItems: 'flex-start' },
    heroBlock:   { flex: 1, gap: 2 },
    heroLbl:     { color: 'rgba(255,255,255,0.78)' },
    heroAmtPositive: { color: '#fff', letterSpacing: -0.6 },
    heroAmtNegative: { color: '#fff', letterSpacing: -0.6 },
    heroDivider:     { width: 1, height: 48, backgroundColor: 'rgba(255,255,255,0.18)', marginTop: 18 },
    heroNetRow:      { flexDirection: 'row', alignItems: 'center', gap: 10, paddingTop: 6, borderTopWidth: 1, borderTopColor: 'rgba(255,255,255,0.14)' },
    heroNetTag:      { borderRadius: 999, paddingHorizontal: 10, paddingVertical: 4, marginLeft: 'auto' },

    // Settle Up
    settleCard: {
      borderRadius: 16, borderWidth: 1,
      paddingHorizontal: sizes.md, paddingVertical: 14,
      ...(isDark
        ? {}
        : {
          shadowColor: '#000', shadowOffset: { width: 0, height: 2 },
          shadowOpacity: 0.05, shadowRadius: 6, elevation: 2,
        }),
    } as never,
    settleCardHeader: { flexDirection: 'row', alignItems: 'center', gap: 10 },
    settleIconWrap:   { width: 32, height: 32, borderRadius: 9, justifyContent: 'center', alignItems: 'center' },
    settleContent:    { marginTop: 12, gap: 10 },

    settleAllGood: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingVertical: 6 },
    settleList:    { gap: 8 },
    settleRow: {
      flexDirection: 'row', alignItems: 'center', gap: 8,
      borderRadius: 10, paddingHorizontal: 12, paddingVertical: 10, borderWidth: 1,
    },
    settleAvatar:    { width: 28, height: 28, borderRadius: 14, justifyContent: 'center', alignItems: 'center', overflow: 'hidden' },
    settleAvatarImg: { width: 28, height: 28 },
    settleArrow:     { marginHorizontal: 2 },

    householdWrap: { minHeight: 200 },

    // List eyebrow + count pill
    listCountRow: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingHorizontal: 4 },
    countPill: {
      minHeight: 20, paddingHorizontal: 8, borderRadius: 9999,
      justifyContent: 'center', alignItems: 'center', borderWidth: 1,
    },

    // Date section header
    sectionDateHeader: { paddingHorizontal: 20, paddingTop: 12, paddingBottom: 4 },

    // Bill row card
    billCard: {
      flexDirection: 'row', alignItems: 'center', gap: 12,
      paddingHorizontal: 14, paddingVertical: 14,
      borderRadius: 14, borderWidth: 1, marginHorizontal: sizes.md,
      ...(isDark
        ? {}
        : {
          shadowColor: '#000', shadowOffset: { width: 0, height: 1 },
          shadowOpacity: 0.04, shadowRadius: 4, elevation: 1,
        }),
    } as never,
    billIconWrap: { width: 42, height: 42, borderRadius: 12, justifyContent: 'center', alignItems: 'center', flexShrink: 0 },
    billInfo:     { flex: 1, gap: 2 },
    billRight:    { flexDirection: 'row', alignItems: 'center', gap: 4 },
    settledBadge: { marginRight: 4 },
  });
}
