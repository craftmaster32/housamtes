import { useState, useCallback, useMemo } from 'react';
import {
  View, SectionList, ScrollView, StyleSheet, Pressable,
  useWindowDimensions,
} from 'react-native';
import { Text } from 'react-native-paper';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { Ionicons } from '@expo/vector-icons';
import {
  useBillsStore, calculateBalances, calculateAllNetBalances, settleDebts, type Bill,
} from '@stores/billsStore';
import { useRecurringBillsStore, calculateFairness } from '@stores/recurringBillsStore';
import { useAuthStore } from '@stores/authStore';
import { useSettingsStore } from '@stores/settingsStore';
import { HouseholdTab } from '@components/bills/HouseholdTab';
import { colors } from '@constants/colors';
import { font } from '@constants/typography';

const SURFACE = 'rgba(251,248,245,0.98)';
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
interface HousemateBalance { name: string; amount: number; color: string }

function HousemateCard({ item }: { item: HousemateBalance }): React.JSX.Element {
  const currency = useSettingsStore((s) => s.currency);
  const owesMe = item.amount > 0;
  const initial = item.name[0]?.toUpperCase() ?? '?';
  return (
    <View style={styles.hmCard}>
      <View style={[styles.hmAvatar, { backgroundColor: item.color + '22' }]}>
        <Text style={[styles.hmAvatarText, { color: item.color }]}>{initial}</Text>
      </View>
      <Text style={styles.hmName} numberOfLines={1}>{item.name}</Text>
      <Text style={[styles.hmStatus, { color: owesMe ? colors.positive : colors.negative }]}>
        {owesMe ? 'Owes you' : 'You owe'}
      </Text>
      <Text style={[styles.hmAmount, { color: owesMe ? colors.positive : colors.negative }]}>
        {currency}{Math.abs(item.amount).toFixed(2)}
      </Text>
      <Pressable
        style={[styles.hmBtn, { backgroundColor: owesMe ? colors.positive + '18' : colors.primary + '18' }]}
        onPress={() => router.push('/(tabs)/bills/setup')}
        accessibilityRole="button"
      >
        <Text style={[styles.hmBtnText, { color: owesMe ? colors.positive : colors.primary }]}>
          {owesMe ? 'Remind' : 'Settle'}
        </Text>
      </Pressable>
    </View>
  );
}

// ── Bill row card ─────────────────────────────────────────────────────────────
function BillCard({ bill }: { bill: Bill }): React.JSX.Element {
  const currency = useSettingsStore((s) => s.currency);
  const share = bill.amount / Math.max(bill.splitBetween.length, 1);
  const icon = getCategoryIcon(bill.category ?? '');
  return (
    <Pressable
      style={styles.billCard}
      onPress={() => router.push(`/(tabs)/bills/${bill.id}`)}
      accessibilityRole="button"
    >
      <View style={[styles.billIconWrap, {
        backgroundColor: bill.settled ? colors.surfaceSecondary : colors.primary + '12',
      }]}>
        <Ionicons
          name={icon} size={18}
          color={bill.settled ? colors.textSecondary : colors.primary}
        />
      </View>
      <View style={styles.billInfo}>
        <Text
          style={[styles.billTitle, bill.settled && { color: colors.textSecondary }]}
          numberOfLines={1}
        >
          {bill.title}
        </Text>
        <Text style={styles.billMeta} numberOfLines={1}>
          Paid by {bill.paidBy} · {currency}{share.toFixed(2)} each
        </Text>
      </View>
      <View style={styles.billRight}>
        {bill.settled && (
          <View style={styles.settledBadge}>
            <Text style={styles.settledBadgeText}>✓ Settled</Text>
          </View>
        )}
        <Text style={[styles.billAmount, bill.settled && { color: colors.textSecondary }]}>
          {currency}{bill.amount.toFixed(2)}
        </Text>
        <Ionicons name="chevron-forward" size={14} color={colors.textSecondary} />
      </View>
    </Pressable>
  );
}

