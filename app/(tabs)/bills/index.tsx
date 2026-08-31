import { useState, useCallback, useMemo, useEffect, useRef, memo } from 'react';
import {
  View,
  FlatList,
  ScrollView,
  StyleSheet,
  Pressable,
  TextInput,
  useWindowDimensions,
  Platform,
  Animated as RNAnimated,
} from 'react-native';
import Animated, { FadeIn, FadeInDown } from 'react-native-reanimated';
import Swipeable from 'react-native-gesture-handler/Swipeable';
import * as Haptics from 'expo-haptics';
import { LinearGradient } from 'expo-linear-gradient';
import { Image } from 'expo-image';
import { Text } from 'react-native-paper';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router, useFocusEffect, useLocalSearchParams } from 'expo-router';
import { navigateToBase } from '@stores/navigationStore';
import { useTranslation } from 'react-i18next';
import { Ionicons } from '@expo/vector-icons';
import { Alert } from '@lib/alert';
import {
  useBillsStore,
  calculateAllNetBalances,
  calculateSimplifiedBalancesForUser,
  settleDebts,
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
import { useThemedColors, darkColors } from '@constants/colors';
import { formatFull } from '@constants/currencies';
import { Money } from '@components/shared/Money';
import { BackLink } from '@components/shared/BackLink';
import { Pill } from '@components/ui';
import { EmptyState } from '@components/ui';
import { font } from '@constants/typography';
import { sizes } from '@constants/sizes';
import { isRTL } from '@lib/i18n';
import { useHeadingFont } from '@hooks/useHeadingFont';
import {
  useOneOffBillHistory,
  type BillRow,
  type RecurringPaymentRow,
} from '@hooks/useOneOffBillHistory';

import { mf, ms } from '@utils/responsive';
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
/** Ionicon name for a category, falling back to a generic receipt icon. */
function getCategoryIcon(category: string): React.ComponentProps<typeof Ionicons>['name'] {
  return CATEGORY_ICONS[(category ?? '').toLowerCase()] ?? CATEGORY_ICONS.default;
}

// Each category gets its own colour so the list reads with variety and life,
// rather than a wall of identical tiles.
const CATEGORY_COLORS: Record<string, string> = {
  food: '#F59E0B',
  groceries: '#22C55E',
  transport: '#3B82F6',
  utilities: '#EAB308',
  rent: '#14B8A6',
  entertainment: '#EF4444',
  health: '#F43F5E',
  travel: '#0EA5E9',
  shopping: '#8B5CF6',
  internet: '#06B6D4',
  phone: '#6366F1',
};
/** Accent colour for a category's icon tile; returns `fallback` when unmapped. */
function getCategoryColor(category: string, fallback: string): string {
  return CATEGORY_COLORS[(category ?? '').toLowerCase()] ?? fallback;
}

// Width of the swipe-to-delete panel, kept in sync between the reveal animation
// and its style so the red panel slides in flush with the row edge.
const SWIPE_DELETE_WIDTH = ms(84);

// ── Bill row card ─────────────────────────────────────────────────────────────
/** A single one-off expense row: category-coloured tile, title, "category · payer", and total. */
function BillCard({
  bill,
}: {
  bill: Extract<BillRow, { kind: 'bill' }>['bill'];
}): React.JSX.Element {
  const c = useThemedColors();
  const { t } = useTranslation();
  const currencyCode = useSettingsStore((s) => s.currencyCode);
  const memberName = useMemberName();
  const role = useAuthStore((s) => s.role);
  const houseId = useAuthStore((s) => s.houseId) ?? '';
  const deleteBill = useBillsStore((s) => s.deleteBill);
  // Same rule as the detail screen's delete button: only owners/admins can
  // remove a bill, and settled bills stay locked as permanent history. A valid
  // house context is required too, so deletion never fires without one.
  const canDelete = (role === 'owner' || role === 'admin') && !bill.settled && !!houseId;
  const isDark = c === darkColors;
  const icon = getCategoryIcon(bill.category ?? '');
  const catColor = bill.settled
    ? c.textSecondary
    : getCategoryColor(bill.category ?? '', c.primary);
  const payer = memberName(bill.paidBy).split(' ')[0];
  const catLabel = bill.category
    ? t(`bills.cat_${bill.category.toLowerCase()}`, { defaultValue: bill.category })
    : '';

  // Single-flight guard: a slow delete must not be submitted twice (which would
  // fire duplicate deletes and notify housemates more than once).
  const deletingRef = useRef(false);
  const handleDelete = useCallback((): void => {
    if (deletingRef.current) return;
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium).catch(() => {});
    // Deleting a bill can't be undone and shifts everyone's balances, so
    // confirm before removing — unlike the throwaway grocery rows.
    Alert.alert(t('bills.delete_bill_confirm_title'), t('bills.delete_bill_confirm_msg'), [
      { text: t('common.cancel'), style: 'cancel' },
      {
        text: t('common.delete'),
        style: 'destructive',
        onPress: (): void => {
          if (deletingRef.current) return;
          deletingRef.current = true;
          deleteBill(bill.id, houseId)
            .catch(() => {
              Alert.alert(t('bills.failed_delete'));
            })
            .finally(() => {
              deletingRef.current = false;
            });
        },
      },
    ]);
  }, [bill.id, houseId, deleteBill, t]);

  const row = (
    <Pressable
      style={({ pressed }) => [
        styles.billRow,
        // Opaque background matches the day card so the red delete lane never
        // shows through the gaps between rows while swiping.
        { backgroundColor: isDark ? c.surfaceSecondary : c.surface },
        pressed && { backgroundColor: isDark ? 'rgba(255,255,255,0.06)' : c.surfaceSecondary },
      ]}
      onPress={() => router.push(`/(tabs)/bills/${bill.id}`)}
      accessibilityRole="button"
    >
      <View
        style={[
          styles.billIconWrap,
          { backgroundColor: catColor + (isDark ? '26' : '1A'), borderColor: catColor + '2E' },
        ]}
      >
        <Ionicons name={icon} size={19} color={catColor} />
      </View>
      <View style={styles.billInfo}>
        <Text
          style={[styles.billTitle, { color: bill.settled ? c.textSecondary : c.textPrimary }]}
          numberOfLines={1}
        >
          {bill.title}
        </Text>
        <Text style={[styles.billMeta, { color: c.textSecondary }]} numberOfLines={1}>
          {catLabel ? `${catLabel} · ${payer}` : t('bills.paid_by_name', { name: payer })}
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
      </View>
    </Pressable>
  );

  // Swipe left-to-reveal a red Delete, like a native list. Settled bills and
  // non-owner/admins can't delete, so they just render the plain row.
  if (!canDelete) return row;
  return (
    <Swipeable
      renderRightActions={(_progress, dragX): React.JSX.Element => {
        // Slide the panel in 1:1 with the drag so it stays glued to the row's
        // right edge instead of sitting revealed as a floating box underneath.
        const translateX = dragX.interpolate({
          inputRange: [-SWIPE_DELETE_WIDTH, 0],
          outputRange: [0, SWIPE_DELETE_WIDTH],
          extrapolate: 'clamp',
        });
        return (
          <RNAnimated.View style={[styles.swipeDeleteLane, { transform: [{ translateX }] }]}>
            <Pressable
              style={[styles.swipeDelete, { backgroundColor: c.danger }]}
              onPress={handleDelete}
              accessible
              accessibilityRole="button"
              accessibilityLabel={t('bills.delete_bill_name', { name: bill.title })}
              accessibilityState={{ disabled: false }}
            >
              <Ionicons name="trash" size={20} color="#fff" />
              <Text style={styles.swipeDeleteText}>{t('common.delete')}</Text>
            </Pressable>
          </RNAnimated.View>
        );
      }}
      overshootRight={false}
      rightThreshold={40}
      friction={2}
    >
      {row}
    </Swipeable>
  );
}

