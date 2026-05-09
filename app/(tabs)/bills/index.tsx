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
import {
  useBillsStore, calculateAllNetBalances, calculateSimplifiedBalancesForUser, settleDebts, type Bill,
} from '@stores/billsStore';
import { useRecurringBillsStore, calculateFairness } from '@stores/recurringBillsStore';
import { useAuthStore } from '@stores/authStore';
import { useHousematesStore } from '@stores/housematesStore';
import { useSettingsStore } from '@stores/settingsStore';
import { resolveName } from '@utils/housemates';
import { HouseholdTab } from '@components/bills/HouseholdTab';
import { useBadgeStore } from '@stores/badgeStore';
import { useThemedColors } from '@constants/colors';
import { formatFull } from '@constants/currencies';
import { Pill } from '@components/ui';
import { EmptyState } from '@components/ui';
import { font } from '@constants/typography';
import { sizes } from '@constants/sizes';

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

// ── Housemate balance card ────────────────────────────────────────────────────
interface HousemateBalance { person: string; name: string; amount: number; color: string; avatarUrl?: string }

function HousemateCard({ item }: { item: HousemateBalance }): React.JSX.Element {
  const c            = useThemedColors();
  const currencyCode = useSettingsStore((s) => s.currencyCode);
  const owesMe       = item.amount > 0;
  const initial  = item.name[0]?.toUpperCase() ?? '?';
  return (
    <View style={[styles.hmCard, { backgroundColor: c.surface, borderColor: c.border }]}>
      <View style={[styles.hmAvatar, { backgroundColor: item.avatarUrl ? 'transparent' : item.color + '22' }]}>
        {item.avatarUrl
          ? <Image source={{ uri: item.avatarUrl }} style={styles.hmAvatarImg} contentFit="cover" />
          : <Text style={[styles.hmAvatarText, { color: item.color }]}>{initial}</Text>
        }
      </View>
      <Text style={[styles.hmName, { color: c.textPrimary }]} numberOfLines={1}>{item.name}</Text>
      <Text style={[styles.hmStatus, { color: owesMe ? c.positive : c.negative }]}>
        {owesMe ? 'Owes you' : 'You owe'}
      </Text>
      <Text style={[styles.hmAmount, { color: owesMe ? c.positive : c.negative }]}>
        {formatFull(Math.abs(item.amount), currencyCode)}
      </Text>
      <Pressable
        style={({ pressed }) => [
          styles.hmBtn,
          { backgroundColor: owesMe ? c.positive + '18' : c.primary + '18', transform: [{ scale: pressed ? 0.96 : 1 }] },
        ]}
        onPress={() => router.push('/(tabs)/bills/setup')}
        accessibilityRole="button"
      >
        <Text style={[styles.hmBtnText, { color: owesMe ? c.positive : c.primary }]}>
          {owesMe ? 'Remind' : 'Settle'}
        </Text>
      </Pressable>
    </View>
  );
}

// ── Bill row card ─────────────────────────────────────────────────────────────
function BillCard({ bill }: { bill: Bill }): React.JSX.Element {
  const c            = useThemedColors();
  const currencyCode = useSettingsStore((s) => s.currencyCode);
  const housemates = useHousematesStore((s) => s.housemates);
  const share    = bill.amount / Math.max(bill.splitBetween.length, 1);
  const icon     = getCategoryIcon(bill.category ?? '');
  return (
    <Pressable
      style={({ pressed }) => [
        styles.billCard,
        {
          backgroundColor: c.surface,
          borderColor: c.border,
          transform: [{ scale: pressed ? 0.98 : 1 }],
          opacity: pressed ? 0.92 : 1,
        },
      ]}
      onPress={() => router.push(`/(tabs)/bills/${bill.id}`)}
      accessibilityRole="button"
    >
      <View style={[styles.billIconWrap, {
        backgroundColor: bill.settled ? c.surfaceSecondary : c.primary + '12',
      }]}>
        <Ionicons
          name={icon} size={18}
          color={bill.settled ? c.textSecondary : c.primary}
        />
      </View>
      <View style={styles.billInfo}>
        <Text
          style={[styles.billTitle, { color: bill.settled ? c.textSecondary : c.textPrimary }]}
          numberOfLines={1}
        >
          {bill.title}
        </Text>
        <Text style={[styles.billMeta, { color: c.textSecondary }]} numberOfLines={1}>
          Paid by {resolveName(bill.paidBy, housemates)} · {formatFull(share, currencyCode)} each
        </Text>
      </View>
      <View style={styles.billRight}>
        {bill.settled && (
          <Pill tone="success" style={styles.settledBadge}>✓ Settled</Pill>
        )}
        <Text style={[styles.billAmount, { color: bill.settled ? c.textSecondary : c.textPrimary }]}>
          {formatFull(bill.amount, currencyCode)}
        </Text>
        <Ionicons name="chevron-forward" size={14} color={c.textSecondary} />
      </View>
    </Pressable>
  );
}