// ── Settle Up content (used inside collapsible card) ──────────────────────────
function SettleUpPanel(): React.JSX.Element {
  const currency = useSettingsStore((s) => s.currency);
  const bills = useBillsStore((s) => s.bills);
  const householdBills = useRecurringBillsStore((s) => s.bills);
  const payments = useRecurringBillsStore((s) => s.payments);

  const sharedNet = calculateAllNetBalances(bills.filter((b) => !b.settled));
  const householdFairness = calculateFairness(householdBills, payments);

  const combined = new Map<string, number>(sharedNet);
  for (const { person, balance } of householdFairness) {
    combined.set(person, (combined.get(person) ?? 0) + balance);
  }
  const settlements = settleDebts(new Map(combined));

  if (settlements.length === 0) {
    return (
      <View style={styles.settleAllGood}>
        <Ionicons name="checkmark-circle" size={20} color={colors.positive} />
        <Text style={styles.settleAllGoodText}>Everyone is settled up!</Text>
      </View>
    );
  }

  return (
    <View style={styles.settleList}>
      {settlements.map((s, idx) => (
        <View key={idx} style={styles.settleRow}>
          <View style={styles.settleAvatar}>
            <Text style={styles.settleAvatarText}>{s.from[0]?.toUpperCase()}</Text>
          </View>
          <Text style={styles.settleName}>{s.from}</Text>
          <Ionicons name="arrow-forward" size={12} color={colors.textSecondary} style={styles.settleArrow} />
          <View style={styles.settleAvatar}>
            <Text style={styles.settleAvatarText}>{s.to[0]?.toUpperCase()}</Text>
          </View>
          <Text style={styles.settleName}>{s.to}</Text>
          <Text style={styles.settleAmt}>{currency}{s.amount.toFixed(2)}</Text>
        </View>
      ))}
    </View>
  );
}

