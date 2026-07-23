import { useState, useCallback, useMemo, useEffect } from 'react';
import {
  View,
  SectionList,
  ScrollView,
  StyleSheet,
  Pressable,
  useWindowDimensions,
  Platform,
} from 'react-native';
import Animated, { FadeIn, FadeInDown } from 'react-native-reanimated';
import { LinearGradient } from 'expo-linear-gradient';
import { AnimatedListItem } from '@components/shared/AnimatedListItem';
import { Image } from 'expo-image';
import { Text } from 'react-native-paper';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router, useFocusEffect, useLocalSearchParams } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { Ionicons } from '@expo/vector-icons';
import {
  useBillsStore,
  calculateAllNetBalances,
  calculateSimplifiedBalancesForUser,
  settleDebts,
  type Bill,
} from '@stores/billsStore';
import {
  useRecurringBillsStore,
  calculateFairness,
  resolveBillIcon,
} from '@stores/recurringBillsStore';
import { useAuthStore } from '@stores/authStore';
import { useHousematesStore } from '@stores/housematesStore';
import { useSettingsStore } from '@stores/settingsStore';
import { useMemberName } from '@hooks/useMemberName';
import { HouseholdTab } from '@components/bills/HouseholdTab';
import { useBadgeStore } from '@stores/badgeStore';
import { useThemedColors } from '@constants/colors';
import { formatFull } from '@constants/currencies';
import { Money } from '@components/shared/Money';
import { Pill } from '@components/ui';
import { EmptyState } from '@components/ui';
import { font } from '@constants/typography';
import { sizes } from '@constants/sizes';
import { useLanguageStore } from '@stores/languageStore';
import { isRTL } from '@lib/i18n';
import { useHeadingFont } from '@hooks/useHeadingFont';

type BillFilter = 'recurring' | 'one-off';

interface RecurringPaymentRow {
  id: string;
  title: string;
  icon: string;
  amount: number;
  paidBy: string; // user UUID the recurring bill is assigned to
  splitBetween: string[]; // user UUIDs sharing the cost
}

type BillRow =
  | { kind: 'bill'; key: string; date: string; bill: Bill }
  | { kind: 'payment'; key: string; date: string; payment: RecurringPaymentRow };

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
function formatDateLabel(dateStr: string, locale: string, t: (key: string) => string): string {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(dateStr)) return t('common.unknown');
  const appLocale = locale === 'he' ? 'he-IL' : locale === 'es' ? 'es-ES' : 'en-GB';
  const today = new Date();
  const pad = (n: number): string => String(n).padStart(2, '0');
  const todayStr = `${today.getFullYear()}-${pad(today.getMonth() + 1)}-${pad(today.getDate())}`;
  const yest = new Date(today);
  yest.setDate(yest.getDate() - 1);
  const yestStr = `${yest.getFullYear()}-${pad(yest.getMonth() + 1)}-${pad(yest.getDate())}`;
  if (dateStr === todayStr) return t('common.today');
  if (dateStr === yestStr) return t('common.yesterday');
  return new Date(`${dateStr}T12:00:00`).toLocaleDateString(appLocale, {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
  });
}

