import { useState, useCallback, useMemo } from 'react';
import { View, StyleSheet, Pressable } from 'react-native';
import { Text } from 'react-native-paper';
import { useTranslation } from 'react-i18next';
import { Ionicons } from '@expo/vector-icons';
import {
  useRecurringBillsStore,
  resolveBillIcon,
  DeleteNotAllowedError,
  type HouseholdPayment,
  type RecurringBill,
} from '@stores/recurringBillsStore';
import { useMemberName } from '@hooks/useMemberName';
import { useSettingsStore } from '@stores/settingsStore';
import { Alert } from '@lib/alert';
import { BillChangeLog } from '@components/bills/BillChangeLog';
import { font } from '@constants/typography';
import type { HistoryItem } from '@utils/recurringHistory';
import {
  FREQUENCY_MONTHS,
  coveredThrough,
  findOverlappingPayments,
  formatPeriod,
  getDueStatus,
} from '@utils/recurringCoverage';
import { mf, ms } from '@utils/responsive';
import { BillCardMenu, type BillMenuAction } from './BillCardMenu';
import { BillStatusRow } from './BillStatusRow';
import type { ChoiceOption } from './ChoiceChips';
import { PaymentHistory } from './PaymentHistory';
import { PaymentSheet } from './PaymentSheet';
import { RecurringBillForm } from './RecurringBillForm';
import { formatMoney } from './money';
import { useRecurringPalette } from './palette';

interface RecurringBillCardProps {
  bill: RecurringBill;
  payments: HouseholdPayment[]; // all house payments; the card picks its own
  changes: HistoryItem[];
  people: ChoiceOption[];
  today: string; // YYYY-MM-DD
}