// ── Main screen ───────────────────────────────────────────────────────────────
export default function BillsScreen(): React.JSX.Element {
  const { t } = useTranslation();
  const { width } = useWindowDimensions();
  const isWide = width >= 680;

  const bills = useBillsStore((s) => s.bills);
  const isLoading = useBillsStore((s) => s.isLoading);
  const profile = useAuthStore((s) => s.profile);
  const currency = useSettingsStore((s) => s.currency);

  const [filter, setFilter] = useState<BillFilter>('one-off');
  const [showSettle, setShowSettle] = useState(false);

  const myName = profile?.name ?? '';
  const activeBills = bills.filter((b) => !b.settled);
  const sharedBalances = calculateBalances(activeBills, myName);

  const totalOwed = sharedBalances.filter((b) => b.amount > 0).reduce((s, b) => s + b.amount, 0);
  const totalOwe  = sharedBalances.filter((b) => b.amount < 0).reduce((s, b) => s + Math.abs(b.amount), 0);
  const netBalance = totalOwed - totalOwe;

  const COLORS = ['#6366f1', '#0ea5e9', '#f59e0b', '#10b981', '#ef4444', '#8b5cf6'];
  const hmBalances: HousemateBalance[] = sharedBalances.map((b, i) => ({
    name: b.person,
    amount: b.amount,
    color: COLORS[i % COLORS.length],
  }));

  // Group bills by date for section list
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
      <SafeAreaView style={styles.container} edges={['top']}>
        <View style={styles.centered}>
          <Text style={styles.emptyText}>{t('common.loading')}</Text>
        </View>
      </SafeAreaView>
    );
  }

  // Shared header rendered above the list in both scroll and section-list modes
  const ListHeader = (
    <View style={[styles.listHeaderWrap, isWide && styles.listHeaderWrapWide]}>

      {/* ── Page header ─────────────────────────────────────────── */}
      <View style={styles.pageHeader}>
        <View>
          <Text style={styles.pageTitle}>Bills</Text>
          <Text style={styles.pageSubtitle}>{'Expenses & balances'}</Text>
        </View>
        <Pressable
          style={styles.addBtn}
          onPress={() => router.push('/(tabs)/bills/add')}
          accessibilityRole="button"
          accessibilityLabel="Add new expense"
        >
          <Ionicons name="add" size={18} color="#fff" />
          <Text style={styles.addBtnText}>Add Expense</Text>
        </Pressable>
      </View>

      {/* ── Balance stats ────────────────────────────────────────── */}
      <View style={styles.balanceCard}>
        <View style={styles.balanceStat}>
          <Text style={styles.balanceStatLabel}>Owed to you</Text>
          <Text style={[styles.balanceStatNum, { color: totalOwed > 0 ? colors.positive : colors.textPrimary }]}>
            {currency}{totalOwed.toFixed(2)}
          </Text>
        </View>
        <View style={styles.balanceDivider} />
        <View style={styles.balanceStat}>
          <Text style={styles.balanceStatLabel}>Net balance</Text>
          <Text style={[styles.balanceStatNum, { color: netBalance > 0 ? colors.positive : netBalance < 0 ? colors.negative : colors.textPrimary }]}>
            {netBalance > 0 ? '+' : ''}{currency}{Math.abs(netBalance).toFixed(2)}
          </Text>
          <Text style={[styles.balanceStatTag, {
            color: netBalance > 0 ? colors.positive : netBalance < 0 ? colors.negative : colors.textSecondary,
          }]}>
            {netBalance > 0 ? 'You are owed' : netBalance < 0 ? 'You owe' : 'All settled'}
          </Text>
        </View>
        <View style={styles.balanceDivider} />
        <View style={styles.balanceStat}>
          <Text style={styles.balanceStatLabel}>You owe</Text>
          <Text style={[styles.balanceStatNum, { color: totalOwe > 0 ? colors.negative : colors.textPrimary }]}>
            {currency}{totalOwe.toFixed(2)}
          </Text>
        </View>
      </View>

      {/* ── Settle Up collapsible card ────────────────────────────── */}
      <Pressable
        style={[styles.settleCard, showSettle && styles.settleCardOpen]}
        onPress={() => setShowSettle((v) => !v)}
        accessibilityRole="button"
        accessibilityLabel="Toggle settle up"
      >
        <View style={styles.settleCardHeader}>
          <View style={styles.settleIconWrap}>
            <Ionicons name="swap-horizontal-outline" size={16} color={colors.positive} />
          </View>
          <Text style={styles.settleCardTitle}>Settle Up</Text>
          <Text style={styles.settleCardHint}>
            {showSettle ? 'Hide' : 'See transfers'}
          </Text>
          <Ionicons
            name={showSettle ? 'chevron-up' : 'chevron-down'}
            size={16}
            color={colors.textSecondary}
          />
        </View>
        {showSettle && (
          <View style={styles.settleContent}>
            <Text style={styles.settleCardSub}>Minimum transfers to clear all balances</Text>
            <SettleUpPanel />
          </View>
        )}
      </Pressable>

      {/* ── Housemate balances ────────────────────────────────────── */}
      {hmBalances.length > 0 && (
        <View style={styles.section}>
          <View style={styles.sectionHeaderRow}>
            <Text style={styles.sectionLabel}>HOUSEMATE BALANCES</Text>
            <Pressable onPress={() => router.push('/(tabs)/bills/setup')} accessibilityRole="button">
              <Text style={styles.seeAll}>Manage</Text>
            </Pressable>
          </View>
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.hmScrollContent}
          >
            {hmBalances.map((item) => (
              <HousemateCard key={item.name} item={item} />
            ))}
          </ScrollView>
        </View>
      )}

      {/* ── Bill type filter ──────────────────────────────────────── */}
      <View style={styles.filterRow}>
        <Pressable
          style={[styles.filterTab, filter === 'one-off' && styles.filterTabActive]}
          onPress={() => setFilter('one-off')}
          accessibilityRole="tab"
        >
          <Ionicons
            name="receipt-outline" size={14}
            color={filter === 'one-off' ? '#fff' : colors.textSecondary}
          />
          <Text style={[styles.filterTabText, filter === 'one-off' && styles.filterTabTextActive]}>
            One-off expenses
          </Text>
          {bills.length > 0 && filter === 'one-off' && (
            <View style={styles.filterBadge}>
              <Text style={styles.filterBadgeText}>{bills.length}</Text>
            </View>
          )}
        </Pressable>
        <Pressable
          style={[styles.filterTab, filter === 'recurring' && styles.filterTabActive]}
          onPress={() => setFilter('recurring')}
          accessibilityRole="tab"
        >
          <Ionicons
            name="repeat-outline" size={14}
            color={filter === 'recurring' ? '#fff' : colors.textSecondary}
          />
          <Text style={[styles.filterTabText, filter === 'recurring' && styles.filterTabTextActive]}>
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
          <Text style={styles.eyebrow}>ALL EXPENSES</Text>
          <View style={styles.countPill}>
            <Text style={styles.countPillText}>{bills.length}</Text>
          </View>
        </View>
      )}
    </View>
  );

  // Recurring: plain scroll
  if (filter === 'recurring') {
    return (
      <SafeAreaView style={styles.container} edges={['top']}>
        <ScrollView
          showsVerticalScrollIndicator={false}
          contentContainerStyle={styles.listContent}
          keyboardShouldPersistTaps="handled"
        >
          {ListHeader}
        </ScrollView>
      </SafeAreaView>
    );
  }

  // One-off: section list with date groups
  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <SectionList<Bill>
        sections={billSections}
        keyExtractor={(item) => item.id}
        renderItem={renderBill}
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.listContent}
        stickySectionHeadersEnabled={false}
        ListHeaderComponent={ListHeader}
        renderSectionHeader={({ section }) => (
          <View style={styles.sectionDateHeader}>
            <Text style={styles.sectionDateText}>{section.title}</Text>
          </View>
        )}
        ItemSeparatorComponent={() => <View style={{ height: 8 }} />}
        SectionSeparatorComponent={() => <View style={{ height: 4 }} />}
        ListEmptyComponent={
          <View style={styles.emptyWrap}>
            <View style={styles.emptyIconWrap}>
              <Ionicons name="receipt-outline" size={32} color={colors.textSecondary} />
            </View>
            <Text style={styles.emptyTitle}>No expenses yet</Text>
            <Text style={styles.emptyText}>Tap Add Expense to record your first shared spend</Text>
          </View>
        }
      />
    </SafeAreaView>
  );
}