// ── Recurring payment row (shown in the one-off history) ────────────────────────
/** A logged recurring-payment row shown inline within the one-off expense history. */
function RecurringPaymentCard({ row }: { row: RecurringPaymentRow }): React.JSX.Element {
  const c = useThemedColors();
  const { t } = useTranslation();
  const currencyCode = useSettingsStore((s) => s.currencyCode);
  const memberName = useMemberName();
  const isDark = c === darkColors;
  return (
    <Pressable
      style={({ pressed }) => [
        styles.billRow,
        pressed && { backgroundColor: isDark ? 'rgba(255,255,255,0.06)' : c.surfaceSecondary },
      ]}
      onPress={() => navigateToBase('/(tabs)/bills?openRecurring=1')}
      accessibilityRole="button"
      accessibilityLabel={row.title}
    >
      <View
        style={[
          styles.billIconWrap,
          { backgroundColor: c.primary + '14', borderColor: c.primary + '2E' },
        ]}
      >
        <Ionicons name={resolveBillIcon(row.icon)} size={20} color={c.primary} />
      </View>
      <View style={styles.billInfo}>
        <Text style={[styles.billTitle, { color: c.textPrimary }]} numberOfLines={1}>
          {row.title}
        </Text>
        <Text style={[styles.billMeta, { color: c.textSecondary }]} numberOfLines={1}>
          {t('bills.paid_by_name', { name: memberName(row.paidBy).split(' ')[0] })}
        </Text>
      </View>
      <View style={styles.billRight}>
        <Pill tone="brand" style={styles.settledBadge}>
          {t('bills.recurring_tag')}
        </Pill>
        <Text style={[styles.billAmount, { color: c.textPrimary }]}>
          {formatFull(row.amount, currencyCode)}
        </Text>
      </View>
    </Pressable>
  );
}