/** One recurring bill: what it costs, how far it's paid, and its payment history. */
export function RecurringBillCard({
  bill,
  payments,
  changes,
  people,
  today,
}: RecurringBillCardProps): React.JSX.Element {
  const { t, i18n } = useTranslation();
  const p = useRecurringPalette();
  const memberName = useMemberName();
  const currency = useSettingsStore((s) => s.currency);
  const deleteBill = useRecurringBillsStore((s) => s.deleteBill);

  const [menuOpen, setMenuOpen] = useState(false);
  const [editing, setEditing] = useState(false);
  const [showHistory, setShowHistory] = useState(false);
  const [showChanges, setShowChanges] = useState(false);
  const [sheetOpen, setSheetOpen] = useState(false);
  const [selected, setSelected] = useState<HouseholdPayment | undefined>(undefined);
  const [error, setError] = useState('');

  const billPayments = useMemo(
    () =>
      payments
        .filter((x) => x.billId === bill.id)
        .sort((a, b) => b.paidAt.localeCompare(a.paidAt) || b.id.localeCompare(a.id)),
    [payments, bill.id]
  );
  const overlapping = useMemo(() => findOverlappingPayments(billPayments), [billPayments]);
  const through = coveredThrough(bill.id, billPayments);
  const status = getDueStatus(bill, billPayments, today);
  const months = FREQUENCY_MONTHS[bill.frequency];

  const meta = [
    formatMoney(currency, bill.typicalAmount),
    months === 1 ? t('bills.recurring_monthly') : t('bills.recurring_every_n', { n: months }),
    memberName(bill.assignedTo),
  ].join(' · ');

  const handleDelete = useCallback(async (): Promise<void> => {
    try {
      setError('');
      await deleteBill(bill.id);
    } catch (err) {
      setError(
        err instanceof DeleteNotAllowedError
          ? t('bills.household_delete_not_allowed')
          : t('bills.failed_delete')
      );
    }
  }, [deleteBill, bill.id, t]);

  const handleMenu = useCallback(
    (action: BillMenuAction): void => {
      setMenuOpen(false);
      if (action === 'edit') setEditing(true);
      if (action === 'changes') setShowChanges((v) => !v);
      if (action === 'delete') {
        // Any housemate can delete, so ask first — it removes the whole history.
        Alert.alert(
          t('bills.household_delete_bill_title', { name: bill.name }),
          t('bills.household_delete_bill_body'),
          [
            { text: t('common.cancel'), style: 'cancel' },
            { text: t('common.delete'), style: 'destructive', onPress: handleDelete },
          ]
        );
      }
    },
    [bill.name, handleDelete, t]
  );

  const openMenu = useCallback((): void => setMenuOpen(true), []);
  const closeMenu = useCallback((): void => setMenuOpen(false), []);
  const stopEditing = useCallback((): void => setEditing(false), []);
  const toggleHistory = useCallback((): void => setShowHistory((v) => !v), []);
  const openLog = useCallback((): void => {
    setSelected(undefined);
    setSheetOpen(true);
  }, []);
  const openEdit = useCallback((payment: HouseholdPayment): void => {
    setSelected(payment);
    setSheetOpen(true);
  }, []);
  const closeSheet = useCallback((): void => setSheetOpen(false), []);

  if (editing) {
    return <RecurringBillForm bill={bill} people={people} onClose={stopEditing} />;
  }

  return (
    <View style={[styles.card, { backgroundColor: p.card, shadowColor: p.shadow }]}>
      {/* Top row */}
      <View style={styles.topRow}>
        <View style={[styles.iconTile, { backgroundColor: p.secondaryBg }]}>
          <Ionicons name={resolveBillIcon(bill.icon)} size={22} color={p.secondaryText} />
        </View>
        <View style={styles.titleWrap}>
          <Text style={[styles.name, { color: p.text }]} numberOfLines={1}>
            {bill.name}
          </Text>
          <Text style={[styles.meta, { color: p.muted }]} numberOfLines={1}>
            {meta}
          </Text>
        </View>
        <Pressable
          onPress={openMenu}
          style={({ pressed }) => [styles.menuBtn, pressed && { backgroundColor: p.secondaryBg }]}
          accessible
          accessibilityRole="button"
          accessibilityLabel={t('bills.recurring_menu_label', { name: bill.name })}
        >
          <Ionicons name="ellipsis-horizontal" size={20} color={p.muted} />
        </Pressable>
      </View>

      <BillStatusRow
        coveredThrough={through}
        status={status}
        hasPayments={billPayments.length > 0}
      />

      {/* Actions row */}
      <View style={styles.actionsRow}>
        <Pressable
          onPress={openLog}
          style={({ pressed }) => [
            styles.logBtn,
            { backgroundColor: p.primary },
            pressed && styles.pressed,
          ]}
          accessible
          accessibilityRole="button"
        >
          <Text style={[styles.logText, { color: p.onPrimary }]} numberOfLines={1}>
            {status
              ? t('bills.recurring_log_period', {
                  period: formatPeriod(status.period, i18n.language, { withYear: false }),
                })
              : t('bills.household_log_payment')}
          </Text>
        </Pressable>
        {billPayments.length > 0 && (
          <Pressable
            onPress={toggleHistory}
            style={styles.textBtn}
            accessible
            accessibilityRole="button"
            accessibilityState={{ expanded: showHistory }}
          >
            <Text style={[styles.textBtnText, { color: p.secondaryText }]}>
              {showHistory ? t('bills.recurring_hide') : t('bills.recurring_history')}
            </Text>
            <Ionicons
              name={showHistory ? 'chevron-up' : 'chevron-down'}
              size={16}
              color={p.secondaryText}
            />
          </Pressable>
        )}
      </View>

      {!!error && <Text style={[styles.error, { color: p.overdueText }]}>{error}</Text>}

      {showHistory && (
        <PaymentHistory
          payments={billPayments}
          overlapping={overlapping}
          defaultPayer={bill.assignedTo}
          currency={currency}
          onSelect={openEdit}
        />
      )}

      {showChanges &&
        (changes.length > 0 ? (
          <BillChangeLog items={changes} currency={currency} />
        ) : (
          <Text style={[styles.empty, { color: p.muted }]}>{t('bills.recurring_no_changes')}</Text>
        ))}

      <BillCardMenu
        visible={menuOpen}
        billName={bill.name}
        onSelect={handleMenu}
        onClose={closeMenu}
      />
      <PaymentSheet
        visible={sheetOpen}
        bill={bill}
        payment={selected}
        people={people}
        onClose={closeSheet}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    borderRadius: ms(18),
    padding: ms(16),
    shadowOffset: { width: 0, height: ms(2) },
    shadowOpacity: 1,
    shadowRadius: ms(10),
    elevation: 1,
  },
  topRow: { flexDirection: 'row', alignItems: 'center', gap: ms(12) },
  iconTile: {
    width: ms(40),
    height: ms(40),
    borderRadius: ms(12),
    alignItems: 'center',
    justifyContent: 'center',
  },
  titleWrap: { flex: 1, minWidth: 0 },
  name: { fontSize: mf(17), ...font.semibold },
  meta: { fontSize: mf(13), ...font.regular, marginTop: ms(2) },
  menuBtn: {
    width: ms(44),
    height: ms(44),
    borderRadius: ms(22),
    alignItems: 'center',
    justifyContent: 'center',
    marginEnd: ms(-8),
  },
  actionsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    flexWrap: 'wrap',
    gap: ms(8),
    marginTop: ms(16),
  },
  logBtn: {
    minHeight: ms(44),
    paddingHorizontal: ms(18),
    borderRadius: ms(12),
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 1,
  },
  pressed: { opacity: 0.85 },
  logText: { fontSize: mf(15), ...font.semibold },
  textBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: ms(4),
    minHeight: ms(44),
    paddingHorizontal: ms(8),
  },
  textBtnText: { fontSize: mf(15), ...font.medium },
  error: { fontSize: mf(14), ...font.medium, marginTop: ms(8) },
  empty: { fontSize: mf(13), ...font.regular, marginTop: ms(12) },
});
