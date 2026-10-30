import { useState, useCallback, useMemo } from 'react';
import { View, StyleSheet, ScrollView, Pressable } from 'react-native';
import { Text } from 'react-native-paper';
import { useTranslation } from 'react-i18next';
import { useRecurringBillsStore } from '@stores/recurringBillsStore';
import { useAuthStore } from '@stores/authStore';
import { useHousematesStore } from '@stores/housematesStore';
import { useHeadingFont } from '@hooks/useHeadingFont';
import { useHandFont } from '@hooks/useHandFont';
import { useSettingsStore } from '@stores/settingsStore';
import { DeletedBillsList } from '@components/bills/DeletedBillsList';
import { RecurringBillCard } from '@components/bills/recurring/RecurringBillCard';
import { RecurringBillForm } from '@components/bills/recurring/RecurringBillForm';
import { EmptyState } from '@components/ui';
import { buildHistory, type HistoryItem } from '@utils/recurringHistory';
import { sortBillsByDue, todayISO } from '@utils/recurringCoverage';
import { useThemedColors } from '@constants/colors';
import { mf, ms } from '@utils/responsive';

const MAX_DELETED_BILLS = 10;
const NO_CHANGES: HistoryItem[] = [];

// ── Main tab ──────────────────────────────────────────────────────────────────

export function HouseholdTab(): React.JSX.Element {
  const { t } = useTranslation();
  const c = useThemedColors();
  const headingFont = useHeadingFont('semibold');
  const handFont = useHandFont();
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
      {bills.length === 0 && !showAddForm && (
        <View style={styles.emptySection}>
          <Text style={[styles.emptyTitle, headingFont, { color: c.textPrimary }]}>
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
          style={({ pressed }) => [
            styles.addBillBtn,
            { borderColor: c.border },
            pressed && styles.pressed,
          ]}
          onPress={openAddForm}
          accessible
          accessibilityRole="button"
          accessibilityLabel={t('bills.household_add_recurring')}
        >
          <Text style={[styles.addBillBtnText, handFont, { color: c.primary }]}>
            {t('bills.household_add_recurring')}
          </Text>
        </Pressable>
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  // The Bills screen already pads the page, so only space the sections here.
  content: { paddingTop: ms(8), paddingBottom: ms(60), gap: ms(12) },

  // "+ Add recurring bill" — a dashed, handwritten slot at the end of the list.
  addBillBtn: {
    minHeight: ms(64),
    borderWidth: 2,
    borderStyle: 'dashed',
    borderRadius: ms(24),
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: ms(16),
  },
  addBillBtnText: { fontSize: mf(23) },
  pressed: { opacity: 0.75 },

  // Empty
  emptySection: { alignItems: 'center', paddingVertical: ms(24), gap: ms(4) },
  emptyTitle: { fontSize: mf(20) },
  emptyText: { textAlign: 'center', fontSize: mf(14) },
});