// ── Date group ────────────────────────────────────────────────────────────────
// A day's expenses share one soft card, separated by hairlines — a calmer, more
// unified list than one bordered box per row.
/** One day's expenses rendered as a segment of the continuous card, with an inline day label. */
function DateGroup({
  title,
  data,
  isFirst,
  isLast,
}: {
  title: string;
  data: BillRow[];
  isFirst: boolean;
  isLast: boolean;
}): React.JSX.Element {
  const c = useThemedColors();
  const isDark = c === darkColors;
  // Every day is a segment of ONE continuous card: shared surface + side borders,
  // rounded only at the very top and very bottom. The day label sits inside.
  return (
    <View
      style={[
        styles.groupSegment,
        {
          backgroundColor: isDark ? c.surfaceSecondary : c.surface,
          borderColor: isDark ? 'rgba(255,255,255,0.10)' : c.border,
        },
        isFirst && styles.groupSegmentFirst,
        isLast && styles.groupSegmentLast,
      ]}
    >
      <Text style={[styles.dayLabel, { color: c.textPrimary }]}>{title}</Text>
      {data.map((row, i) => (
        <View key={row.key}>
          {i > 0 && <View style={[styles.rowDivider, { backgroundColor: c.border }]} />}
          {row.kind === 'bill' ? (
            <BillCard bill={row.bill} />
          ) : (
            <RecurringPaymentCard row={row.payment} />
          )}
        </View>
      ))}
    </View>
  );
}

// ── Settle avatar (small, on-gradient) ──────────────────────────────────────────
/** Small circular avatar (photo or initial) used inside the settle-up transfer list. */
function SettleAvatar({ name, uri }: { name: string; uri?: string }): React.JSX.Element {
  return (
    <View style={styles.settleAv}>
      {uri ? (
        <Image
          source={{ uri }}
          style={styles.settleAvImg}
          contentFit="cover"
          accessible
          accessibilityLabel={name}
        />
      ) : (
        <Text style={styles.settleAvText}>{name[0]?.toUpperCase() ?? '?'}</Text>
      )}
    </View>
  );
}

// ── Category filter chip ──────────────────────────────────────────────────────
interface CategoryChipProps {
  chipKey: string;
  selected: boolean;
  label: string;
  icon: React.ComponentProps<typeof Ionicons>['name'];
  setCategory: (cat: string) => void;
}

/** A single category filter chip (icon + label) in the horizontal chip row. */
const CategoryChip = memo(function CategoryChip({
  chipKey,
  selected,
  label,
  icon,
  setCategory,
}: CategoryChipProps): React.JSX.Element {
  const c = useThemedColors();
  const handlePress = useCallback((): void => {
    setCategory(chipKey);
  }, [setCategory, chipKey]);

  return (
    <Pressable
      onPress={handlePress}
      accessible={true}
      style={[
        styles.chip,
        {
          backgroundColor: selected ? c.primary : c.surface,
          borderColor: selected ? c.primary : c.border,
        },
      ]}
      accessibilityRole="radio"
      accessibilityState={{ selected }}
      accessibilityLabel={label}
    >
      <Ionicons name={icon} size={14} color={selected ? '#fff' : c.textSecondary} />
      <Text style={[styles.chipText, { color: selected ? '#fff' : c.textSecondary }]}>{label}</Text>
    </Pressable>
  );
});