// ── Bill row card ─────────────────────────────────────────────────────────────
function BillCard({ bill }: { bill: Bill }): React.JSX.Element {
  const c = useThemedColors();
  const { t } = useTranslation();
  const language = useLanguageStore((s) => s.language);
  const rtl = isRTL(language);
  const currencyCode = useSettingsStore((s) => s.currencyCode);
  const memberName = useMemberName();
  const share = bill.amount / Math.max(bill.splitBetween.length, 1);
  const icon = getCategoryIcon(bill.category ?? '');
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
      <View
        style={[
          styles.billIconWrap,
          {
            backgroundColor: bill.settled ? c.surfaceSecondary : c.primary + '12',
          },
        ]}
      >
        <Ionicons name={icon} size={18} color={bill.settled ? c.textSecondary : c.primary} />
      </View>
      <View style={styles.billInfo}>
        <Text
          style={[styles.billTitle, { color: bill.settled ? c.textSecondary : c.textPrimary }]}
          numberOfLines={1}
        >
          {bill.title}
        </Text>
        <Text style={[styles.billMeta, { color: c.textSecondary }]} numberOfLines={1}>
          {t('bills.paid_by_each', {
            name: memberName(bill.paidBy),
            amount: formatFull(share, currencyCode),
          })}
        </Text>
      </View>
      <View style={styles.billRight}>
        {bill.settled && (
          <Pill tone="success" style={styles.settledBadge}>
            {t('bills.settled_badge')}
          </Pill>
        )}
        <Text
          style={[styles.billAmount, { color: bill.settled ? c.textSecondary : c.textPrimary }]}
        >
          {formatFull(bill.amount, currencyCode)}
        </Text>
        <Ionicons
          name={rtl ? 'chevron-back' : 'chevron-forward'}
          size={14}
          color={c.textSecondary}
        />
      </View>
    </Pressable>
  );
}

// ── Recurring payment row (shown in the one-off history) ────────────────────────
function RecurringPaymentCard({ row }: { row: RecurringPaymentRow }): React.JSX.Element {
  const c = useThemedColors();
  const { t } = useTranslation();
  const language = useLanguageStore((s) => s.language);
  const rtl = isRTL(language);
  const currencyCode = useSettingsStore((s) => s.currencyCode);
  const memberName = useMemberName();
  const share = row.amount / Math.max(row.splitBetween.length, 1);
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
      onPress={() => router.push('/(tabs)/bills?openRecurring=1')}
      accessibilityRole="button"
      accessibilityLabel={row.title}
    >
      <View style={[styles.billIconWrap, { backgroundColor: c.primary + '12' }]}>
        <Ionicons name={resolveBillIcon(row.icon)} size={20} color={c.primary} />
      </View>
      <View style={styles.billInfo}>
        <Text style={[styles.billTitle, { color: c.textPrimary }]} numberOfLines={1}>
          {row.title}
        </Text>
        <Text style={[styles.billMeta, { color: c.textSecondary }]} numberOfLines={1}>
          {t('bills.paid_by_each', {
            name: memberName(row.paidBy),
            amount: formatFull(share, currencyCode),
          })}
        </Text>
      </View>
      <View style={styles.billRight}>
        <Pill tone="brand" style={styles.settledBadge}>
          {t('bills.recurring_tag')}
        </Pill>
        <Text style={[styles.billAmount, { color: c.textPrimary }]}>
          {formatFull(row.amount, currencyCode)}
        </Text>
        <Ionicons
          name={rtl ? 'chevron-back' : 'chevron-forward'}
          size={14}
          color={c.textSecondary}
        />
      </View>
    </Pressable>
  );
}

// ── Settle avatar (small, on-gradient) ──────────────────────────────────────────
function SettleAvatar({
  name,
  uri,
  isYou,
}: {
  name: string;
  uri?: string;
  isYou: boolean;
}): React.JSX.Element {
  return (
    <View style={[styles.settleAv, isYou && styles.settleAvYou]}>
      {uri ? (
        <Image source={{ uri }} style={styles.settleAvImg} contentFit="cover" />
      ) : (
        <Text style={styles.settleAvText}>{name[0]?.toUpperCase() ?? '?'}</Text>
      )}
    </View>
  );
}