// ── Styles ────────────────────────────────────────────────────────────────────
const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  centered: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 20 },
  listContent: { paddingBottom: 52 },

  listHeaderWrap: { paddingHorizontal: 16, paddingTop: 8, gap: 14 },
  listHeaderWrapWide: { paddingHorizontal: 24 },

  // ── Page header
  pageHeader: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    paddingTop: 4,
  },
  pageTitle: { fontSize: 28, ...font.extrabold, color: colors.textPrimary, letterSpacing: -0.8 },
  pageSubtitle: { fontSize: 13, ...font.regular, color: colors.textSecondary, marginTop: 2 },
  addBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    backgroundColor: colors.primary,
    paddingVertical: 11, paddingHorizontal: 16,
    borderRadius: 12,
    boxShadow: '0 4px 14px rgba(79,120,182,0.25)',
  } as never,
  addBtnText: { fontSize: 14, ...font.semibold, color: '#fff' },

  // ── Balance card
  balanceCard: {
    flexDirection: 'row',
    backgroundColor: SURFACE,
    borderRadius: 20, borderWidth: 1, borderColor: colors.border,
    padding: 20,
    alignItems: 'flex-start',
    boxShadow: '0 4px 20px rgba(44,51,61,0.06)',
  } as never,
  balanceStat: { flex: 1, alignItems: 'center', gap: 3 },
  balanceDivider: { width: 1, height: 52, backgroundColor: colors.border, alignSelf: 'center' },
  balanceStatLabel: { fontSize: 12, ...font.medium, color: colors.textSecondary, textAlign: 'center' },
  balanceStatNum: { fontSize: 22, ...font.extrabold, color: colors.textPrimary, letterSpacing: -0.5, textAlign: 'center' },
  balanceStatTag: { fontSize: 11, ...font.semibold, textAlign: 'center' },

  // ── Settle card
  settleCard: {
    backgroundColor: SURFACE,
    borderRadius: 16, borderWidth: 1, borderColor: colors.positive + '35',
    paddingHorizontal: 16, paddingVertical: 14,
    boxShadow: '0 2px 12px rgba(34,197,94,0.07)',
  } as never,
  settleCardOpen: { borderColor: colors.positive + '60' },
  settleCardHeader: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  settleIconWrap: {
    width: 32, height: 32, borderRadius: 9,
    backgroundColor: colors.positive + '18',
    justifyContent: 'center', alignItems: 'center',
  },
  settleCardTitle: { flex: 1, fontSize: 15, ...font.semibold, color: colors.textPrimary },
  settleCardHint: { fontSize: 13, ...font.regular, color: colors.textSecondary },
  settleContent: { marginTop: 12, gap: 10 },
  settleCardSub: { fontSize: 13, ...font.regular, color: colors.textSecondary, lineHeight: 18 },

  settleAllGood: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingVertical: 6 },
  settleAllGoodText: { fontSize: 14, ...font.semibold, color: colors.positive },
  settleList: { gap: 8 },
  settleRow: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    backgroundColor: colors.background, borderRadius: 10,
    paddingHorizontal: 12, paddingVertical: 10,
    borderWidth: 1, borderColor: colors.border,
  },
  settleAvatar: {
    width: 28, height: 28, borderRadius: 14,
    backgroundColor: colors.primary + '22',
    justifyContent: 'center', alignItems: 'center',
  },
  settleAvatarText: { fontSize: 12, ...font.bold, color: colors.primary },
  settleName: { fontSize: 13, ...font.semibold, color: colors.textPrimary },
  settleArrow: { marginHorizontal: 2 },
  settleAmt: { marginLeft: 'auto' as never, fontSize: 14, ...font.bold, color: colors.textPrimary },

  // ── Section / labels
  section: { gap: 10 },
  sectionHeaderRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  sectionLabel: {
    fontSize: 11, ...font.bold, color: colors.textSecondary,
    letterSpacing: 0.8, textTransform: 'uppercase',
  },
  seeAll: { fontSize: 13, ...font.semibold, color: colors.primary },

  // ── Housemate cards (horizontal scroll)
  hmScrollContent: { gap: 10, paddingBottom: 4 },
  hmCard: {
    width: 130,
    backgroundColor: SURFACE,
    borderRadius: 16, borderWidth: 1, borderColor: colors.border,
    padding: 14, gap: 4, alignItems: 'center',
    boxShadow: '0 2px 10px rgba(44,51,61,0.05)',
  } as never,
  hmAvatar: {
    width: 44, height: 44, borderRadius: 22,
    justifyContent: 'center', alignItems: 'center', marginBottom: 2,
  },
  hmAvatarText: { fontSize: 18, ...font.bold },
  hmName: { fontSize: 13, ...font.semibold, color: colors.textPrimary, textAlign: 'center' },
  hmStatus: { fontSize: 11, ...font.regular, textAlign: 'center' },
  hmAmount: { fontSize: 14, ...font.extrabold, textAlign: 'center' },
  hmBtn: {
    paddingHorizontal: 14, paddingVertical: 6, borderRadius: 8, marginTop: 4,
  },
  hmBtnText: { fontSize: 12, ...font.semibold },

  // ── Filter tabs
  filterRow: {
    flexDirection: 'row', gap: 8,
    backgroundColor: colors.surfaceSecondary,
    borderRadius: 14, padding: 4,
    borderWidth: 1, borderColor: colors.border,
  },
  filterTab: {
    flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    gap: 6, paddingVertical: 10, borderRadius: 11,
  },
  filterTabActive: { backgroundColor: colors.primary },
  filterTabText: { fontSize: 13, ...font.semibold, color: colors.textSecondary },
  filterTabTextActive: { color: '#fff' },
  filterBadge: {
    backgroundColor: 'rgba(255,255,255,0.3)',
    borderRadius: 8, paddingHorizontal: 6, paddingVertical: 1,
  },
  filterBadgeText: { fontSize: 11, ...font.bold, color: '#fff' },

  // Recurring tab content
  householdWrap: { minHeight: 200 },

  // ── One-off list header
  listCountRow: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingHorizontal: 4 },
  eyebrow: {
    fontSize: 11, ...font.bold, color: colors.textSecondary,
    letterSpacing: 0.8, textTransform: 'uppercase',
  },
  countPill: {
    minHeight: 20, paddingHorizontal: 8, borderRadius: 9999,
    backgroundColor: colors.surfaceSecondary,
    justifyContent: 'center', alignItems: 'center',
    borderWidth: 1, borderColor: colors.border,
  },
  countPillText: { fontSize: 11, ...font.bold, color: colors.textSecondary },

  // ── Date section header
  sectionDateHeader: {
    paddingHorizontal: 20, paddingTop: 12, paddingBottom: 4,
  },
  sectionDateText: {
    fontSize: 12, ...font.bold, color: colors.textSecondary,
    textTransform: 'uppercase', letterSpacing: 0.7,
  },

  // ── Bill row card
  billCard: {
    flexDirection: 'row', alignItems: 'center', gap: 12,
    paddingHorizontal: 14, paddingVertical: 14,
    borderRadius: 14, backgroundColor: SURFACE,
    borderWidth: 1, borderColor: colors.border,
    marginHorizontal: 16,
    boxShadow: '0 2px 10px rgba(44,51,61,0.03)',
  } as never,
  billIconWrap: {
    width: 42, height: 42, borderRadius: 12,
    justifyContent: 'center', alignItems: 'center', flexShrink: 0,
  },
  billInfo: { flex: 1 },
  billTitle: { fontSize: 15, ...font.semibold, color: colors.textPrimary },
  billMeta: { fontSize: 12, ...font.regular, color: colors.textSecondary, marginTop: 2 },
  settledBadge: {
    backgroundColor: colors.positive + '18',
    paddingHorizontal: 7, paddingVertical: 3,
    borderRadius: 6, marginRight: 4,
  },
  settledBadgeText: { fontSize: 10, ...font.semibold, color: colors.positive },
  billRight: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  billAmount: { fontSize: 16, ...font.bold, color: colors.textPrimary },

  // ── Empty state
  emptyWrap: { alignItems: 'center', paddingVertical: 48, gap: 10, paddingHorizontal: 24 },
  emptyIconWrap: {
    width: 72, height: 72, borderRadius: 36,
    backgroundColor: colors.surfaceSecondary,
    justifyContent: 'center', alignItems: 'center',
  },
  emptyTitle: { fontSize: 16, ...font.bold, color: colors.textPrimary },
  emptyText: {
    fontSize: 14, ...font.regular, color: colors.textSecondary,
    textAlign: 'center', lineHeight: 20,
  },
});