// ── Main screen ───────────────────────────────────────────────────────────────
/**
 * Bills tab. Shows the balance/settle-up hero, a one-off vs recurring filter,
 * and — for one-off expenses — a search box, category chips, and the expense
 * history grouped into day sections.
 */
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
  // Search state lives here; category state is owned by the hook.
  const [search, setSearch] = useState('');
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
  const memberName = useMemberName();
  const billsRtl = isRTL(i18n.language as never);
  const avatarById = useMemo(
    (): Map<string, string | undefined> => new Map(housemates.map((h) => [h.id, h.avatarUrl])),
    [housemates]
  );

  const handleClearSearch = useCallback((): void => {
    setSearch('');
  }, []);

  const sectionCount = billSections.length;
  const renderGroup = useCallback(
    ({
      item,
      index,
    }: {
      item: { title: string; data: BillRow[] };
      index: number;
    }): React.JSX.Element => (
      <DateGroup
        title={item.title}
        data={item.data}
        isFirst={index === 0}
        isLast={index === sectionCount - 1}
      />
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
      <View style={styles.pageHeader}>
        <View style={styles.pageHeaderText}>
          <Text style={[styles.pageTitle, headingFont, { color: c.textPrimary }]} numberOfLines={1}>
            {t('bills.title')}
          </Text>
          <Text style={[styles.pageSubtitle, { color: c.textSecondary }]}>
            {t('bills.page_subtitle')}
          </Text>
        </View>
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
      entering={entered ? undefined : FadeInDown.duration(400)}
      style={[styles.listHeaderWrap, isWide && styles.listHeaderWrapWide]}
    >
      <BackLink label={t('common.home')} />
      {/* ── Balance + settle (one merged card) ───────────────────── */}
      <LinearGradient
        colors={isOwed ? c.owedGradient : c.dangerGradient}
        start={{ x: 0.15, y: 0 }}
        end={{ x: 0.85, y: 1 }}
        style={[styles.balanceCard, { shadowColor: isOwed ? c.owedShadow : c.dangerGradient[1] }]}
      >
        <View style={styles.balanceHighlight} />
        <View style={styles.balanceDeco} pointerEvents="none" />
        <View style={styles.balanceDecoSm} pointerEvents="none" />

        <View style={styles.balanceTop}>
          <View style={styles.flexShrink}>
            <Text style={[styles.balanceLabel, styles.balanceOnHero]}>
              {iAmSettled
                ? t('bills.all_settled_tag')
                : isOwed
                  ? t('bills.you_are_owed')
                  : t('bills.you_owe')}
            </Text>
            {iAmSettled ? (
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
                    ? t('bills.net_across', { count: sharedBalances.length })
                    : t('bills.net_across_plural', { count: sharedBalances.length })}
                </Text>
              </>
            )}
          </View>
          {iAmSettled ? (
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
          <View style={styles.settlePanel}>
            <Pressable
              style={({ pressed }) => [styles.settleStrip, pressed && { opacity: 0.85 }]}
              onPress={() => setShowSettle((v) => !v)}
              accessibilityRole="button"
              accessibilityLabel={t('bills.toggle_settle')}
              accessibilityState={{ expanded: showSettle }}
            >
              <View style={styles.settleStripIcon}>
                <Ionicons name="checkmark" size={16} color="#fff" />
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

            {showSettle && (
              <View style={styles.settleRows}>
                {settlements.map((s, idx) => {
                  const fromIsMe = s.from === myId;
                  const toIsMe = s.to === myId;
                  const fromName = memberName(s.from).split(' ')[0];
                  const toName = memberName(s.to).split(' ')[0];
                  const amtColor = toIsMe
                    ? '#8FE0AC'
                    : fromIsMe
                      ? '#FF8478'
                      : 'rgba(255,255,255,0.92)';
                  return (
                    <View key={idx} style={styles.settleXfer}>
                      {fromIsMe ? (
                        <View style={styles.youPill}>
                          <Text style={styles.youPillText}>{t('bills.you_label')}</Text>
                        </View>
                      ) : (
                        <>
                          <SettleAvatar name={fromName} uri={avatarById.get(s.from)} />
                          <Text style={styles.settleXferName} numberOfLines={1}>
                            {fromName}
                          </Text>
                        </>
                      )}
                      <Ionicons
                        name={billsRtl ? 'arrow-back' : 'arrow-forward'}
                        size={14}
                        color="rgba(255,255,255,0.55)"
                        style={styles.settleXferArrow}
                      />
                      {toIsMe ? (
                        <View style={styles.youPill}>
                          <Text style={styles.youPillText}>{t('bills.you_label')}</Text>
                        </View>
                      ) : (
                        <>
                          <SettleAvatar name={toName} uri={avatarById.get(s.to)} />
                          <Text style={styles.settleXferName} numberOfLines={1}>
                            {toName}
                          </Text>
                        </>
                      )}
                      <Text style={[styles.settleXferAmt, { color: amtColor }]}>
                        {formatFull(s.amount, currencyCode)}
                      </Text>
                    </View>
                  );
                })}
              </View>
            )}
          </View>
        )}
      </LinearGradient>

      {/* Recurring household bills */}
      {filter === 'recurring' && (
        <View style={styles.householdWrap}>
          <HouseholdTab />
        </View>
      )}

      {/* One-off: search + category chips + list eyebrow */}
      {filter === 'one-off' && bills.length + payments.length > 0 && (
        <View style={styles.oneOffControls}>
          <View
            style={[
              styles.searchBar,
              { backgroundColor: c.surfaceSecondary, borderColor: c.border },
            ]}
          >
            <Ionicons name="search" size={17} color={c.textSecondary} />
            <TextInput
              style={[styles.searchInput, { color: c.textPrimary }]}
              value={search}
              onChangeText={setSearch}
              placeholder={t('bills.search_placeholder')}
              placeholderTextColor={c.textSecondary}
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

          {presentCategories.length > 0 && (
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={styles.chipScroll}
            >
              {['all', ...presentCategories].map((key) => (
                <CategoryChip
                  key={key}
                  chipKey={key}
                  selected={category === key}
                  label={key === 'all' ? t('bills.filter_all') : t(`bills.cat_${key}`)}
                  icon={key === 'all' ? 'apps-outline' : getCategoryIcon(key)}
                  setCategory={setCategory}
                />
              ))}
            </ScrollView>
          )}

          <View style={styles.listCountRow}>
            <Text style={[styles.eyebrow, { color: c.textSecondary }]}>
              {t('bills.all_expenses')}
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
      <FlatList
        style={styles.flex}
        data={billSections}
        keyExtractor={(section) => section.key}
        renderItem={renderGroup}
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.listContent}
        ListHeaderComponent={ListHeader}
        ListEmptyComponent={
          bills.length + payments.length > 0 ? (
            <EmptyState
              icon="search-outline"
              title={t('bills.no_results')}
              message={t('bills.no_results_hint')}
            />
          ) : (
            <EmptyState
              icon="receipt-outline"
              title={t('bills.no_expenses_yet')}
              message={t('bills.no_expenses_hint')}
            />
          )
        }
      />
    </SafeAreaView>
  );
}

