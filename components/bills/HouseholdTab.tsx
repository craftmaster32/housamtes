import { useState, useCallback, useMemo } from 'react';
import { View, StyleSheet, ScrollView, Pressable } from 'react-native';
import { Text } from 'react-native-paper';
import { useTranslation } from 'react-i18next';
import { useRecurringBillsStore, calculateFairness } from '@stores/recurringBillsStore';
import { useAuthStore } from '@stores/authStore';
import { useHousematesStore } from '@stores/housematesStore';
import { useMemberName } from '@hooks/useMemberName';
import { useSettingsStore } from '@stores/settingsStore';
import { DeletedBillsList } from '@components/bills/DeletedBillsList';
import { RecurringBillCard } from '@components/bills/recurring/RecurringBillCard';
import { RecurringBillForm } from '@components/bills/recurring/RecurringBillForm';
import { EmptyState } from '@components/ui';
import { buildHistory, type HistoryItem } from '@utils/recurringHistory';
import { sortBillsByDue, todayISO } from '@utils/recurringCoverage';
import { useThemedColors } from '@constants/colors';
import { sizes } from '@constants/sizes';
import { font } from '@constants/typography';

import { mf, ms } from '@utils/responsive';
const MAX_DELETED_BILLS = 10;
const NO_CHANGES: HistoryItem[] = [];

// ── Fairness bar ──────────────────────────────────────────────────────────────

function FairnessSection(): React.JSX.Element {
  const { t } = useTranslation();
  const c = useThemedColors();
  const bills = useRecurringBillsStore((s) => s.bills);
  const payments = useRecurringBillsStore((s) => s.payments);
  const housemates = useHousematesStore((s) => s.housemates);
  const memberName = useMemberName();
  const currency = useSettingsStore((s) => s.currency);
  const fairness = calculateFairness(
    bills,
    payments,
    housemates.map((h) => h.id)
  );

  if (fairness.length === 0) return <></>;

  const maxTotal = Math.max(...fairness.map((f) => f.total), 1);

  return (
    <View
      style={[
        styles.fairnessCard,
        { backgroundColor: c.surface, borderColor: c.border, borderWidth: 1 },
      ]}
    >
      <Text style={[styles.fairnessTitle, { color: c.textSecondary }]}>
        {t('bills.household_contributions')}
      </Text>
      {fairness.map((f) => (
        <View key={f.person} style={styles.fairnessRow}>
          <Text style={[styles.fairnessPerson, { color: c.textPrimary }]} numberOfLines={1}>
            {memberName(f.person)}
          </Text>
          <View style={[styles.barTrack, { backgroundColor: c.surfaceSecondary }]}>
            <View
              style={[
                styles.barFill,
                {
                  width: `${(f.total / maxTotal) * 100}%`,
                  backgroundColor: f.balance >= 0 ? c.positive : c.negative,
                },
              ]}
            />
          </View>
          <Text style={[styles.fairnessAmount, { color: c.textPrimary }]}>
            {currency}
            {f.total.toFixed(0)}
          </Text>
          <Text
            style={[styles.fairnessBalance, { color: f.balance >= 0 ? c.positive : c.negative }]}
          >
            {f.balance >= 0
              ? `+${currency}${f.balance.toFixed(0)}`
              : `-${currency}${Math.abs(f.balance).toFixed(0)}`}
          </Text>
        </View>
      ))}
      <Text style={[styles.fairnessNote, { color: c.textDisabled }]}>
        {t('bills.household_balance_note')}
      </Text>
    </View>
  );
}

// ── Main tab ──────────────────────────────────────────────────────────────────

