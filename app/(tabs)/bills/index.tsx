import { useState, useCallback } from 'react';
import { View, FlatList, StyleSheet, Pressable } from 'react-native';
import { Text, FAB } from 'react-native-paper';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { useBillsStore, calculateBalances, type Bill } from '@stores/billsStore';

import { useAuthStore } from '@stores/authStore';
import { HouseholdTab } from '@components/bills/HouseholdTab';
import { SettlementPanel } from '@components/bills/SettlementPanel';
import { colors } from '@constants/colors';
import { sizes } from '@constants/sizes';
import { font } from '@constants/typography';

type TabId = 'household' | 'shared';

function BalanceCard({ person, amount }: { person: string; amount: number }): React.JSX.Element {
  const { t } = useTranslation();
  const isPositive = amount > 0;
  return (
    <View style={[styles.balanceCard, { borderLeftColor: isPositive ? colors.positive : colors.negative }]}>
      <Text style={styles.balanceName}>{person}</Text>
      <Text style={[styles.balanceAmount, { color: isPositive ? colors.positive : colors.negative }]}>
        {isPositive
          ? t('bills.owes_you', { amount: amount.toFixed(2) })
          : t('bills.you_owe_person', { amount: Math.abs(amount).toFixed(2) })}
      </Text>
    </View>
  );
}

function BillCard({ bill }: { bill: Bill }): React.JSX.Element {
  const { t } = useTranslation();
  const share = bill.amount / bill.splitBetween.length;
  return (
    <Pressable style={styles.billCard} onPress={() => router.push(`/(tabs)/bills/${bill.id}`)}>
      <View style={styles.billRow}>
        <View style={styles.billInfo}>
          <View style={styles.billTitleRow}>
            <Text style={styles.billTitle}>{bill.title}</Text>
            {bill.settled && <Text style={styles.settledBadge}>{t('bills.settled')}</Text>}
          </View>
          <Text style={styles.billMeta}>
            {t('bills.paid_by')} {bill.paidBy} · {bill.category} · {new Date(bill.date).toLocaleDateString()}
          </Text>
          <Text style={styles.billSplit}>
            {t('bills.split')} {bill.splitBetween.length} {t('bills.ways', { amount: share.toFixed(2) })} {t('common.each')}
          </Text>
        </View>
        <View style={styles.billRight}>
          <Text style={[styles.billAmount, bill.settled && styles.billAmountSettled]}>₪{bill.amount.toFixed(2)}</Text>
          <Text style={styles.chevron}>›</Text>
        </View>
      </View>
    </Pressable>
  );
}

function SharedTab(): React.JSX.Element {
  const { t } = useTranslation();
  const bills = useBillsStore((state) => state.bills);
  const profile = useAuthStore((state) => state.profile);
  const activeBills = bills.filter((b) => !b.settled);
  const balances = calculateBalances(activeBills, profile?.name ?? '');
  const totalOwed = balances.filter((b) => b.amount > 0).reduce((s, b) => s + b.amount, 0);
  const totalOwe = balances.filter((b) => b.amount < 0).reduce((s, b) => s + Math.abs(b.amount), 0);
  const renderBill = useCallback(
    ({ item }: { item: Bill }) => <BillCard bill={item} />,
    []
  );

  return (
    <>
      <FlatList
        data={bills}
        keyExtractor={(item) => item.id}
        renderItem={renderBill}
        ListHeaderComponent={
          <View>
            <View style={styles.summaryRow}>
              <View style={[styles.summaryCard, { backgroundColor: colors.positive + '20' }]}>
                <Text style={styles.summaryLabel}>{t('bills.you_are_owed')}</Text>
                <Text style={[styles.summaryAmount, { color: colors.positive }]}>₪{totalOwed.toFixed(2)}</Text>
              </View>
              <View style={[styles.summaryCard, { backgroundColor: colors.negative + '20' }]}>
                <Text style={styles.summaryLabel}>{t('bills.you_owe')}</Text>
                <Text style={[styles.summaryAmount, { color: colors.negative }]}>₪{totalOwe.toFixed(2)}</Text>
              </View>
            </View>
            {balances.length > 0 && (
              <View style={styles.balancesSection}>
                {balances.map((b) => <BalanceCard key={b.person} person={b.person} amount={b.amount} />)}
              </View>
            )}
            {bills.length > 0 && <Text style={styles.sectionTitle}>{t('bills.all_shared')}</Text>}
          </View>
        }
        ListEmptyComponent={
          <View style={styles.emptySection}>
            <Text style={styles.emptyTitle}>{t('bills.no_shared')}</Text>
            <Text style={styles.emptyText}>{t('bills.no_shared_hint')}</Text>
          </View>
        }
        contentContainerStyle={styles.sharedList}
      />
      <FAB
        icon="plus"
        style={styles.fab}
        onPress={() => router.push('/(tabs)/bills/add')}
        accessibilityLabel={t('bills.add_title')}
      />
    </>
  );
}