// ── Styles ────────────────────────────────────────────────────────────────────
const styles = StyleSheet.create({
  container: { flex: 1 },
  flex: { flex: 1 },
  centered: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: ms(20) },
  listContent: {
    paddingBottom: Platform.OS === 'web' ? sizes.bottomTabBarHeight : sizes.bottomTabContentPadding,
  },

  topBar: { paddingHorizontal: ms(16), paddingTop: ms(4), paddingBottom: ms(4), gap: ms(12) },
  topBarWide: { paddingHorizontal: ms(24) },
  listHeaderWrap: { paddingHorizontal: ms(16), paddingTop: ms(12), gap: ms(14) },
  listHeaderWrapWide: { paddingHorizontal: ms(24) },

  // ── Page header
  pageHeader: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    gap: ms(12),
  },
  pageHeaderText: { flexShrink: 1, minWidth: 0 },
  pageTitle: { fontSize: mf(28), ...font.extrabold, letterSpacing: -0.8 },
  pageSubtitle: { fontSize: mf(13), ...font.regular, marginTop: ms(2) },

  // ── Balance + settle (merged card)
  balanceCard: {
    borderRadius: ms(20),
    padding: ms(20),
    overflow: 'hidden',
    shadowOffset: { width: 0, height: ms(14) },
    shadowOpacity: 1,
    shadowRadius: 26,
    elevation: 9,
  },
  balanceHighlight: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    height: ms(1),
    backgroundColor: 'rgba(255,255,255,0.18)',
  },
  // Soft decorative circles behind the amount (clipped by the card's overflow).
  balanceDeco: {
    position: 'absolute',
    top: ms(-34),
    right: ms(-26),
    width: ms(150),
    height: ms(150),
    borderRadius: ms(75),
    backgroundColor: 'rgba(255,255,255,0.06)',
  },
  balanceDecoSm: {
    position: 'absolute',
    top: ms(22),
    right: ms(40),
    width: ms(92),
    height: ms(92),
    borderRadius: ms(46),
    backgroundColor: 'rgba(255,255,255,0.05)',
  },
  balanceOnHero: { color: 'rgba(255,255,255,0.85)' },
  balanceTop: { flexDirection: 'row', alignItems: 'flex-start', gap: ms(12) },
  flexShrink: { flex: 1, minWidth: 0 },
  balanceLabel: { fontSize: mf(12.5), ...font.semibold },
  // Isolate money to LTR so digits/symbol don't bidi-reorder under Hebrew/RTL.
  balanceBigAmt: { marginTop: ms(6), writingDirection: 'ltr' },
  balanceSub: {
    fontSize: mf(11.5),
    ...font.medium,
    color: 'rgba(255,255,255,0.78)',
    marginTop: ms(6),
  },
  balanceSettledSub: {
    fontSize: mf(13),
    ...font.medium,
    color: 'rgba(255,255,255,0.8)',
    marginTop: ms(4),
  },
  balanceAnalysis: {
    width: ms(46),
    height: ms(46),
    borderRadius: ms(15),
    backgroundColor: 'rgba(255,255,255,0.15)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.16)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  balanceCheck: {
    width: ms(44),
    height: ms(44),
    borderRadius: ms(22),
    backgroundColor: 'rgba(255,255,255,0.16)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  // Settle section flush to the card's bottom edge. The "Settle up" header
  // stays on the gradient (same colour as the amount above); only the expanded
  // transfer rows sit on a lighter tint, so the data reads as its own panel.
  settlePanel: {
    marginTop: ms(16),
    marginHorizontal: ms(-20),
    marginBottom: ms(-20),
  },
  settleStrip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: ms(11),
    paddingHorizontal: ms(20),
    paddingVertical: ms(13),
  },
  settleRows: { backgroundColor: 'rgba(255,255,255,0.1)' },
  settleStripIcon: {
    width: ms(30),
    height: ms(30),
    borderRadius: ms(10),
    backgroundColor: 'rgba(255,255,255,0.18)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  settleStripTitle: { fontSize: mf(14), ...font.bold, color: '#fff' },
  settleStripSub: {
    fontSize: mf(11.5),
    ...font.medium,
    color: 'rgba(255,255,255,0.75)',
    marginTop: ms(1),
  },
  settleXfer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: ms(8),
    paddingHorizontal: ms(20),
    paddingVertical: ms(11),
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: 'rgba(255,255,255,0.08)',
  },
  settleXferName: { fontSize: mf(13), ...font.bold, color: '#fff', maxWidth: ms(74) },
  settleXferArrow: { marginHorizontal: ms(1) },
  settleXferAmt: {
    marginStart: 'auto' as never,
    fontSize: mf(14),
    ...font.extrabold,
    writingDirection: 'ltr',
  },
  settleAv: {
    width: ms(26),
    height: ms(26),
    borderRadius: ms(13),
    backgroundColor: 'rgba(255,255,255,0.2)',
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  settleAvImg: { width: ms(26), height: ms(26) },
  settleAvText: { fontSize: mf(11), ...font.bold, color: '#fff' },
  youPill: {
    paddingHorizontal: ms(11),
    paddingVertical: ms(5),
    borderRadius: 9999,
    backgroundColor: 'rgba(255,255,255,0.22)',
  },
  youPillText: { fontSize: mf(12.5), ...font.bold, color: '#fff' },

  // ── Filter tabs
  filterRow: {
    flexDirection: 'row',
    gap: ms(8),
    borderRadius: ms(14),
    padding: ms(4),
    borderWidth: 1,
  },
  filterTab: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: ms(6),
    paddingVertical: ms(10),
    borderRadius: ms(11),
    minHeight: ms(44),
  },
  filterTabText: { fontSize: mf(13), ...font.semibold },
  filterTabTextActive: { color: '#fff' },

  householdWrap: { minHeight: ms(200) },

  // ── One-off search + category chips
  oneOffControls: { gap: ms(12) },
  searchBar: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: ms(8),
    paddingHorizontal: ms(14),
    height: ms(46),
    borderRadius: ms(14),
    borderWidth: 1,
  },
  searchInput: {
    flex: 1,
    minWidth: 0,
    fontSize: mf(14),
    ...font.regular,
    paddingVertical: 0,
    ...(Platform.OS === 'web' ? ({ outlineStyle: 'none' } as object) : null),
  },
  clearSearchButton: {
    minWidth: ms(44),
    minHeight: ms(44),
    alignItems: 'center',
    justifyContent: 'center',
  },
  chipScroll: { gap: ms(8), paddingVertical: ms(1), paddingHorizontal: ms(1) },
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: ms(6),
    paddingHorizontal: ms(13),
    minHeight: ms(44),
    borderRadius: 9999,
    borderWidth: 1,
  },
  chipText: { fontSize: mf(13), ...font.semibold },

  // ── One-off list header
  listCountRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: ms(8),
    paddingHorizontal: ms(4),
  },
  eyebrow: { fontSize: mf(11), ...font.bold, letterSpacing: 0.8, textTransform: 'uppercase' },
  // ── Day segments of one continuous card
  groupSegment: {
    marginHorizontal: ms(16),
    borderLeftWidth: 1,
    borderRightWidth: 1,
    // Full-width top line marks a new day section; a soft shadow lifts the
    // whole card off the background so days read as distinct sections.
    borderTopWidth: 1,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: ms(5) },
    shadowOpacity: 0.05,
    shadowRadius: 18,
    elevation: 2,
  },
  groupSegmentFirst: {
    marginTop: ms(4),
    borderTopLeftRadius: ms(16),
    borderTopRightRadius: ms(16),
  },
  groupSegmentLast: {
    borderBottomWidth: 1,
    borderBottomLeftRadius: ms(16),
    borderBottomRightRadius: ms(16),
    marginBottom: ms(2),
  },
  dayLabel: {
    paddingHorizontal: ms(16),
    paddingTop: ms(14),
    paddingBottom: ms(6),
    fontSize: mf(13),
    ...font.bold,
    letterSpacing: 0.3,
  },
  // Short centered hairline between rows within the same day.
  rowDivider: { height: StyleSheet.hairlineWidth, width: '42%', alignSelf: 'center' },

  // ── Bill row
  billRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: ms(13),
    paddingHorizontal: ms(16),
    paddingVertical: ms(15),
  },
  billIconWrap: {
    width: ms(44),
    height: ms(44),
    borderRadius: ms(14),
    borderWidth: 1,
    justifyContent: 'center',
    alignItems: 'center',
    flexShrink: 0,
  },
  billInfo: { flex: 1 },
  billTitle: { fontSize: mf(15.5), ...font.semibold, letterSpacing: -0.2 },
  billMeta: { fontSize: mf(12.5), ...font.regular, marginTop: ms(3) },
  settledBadge: {
    paddingHorizontal: ms(7),
    paddingVertical: ms(3),
    borderRadius: ms(6),
    marginEnd: ms(4),
  },
  settledBadgeText: { fontSize: mf(10), ...font.semibold },
  billRight: { flexDirection: 'row', alignItems: 'center', gap: ms(4) },
  billAmount: {
    fontSize: mf(15.5),
    ...font.bold,
    letterSpacing: -0.3,
    fontVariant: ['tabular-nums'],
  },

  // ── Swipe-to-delete lane (danger colour applied inline for theming)
  swipeDeleteLane: { width: SWIPE_DELETE_WIDTH },
  swipeDelete: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    gap: ms(3),
  },
  swipeDeleteText: { fontSize: mf(12), ...font.bold, color: '#fff' },

  // ── Empty state
  emptyWrap: {
    alignItems: 'center',
    paddingVertical: ms(48),
    gap: ms(10),
    paddingHorizontal: ms(24),
  },
  emptyIconWrap: {
    width: ms(72),
    height: ms(72),
    borderRadius: ms(36),
    justifyContent: 'center',
    alignItems: 'center',
  },
  emptyTitle: { fontSize: mf(16), ...font.bold },
  emptyText: { fontSize: mf(14), ...font.regular, textAlign: 'center', lineHeight: mf(20) },
});