export function HouseholdTab(): React.JSX.Element {
  const { t } = useTranslation();
  const c = useThemedColors();
  const bills = useRecurringBillsStore((s) => s.bills);
  const payments = useRecurringBillsStore((s) => s.payments);
  const history = useRecurringBillsStore((s) => s.history);
  const isLoading = useRecurringBillsStore((s) => s.isLoading);
  const error = useRecurringBillsStore((s) => s.error);
  const load = useRecurringBillsStore((s) => s.load);
  const houseId = useAuthStore((s) => s.houseId);
  const currency = useSettingsStore((s) => s.currency);
  const profile = useAuthStore((s) => s.profile);
  const housemates = useHousematesStore((s) => s.housemates);
  const [showAddForm, setShowAddForm] = useState(false);
  const today = todayISO();

  // Change history, grouped per bill; deleted bills are listed on their own.
  const { changesByBill, deletedBills } = useMemo(() => {
    const items = buildHistory(history, bills, payments);
    const byBill = new Map<string, HistoryItem[]>();
    const deleted: HistoryItem[] = [];
    for (const item of items) {
      if (item.kind === 'bill_delete') {
        deleted.push(item);
        continue;
      }
      const list = byBill.get(item.billId) ?? [];
      list.push(item);
      byBill.set(item.billId, list);
    }
    return { changesByBill: byBill, deletedBills: deleted.slice(0, MAX_DELETED_BILLS) };
  }, [history, bills, payments]);

  // Overdue first, then soonest due.
  const sortedBills = useMemo(
    () => sortBillsByDue(bills, payments, today),
    [bills, payments, today]
  );

  const people = useMemo(
    () =>
      [
        profile ? { id: profile.id, name: profile.name ?? '' } : null,
        ...housemates.map((h) => ({ id: h.id, name: h.name })),
      ]
        .filter((p): p is { id: string; name: string } => Boolean(p?.id && p?.name))
        .filter((p, i, arr) => arr.findIndex((q) => q.id === p.id) === i),
    [profile, housemates]
  );

  const openAddForm = useCallback((): void => setShowAddForm(true), []);
  const closeAddForm = useCallback((): void => setShowAddForm(false), []);
  const retry = useCallback((): void => {
    if (houseId) load(houseId);
  }, [houseId, load]);

  if (isLoading && bills.length === 0) {
    return <EmptyState mode="loading" title={t('bills.loading_bills')} />;
  }
  if (error && bills.length === 0) {
    return (
      <EmptyState
        mode="error"
        icon="alert-circle-outline"
        title={t('bills.load_error')}
        message={error}
        actionLabel={t('bills.retry')}
        onAction={retry}
      />
    );
  }

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <FairnessSection />

      {bills.length === 0 && !showAddForm && (
        <View style={styles.emptySection}>
          <Text style={[styles.emptyTitle, { color: c.textPrimary }]}>
            {t('bills.household_no_bills')}
          </Text>
          <Text style={[styles.emptyText, { color: c.textSecondary }]}>
            {t('bills.household_no_bills_hint')}
          </Text>
        </View>
      )}

      {sortedBills.map((bill) => (
        <RecurringBillCard
          key={bill.id}
          bill={bill}
          payments={payments}
          changes={changesByBill.get(bill.id) ?? NO_CHANGES}
          people={people}
          today={today}
        />
      ))}

      {deletedBills.length > 0 && <DeletedBillsList items={deletedBills} currency={currency} />}

      {showAddForm ? (
        <RecurringBillForm people={people} onClose={closeAddForm} />
      ) : (
        <Pressable
          style={[styles.addBillBtn, { borderColor: c.border }]}
          onPress={openAddForm}
          accessible
          accessibilityRole="button"
          accessibilityLabel={t('bills.household_add_recurring')}
        >
          <Text style={[styles.addBillBtnText, { color: c.primary }]}>
            {t('bills.household_add_recurring')}
          </Text>
        </Pressable>
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  content: { padding: sizes.lg, paddingBottom: ms(60), gap: ms(12) },

  // Fairness
  fairnessCard: { borderRadius: sizes.borderRadius, padding: sizes.md, gap: sizes.sm },
  fairnessTitle: {
    fontSize: sizes.fontSm,
    ...font.bold,
    letterSpacing: 0.5,
    textTransform: 'uppercase',
  },
  fairnessRow: { flexDirection: 'row', alignItems: 'center', gap: sizes.xs },
  fairnessPerson: { width: ms(64), fontSize: sizes.fontSm, ...font.semibold },
  barTrack: { flex: 1, height: ms(8), borderRadius: ms(4), overflow: 'hidden' },
  barFill: { height: ms(8), borderRadius: ms(4) },
  fairnessAmount: { width: ms(56), fontSize: sizes.fontSm, textAlign: 'right' },
  fairnessBalance: { width: ms(56), fontSize: sizes.fontXs, ...font.bold, textAlign: 'right' },
  fairnessNote: { fontSize: mf(11), marginTop: sizes.xs },

  // Add bill button
  addBillBtn: {
    borderWidth: 2,
    borderStyle: 'dashed',
    borderRadius: sizes.borderRadius,
    paddingVertical: sizes.md,
    alignItems: 'center',
  },
  addBillBtnText: { ...font.bold, fontSize: sizes.fontMd },

  // Empty
  emptySection: { alignItems: 'center', paddingVertical: sizes.xl },
  emptyTitle: { ...font.bold, marginBottom: sizes.xs },
  emptyText: { textAlign: 'center', fontSize: sizes.fontSm },
});
