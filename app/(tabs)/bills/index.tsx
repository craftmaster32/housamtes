import { useState, useCallback, useMemo, useEffect } from 'react';
import { withFeatureGuard } from '@components/shared/withFeatureGuard';
import {
  View,
  FlatList,
  ScrollView,
  StyleSheet,
  Pressable,
  TextInput,
  useWindowDimensions,
  Platform,
} from 'react-native';
import Animated, { FadeIn, FadeInDown } from 'react-native-reanimated';
import { Text } from 'react-native-paper';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useFocusEffect, useLocalSearchParams } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { Ionicons } from '@expo/vector-icons';
import {
  useBillsStore,
  calculateAllNetBalances,
  calculateSimplifiedBalancesForUser,
  settleDebts,
} from '@stores/billsStore';
import { useRecurringBillsStore, calculateFairness } from '@stores/recurringBillsStore';
import { useExpenseCategoriesStore } from '@stores/expenseCategoriesStore';
import { useAuthStore } from '@stores/authStore';
import { useHousematesStore } from '@stores/housematesStore';
import { localizeCategoryName } from '@utils/categoryName';
import { HouseholdTab } from '@components/bills/HouseholdTab';
import { useBadgeStore } from '@stores/badgeStore';
import { useThemedColors } from '@constants/colors';
import { BackLink } from '@components/shared/BackLink';
import { Mate } from '@components/shared/Mate';
import { MateCameo } from '@components/shared/MateCameo';
import { MateSpot } from '@components/shared/MateSpot';
import { useMateScene } from '@hooks/useMateScene';
import { EmptyState } from '@components/ui';
import { font } from '@constants/typography';
import { sizes } from '@constants/sizes';
import { useHeadingFont } from '@hooks/useHeadingFont';
import { useOneOffBillHistory, type BillRow } from '@hooks/useOneOffBillHistory';
import { BillTabs } from '@components/bills/BillTabs';
import { sentenceCase } from '@components/dashboard/cards/cardStyles';
import { BalancePaper } from '@components/bills/BalancePaper';
import { CategoryWords } from '@components/bills/CategoryWords';
import { ReceiptRoll } from '@components/bills/ReceiptRoll';
import { DayHeader, BillLine, RecurringPaymentLine } from '@components/bills/ExpenseLines';

import { mf, ms } from '@utils/responsive';
type BillFilter = 'recurring' | 'one-off';

// ── Main screen ───────────────────────────────────────────────────────────────
/**
 * Bills tab. Shows the balance/settle-up hero, a one-off vs recurring filter,
 * and — for one-off expenses — a search box, category chips, and the expense
 * history grouped into day sections.
 */