// ── Settle Up panel ───────────────────────────────────────────────────────────
function SettleUpPanel(): React.JSX.Element {
  const c            = useThemedColors();
  const currencyCode = useSettingsStore((s) => s.currencyCode);
  const bills      = useBillsStore((s) => s.bills);
  const housemates = useHousematesStore((s) => s.housemates);
  const avatarById = new Map(housemates.map((h) => [h.id, h.avatarUrl]));
  const householdBills = useRecurringBillsStore((s) => s.bills);
  const payments   = useRecurringBillsStore((s) => s.payments);

  const sharedNet       = calculateAllNetBalances(bills.filter((b) => !b.settled));
  const householdFairness = calculateFairness(householdBills, payments);

  const combined = new Map<string, number>(sharedNet);
  for (const { person, balance } of householdFairness) {
    combined.set(person, (combined.get(person) ?? 0) + balance);
  }
  const settlements = settleDebts(new Map(combined));

  if (settlements.length === 0) {
    return (
      <View style={styles.settleAllGood}>
        <Ionicons name="checkmark-circle" size={20} color={c.positive} />
        <Text style={[styles.settleAllGoodText, { color: c.positive }]}>Everyone is settled up!</Text>
      </View>
    );
  }

  return (
    <View style={styles.settleList}>
      {settlements.map((s, idx) => {
        const fromName = resolveName(s.from, housemates);
        const toName   = resolveName(s.to, housemates);
        return (
          <View key={idx} style={[styles.settleRow, { backgroundColor: c.background, borderColor: c.border }]}>
            <View style={[styles.settleAvatar, { backgroundColor: c.primary + '22' }]}>
              {avatarById.get(s.from)
                ? <Image source={{ uri: avatarById.get(s.from) }} style={styles.settleAvatarImg} contentFit="cover" />
                : <Text style={[styles.settleAvatarText, { color: c.primary }]}>{fromName[0]?.toUpperCase()}</Text>
              }
            </View>
            <Text style={[styles.settleName, { color: c.textPrimary }]}>{fromName}</Text>
            <Ionicons name="arrow-forward" size={12} color={c.textSecondary} style={styles.settleArrow} />
            <View style={[styles.settleAvatar, { backgroundColor: c.primary + '22' }]}>
              {avatarById.get(s.to)
                ? <Image source={{ uri: avatarById.get(s.to) }} style={styles.settleAvatarImg} contentFit="cover" />
                : <Text style={[styles.settleAvatarText, { color: c.primary }]}>{toName[0]?.toUpperCase()}</Text>
              }
            </View>
            <Text style={[styles.settleName, { color: c.textPrimary }]}>{toName}</Text>
            <Text style={[styles.settleAmt, { color: c.textPrimary }]}>{formatFull(s.amount, currencyCode)}</Text>
          </View>
        );
      })}
    </View>
  );
}

