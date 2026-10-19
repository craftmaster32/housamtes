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
import { useThemedColors } from '@constants/colors';
import { useHeadingFont } from '@hooks/useHeadingFont';
import { useHandFont } from '@hooks/useHandFont';
import { ArtSticker } from '@components/shared/ArtSticker';
import { BillArt } from '@components/bills/art/BillArt';
import type { HistoryItem } from '@utils/recurringHistory';
import {
  FREQUENCY_MONTHS,
  coveredThrough,
  findOverlappingPayments,
  formatPeriod,
  getDueStatus,
  monthTrack,
} from '@utils/recurringCoverage';
import { mf, ms } from '@utils/responsive';
import { BillCardMenu, type BillMenuAction } from './BillCardMenu';
import type { ChoiceOption } from './ChoiceChips';
import { PaymentHistory } from './PaymentHistory';
import { PaymentSheet } from './PaymentSheet';
import { RecurringBillForm } from './RecurringBillForm';
import { formatMoney } from './money';
import { MonthTrack } from './MonthTrack';
import { PaperTag } from './PaperTag';
import { useBillStatusText } from './useBillStatusText';
import { useRecurringPalette } from './palette';

interface RecurringBillCardProps {
  bill: RecurringBill;
  payments: HouseholdPayment[]; // all house payments; the card picks its own
  changes: HistoryItem[];
  people: ChoiceOption[];
  today: string; // YYYY-MM-DD
}

/**
 * One recurring bill as a glanceable tile, like the home cards: its name, one
 * big answer ("4d overdue", "in 13d"), a row of month boxes ticked off as they're
 * paid, a handwritten status line, and a paper tag to log the next payment.
 */
export function RecurringBillCard({
  bill,
  payments,
  changes,
  people,
  today,
}: RecurringBillCardProps): React.JSX.Element {
  const { t, i18n } = useTranslation();
  const p = useRecurringPalette();
  const c = useThemedColors();
  const headingFont = useHeadingFont('semibold');
  const handFont = useHandFont();
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
  const track = useMemo(
    () => monthTrack(billPayments, status, today),
    [billPayments, status, today]
  );
  const words = useBillStatusText(through, status, billPayments.length > 0);

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
      {/* Label row: icon + name, and the ⋯ menu */}
      <View style={styles.topRow}>
        <Ionicons name={resolveBillIcon(bill.icon)} size={16} color={p.muted} />
        <Text style={[styles.name, { color: p.muted }]} numberOfLines={1}>
          {bill.name}
        </Text>
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

      <View style={styles.answerRow}>
        <View style={styles.answerText}>
          {/* The one big answer, then what it costs and who pays. */}
          <Text
            style={[styles.answer, headingFont, { color: words.overdue ? c.danger : p.text }]}
            numberOfLines={1}
            adjustsFontSizeToFit
          >
            {words.answer ?? words.coverage}
          </Text>
          <Text style={[styles.meta, { color: p.muted }]} numberOfLines={2}>
            {meta}
          </Text>
        </View>
        <ArtSticker style={styles.art}>
          <BillArt icon={bill.icon} size={ms(54)} />
        </ArtSticker>
      </View>

      <MonthTrack track={track} />

      {!!words.line && (
        <Text style={[styles.note, handFont, { color: words.overdue ? c.danger : p.muted }]}>
          {words.line}
        </Text>
      )}
      {!!words.answer && (
        <Text style={[styles.coverage, { color: p.muted }]}>{words.coverage}</Text>
      )}

      {/* Actions: log the next payment, show past payments */}
      <View style={styles.actionsRow}>
        <PaperTag
          urgent={words.overdue}
          onPress={openLog}
          label={
            status
              ? t('bills.recurring_log_period', {
                  period: formatPeriod(status.period, i18n.language, { withYear: false }),
                })
              : t('bills.household_log_payment')
          }
        />
        {billPayments.length > 0 && (
          <Pressable
            onPress={toggleHistory}
            style={styles.textBtn}
            accessible
            accessibilityRole="button"
            accessibilityState={{ expanded: showHistory }}
          >
            <Text style={[styles.textBtnText, { color: p.muted }]}>
              {showHistory ? t('bills.recurring_hide') : t('bills.recurring_history')}
            </Text>
            <Ionicons
              name={showHistory ? 'chevron-up' : 'chevron-down'}
              size={16}
              color={p.muted}
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
    borderRadius: ms(24),
    paddingHorizontal: ms(16),
    paddingTop: ms(10),
    paddingBottom: ms(14),
    shadowOffset: { width: 0, height: ms(2) },
    shadowOpacity: 1,
    shadowRadius: ms(10),
    elevation: 1,
  },
  topRow: { flexDirection: 'row', alignItems: 'center', gap: ms(6) },
  name: { flex: 1, minWidth: 0, fontSize: mf(14.5), ...font.bold },
  menuBtn: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
    marginEnd: ms(-10),
  },
  answerRow: { flexDirection: 'row', alignItems: 'flex-start', gap: ms(10) },
  answerText: { flex: 1, minWidth: 0 },
  answer: { fontSize: mf(30), lineHeight: mf(34), letterSpacing: -1 },
  meta: { fontSize: mf(13.5), ...font.medium, marginTop: ms(4) },
  art: { marginTop: ms(-4) },
  note: { fontSize: mf(22), lineHeight: mf(25), marginTop: ms(8) },
  coverage: { fontSize: mf(13), ...font.medium, marginTop: ms(2) },
  actionsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: ms(14),
    marginTop: ms(14),
  },
  textBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: ms(4),
    minHeight: 44,
    paddingHorizontal: ms(4),
  },
  textBtnText: { fontSize: mf(15), ...font.bold },
  error: { fontSize: mf(14), ...font.medium, marginTop: ms(8) },
  empty: { fontSize: mf(13), ...font.regular, marginTop: ms(12) },
});