function BillsScreen(): React.JSX.Element {
  const c = useThemedColors();
  const { t } = useTranslation();
  const headingFont = useHeadingFont('semibold');
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
  const loadCategories = useExpenseCategoriesStore((s) => s.load);
  const categoriesIsLoading = useExpenseCategoriesStore((s) => s.isLoading);
  const categoriesError = useExpenseCategoriesStore((s) => s.error);

  // Load managed categories so presentCategories in useOneOffBillHistory
  // uses the configured order on the first visit to this screen.
  useEffect((): void => {
    if (houseId) loadCategories(houseId);
  }, [houseId, loadCategories]);
  const handleRetryCategories = useCallback((): void => {
    if (houseId) loadCategories(houseId);
  }, [houseId, loadCategories]);

  const [filter, setFilter] = useState<BillFilter>('one-off');
  // Search state lives here; category state is owned by the hook.
  const [search, setSearch] = useState('');
  const mateSpot = useMateScene(MATE_SPOTS);
  const { openRecurring } = useLocalSearchParams<{ openRecurring?: string }>();
  useEffect((): void => {
    if (openRecurring === '1') setFilter('recurring');
  }, [openRecurring]);
  const [showSettle, setShowSettle] = useState(false);
  // The balance card slides in once on first load. Toggling the one-off/recurring
  // filter swaps the whole list tree, which would otherwise remount the card and
  // replay that animation — read as a "jump". Gate it so it only plays once.
  const [entered, setEntered] = useState(false);
  useEffect((): void => {
    setEntered(true);
  }, []);

  const { category, setCategory, presentCategories, billSections } = useOneOffBillHistory(search);

  const householdBills = useRecurringBillsStore((s) => s.bills);
  const payments = useRecurringBillsStore((s) => s.payments);
  const housemates = useHousematesStore((s) => s.housemates);
  const memberIds = useMemo((): string[] => housemates.map((h) => h.id), [housemates]);

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
  // The hero's "all settled" state must reflect the current user's own position,
  // not the whole house: two housemates can still owe each other while I'm square.
  const iAmSettled = sharedBalances.length === 0;

  // Fewest-transfer settlement plan for the whole house — powers the "Settle up"
  // strip merged into the balance card.
  const settlements = settleDebts(new Map(combinedNet));
  const avatarById = useMemo(
    (): Map<string, string | undefined> => new Map(housemates.map((h) => [h.id, h.avatarUrl])),
    [housemates]
  );

  const handleClearSearch = useCallback((): void => {
    setSearch('');
  }, []);
  const handleToggleSettle = useCallback((): void => setShowSettle((v) => !v), []);

  // The whole history prints as one long receipt: each day is a piece of the
  // same slip, with the torn edges only at the very top and bottom.
  const sectionCount = billSections.length;
  const renderGroup = useCallback(
    ({
      item,
      index,
    }: {
      item: { title: string; data: BillRow[] };
      index: number;
    }): React.JSX.Element => (
      <ReceiptRoll
        top={index === 0}
        bottom={index === sectionCount - 1}
        style={styles.receiptPiece}
        contentStyle={index === sectionCount - 1 ? styles.receiptEnd : undefined}
      >
        <DayHeader title={item.title} />
        {item.data.map((row) =>
          row.kind === 'bill' ? (
            <BillLine key={row.key} bill={row.bill} />
          ) : (
            <RecurringPaymentLine key={row.key} row={row.payment} />
          )
        )}
      </ReceiptRoll>
    ),
    [sectionCount]
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
      <Text style={[styles.pageTitle, headingFont, { color: c.textPrimary }]} numberOfLines={1}>
        {t('bills.title')}
      </Text>
      <Text style={[styles.pageSubtitle, { color: c.textSecondary }]}>
        {t('bills.page_subtitle')}
      </Text>
      <View style={styles.tabs}>
        <BillTabs
          tabs={[
            { key: 'one-off', label: t('bills.one_off_expenses'), icon: 'receipt-outline' },
            { key: 'recurring', label: t('bills.recurring_bills'), icon: 'repeat-outline' },
          ]}
          selected={filter}
          onSelect={setFilter}
        />
      </View>
    </Animated.View>
  );

  const ListHeader = (
    <Animated.View
      entering={entered ? undefined : FadeInDown.duration(400)}
      style={[styles.listHeaderWrap, isWide && styles.listHeaderWrapWide]}
    >
      <BackLink label={t('common.home')} />
      {/* Before the paper so it covers his lower half: peeking over its top. */}
      {mateSpot === 'peekOver' && (
        <View style={styles.mateBehind}>
          <MateSpot kind="peekOver" size={ms(40)} style={styles.matePeek} />
        </View>
      )}
      <BalancePaper
        settled={iAmSettled}
        isOwed={isOwed}
        net={netBalance}
        peopleCount={sharedBalances.length}
        settlements={settlements}
        myId={myId}
        avatarById={avatarById}
        showSettle={showSettle}
        onToggleSettle={handleToggleSettle}
      />
      {/* After the paper: hanging on to its torn bottom edge. */}
      {mateSpot === 'cling' && (
        <View style={styles.mateAnchor}>
          <MateSpot kind="cling" size={ms(36)} style={styles.mateCling} />
        </View>
      )}

      {/* Recurring household bills */}
      {filter === 'recurring' && (
        <View style={styles.householdWrap}>
          <HouseholdTab />
        </View>
      )}

      {/* One-off: search + category words + list heading */}
      {filter === 'one-off' && bills.length + payments.length > 0 && (
        <View style={styles.oneOffControls}>
          <View style={[styles.searchBar, { borderColor: c.border }]}>
            <Ionicons name="search" size={18} color={c.textTertiary} />
            <TextInput
              style={[styles.searchInput, { color: c.textPrimary }]}
              value={search}
              onChangeText={setSearch}
              placeholder={t('bills.search_placeholder')}
              placeholderTextColor={c.textTertiary}
              returnKeyType="search"
              autoCorrect={false}
              accessibilityLabel={t('bills.search_placeholder')}
              accessibilityHint={t('bills.search_hint')}
            />
            {search.length > 0 && (
              <Pressable
                onPress={handleClearSearch}
                style={styles.clearSearchButton}
                accessibilityRole="button"
                accessibilityLabel={t('common.clear')}
              >
                <Ionicons name="close-circle" size={17} color={c.textSecondary} />
              </Pressable>
            )}
          </View>

          {categoriesError && !categoriesIsLoading ? (
            <EmptyState
              mode="error"
              title={categoriesError}
              actionLabel={t('bills.retry')}
              onAction={handleRetryCategories}
            />
          ) : presentCategories.length > 0 ? (
            <View style={styles.wordsBleed}>
              <CategoryWords
                items={['all', ...presentCategories].map((key) => ({
                  key,
                  label: key === 'all' ? t('bills.filter_all') : localizeCategoryName(key, t),
                }))}
                selected={category}
                onSelect={setCategory}
              />
            </View>
          ) : null}

          <Text
            style={[styles.listTitle, headingFont, { color: c.textPrimary }]}
            accessibilityRole="header"
          >
            {sentenceCase(t('bills.all_expenses'))}
          </Text>
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
      <FlatList
        style={styles.flex}
        data={billSections}
        keyExtractor={(section) => section.key}
        renderItem={renderGroup}
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.listContent}
        ListHeaderComponent={ListHeader}
        ListFooterComponent={
          mateSpot === 'footer' && billSections.length > 0 ? (
            <MateCameo page="bills" always />
          ) : null
        }
        ListEmptyComponent={
          bills.length + payments.length > 0 ? (
            <EmptyState
              icon="search-outline"
              title={t('bills.no_results')}
              message={t('bills.no_results_hint')}
            />
          ) : (
            // Mate keeps the empty page company — the one Mate on this screen.
            <View style={styles.empty}>
              <Mate size={ms(96)} />
              <Text style={[styles.emptyTitle, headingFont, { color: c.textPrimary }]}>
                {t('bills.no_expenses_yet')}
              </Text>
              <Text style={[styles.emptyText, { color: c.textSecondary }]}>
                {t('bills.no_expenses_hint')}
              </Text>
            </View>
          )
        }
      />
    </SafeAreaView>
  );
}

// ── Styles ────────────────────────────────────────────────────────────────────
// Where Mate may hide on a visit: peeking over the balance paper by the chart
// button, clinging to its torn edge, or at the end of the expenses.
const MATE_SPOTS = ['peekOver', 'cling', 'footer'] as const;

const styles = StyleSheet.create({
  mateAnchor: { height: 0, zIndex: 2 },
  mateBehind: { height: 0 },
  matePeek: { end: ms(36), top: -ms(28) },
  mateCling: { end: ms(26), top: -ms(16) },
  container: { flex: 1 },
  flex: { flex: 1 },
  centered: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: ms(20) },
  listContent: {
    paddingBottom: Platform.OS === 'web' ? sizes.bottomTabBarHeight : sizes.bottomTabContentPadding,
  },

  topBar: { paddingHorizontal: ms(20), paddingTop: ms(4) },
  topBarWide: { paddingHorizontal: ms(24) },
  listHeaderWrap: { paddingHorizontal: ms(20), paddingTop: ms(8), gap: ms(16) },
  listHeaderWrapWide: { paddingHorizontal: ms(24) },

  pageTitle: { fontSize: mf(36), lineHeight: mf(40), letterSpacing: -1 },
  pageSubtitle: { fontSize: mf(15), ...font.semibold, marginTop: ms(2) },
  tabs: { marginTop: ms(10) },

  householdWrap: { minHeight: ms(200) },

  // ── One-off search + category words
  oneOffControls: { gap: ms(8), marginTop: ms(10) },
  // A plain underlined line to write on, not a boxed field.
  searchBar: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: ms(9),
    minHeight: ms(48),
    borderBottomWidth: 1.5,
    paddingHorizontal: ms(2),
  },
  searchInput: {
    flex: 1,
    minWidth: 0,
    fontSize: mf(15.5),
    ...font.semibold,
    paddingVertical: 0,
    ...(Platform.OS === 'web' ? ({ outlineStyle: 'none' } as object) : null),
  },
  clearSearchButton: {
    minWidth: ms(44),
    minHeight: ms(44),
    alignItems: 'center',
    justifyContent: 'center',
  },
  wordsBleed: { marginHorizontal: ms(-14) },
  listTitle: { fontSize: mf(22), letterSpacing: -0.4, marginTop: ms(12), marginStart: ms(2) },

  // ── The receipt
  receiptPiece: { marginHorizontal: ms(20) },
  receiptEnd: { paddingBottom: ms(18) },

  // ── Empty state
  empty: { alignItems: 'center', paddingTop: ms(28), paddingHorizontal: ms(32), gap: ms(6) },
  emptyTitle: { fontSize: mf(22), letterSpacing: -0.4, marginTop: ms(10) },
  emptyText: { fontSize: mf(15), ...font.medium, textAlign: 'center', lineHeight: mf(21) },
});

export default withFeatureGuard('bills', BillsScreen);