// ── Main screen ───────────────────────────────────────────────────────────────
export default function BillsScreen(): React.JSX.Element {
  const c          = useThemedColors();
  const { t }      = useTranslation();
  const { width }  = useWindowDimensions();
  const isWide     = width >= 680;

  const markSeen   = useBadgeStore((s) => s.markSeen);
  useFocusEffect(useCallback(() => { markSeen('bills').catch(() => {}); }, [markSeen]));

  const bills      = useBillsStore((s) => s.bills);
  const isLoading  = useBillsStore((s) => s.isLoading);
  const error      = useBillsStore((s) => s.error);
  const loadBills  = useBillsStore((s) => s.load);
  const profile    = useAuthStore((s) => s.profile);
  const houseId    = useAuthStore((s) => s.houseId) ?? '';
  const currencyCode = useSettingsStore((s) => s.currencyCode);
  const housemates   = useHousematesStore((s) => s.housemates);
  const housemateById = useMemo(() => new Map(housemates.map((h) => [h.id, h])), [housemates]);

  const [filter, setFilter]     = useState<BillFilter>('one-off');
  const { openRecurring }       = useLocalSearchParams<{ openRecurring?: string }>();
  useEffect(() => {
    if (openRecurring === '1') setFilter('recurring');
  }, [openRecurring]);
  const [showSettle, setShowSettle] = useState(false);

  const householdBills = useRecurringBillsStore((s) => s.bills);
  const payments       = useRecurringBillsStore((s) => s.payments);

  const myId       = profile?.id ?? '';
  const activeBills = bills.filter((b) => !b.settled);

  const combinedNet = new Map<string, number>(calculateAllNetBalances(activeBills));
  for (const { person, balance } of calculateFairness(householdBills, payments)) {
    combinedNet.set(person, (combinedNet.get(person) ?? 0) + balance);
  }
  const sharedBalances = calculateSimplifiedBalancesForUser(combinedNet, myId);

  const totalOwed  = sharedBalances.filter((b) => b.amount > 0).reduce((s, b) => s + b.amount, 0);
  const totalOwe   = sharedBalances.filter((b) => b.amount < 0).reduce((s, b) => s + Math.abs(b.amount), 0);
  const netBalance = totalOwed - totalOwe;

  const COLORS = ['#6366f1', '#0ea5e9', '#f59e0b', '#10b981', '#ef4444', '#8b5cf6'];
  const hmBalances: HousemateBalance[] = sharedBalances.map((b, i) => ({
    person:   b.person,
    name:     resolveName(b.person, housemates),
    amount:   b.amount,
    color:    housemateById.get(b.person)?.color ?? COLORS[i % COLORS.length],
    avatarUrl: housemateById.get(b.person)?.avatarUrl,
  }));

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
    ({ item }: { item: Bill }): React.JSX.Element => <BillCard bill={item} />,
    []
  );

  if (isLoading) {
    return (
      <SafeAreaView style={[styles.container, { backgroundColor: c.background }]} edges={['top']}>
        <View style={styles.centered}>
          <EmptyState mode="loading" title="Loading bills…" />
        </View>
      </SafeAreaView>
    );
  }

  if (error) {
    return (
      <SafeAreaView style={[styles.container, { backgroundColor: c.background }]} edges={['top']}>
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

  const ListHeader = (
    <View style={[styles.listHeaderWrap, isWide && styles.listHeaderWrapWide]}>

      {/* ── Page header ─────────────────────────────────────────── */}
      <View style={styles.pageHeader}>
        <View>
          <Text style={[styles.pageTitle, { color: c.textPrimary }]}>Bills</Text>
          <Text style={[styles.pageSubtitle, { color: c.textSecondary }]}>{'Expenses & balances'}</Text>
        </View>
        <Pressable
          style={({ pressed }) => [
            styles.addBtn,
            { backgroundColor: c.primary, transform: [{ scale: pressed ? 0.96 : 1 }], opacity: pressed ? 0.88 : 1 },
          ]}
          onPress={() => router.push('/(tabs)/bills/add')}
          accessibilityRole="button"
          accessibilityLabel="Add new expense"
        >
          <Ionicons name="add" size={18} color="#fff" />
          <Text style={styles.addBtnText}>{t('bills.add_expense')}</Text>
        </Pressable>
      </View>

      {/* ── Balance stats ────────────────────────────────────────── */}
      <View style={[styles.balanceCard, { backgroundColor: c.surface, borderColor: c.border }]}>
        <View style={styles.balanceStat}>
          <Text style={[styles.balanceStatLabel, { color: c.textSecondary }]}>Owed to you</Text>
          <Text style={[styles.balanceStatNum, { color: totalOwed > 0 ? c.positive : c.textPrimary }]}>
            {formatFull(totalOwed, currencyCode)}
          </Text>
        </View>
        <View style={[styles.balanceDivider, { backgroundColor: c.border }]} />
        <View style={styles.balanceStat}>
          <Text style={[styles.balanceStatLabel, { color: c.textSecondary }]}>Net balance</Text>
          <Text style={[styles.balanceStatNum, { color: netBalance > 0 ? c.positive : netBalance < 0 ? c.negative : c.textPrimary }]}>
            {netBalance > 0 ? '+' : ''}{formatFull(Math.abs(netBalance), currencyCode)}
          </Text>
          <Text style={[styles.balanceStatTag, { color: netBalance > 0 ? c.positive : netBalance < 0 ? c.negative : c.textSecondary }]}>
            {netBalance > 0 ? 'You are owed' : netBalance < 0 ? 'You owe' : 'All settled'}
          </Text>
        </View>
        <View style={[styles.balanceDivider, { backgroundColor: c.border }]} />
        <View style={styles.balanceStat}>
          <Text style={[styles.balanceStatLabel, { color: c.textSecondary }]}>You owe</Text>
          <Text style={[styles.balanceStatNum, { color: totalOwe > 0 ? c.negative : c.textPrimary }]}>
            {formatFull(totalOwe, currencyCode)}
          </Text>
        </View>
      </View>

      {/* ── Settle Up collapsible ────────────────────────────────── */}
      <View>
        <Pressable
          style={({ pressed }) => [
            styles.settleCard,
            { borderColor: showSettle ? c.positive + '60' : c.positive + '35', backgroundColor: c.surface },
            pressed && { opacity: 0.85 },
          ]}
          onPress={() => setShowSettle((v) => !v)}
          accessible={true}
          accessibilityRole="button"
          accessibilityLabel="Toggle settle up"
          accessibilityState={{ expanded: showSettle }}
        >
          <View style={styles.settleCardHeader}>
            <View style={[styles.settleIconWrap, { backgroundColor: c.positive + '18' }]}>
              <Ionicons name="swap-horizontal-outline" size={16} color={c.positive} />
            </View>
            <Text style={[styles.settleCardTitle, { color: c.textPrimary }]}>Settle Up</Text>
            <Text style={[styles.settleCardHint, { color: c.textSecondary }]}>
              {showSettle ? 'Hide' : 'See transfers'}
            </Text>
            <Ionicons name={showSettle ? 'chevron-up' : 'chevron-down'} size={16} color={c.textSecondary} />
          </View>
          {showSettle && (
            <View style={styles.settleContent}>
              <Text style={[styles.settleCardSub, { color: c.textSecondary }]}>Minimum transfers to clear all balances</Text>
              <SettleUpPanel />
            </View>
          )}
        </Pressable>
      </View>

      {/* ── Housemate balances ────────────────────────────────────── */}
      {hmBalances.length > 0 && (
        <View style={styles.section}>
          <View style={styles.sectionHeaderRow}>
            <Text style={[styles.sectionLabel, { color: c.textSecondary }]}>HOUSEMATE BALANCES</Text>
            <Pressable onPress={() => router.push('/(tabs)/bills/setup')} accessibilityRole="button">
              <Text style={[styles.seeAll, { color: c.primary }]}>Manage</Text>
            </Pressable>
          </View>
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.hmScrollContent}
          >
            {hmBalances.map((item) => (
              <HousemateCard key={item.person} item={item} />
            ))}
          </ScrollView>
        </View>
      )}

      {/* ── Bill type filter ──────────────────────────────────────── */}
      <View style={[styles.filterRow, { backgroundColor: c.surfaceSecondary, borderColor: c.border }]}>
        <Pressable
          style={({ pressed }) => [
            styles.filterTab,
            filter === 'one-off' && { backgroundColor: c.primary },
            pressed && filter !== 'one-off' && { opacity: 0.7 },
          ]}
          onPress={() => setFilter('one-off')}
          accessible={true}
          accessibilityRole="tab"
          accessibilityState={{ selected: filter === 'one-off' }}
        >
          <Ionicons name="receipt-outline" size={14} color={filter === 'one-off' ? '#fff' : c.textSecondary} />
          <Text style={[styles.filterTabText, { color: filter === 'one-off' ? '#fff' : c.textSecondary }, filter === 'one-off' && styles.filterTabTextActive]}>
            One-off expenses
          </Text>
          {bills.length > 0 && filter === 'one-off' && (
            <View style={styles.filterBadge}>
              <Text style={styles.filterBadgeText}>{bills.length}</Text>
            </View>
          )}
        </Pressable>
        <Pressable
          style={({ pressed }) => [
            styles.filterTab,
            filter === 'recurring' && { backgroundColor: c.primary },
            pressed && filter !== 'recurring' && { opacity: 0.7 },
          ]}
          onPress={() => setFilter('recurring')}
          accessible={true}
          accessibilityRole="tab"
          accessibilityState={{ selected: filter === 'recurring' }}
        >
          <Ionicons name="repeat-outline" size={14} color={filter === 'recurring' ? '#fff' : c.textSecondary} />
          <Text style={[styles.filterTabText, { color: filter === 'recurring' ? '#fff' : c.textSecondary }, filter === 'recurring' && styles.filterTabTextActive]}>
            Recurring bills
          </Text>
        </Pressable>
      </View>

      {/* Recurring household bills */}
      {filter === 'recurring' && (
        <View style={styles.householdWrap}>
          <HouseholdTab />
        </View>
      )}

      {/* One-off list eyebrow */}
      {filter === 'one-off' && bills.length > 0 && (
        <View style={styles.listCountRow}>
          <Text style={[styles.eyebrow, { color: c.textSecondary }]}>ALL EXPENSES</Text>
          <View style={[styles.countPill, { backgroundColor: c.surfaceSecondary, borderColor: c.border }]}>
            <Text style={[styles.countPillText, { color: c.textSecondary }]}>{bills.length}</Text>
          </View>
        </View>
      )}
    </View>
  );

  if (filter === 'recurring') {
    return (
      <SafeAreaView style={[styles.container, { backgroundColor: c.background }]} edges={['top']}>
        <ScrollView
          style={styles.flex}
          showsVerticalScrollIndicator={false}
          contentContainerStyle={styles.listContent}
          keyboardShouldPersistTaps="handled"
        >
          {ListHeader}
        </ScrollView>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: c.background }]} edges={['top']}>
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
            <Text style={[styles.sectionDateText, { color: c.textSecondary }]}>{section.title}</Text>
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
    </SafeAreaView>
  );
}