export default function BillsScreen(): React.JSX.Element {
  const { t } = useTranslation();
  const isLoading = useBillsStore((state) => state.isLoading);
  const [activeTab, setActiveTab] = useState<TabId>('household');

  if (isLoading) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.centered}><Text style={styles.emptyText}>{t('common.loading')}</Text></View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      {/* Page header */}
      <View style={styles.pageHeader}>
        <Text style={styles.heading}>{t('bills.title')}</Text>
      </View>

      {/* Settlement panel */}
      <SettlementPanel />

      {/* Tab strip */}
      <View style={styles.tabStrip}>
        <Pressable
          style={[styles.tab, activeTab === 'household' && styles.tabActive]}
          onPress={() => setActiveTab('household')}
        >
          <Text style={[styles.tabText, activeTab === 'household' && styles.tabTextActive]}>
            {t('bills.tab_household')}
          </Text>
        </Pressable>
        <Pressable
          style={[styles.tab, activeTab === 'shared' && styles.tabActive]}
          onPress={() => setActiveTab('shared')}
        >
          <Text style={[styles.tabText, activeTab === 'shared' && styles.tabTextActive]}>
            {t('bills.tab_shared')}
          </Text>
        </Pressable>
      </View>

      {/* Tab content */}
      <View style={styles.tabContent}>
        {activeTab === 'household' ? <HouseholdTab /> : <SharedTab />}
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  pageHeader: { paddingHorizontal: sizes.lg, paddingTop: sizes.md, paddingBottom: sizes.sm },
  heading: { fontSize: 26, ...font.extrabold, letterSpacing: -0.5, color: colors.textPrimary },

  // Tab strip
  tabStrip: {
    flexDirection: 'row',
    backgroundColor: colors.white,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
    paddingHorizontal: sizes.lg,
  },
  tab: {
    paddingVertical: sizes.sm,
    paddingHorizontal: sizes.md,
    borderBottomWidth: 2,
    borderBottomColor: 'transparent',
    marginBottom: -1,
  },
  tabActive: { borderBottomColor: colors.primary },
  tabText: { fontSize: 15, ...font.semibold, color: colors.textSecondary },
  tabTextActive: { color: colors.primary },
  tabContent: { flex: 1 },

  // Shared tab
  sharedList: { padding: sizes.lg, paddingBottom: 100 },
  summaryRow: { flexDirection: 'row', gap: sizes.sm, marginBottom: sizes.md },
  summaryCard: { flex: 1, padding: sizes.md, borderRadius: 16, alignItems: 'center', boxShadow: '0 2px 8px rgba(0,0,0,0.05)' } as never,
  summaryLabel: { color: colors.textSecondary, fontSize: 12, ...font.semibold, textTransform: 'uppercase', letterSpacing: 0.8 },
  summaryAmount: { fontSize: sizes.fontXl, ...font.bold, marginTop: 2 },
  balancesSection: { gap: sizes.sm, marginBottom: sizes.md },
  balanceCard: {
    backgroundColor: colors.white,
    borderRadius: 16,
    padding: sizes.md,
    borderLeftWidth: 4,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    boxShadow: '0 2px 8px rgba(0,0,0,0.05)',
  } as never,
  balanceName: { color: colors.textPrimary, ...font.semibold, fontSize: 15 },
  balanceAmount: { fontSize: 15, ...font.semibold },
  sectionTitle: { color: colors.textPrimary, ...font.bold, fontSize: 17, marginBottom: sizes.sm },
  billCard: {
    backgroundColor: colors.white,
    borderRadius: 16,
    padding: sizes.md,
    marginBottom: sizes.sm,
    boxShadow: '0 2px 8px rgba(0,0,0,0.05)',
  } as never,
  billRow: { flexDirection: 'row', justifyContent: 'space-between' },
  billInfo: { flex: 1 },
  billTitle: { color: colors.textPrimary, ...font.semibold, fontSize: 15 },
  billMeta: { color: colors.textSecondary, fontSize: 15, ...font.regular, marginTop: 2 },
  billSplit: { color: colors.textSecondary, fontSize: 15, ...font.regular, marginTop: 2 },
  billRight: { alignItems: 'flex-end', gap: sizes.xs },
  billAmount: { color: colors.textPrimary, ...font.bold, fontSize: sizes.fontLg },
  billTitleRow: { flexDirection: 'row', alignItems: 'center', gap: sizes.xs, flexWrap: 'wrap' },
  settledBadge: {
    fontSize: 11,
    ...font.semibold,
    color: colors.positive,
    backgroundColor: colors.positive + '20',
    paddingHorizontal: 6,
    paddingVertical: 1,
    borderRadius: 6,
  },
  billAmountSettled: { color: colors.textSecondary },
  chevron: { color: colors.textSecondary, fontSize: 20, ...font.regular },
  fab: { position: 'absolute', right: sizes.lg, bottom: sizes.lg, backgroundColor: colors.primary },

  // Empty / setup
  centered: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: sizes.lg },
  emptySection: { alignItems: 'center', paddingVertical: sizes.xxl },
  emptyTitle: { color: colors.textPrimary, ...font.bold, fontSize: 15, marginBottom: sizes.sm },
  emptyText: { color: colors.textSecondary, ...font.regular, fontSize: 15, textAlign: 'center', marginBottom: sizes.lg },
  setupBtn: {
    backgroundColor: colors.primary,
    height: 52,
    paddingHorizontal: sizes.lg,
    borderRadius: 14,
    justifyContent: 'center',
    alignItems: 'center',
    borderCurve: 'continuous',
  } as never,
  setupBtnText: { color: colors.white, ...font.semibold, fontSize: 15 },
});