// ── Main screen ───────────────────────────────────────────────────────────────
export default function BillsScreen(): React.JSX.Element {
  const c = useThemedColors();
  const { t, i18n } = useTranslation();
  const headingFont = useHeadingFont();
  const { width } = useWindowDimensions();
  const isWide = width >= 680;

  const markSeen = useBadgeStore((s) => s.markSeen);
  useFocusEffect(
    useCallback(() => {
      markSeen('bills').catch(() => {});
    }, [markSeen])
  );

  const bills = useBillsStore((s) => s.bills);
  const isLoading = useBillsStore((s) => s.isLoading);
  const error = useBillsStore((s) => s.error);
  const loadBills = useBillsStore((s) => s.load);
  const profile = useAuthStore((s) => s.profile);
  const houseId = useAuthStore((s) => s.houseId) ?? '';
  const currencyCode = useSettingsStore((s) => s.currencyCode);

  const [filter, setFilter] = useState<BillFilter>('one-off');
  const { openRecurring } = useLocalSearchParams<{ openRecurring?: string }>();
  useEffect(() => {
    if (openRecurring === '1') setFilter('recurring');
  }, [openRecurring]);
  const [showSettle, setShowSettle] = useState(false);

  const householdBills = useRecurringBillsStore((s) => s.bills);
  const payments = useRecurringBillsStore((s) => s.payments);
  const housemates = useHousematesStore((s) => s.housemates);
  const memberIds = useMemo(() => housemates.map((h) => h.id), [housemates]);

  const myId = profile?.id ?? '';
  const activeBills = bills.filter((b) => !b.settled);

  const combinedNet = new Map<string, number>(calculateAllNetBalances(activeBills));
  for (const { person, balance } of calculateFairness(householdBills, payments, memberIds)) {
    combinedNet.set(person, (combinedNet.get(person) ?? 0) + balance);
  }
  const sharedBalances = calculateSimplifiedBalancesForUser(combinedNet, myId);

  const totalOwed = sharedBalances.filter((b) => b.amount > 0).reduce((s, b) => s + b.amount, 0);
  const totalOwe = sharedBalances
    .filter((b) => b.amount < 0)
    .reduce((s, b) => s + Math.abs(b.amount), 0);
  const netBalance = totalOwed - totalOwe;
  const isOwed = netBalance >= 0;

  // Fewest-transfer settlement plan for the whole house — powers the "Settle up"
  // strip merged into the balance card.
  const settlements = settleDebts(new Map(combinedNet));
  const memberName = useMemberName();
  const billsRtl = isRTL(i18n.language as never);
  const avatarById = useMemo(
    () => new Map(housemates.map((h) => [h.id, h.avatarUrl])),
    [housemates]
  );

  const billSections = useMemo(() => {
    // Merge one-off bills and logged recurring payments into one date-grouped history.
    const billMeta = new Map(
      householdBills.map((b) => [b.id, { name: b.name, icon: b.icon, assignedTo: b.assignedTo }])
    );
    const rows: BillRow[] = [
      ...bills.map((bill) => ({ kind: 'bill' as const, key: bill.id, date: bill.date, bill })),
      ...payments.map((p) => {
        const meta = billMeta.get(p.billId);
        return {
          kind: 'payment' as const,
          key: `recurring:${p.id}`,
          date: p.paidAt,
          payment: {
            id: p.id,
            title: meta?.name ?? '',
            icon: meta?.icon ?? 'receipt-outline',
            amount: p.amount,
            paidBy: meta?.assignedTo ?? '',
            splitBetween: p.splitBetween && p.splitBetween.length > 0 ? p.splitBetween : memberIds,
          },
        };
      }),
    ].sort((a, b) => (b.date ?? '').localeCompare(a.date ?? ''));

    const groups: Record<string, BillRow[]> = {};
    for (const row of rows) {
      const key = row.date || 'Unknown';
      if (!groups[key]) groups[key] = [];
      groups[key].push(row);
    }
    return Object.entries(groups).map(([date, data]) => ({
      title: formatDateLabel(date, i18n.language, t),
      data,
    }));
  }, [bills, payments, householdBills, memberIds, i18n.language, t]);

  const renderBill = useCallback(
    ({ item, index }: { item: BillRow; index: number }): React.JSX.Element => (
      <AnimatedListItem index={index}>
        {item.kind === 'bill' ? (
          <BillCard bill={item.bill} />
        ) : (
          <RecurringPaymentCard row={item.payment} />
        )}
      </AnimatedListItem>
    ),
    []
  );

  if (isLoading) {
    return (
      <SafeAreaView style={[styles.container, { backgroundColor: c.background }]} edges={['top']}>
        <View style={styles.centered}>
          <EmptyState mode="loading" title={t('bills.loading_bills')} />
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

  // Sticky top bar — always visible above the scroll area
  const topBar = (
    <Animated.View
      entering={FadeIn.duration(350)}
      style={[styles.topBar, isWide && styles.topBarWide]}
    >
      <View style={styles.pageHeader}>
        <View>
          <Text style={[styles.pageTitle, headingFont, { color: c.textPrimary }]}>
            {t('bills.title')}
          </Text>
          <Text style={[styles.pageSubtitle, { color: c.textSecondary }]}>
            {t('bills.page_subtitle')}
          </Text>
        </View>
        <Pressable
          style={({ pressed }) => [
            styles.addBtn,
            {
              backgroundColor: c.primary,
              transform: [{ scale: pressed ? 0.96 : 1 }],
              opacity: pressed ? 0.88 : 1,
            },
          ]}
          onPress={() => router.push('/(tabs)/bills/add')}
          accessibilityRole="button"
          accessibilityLabel={t('bills.add_new_expense')}
        >
          <Ionicons name="add" size={18} color="#fff" />
          <Text style={styles.addBtnText}>{t('bills.add_expense')}</Text>
        </Pressable>
      </View>

      <View
        style={[styles.filterRow, { backgroundColor: c.surfaceSecondary, borderColor: c.border }]}
      >
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
          <Ionicons
            name="receipt-outline"
            size={14}
            color={filter === 'one-off' ? '#fff' : c.textSecondary}
          />
          <Text
            style={[
              styles.filterTabText,
              { color: filter === 'one-off' ? '#fff' : c.textSecondary },
              filter === 'one-off' && styles.filterTabTextActive,
            ]}
          >
            {t('bills.one_off_expenses')}
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
          <Ionicons
            name="repeat-outline"
            size={14}
            color={filter === 'recurring' ? '#fff' : c.textSecondary}
          />
          <Text
            style={[
              styles.filterTabText,
              { color: filter === 'recurring' ? '#fff' : c.textSecondary },
              filter === 'recurring' && styles.filterTabTextActive,
            ]}
          >
            {t('bills.recurring_bills')}
          </Text>
        </Pressable>
      </View>
    </Animated.View>
  );

  const ListHeader = (
    <Animated.View
      entering={FadeInDown.duration(400)}
      style={[styles.listHeaderWrap, isWide && styles.listHeaderWrapWide]}
    >
      {/* ── Balance + settle (one merged card) ───────────────────── */}
      <LinearGradient
        colors={isOwed ? c.owedGradient : c.dangerGradient}
        start={{ x: 0.15, y: 0 }}
        end={{ x: 0.85, y: 1 }}
        style={[styles.balanceCard, { shadowColor: isOwed ? c.owedShadow : c.dangerGradient[1] }]}
      >
        <View style={styles.balanceHighlight} />

        <View style={styles.balanceTop}>
          <View style={styles.flexShrink}>
            <Text style={[styles.balanceLabel, styles.balanceOnHero]}>
              {settlements.length === 0
                ? t('bills.all_settled_tag')
                : isOwed
                  ? t('bills.you_are_owed')
                  : t('bills.you_owe')}
            </Text>
            {settlements.length === 0 ? (
              <Text style={styles.balanceSettledSub}>{t('bills.everyone_settled')}</Text>
            ) : (
              <>
                <Money
                  amount={Math.abs(netBalance)}
                  currencyCode={currencyCode}
                  size={40}
                  color="#fff"
                  mutedColor="rgba(255,255,255,0.72)"
                  style={styles.balanceBigAmt}
                />
                <Text style={styles.balanceSub}>
                  {sharedBalances.length === 1
                    ? t('dashboard.balance_across', { count: sharedBalances.length })
                    : t('dashboard.balance_across_plural', { count: sharedBalances.length })}
                </Text>
              </>
            )}
          </View>
          {settlements.length === 0 ? (
            <View style={styles.balanceCheck}>
              <Ionicons name="checkmark" size={24} color="#fff" />
            </View>
          ) : (
            <Pressable
              style={({ pressed }) => [styles.balanceAnalysis, pressed && { opacity: 0.85 }]}
              onPress={() => router.push('/(tabs)/profile/spending')}
              accessibilityRole="button"
              accessibilityLabel={t('spending.view_spending')}
            >
              <Ionicons name="stats-chart-outline" size={20} color="#fff" />
            </Pressable>
          )}
        </View>

        {settlements.length > 0 && (
          <Pressable
            style={({ pressed }) => [styles.settleStrip, pressed && { opacity: 0.85 }]}
            onPress={() => setShowSettle((v) => !v)}
            accessibilityRole="button"
            accessibilityLabel={t('bills.toggle_settle')}
            accessibilityState={{ expanded: showSettle }}
          >
            <View style={styles.settleStripIcon}>
              <Ionicons name="swap-horizontal" size={16} color="#fff" />
            </View>
            <View style={styles.flexShrink}>
              <Text style={styles.settleStripTitle}>{t('bills.settle_up')}</Text>
              <Text style={styles.settleStripSub}>
                {showSettle
                  ? t('bills.min_transfers')
                  : settlements.length === 1
                    ? t('bills.n_transfers', { count: settlements.length })
                    : t('bills.n_transfers_plural', { count: settlements.length })}
              </Text>
            </View>
            <Ionicons name={showSettle ? 'chevron-up' : 'chevron-down'} size={18} color="#fff" />
          </Pressable>
        )}

        {settlements.length > 0 && showSettle && (
          <View style={styles.settleList}>
            {settlements.map((s, idx) => {
              const fromName = memberName(s.from).split(' ')[0];
              const toName = memberName(s.to).split(' ')[0];
              const amtColor =
                s.to === myId ? '#8FE0AC' : s.from === myId ? '#FF8478' : 'rgba(255,255,255,0.92)';
              return (
                <View key={idx} style={styles.settleXfer}>
                  <SettleAvatar
                    name={fromName}
                    uri={avatarById.get(s.from)}
                    isYou={s.from === myId}
                  />
                  <Text style={styles.settleXferName} numberOfLines={1}>
                    {s.from === myId ? t('bills.you_label') : fromName}
                  </Text>
                  <Ionicons
                    name={billsRtl ? 'arrow-back' : 'arrow-forward'}
                    size={14}
                    color="rgba(255,255,255,0.55)"
                    style={styles.settleXferArrow}
                  />
                  <SettleAvatar name={toName} uri={avatarById.get(s.to)} isYou={s.to === myId} />
                  <Text style={styles.settleXferName} numberOfLines={1}>
                    {s.to === myId ? t('bills.you_label') : toName}
                  </Text>
                  <Text style={[styles.settleXferAmt, { color: amtColor }]}>
                    {formatFull(s.amount, currencyCode)}
                  </Text>
                </View>
              );
            })}
          </View>
        )}
      </LinearGradient>

      {/* Recurring household bills */}
      {filter === 'recurring' && (
        <View style={styles.householdWrap}>
          <HouseholdTab />
        </View>
      )}

      {/* One-off list eyebrow */}
      {filter === 'one-off' && bills.length + payments.length > 0 && (
        <View style={styles.listCountRow}>
          <Text style={[styles.eyebrow, { color: c.textSecondary }]}>
            {t('bills.all_expenses')}
          </Text>
          <View
            style={[
              styles.countPill,
              { backgroundColor: c.surfaceSecondary, borderColor: c.border },
            ]}
          >
            <Text style={[styles.countPillText, { color: c.textSecondary }]}>
              {bills.length + payments.length}
            </Text>
          </View>
        </View>
      )}
    </Animated.View>
  );

  if (filter === 'recurring') {
    return (
      <SafeAreaView style={[styles.container, { backgroundColor: c.background }]} edges={['top']}>
        {topBar}
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
      {topBar}
      <SectionList<BillRow>
        style={styles.flex}
        sections={billSections}
        keyExtractor={(item) => item.key}
        renderItem={renderBill}
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.listContent}
        stickySectionHeadersEnabled={false}
        ListHeaderComponent={ListHeader}
        renderSectionHeader={({ section }) => (
          <View style={styles.sectionDateHeader}>
            <Text style={[styles.sectionDateText, { color: c.textSecondary }]}>
              {section.title}
            </Text>
          </View>
        )}
        ItemSeparatorComponent={() => <View style={{ height: 8 }} />}
        SectionSeparatorComponent={() => <View style={{ height: 4 }} />}
        ListEmptyComponent={
          <EmptyState
            icon="receipt-outline"
            title={t('bills.no_expenses_yet')}
            message={t('bills.no_expenses_hint')}
          />
        }
      />
    </SafeAreaView>
  );
}

// ── Styles ────────────────────────────────────────────────────────────────────
const styles = StyleSheet.create({
  container: { flex: 1 },
  flex: { flex: 1 },
  centered: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 20 },
  listContent: {
    paddingBottom: Platform.OS === 'web' ? sizes.bottomTabBarHeight : sizes.bottomTabContentPadding,
  },

  topBar: { paddingHorizontal: 16, paddingTop: 4, paddingBottom: 4, gap: 12 },
  topBarWide: { paddingHorizontal: 24 },
  listHeaderWrap: { paddingHorizontal: 16, paddingTop: 12, gap: 14 },
  listHeaderWrapWide: { paddingHorizontal: 24 },

  // ── Page header
  pageHeader: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
  },
  pageTitle: { fontSize: 28, ...font.extrabold, letterSpacing: -0.8 },
  pageSubtitle: { fontSize: 13, ...font.regular, marginTop: 2 },
  addBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingVertical: 11,
    paddingHorizontal: 16,
    borderRadius: 12,
    shadowColor: '#4F78B6',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.25,
    shadowRadius: 8,
    elevation: 6,
  },
  addBtnText: { fontSize: 14, ...font.semibold, color: '#fff' },

  // ── Balance + settle (merged card)
  balanceCard: {
    borderRadius: 20,
    padding: 20,
    overflow: 'hidden',
    shadowOffset: { width: 0, height: 14 },
    shadowOpacity: 1,
    shadowRadius: 26,
    elevation: 9,
  },
  balanceHighlight: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    height: 1,
    backgroundColor: 'rgba(255,255,255,0.18)',
  },
  balanceOnHero: { color: 'rgba(255,255,255,0.85)' },
  balanceTop: { flexDirection: 'row', alignItems: 'flex-start', gap: 12 },
  flexShrink: { flex: 1, minWidth: 0 },
  balanceLabel: { fontSize: 12.5, ...font.semibold },
  // Isolate money to LTR so digits/symbol don't bidi-reorder under Hebrew/RTL.
  balanceBigAmt: { marginTop: 6, writingDirection: 'ltr' },
  balanceSub: { fontSize: 11.5, ...font.medium, color: 'rgba(255,255,255,0.78)', marginTop: 6 },
  balanceSettledSub: { fontSize: 13, ...font.medium, color: 'rgba(255,255,255,0.8)', marginTop: 4 },
  balanceAnalysis: {
    width: 46,
    height: 46,
    borderRadius: 15,
    backgroundColor: 'rgba(255,255,255,0.15)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.16)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  balanceCheck: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: 'rgba(255,255,255,0.16)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  // Settle strip attached under the amount, on the gradient.
  settleStrip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 11,
    marginTop: 16,
    marginHorizontal: -20,
    marginBottom: -20,
    paddingHorizontal: 20,
    paddingVertical: 13,
    backgroundColor: 'rgba(255,255,255,0.12)',
    borderTopWidth: 1,
    borderTopColor: 'rgba(255,255,255,0.16)',
  },
  settleStripIcon: {
    width: 30,
    height: 30,
    borderRadius: 10,
    backgroundColor: 'rgba(255,255,255,0.18)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  settleStripTitle: { fontSize: 14, ...font.bold, color: '#fff' },
  settleStripSub: { fontSize: 11.5, ...font.medium, color: 'rgba(255,255,255,0.75)', marginTop: 1 },
  settleList: {
    marginHorizontal: -20,
    marginBottom: -20,
    backgroundColor: 'rgba(255,255,255,0.12)',
  },
  settleXfer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 20,
    paddingVertical: 11,
    borderTopWidth: 1,
    borderTopColor: 'rgba(255,255,255,0.1)',
  },
  settleXferName: { fontSize: 13, ...font.bold, color: '#fff', maxWidth: 74 },
  settleXferArrow: { marginHorizontal: 1 },
  settleXferAmt: {
    marginStart: 'auto' as never,
    fontSize: 14,
    ...font.extrabold,
    writingDirection: 'ltr',
  },
  settleAv: {
    width: 26,
    height: 26,
    borderRadius: 13,
    backgroundColor: 'rgba(255,255,255,0.2)',
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  settleAvYou: { backgroundColor: 'rgba(255,255,255,0.32)' },
  settleAvImg: { width: 26, height: 26 },
  settleAvText: { fontSize: 11, ...font.bold, color: '#fff' },

  // ── Filter tabs
  filterRow: {
    flexDirection: 'row',
    gap: 8,
    borderRadius: 14,
    padding: 4,
    borderWidth: 1,
  },
  filterTab: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 10,
    borderRadius: 11,
    minHeight: 44,
  },
  filterTabText: { fontSize: 13, ...font.semibold },
  filterTabTextActive: { color: '#fff' },
  filterBadge: {
    backgroundColor: 'rgba(255,255,255,0.3)',
    borderRadius: 8,
    paddingHorizontal: 6,
    paddingVertical: 1,
  },
  filterBadgeText: { fontSize: 11, ...font.bold, color: '#fff' },

  householdWrap: { minHeight: 200 },

  // ── One-off list header
  listCountRow: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingHorizontal: 4 },
  eyebrow: { fontSize: 11, ...font.bold, letterSpacing: 0.8, textTransform: 'uppercase' },
  countPill: {
    minHeight: 20,
    paddingHorizontal: 8,
    borderRadius: 9999,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
  },
  countPillText: { fontSize: 11, ...font.bold },

  // ── Date section header
  sectionDateHeader: { paddingHorizontal: 20, paddingTop: 12, paddingBottom: 4 },
  sectionDateText: { fontSize: 12, ...font.bold, textTransform: 'uppercase', letterSpacing: 0.7 },

  // ── Bill row card
  billCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingHorizontal: 14,
    paddingVertical: 14,
    borderRadius: 14,
    borderWidth: 1,
    marginHorizontal: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.04,
    shadowRadius: 4,
    elevation: 1,
  },
  billIconWrap: {
    width: 42,
    height: 42,
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
    flexShrink: 0,
  },
  billInfo: { flex: 1 },
  billTitle: { fontSize: 15, ...font.semibold },
  billMeta: { fontSize: 12, ...font.regular, marginTop: 2 },
  settledBadge: { paddingHorizontal: 7, paddingVertical: 3, borderRadius: 6, marginEnd: 4 },
  settledBadgeText: { fontSize: 10, ...font.semibold },
  billRight: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  billAmount: { fontSize: 16, ...font.bold },

  // ── Empty state
  emptyWrap: { alignItems: 'center', paddingVertical: 48, gap: 10, paddingHorizontal: 24 },
  emptyIconWrap: {
    width: 72,
    height: 72,
    borderRadius: 36,
    justifyContent: 'center',
    alignItems: 'center',
  },
  emptyTitle: { fontSize: 16, ...font.bold },
  emptyText: { fontSize: 14, ...font.regular, textAlign: 'center', lineHeight: 20 },
});