// ── Styles ────────────────────────────────────────────────────────────────────
const styles = StyleSheet.create({
  container:    { flex: 1 },
  flex:         { flex: 1 },
  centered:     { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 20 },
  listContent:  {
    paddingBottom: Platform.OS === 'web' ? sizes.bottomTabBarHeight : sizes.bottomTabContentPadding,
  },

  listHeaderWrap:     { paddingHorizontal: 16, paddingTop: 8, gap: 14 },
  listHeaderWrapWide: { paddingHorizontal: 24 },

  // ── Page header
  pageHeader: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    paddingTop: 4,
  },
  pageTitle:    { fontSize: 28, ...font.extrabold, letterSpacing: -0.8 },
  pageSubtitle: { fontSize: 13, ...font.regular, marginTop: 2 },
  addBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    paddingVertical: 11, paddingHorizontal: 16,
    borderRadius: 12,
    shadowColor: '#4F78B6',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.25,
    shadowRadius: 8,
    elevation: 6,
  },
  addBtnText: { fontSize: 14, ...font.semibold, color: '#fff' },

  // ── Balance card
  balanceCard: {
    flexDirection: 'row',
    borderRadius: 20, borderWidth: 1,
    padding: 20,
    alignItems: 'flex-start',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 8,
    elevation: 3,
  },
  balanceStat:      { flex: 1, alignItems: 'center', gap: 3 },
  balanceDivider:   { width: 1, height: 52, alignSelf: 'center' },
  balanceStatLabel: { fontSize: 12, ...font.medium, textAlign: 'center' },
  balanceStatNum:   { fontSize: 22, ...font.extrabold, letterSpacing: -0.5, textAlign: 'center' },
  balanceStatTag:   { fontSize: 11, ...font.semibold, textAlign: 'center' },

  // ── Settle card
  settleCard: {
    borderRadius: 16, borderWidth: 1,
    paddingHorizontal: 16, paddingVertical: 14,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 6,
    elevation: 2,
  },
  settleCardHeader: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  settleIconWrap:   { width: 32, height: 32, borderRadius: 9, justifyContent: 'center', alignItems: 'center' },
  settleCardTitle:  { flex: 1, fontSize: 15, ...font.semibold },
  settleCardHint:   { fontSize: 13, ...font.regular },
  settleContent:    { marginTop: 12, gap: 10 },
  settleCardSub:    { fontSize: 13, ...font.regular, lineHeight: 18 },

  settleAllGood:     { flexDirection: 'row', alignItems: 'center', gap: 8, paddingVertical: 6 },
  settleAllGoodText: { fontSize: 14, ...font.semibold },
  settleList:        { gap: 8 },
  settleRow: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    borderRadius: 10,
    paddingHorizontal: 12, paddingVertical: 10,
    borderWidth: 1,
  },
  settleAvatar:     { width: 28, height: 28, borderRadius: 14, justifyContent: 'center', alignItems: 'center', overflow: 'hidden' },
  settleAvatarImg:  { width: 28, height: 28 },
  settleAvatarText: { fontSize: 12, ...font.bold },
  settleName:       { fontSize: 13, ...font.semibold },
  settleArrow:      { marginHorizontal: 2 },
  settleAmt:        { marginLeft: 'auto' as never, fontSize: 14, ...font.bold },

  // ── Section / labels
  section:          { gap: 10 },
  sectionHeaderRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  sectionLabel:     { fontSize: 11, ...font.bold, letterSpacing: 0.8, textTransform: 'uppercase' },
  seeAll:           { fontSize: 13, ...font.semibold },

  // ── Housemate cards
  hmScrollContent: { gap: 10, paddingBottom: 4 },
  hmCard: {
    width: 130,
    borderRadius: 16, borderWidth: 1,
    padding: 14, gap: 4, alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 6,
    elevation: 2,
  },
  hmAvatar:    { width: 44, height: 44, borderRadius: 22, justifyContent: 'center', alignItems: 'center', marginBottom: 2, overflow: 'hidden' },
  hmAvatarImg: { width: 44, height: 44 },
  hmAvatarText: { fontSize: 18, ...font.bold },
  hmName:      { fontSize: 13, ...font.semibold, textAlign: 'center' },
  hmStatus:    { fontSize: 11, ...font.regular, textAlign: 'center' },
  hmAmount:    { fontSize: 14, ...font.extrabold, textAlign: 'center' },
  hmBtn:       { paddingHorizontal: 14, paddingVertical: 6, borderRadius: 8, marginTop: 4, minHeight: 44, minWidth: 44, justifyContent: 'center', alignItems: 'center' },
  hmBtnText:   { fontSize: 12, ...font.semibold },

  // ── Filter tabs
  filterRow: {
    flexDirection: 'row', gap: 8,
    borderRadius: 14, padding: 4,
    borderWidth: 1,
  },
  filterTab: {
    flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    gap: 6, paddingVertical: 10, borderRadius: 11, minHeight: 44,
  },
  filterTabText:       { fontSize: 13, ...font.semibold },
  filterTabTextActive: { color: '#fff' },
  filterBadge:         { backgroundColor: 'rgba(255,255,255,0.3)', borderRadius: 8, paddingHorizontal: 6, paddingVertical: 1 },
  filterBadgeText:     { fontSize: 11, ...font.bold, color: '#fff' },

  householdWrap: { minHeight: 200 },

  // ── One-off list header
  listCountRow: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingHorizontal: 4 },
  eyebrow:      { fontSize: 11, ...font.bold, letterSpacing: 0.8, textTransform: 'uppercase' },
  countPill:    { minHeight: 20, paddingHorizontal: 8, borderRadius: 9999, justifyContent: 'center', alignItems: 'center', borderWidth: 1 },
  countPillText: { fontSize: 11, ...font.bold },

  // ── Date section header
  sectionDateHeader: { paddingHorizontal: 20, paddingTop: 12, paddingBottom: 4 },
  sectionDateText:   { fontSize: 12, ...font.bold, textTransform: 'uppercase', letterSpacing: 0.7 },

  // ── Bill row card
  billCard: {
    flexDirection: 'row', alignItems: 'center', gap: 12,
    paddingHorizontal: 14, paddingVertical: 14,
    borderRadius: 14,
    borderWidth: 1,
    marginHorizontal: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.04,
    shadowRadius: 4,
    elevation: 1,
  },
  billIconWrap: { width: 42, height: 42, borderRadius: 12, justifyContent: 'center', alignItems: 'center', flexShrink: 0 },
  billInfo:     { flex: 1 },
  billTitle:    { fontSize: 15, ...font.semibold },
  billMeta:     { fontSize: 12, ...font.regular, marginTop: 2 },
  settledBadge: { paddingHorizontal: 7, paddingVertical: 3, borderRadius: 6, marginRight: 4 },
  settledBadgeText: { fontSize: 10, ...font.semibold },
  billRight:    { flexDirection: 'row', alignItems: 'center', gap: 4 },
  billAmount:   { fontSize: 16, ...font.bold },

  // ── Empty state
  emptyWrap:     { alignItems: 'center', paddingVertical: 48, gap: 10, paddingHorizontal: 24 },
  emptyIconWrap: { width: 72, height: 72, borderRadius: 36, justifyContent: 'center', alignItems: 'center' },
  emptyTitle:    { fontSize: 16, ...font.bold },
  emptyText:     { fontSize: 14, ...font.regular, textAlign: 'center', lineHeight: 20 },
});