import { useState, useCallback, useMemo } from 'react';
import { View, StyleSheet, ScrollView, Pressable, TextInput, Modal } from 'react-native';
import { Text } from 'react-native-paper';
import { useTranslation } from 'react-i18next';
import { Ionicons } from '@expo/vector-icons';
import {
  useRecurringBillsStore,
  calculateFairness,
  getLastPayment,
  getNextDueDate,
  BILL_ICONS,
  resolveBillIcon,
  type RecurringBill,
  type HouseholdPayment,
  type BillFrequency,
} from '@stores/recurringBillsStore';
import { useAuthStore } from '@stores/authStore';
import { useHousematesStore } from '@stores/housematesStore';
import { useMemberName } from '@hooks/useMemberName';
import { useSettingsStore } from '@stores/settingsStore';
import { DatePickerModal } from '@components/bills/DatePickerModal';
import { useThemedColors } from '@constants/colors';
import { sizes } from '@constants/sizes';
import { font } from '@constants/typography';
import { getErrorMessage } from '@utils/errors';
import { formatDateDDMMYYYY } from '@utils/dates';

import { mf, ms } from '@utils/responsive';
const FREQUENCIES: BillFrequency[] = ['monthly', 'bimonthly', 'quarterly'];

// icon name → i18n key, so the picker labels localize with the rest of the app.
const BILL_ICON_LABEL_KEYS: Record<string, string> = {
  'business-outline': 'bills.icon_tax',
  'flash-outline': 'bills.icon_electric',
  'water-outline': 'bills.icon_water',
  'flame-outline': 'bills.icon_gas',
  'wifi-outline': 'bills.icon_internet',
  business: 'bills.icon_building',
  'home-outline': 'bills.icon_rent',
  'receipt-outline': 'bills.icon_other',
  'thermometer-outline': 'bills.icon_heating',
  'trash-outline': 'bills.icon_waste',
};

function dueBadge(
  nextDue: string | null,
  tone: { secondary: string; danger: string; warning: string }
): { key: string; params?: Record<string, string | number>; color: string } | null {
  if (!nextDue) return null;
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const due = new Date(nextDue + 'T00:00:00');
  const diff = Math.round((due.getTime() - today.getTime()) / 86400000);
  if (diff < 0)
    return { key: 'bills.household_overdue', params: { n: Math.abs(diff) }, color: tone.danger };
  if (diff === 0) return { key: 'bills.household_due_today', color: tone.danger };
  if (diff <= 7) return { key: 'bills.household_due_in', params: { n: diff }, color: tone.warning };
  return { key: 'bills.household_due_in', params: { n: diff }, color: tone.secondary };
}

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

// ── Payment history row ─────────────────────────────────────────────────────────

interface HousemateOption {
  id: string;
  name: string;
}

/** One logged payment in a bill's history — read-only row; pencil or long-press opens an edit popup. */
function PaymentHistoryRow({
  payment,
  housemates,
  currency,
  onDelete,
}: {
  payment: HouseholdPayment;
  housemates: HousemateOption[];
  currency: string;
  onDelete: (id: string) => void;
}): React.JSX.Element {
  const { t } = useTranslation();
  const c = useThemedColors();
  const updatePayment = useRecurringBillsStore((s) => s.updatePayment);

  const memberIds = useMemo(() => housemates.map((m) => m.id), [housemates]);
  const [editing, setEditing] = useState(false);
  const [amount, setAmount] = useState(String(payment.amount));
  const [date, setDate] = useState(payment.paidAt);
  const [note, setNote] = useState(payment.note);
  const [splitWith, setSplitWith] = useState<string[]>(
    payment.splitBetween && payment.splitBetween.length > 0 ? payment.splitBetween : memberIds
  );
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);

  const parsedAmount = parseFloat(amount.replace(',', '.'));
  const isSaveDisabled =
    saving || !amount || isNaN(parsedAmount) || parsedAmount <= 0 || splitWith.length === 0;

  const startEditing = useCallback((): void => {
    // Reset the form to the current payment values whenever it opens.
    setAmount(String(payment.amount));
    setDate(payment.paidAt);
    setNote(payment.note);
    setSplitWith(
      payment.splitBetween && payment.splitBetween.length > 0 ? payment.splitBetween : memberIds
    );
    setError('');
    setEditing(true);
  }, [payment.amount, payment.paidAt, payment.note, payment.splitBetween, memberIds]);

  const cancelEditing = useCallback((): void => {
    if (saving) return;
    setEditing(false);
  }, [saving]);

  const toggleSplitMember = useCallback((id: string): void => {
    setSplitWith((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]));
  }, []);

  const openDatePicker = useCallback((): void => setShowDatePicker(true), []);
  const closeDatePicker = useCallback((): void => setShowDatePicker(false), []);
  const handleDateSelect = useCallback((val: string): void => {
    setDate(val);
    setShowDatePicker(false);
  }, []);

  const handleSave = useCallback(async (): Promise<void> => {
    if (saving) return;
    const parsed = parseFloat(amount.replace(',', '.'));
    if (!amount || isNaN(parsed) || parsed <= 0) {
      setError(t('bills.enter_valid_amount'));
      return;
    }
    if (splitWith.length === 0) {
      setError(t('bills.household_split_required'));
      return;
    }
    try {
      setSaving(true);
      setError('');
      await updatePayment(payment.id, {
        amount: parsed,
        paidAt: date,
        note,
        splitBetween: splitWith,
      });
      setEditing(false);
    } catch {
      setError(t('bills.failed_save'));
    } finally {
      setSaving(false);
    }
  }, [saving, amount, date, note, splitWith, updatePayment, payment.id, t]);

  const handleDelete = useCallback((): void => onDelete(payment.id), [onDelete, payment.id]);

  return (
    <>
      {/* Read-only row — tap the pencil or long-press the row to edit. */}
      <Pressable
        style={({ pressed }) => [
          styles.historyRow,
          styles.historyRowTappable,
          { borderColor: c.border },
          pressed && { backgroundColor: c.surfaceSecondary },
        ]}
        onLongPress={startEditing}
        delayLongPress={250}
        accessible
        accessibilityRole="button"
        accessibilityLabel={`${formatDateDDMMYYYY(payment.paidAt)} · ${currency}${payment.amount.toFixed(0)}`}
        accessibilityHint={t('bills.edit_payment_hint')}
      >
        <View style={styles.historyMain}>
          <Text style={[styles.historyAmount, { color: c.textPrimary }]}>
            {currency}
            {payment.amount.toFixed(0)}
          </Text>
          <Text style={[styles.historyDate, { color: c.textSecondary }]}>
            {formatDateDDMMYYYY(payment.paidAt)}
          </Text>
          {payment.note ? (
            <Text style={[styles.historyNote, { color: c.textSecondary }]} numberOfLines={1}>
              {payment.note}
            </Text>
          ) : null}
        </View>
        <Pressable
          onPress={startEditing}
          hitSlop={10}
          style={styles.historyIconBtn}
          accessible
          accessibilityRole="button"
          accessibilityLabel={t('bills.edit_payment')}
        >
          <Ionicons name="pencil" size={16} color={c.textSecondary} />
        </Pressable>
        <Pressable
          onPress={handleDelete}
          hitSlop={10}
          style={styles.historyIconBtn}
          accessible
          accessibilityRole="button"
          accessibilityLabel={t('bills.delete_payment')}
        >
          <Ionicons name="trash-outline" size={16} color={c.textSecondary} />
        </Pressable>
      </Pressable>

      {/* Edit popup */}
      <Modal
        visible={editing}
        transparent
        animationType="fade"
        onRequestClose={cancelEditing}
        statusBarTranslucent
      >
        <Pressable style={styles.modalOverlay} onPress={cancelEditing}>
          <Pressable
            style={[styles.modalCard, { backgroundColor: c.surface }]}
            onPress={(e) => e.stopPropagation()}
          >
            <View style={styles.modalHeader}>
              <Text style={[styles.modalTitle, { color: c.textPrimary }]}>
                {t('bills.edit_payment')}
              </Text>
              <Pressable
                onPress={cancelEditing}
                hitSlop={10}
                style={styles.historyIconBtn}
                accessible
                accessibilityRole="button"
                accessibilityLabel={t('common.cancel')}
              >
                <Ionicons name="close" size={20} color={c.textSecondary} />
              </Pressable>
            </View>

            <ScrollView
              style={styles.modalScroll}
              contentContainerStyle={styles.modalScrollContent}
              keyboardShouldPersistTaps="handled"
            >
              <Text style={[styles.fieldLabel, { color: c.textSecondary }]}>
                {t('bills.household_amount')}
              </Text>
              <TextInput
                style={[
                  styles.addInput,
                  { backgroundColor: c.background, borderColor: c.border, color: c.textPrimary },
                ]}
                value={amount}
                onChangeText={setAmount}
                keyboardType="decimal-pad"
                placeholder={t('bills.household_amount')}
                placeholderTextColor={c.textDisabled}
                accessibilityLabel={t('bills.household_amount')}
                accessibilityHint={t('bills.hint_amount_paid')}
              />

              <Text style={[styles.fieldLabel, { color: c.textSecondary }]}>
                {t('bills.select_payment_date')}
              </Text>
              <Pressable
                style={[
                  styles.dateTrigger,
                  { backgroundColor: c.background, borderColor: c.border },
                ]}
                onPress={openDatePicker}
                accessible
                accessibilityRole="button"
                accessibilityLabel={t('bills.select_payment_date')}
              >
                <Ionicons name="calendar-outline" size={16} color={c.primary} />
                <Text style={[styles.dateTriggerText, { color: c.textPrimary }]}>
                  {formatDateDDMMYYYY(date)}
                </Text>
              </Pressable>

              <Text style={[styles.fieldLabel, { color: c.textSecondary }]}>
                {t('bills.household_note')}
              </Text>
              <TextInput
                style={[
                  styles.addInput,
                  { backgroundColor: c.background, borderColor: c.border, color: c.textPrimary },
                ]}
                value={note}
                onChangeText={setNote}
                placeholder={t('bills.household_note')}
                placeholderTextColor={c.textDisabled}
                accessibilityLabel={t('bills.household_note')}
                accessibilityHint={t('bills.hint_optional_note')}
              />

              {housemates.length > 0 && (
                <>
                  <Text style={[styles.fieldLabel, { color: c.textSecondary }]}>
                    {t('bills.household_split_between')}
                  </Text>
                  <View style={styles.chipRow}>
                    {housemates.map((m) => {
                      const selected = splitWith.includes(m.id);
                      return (
                        <Pressable
                          key={m.id}
                          style={[
                            styles.chip,
                            { borderColor: c.border, backgroundColor: c.surface },
                            selected && { backgroundColor: c.primary, borderColor: c.primary },
                          ]}
                          onPress={() => toggleSplitMember(m.id)}
                          accessible
                          accessibilityRole="checkbox"
                          accessibilityLabel={m.name}
                          accessibilityState={{ checked: selected }}
                        >
                          <Text
                            style={[styles.chipText, { color: selected ? '#fff' : c.textPrimary }]}
                          >
                            {m.name}
                          </Text>
                        </Pressable>
                      );
                    })}
                  </View>
                </>
              )}

              {!!error && <Text style={[styles.formError, { color: c.negative }]}>{error}</Text>}
            </ScrollView>

            <View style={styles.addFormActions}>
              <Pressable
                style={[styles.cancelBtn, { borderColor: c.border }]}
                onPress={cancelEditing}
                disabled={saving}
                accessible
                accessibilityRole="button"
                accessibilityLabel={t('common.cancel')}
                accessibilityState={{ disabled: saving }}
              >
                <Text style={[styles.cancelBtnText, { color: c.textSecondary }]}>
                  {t('common.cancel')}
                </Text>
              </Pressable>
              <Pressable
                style={[
                  styles.saveBtn,
                  { backgroundColor: isSaveDisabled ? c.textDisabled : c.primary },
                ]}
                onPress={handleSave}
                disabled={isSaveDisabled}
                accessible
                accessibilityRole="button"
                accessibilityLabel={
                  saving ? t('bills.household_saving') : t('bills.household_save_changes')
                }
                accessibilityState={{ disabled: isSaveDisabled }}
              >
                <Text style={styles.saveBtnText}>
                  {saving ? t('bills.household_saving') : t('bills.household_save_changes')}
                </Text>
              </Pressable>
            </View>
          </Pressable>
        </Pressable>

        <DatePickerModal
          visible={showDatePicker}
          value={date}
          onSelect={handleDateSelect}
          onClose={closeDatePicker}
        />
      </Modal>
    </>
  );
}

// ── Bill card ─────────────────────────────────────────────────────────────────

function BillCard({ bill }: { bill: RecurringBill }): React.JSX.Element {
  const { t } = useTranslation();
  const c = useThemedColors();
  const payments = useRecurringBillsStore((s) => s.payments);
  const logPayment = useRecurringBillsStore((s) => s.logPayment);
  const deleteBill = useRecurringBillsStore((s) => s.deleteBill);
  const deletePayment = useRecurringBillsStore((s) => s.deletePayment);
  const houseId = useAuthStore((s) => s.houseId);
  const profile = useAuthStore((s) => s.profile);
  const housemates = useHousematesStore((s) => s.housemates);
  const memberName = useMemberName();
  const currency = useSettingsStore((s) => s.currency);

  const people = useMemo(
    () =>
      [
        profile ? { id: profile.id, name: profile.name ?? '' } : null,
        ...housemates.map((h) => ({ id: h.id, name: h.name })),
      ]
        .filter((p): p is PersonOption => Boolean(p?.id && p?.name))
        .filter((p, i, arr) => arr.findIndex((q) => q.id === p.id) === i),
    [profile, housemates]
  );

  const todayStr = ((): string => {
    const d = new Date();
    const pad = (n: number): string => String(n).padStart(2, '0');
    return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
  })();
  const [logging, setLogging] = useState(false);
  const [isSubmittingLog, setIsSubmittingLog] = useState(false);
  const [amount, setAmount] = useState(String(bill.typicalAmount));
  const [date, setDate] = useState(todayStr);
  const [note, setNote] = useState('');
  const [splitWith, setSplitWith] = useState<string[]>([]);
  const [cardError, setCardError] = useState('');
  const [showHistory, setShowHistory] = useState(false);
  const [showLogDatePicker, setShowLogDatePicker] = useState(false);
  const [editing, setEditing] = useState(false);

  const memberIds = useMemo(() => housemates.map((m) => m.id), [housemates]);

  const last = getLastPayment(bill.id, payments);
  const nextDue = getNextDueDate(bill, payments);
  const badge = dueBadge(nextDue, {
    secondary: c.textSecondary,
    danger: c.danger,
    warning: c.warning,
  });
  const billPayments = payments
    .filter((p) => p.billId === bill.id)
    .sort((a, b) => b.paidAt.localeCompare(a.paidAt));
  const parsedLogAmount = parseFloat(amount.replace(',', '.'));
  const isLogDisabled =
    !houseId ||
    !amount ||
    isNaN(parsedLogAmount) ||
    parsedLogAmount <= 0 ||
    isSubmittingLog ||
    splitWith.length === 0;

  const handleLog = useCallback(async (): Promise<void> => {
    if (isSubmittingLog) return;
    const parsed = parseFloat(amount.replace(',', '.'));
    if (!amount || isNaN(parsed) || parsed <= 0) {
      setCardError(t('bills.enter_valid_amount'));
      return;
    }
    if (!houseId) {
      setCardError(t('bills.household_missing'));
      return;
    }
    const split = splitWith.length > 0 ? splitWith : memberIds;
    if (split.length === 0) {
      setCardError(t('bills.household_split_required'));
      return;
    }
    try {
      setIsSubmittingLog(true);
      setCardError('');
      await logPayment(
        { billId: bill.id, amount: parsed, paidAt: date, note, splitBetween: split },
        houseId
      );
      setLogging(false);
      setAmount(String(bill.typicalAmount));
      setDate(todayStr);
      setNote('');
    } catch {
      setCardError(t('bills.failed_save'));
    } finally {
      setIsSubmittingLog(false);
    }
  }, [
    amount,
    date,
    note,
    splitWith,
    memberIds,
    bill.id,
    bill.typicalAmount,
    logPayment,
    houseId,
    todayStr,
    t,
    isSubmittingLog,
  ]);

  const handleDeleteBill = useCallback(async (): Promise<void> => {
    try {
      setCardError('');
      await deleteBill(bill.id);
    } catch {
      setCardError(t('bills.failed_delete'));
    }
  }, [deleteBill, bill.id, t]);

  const handleDeletePayment = useCallback(
    async (paymentId: string): Promise<void> => {
      try {
        setCardError('');
        await deletePayment(paymentId);
      } catch {
        setCardError(t('bills.failed_delete'));
      }
    },
    [deletePayment, t]
  );
  const toggleLogging = useCallback((): void => {
    if (isSubmittingLog) return;
    setLogging((v) => !v);
    // Default the split to everyone whenever the form opens.
    if (!logging) setSplitWith(memberIds);
  }, [isSubmittingLog, logging, memberIds]);
  const toggleSplitMember = useCallback((id: string): void => {
    setSplitWith((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]));
  }, []);
  const toggleShowHistory = useCallback((): void => setShowHistory((v) => !v), []);
  const startEditing = useCallback((): void => {
    setLogging(false);
    setEditing(true);
  }, []);
  const stopEditing = useCallback((): void => setEditing(false), []);
  const openLogDatePicker = useCallback((): void => setShowLogDatePicker(true), []);
  const closeLogDatePicker = useCallback((): void => setShowLogDatePicker(false), []);
  const handleLogDateSelect = useCallback((val: string): void => {
    setDate(val);
    setShowLogDatePicker(false);
  }, []);

  return (
    <View style={[styles.billCard, { backgroundColor: c.surface, borderColor: c.border }]}>
      {/* Header row */}
      <View style={styles.billHeader}>
        <View style={styles.billIcon}>
          <Ionicons name={resolveBillIcon(bill.icon)} size={24} color={c.primary} />
        </View>
        <View style={styles.billHeaderInfo}>
          <Text style={[styles.billName, { color: c.textPrimary }]}>{bill.name}</Text>
          <View style={styles.billMeta}>
            <View style={[styles.metaChip, { backgroundColor: c.primary + '20' }]}>
              <Text style={[styles.metaChipText, { color: c.primary }]}>
                {memberName(bill.assignedTo)}
              </Text>
            </View>
            <View style={[styles.metaChip, { backgroundColor: c.primary + '20' }]}>
              <Text style={[styles.metaChipText, { color: c.primary }]}>
                {t(`bills.freq_${bill.frequency}`)}
              </Text>
            </View>
            <Text style={[styles.typicalAmount, { color: c.textSecondary }]}>
              ~{currency}
              {bill.typicalAmount}
            </Text>
          </View>
        </View>
        <Pressable
          onPress={startEditing}
          style={styles.deleteBtn}
          accessibilityRole="button"
          accessibilityLabel={t('bills.edit_bill')}
          accessibilityState={{ selected: editing }}
          hitSlop={8}
        >
          <Ionicons name="pencil" size={16} color={c.textSecondary} />
        </Pressable>
        <Pressable
          onPress={handleDeleteBill}
          style={styles.deleteBtn}
          accessibilityRole="button"
          accessibilityLabel={t('bills.delete_bill')}
          hitSlop={8}
        >
          <Ionicons name="close" size={16} color={c.textSecondary} />
        </Pressable>
      </View>

      {editing ? (
        <EditBillForm bill={bill} people={people} onClose={stopEditing} />
      ) : (
        <>
          {/* Last payment + due date */}
          <View style={styles.billStatus}>
            {last ? (
              <Text style={[styles.lastPaid, { color: c.textSecondary }]}>
                {t('bills.household_last_paid')} {formatDateDDMMYYYY(last.paidAt)} · {currency}
                {last.amount.toFixed(0)}
              </Text>
            ) : (
              <Text style={[styles.neverPaid, { color: c.textDisabled }]}>
                {t('bills.household_no_payments')}
              </Text>
            )}
            {badge && (
              <View style={[styles.dueBadge, { backgroundColor: badge.color + '18' }]}>
                <Text style={[styles.dueBadgeText, { color: badge.color }]}>
                  {t(badge.key, badge.params)}
                </Text>
              </View>
            )}
          </View>

          {/* Actions */}
          <View style={styles.billActions}>
            <Pressable
              style={[styles.logBtn, { backgroundColor: c.primary + '20' }]}
              onPress={toggleLogging}
              disabled={isSubmittingLog}
              accessible
              accessibilityRole="button"
              accessibilityLabel={logging ? t('common.cancel') : t('bills.household_log_payment')}
              accessibilityState={{ selected: logging, disabled: isSubmittingLog }}
            >
              <Text style={[styles.logBtnText, { color: c.primary }]}>
                {logging ? t('common.cancel') : t('bills.household_log_payment')}
              </Text>
            </Pressable>
            {billPayments.length > 0 && (
              <Pressable
                onPress={toggleShowHistory}
                accessible
                accessibilityRole="button"
                accessibilityLabel={t('bills.household_history')}
                accessibilityState={{ expanded: showHistory }}
              >
                <Text style={[styles.historyLink, { color: c.textSecondary }]}>
                  {showHistory
                    ? t('bills.household_hide_history')
                    : `${t('bills.household_history')} (${billPayments.length})`}
                </Text>
              </Pressable>
            )}
          </View>

          {!!cardError && (
            <Text style={[styles.formError, { color: c.negative }]}>{cardError}</Text>
          )}

          {/* Log payment inline form */}
          {logging && (
            <View style={[styles.logForm, { borderTopColor: c.border }]}>
              <View style={styles.logRow}>
                <TextInput
                  style={[
                    styles.logAmountInput,
                    { backgroundColor: c.background, borderColor: c.border, color: c.textPrimary },
                  ]}
                  value={amount}
                  onChangeText={setAmount}
                  keyboardType="decimal-pad"
                  placeholder={t('bills.household_amount')}
                  placeholderTextColor={c.textDisabled}
                  accessibilityLabel={t('bills.household_amount')}
                  accessibilityHint={t('bills.hint_amount_paid')}
                />
                <Pressable
                  style={[
                    styles.dateTrigger,
                    { backgroundColor: c.background, borderColor: c.border },
                  ]}
                  onPress={openLogDatePicker}
                  accessible
                  accessibilityRole="button"
                  accessibilityLabel={t('bills.select_payment_date')}
                >
                  <Ionicons name="calendar-outline" size={15} color={c.primary} />
                  <Text style={[styles.dateTriggerText, { color: c.textPrimary }]}>
                    {formatDateDDMMYYYY(date)}
                  </Text>
                </Pressable>
              </View>
              <DatePickerModal
                visible={showLogDatePicker}
                value={date}
                onSelect={handleLogDateSelect}
                onClose={closeLogDatePicker}
              />
              <TextInput
                style={[
                  styles.logNoteInput,
                  { backgroundColor: c.background, borderColor: c.border, color: c.textPrimary },
                ]}
                value={note}
                onChangeText={setNote}
                placeholder={t('bills.household_note')}
                placeholderTextColor={c.textDisabled}
                accessibilityLabel={t('bills.household_note')}
                accessibilityHint={t('bills.hint_optional_note')}
              />

              {/* Who shares this payment (defaults to everyone) */}
              {housemates.length > 0 && (
                <>
                  <Text style={[styles.splitLabel, { color: c.textSecondary }]}>
                    {t('bills.household_split_between')}
                  </Text>
                  <View style={styles.chipRow}>
                    {housemates.map((m) => {
                      const selected = splitWith.includes(m.id);
                      return (
                        <Pressable
                          key={m.id}
                          style={[
                            styles.chip,
                            { borderColor: c.border, backgroundColor: c.surface },
                            selected && { backgroundColor: c.primary, borderColor: c.primary },
                          ]}
                          onPress={() => toggleSplitMember(m.id)}
                          accessible
                          accessibilityRole="checkbox"
                          accessibilityLabel={m.name}
                          accessibilityState={{ checked: selected }}
                        >
                          <Text
                            style={[styles.chipText, { color: selected ? '#fff' : c.textPrimary }]}
                          >
                            {m.name}
                          </Text>
                        </Pressable>
                      );
                    })}
                  </View>
                </>
              )}

              <Pressable
                style={[
                  styles.savePaymentBtn,
                  { backgroundColor: isLogDisabled ? c.textDisabled : c.primary },
                ]}
                onPress={handleLog}
                disabled={isLogDisabled}
                accessible
                accessibilityRole="button"
                accessibilityLabel={t('bills.household_save_payment')}
                accessibilityState={{ disabled: isLogDisabled }}
              >
                <Text style={styles.savePaymentBtnText}>{t('bills.household_save_payment')}</Text>
              </Pressable>
            </View>
          )}

          {/* Payment history */}
          {showHistory && (
            <View style={[styles.history, { borderTopColor: c.border }]}>
              {billPayments.map((p) => (
                <PaymentHistoryRow
                  key={p.id}
                  payment={p}
                  housemates={housemates}
                  currency={currency}
                  onDelete={handleDeletePayment}
                />
              ))}
            </View>
          )}
        </>
      )}
    </View>
  );
}

// ── Add bill form ─────────────────────────────────────────────────────────────

interface PersonOption {
  id: string;
  name: string;
}

function AddBillForm({
  people,
  onClose,
}: {
  people: PersonOption[];
  onClose: () => void;
}): React.JSX.Element {
  const { t } = useTranslation();
  const c = useThemedColors();
  const addBill = useRecurringBillsStore((s) => s.addBill);
  const logPayment = useRecurringBillsStore((s) => s.logPayment);
  const houseId = useAuthStore((s) => s.houseId);
  const [name, setName] = useState('');
  const [assignedTo, setAssignedTo] = useState(people[0]?.id ?? '');
  const [frequency, setFrequency] = useState<BillFrequency>('monthly');
  const [typicalAmount, setTypicalAmount] = useState('');
  const [icon, setIcon] = useState(BILL_ICONS[0]);
  const [lastPaidDate, setLastPaidDate] = useState('');
  const [showAddDatePicker, setShowAddDatePicker] = useState(false);
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);

  const handleSave = useCallback(async (): Promise<void> => {
    if (saving) return;
    if (!name.trim()) {
      setError(t('bills.household_name_required'));
      return;
    }
    const amt = parseFloat(typicalAmount.replace(',', '.'));
    if (!typicalAmount || isNaN(amt) || amt <= 0) {
      setError(t('bills.household_invalid_amount'));
      return;
    }
    if (!assignedTo) {
      setError(t('bills.household_assignee_required'));
      return;
    }
    if (!houseId) {
      setError(t('bills.household_missing'));
      return;
    }
    try {
      setSaving(true);
      const newBill = await addBill(
        { name: name.trim(), assignedTo, frequency, typicalAmount: amt, icon },
        houseId
      );
      if (lastPaidDate) {
        await logPayment(
          { billId: newBill.id, amount: amt, paidAt: lastPaidDate, note: '' },
          houseId
        );
      }
      onClose();
    } catch (err) {
      setError(getErrorMessage(err, t('bills.failed_save')));
    } finally {
      setSaving(false);
    }
  }, [
    name,
    assignedTo,
    frequency,
    typicalAmount,
    icon,
    lastPaidDate,
    addBill,
    logPayment,
    houseId,
    onClose,
    t,
    saving,
  ]);

  const handleCancel = useCallback((): void => {
    if (saving) return;
    onClose();
  }, [saving, onClose]);

  const openAddDatePicker = useCallback((): void => setShowAddDatePicker(true), []);
  const closeAddDatePicker = useCallback((): void => setShowAddDatePicker(false), []);
  const handleAddDateSelect = useCallback((val: string): void => {
    setLastPaidDate(val);
    setShowAddDatePicker(false);
  }, []);

  const isSaveDisabled =
    saving ||
    !houseId ||
    !name.trim() ||
    !assignedTo ||
    !(parseFloat(typicalAmount.replace(',', '.')) > 0);

  return (
    <View style={[styles.addForm, { backgroundColor: c.surface, borderColor: c.border }]}>
      <Text style={[styles.addFormTitle, { color: c.textPrimary }]}>
        {t('bills.household_new_recurring')}
      </Text>

      {/* Icon picker */}
      <Text style={[styles.fieldLabel, { color: c.textSecondary }]}>
        {t('bills.household_icon')}
      </Text>
      <View style={styles.iconRow}>
        {BILL_ICONS.map((ic) => (
          <Pressable
            key={ic}
            style={[
              styles.iconChip,
              { backgroundColor: c.surfaceSecondary, borderColor: 'transparent' },
              icon === ic && { borderColor: c.primary, backgroundColor: c.primary + '18' },
            ]}
            onPress={() => setIcon(ic)}
            accessible
            accessibilityRole="radio"
            accessibilityLabel={BILL_ICON_LABEL_KEYS[ic] ? t(BILL_ICON_LABEL_KEYS[ic]) : ic}
            accessibilityState={{ selected: icon === ic }}
          >
            <Ionicons name={ic} size={20} color={icon === ic ? c.primary : c.textSecondary} />
            <Text
              style={[styles.iconChipLabel, { color: icon === ic ? c.primary : c.textSecondary }]}
            >
              {BILL_ICON_LABEL_KEYS[ic] ? t(BILL_ICON_LABEL_KEYS[ic]) : ''}
            </Text>
          </Pressable>
        ))}
      </View>

      {/* Name */}
      <Text style={[styles.fieldLabel, { color: c.textSecondary }]}>
        {t('bills.household_bill_name')}
      </Text>
      <TextInput
        style={[
          styles.addInput,
          { backgroundColor: c.background, borderColor: c.border, color: c.textPrimary },
        ]}
        value={name}
        onChangeText={setName}
        placeholder={t('bills.household_bill_name_placeholder')}
        placeholderTextColor={c.textDisabled}
        autoCorrect={false}
        accessibilityLabel={t('bills.household_bill_name')}
        accessibilityHint={t('bills.hint_bill_name')}
      />

      {/* Assigned to */}
      <Text style={[styles.fieldLabel, { color: c.textSecondary }]}>
        {t('bills.household_who_pays')}
      </Text>
      <View style={styles.chipRow}>
        {people.map((p) => (
          <Pressable
            key={p.id}
            style={[
              styles.chip,
              { borderColor: c.border, backgroundColor: c.surface },
              assignedTo === p.id && { backgroundColor: c.primary, borderColor: c.primary },
            ]}
            onPress={() => setAssignedTo(p.id)}
            accessible
            accessibilityRole="radio"
            accessibilityLabel={p.name}
            accessibilityState={{ selected: assignedTo === p.id }}
          >
            <Text
              style={[styles.chipText, { color: assignedTo === p.id ? '#fff' : c.textPrimary }]}
            >
              {p.name}
            </Text>
          </Pressable>
        ))}
      </View>

      {/* Frequency */}
      <Text style={[styles.fieldLabel, { color: c.textSecondary }]}>
        {t('bills.household_how_often')}
      </Text>
      <View style={styles.chipRow}>
        {FREQUENCIES.map((f) => (
          <Pressable
            key={f}
            style={[
              styles.chip,
              { borderColor: c.border, backgroundColor: c.surface },
              frequency === f && { backgroundColor: c.primary, borderColor: c.primary },
            ]}
            onPress={() => setFrequency(f)}
            accessible
            accessibilityRole="radio"
            accessibilityLabel={t(`bills.freq_${f}`)}
            accessibilityState={{ selected: frequency === f }}
          >
            <Text style={[styles.chipText, { color: frequency === f ? '#fff' : c.textPrimary }]}>
              {t(`bills.freq_${f}`)}
            </Text>
          </Pressable>
        ))}
      </View>

      {/* Typical amount */}
      <Text style={[styles.fieldLabel, { color: c.textSecondary }]}>
        {t('bills.household_typical_amount')}
      </Text>
      <TextInput
        style={[
          styles.addInput,
          { backgroundColor: c.background, borderColor: c.border, color: c.textPrimary },
        ]}
        value={typicalAmount}
        onChangeText={setTypicalAmount}
        keyboardType="decimal-pad"
        placeholder="0"
        placeholderTextColor={c.textDisabled}
        accessibilityLabel={t('bills.household_typical_amount')}
        accessibilityHint={t('bills.hint_typical_amount')}
      />

      {/* Last paid date */}
      <Text style={[styles.fieldLabel, { color: c.textSecondary }]}>
        {t('bills.household_last_paid_label')}
      </Text>
      <Text style={[styles.fieldHint, { color: c.textDisabled }]}>
        {t('bills.household_last_paid_help')}
      </Text>
      <Pressable
        style={[styles.dateTrigger, { backgroundColor: c.background, borderColor: c.border }]}
        onPress={openAddDatePicker}
        accessible
        accessibilityRole="button"
        accessibilityLabel={t('bills.select_last_paid_date')}
      >
        <Ionicons name="calendar-outline" size={16} color={c.primary} />
        <Text
          style={[styles.dateTriggerText, { color: lastPaidDate ? c.textPrimary : c.textDisabled }]}
        >
          {lastPaidDate ? formatDateDDMMYYYY(lastPaidDate) : t('bills.household_tap_select_date')}
        </Text>
      </Pressable>
      <DatePickerModal
        visible={showAddDatePicker}
        value={lastPaidDate}
        onSelect={handleAddDateSelect}
        onClose={closeAddDatePicker}
      />

      {!!error && <Text style={[styles.formError, { color: c.negative }]}>{error}</Text>}

      <View style={styles.addFormActions}>
        <Pressable
          style={[styles.cancelBtn, { borderColor: c.border }]}
          onPress={handleCancel}
          disabled={saving}
          accessible
          accessibilityRole="button"
          accessibilityLabel={t('common.cancel')}
          accessibilityState={{ disabled: saving }}
        >
          <Text style={[styles.cancelBtnText, { color: c.textSecondary }]}>
            {t('common.cancel')}
          </Text>
        </Pressable>
        <Pressable
          style={[styles.saveBtn, { backgroundColor: isSaveDisabled ? c.textDisabled : c.primary }]}
          onPress={handleSave}
          disabled={isSaveDisabled}
          accessible
          accessibilityRole="button"
          accessibilityLabel={saving ? t('bills.household_saving') : t('bills.household_add_bill')}
          accessibilityState={{ disabled: isSaveDisabled }}
        >
          <Text style={styles.saveBtnText}>
            {saving ? t('bills.household_saving') : t('bills.household_add_bill')}
          </Text>
        </Pressable>
      </View>
    </View>
  );
}

// ── Edit bill form ────────────────────────────────────────────────────────────

function EditBillForm({
  bill,
  people,
  onClose,
}: {
  bill: RecurringBill;
  people: PersonOption[];
  onClose: () => void;
}): React.JSX.Element {
  const { t } = useTranslation();
  const c = useThemedColors();
  const updateBill = useRecurringBillsStore((s) => s.updateBill);
  const [name, setName] = useState(bill.name);
  const [assignedTo, setAssignedTo] = useState(bill.assignedTo);
  const [frequency, setFrequency] = useState<BillFrequency>(bill.frequency);
  const [typicalAmount, setTypicalAmount] = useState(String(bill.typicalAmount));
  const [icon, setIcon] = useState(resolveBillIcon(bill.icon));
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);

  const handleSave = useCallback(async (): Promise<void> => {
    if (saving) return;
    if (!name.trim()) {
      setError(t('bills.household_name_required'));
      return;
    }
    const amt = parseFloat(typicalAmount.replace(',', '.'));
    if (!typicalAmount || isNaN(amt) || amt <= 0) {
      setError(t('bills.household_invalid_amount'));
      return;
    }
    if (!assignedTo) {
      setError(t('bills.household_assignee_required'));
      return;
    }
    try {
      setSaving(true);
      await updateBill(bill.id, {
        name: name.trim(),
        assignedTo,
        frequency,
        typicalAmount: amt,
        icon,
      });
      onClose();
    } catch (err) {
      setError(getErrorMessage(err, t('bills.failed_save')));
    } finally {
      setSaving(false);
    }
  }, [name, assignedTo, frequency, typicalAmount, icon, updateBill, bill.id, onClose, t, saving]);

  const handleCancel = useCallback((): void => {
    if (saving) return;
    onClose();
  }, [saving, onClose]);

  const isSaveDisabled =
    saving || !name.trim() || !assignedTo || !(parseFloat(typicalAmount.replace(',', '.')) > 0);

  return (
    <View style={[styles.addForm, { backgroundColor: c.surface, borderColor: c.border }]}>
      <Text style={[styles.addFormTitle, { color: c.textPrimary }]}>
        {t('bills.household_edit_bill')}
      </Text>

      {/* Icon picker */}
      <Text style={[styles.fieldLabel, { color: c.textSecondary }]}>
        {t('bills.household_icon')}
      </Text>
      <View style={styles.iconRow}>
        {BILL_ICONS.map((ic) => (
          <Pressable
            key={ic}
            style={[
              styles.iconChip,
              { backgroundColor: c.surfaceSecondary, borderColor: 'transparent' },
              icon === ic && { borderColor: c.primary, backgroundColor: c.primary + '18' },
            ]}
            onPress={() => setIcon(ic)}
            accessible
            accessibilityRole="radio"
            accessibilityLabel={BILL_ICON_LABEL_KEYS[ic] ? t(BILL_ICON_LABEL_KEYS[ic]) : ic}
            accessibilityState={{ selected: icon === ic }}
          >
            <Ionicons name={ic} size={20} color={icon === ic ? c.primary : c.textSecondary} />
            <Text
              style={[styles.iconChipLabel, { color: icon === ic ? c.primary : c.textSecondary }]}
            >
              {BILL_ICON_LABEL_KEYS[ic] ? t(BILL_ICON_LABEL_KEYS[ic]) : ''}
            </Text>
          </Pressable>
        ))}
      </View>

      {/* Name */}
      <Text style={[styles.fieldLabel, { color: c.textSecondary }]}>
        {t('bills.household_bill_name')}
      </Text>
      <TextInput
        style={[
          styles.addInput,
          { backgroundColor: c.background, borderColor: c.border, color: c.textPrimary },
        ]}
        value={name}
        onChangeText={setName}
        placeholder={t('bills.household_bill_name_placeholder')}
        placeholderTextColor={c.textDisabled}
        autoCorrect={false}
        accessibilityLabel={t('bills.household_bill_name')}
        accessibilityHint={t('bills.hint_bill_name')}
      />

      {/* Assigned to */}
      <Text style={[styles.fieldLabel, { color: c.textSecondary }]}>
        {t('bills.household_who_pays')}
      </Text>
      <View style={styles.chipRow}>
        {people.map((p) => (
          <Pressable
            key={p.id}
            style={[
              styles.chip,
              { borderColor: c.border, backgroundColor: c.surface },
              assignedTo === p.id && { backgroundColor: c.primary, borderColor: c.primary },
            ]}
            onPress={() => setAssignedTo(p.id)}
            accessible
            accessibilityRole="radio"
            accessibilityLabel={p.name}
            accessibilityState={{ selected: assignedTo === p.id }}
          >
            <Text
              style={[styles.chipText, { color: assignedTo === p.id ? '#fff' : c.textPrimary }]}
            >
              {p.name}
            </Text>
          </Pressable>
        ))}
      </View>

      {/* Frequency */}
      <Text style={[styles.fieldLabel, { color: c.textSecondary }]}>
        {t('bills.household_how_often')}
      </Text>
      <View style={styles.chipRow}>
        {FREQUENCIES.map((f) => (
          <Pressable
            key={f}
            style={[
              styles.chip,
              { borderColor: c.border, backgroundColor: c.surface },
              frequency === f && { backgroundColor: c.primary, borderColor: c.primary },
            ]}
            onPress={() => setFrequency(f)}
            accessible
            accessibilityRole="radio"
            accessibilityLabel={t(`bills.freq_${f}`)}
            accessibilityState={{ selected: frequency === f }}
          >
            <Text style={[styles.chipText, { color: frequency === f ? '#fff' : c.textPrimary }]}>
              {t(`bills.freq_${f}`)}
            </Text>
          </Pressable>
        ))}
      </View>

      {/* Typical amount */}
      <Text style={[styles.fieldLabel, { color: c.textSecondary }]}>
        {t('bills.household_typical_amount')}
      </Text>
      <TextInput
        style={[
          styles.addInput,
          { backgroundColor: c.background, borderColor: c.border, color: c.textPrimary },
        ]}
        value={typicalAmount}
        onChangeText={setTypicalAmount}
        keyboardType="decimal-pad"
        placeholder="0"
        placeholderTextColor={c.textDisabled}
        accessibilityLabel={t('bills.household_typical_amount')}
        accessibilityHint={t('bills.hint_typical_amount')}
      />

      {!!error && <Text style={[styles.formError, { color: c.negative }]}>{error}</Text>}

      <View style={styles.addFormActions}>
        <Pressable
          style={[styles.cancelBtn, { borderColor: c.border }]}
          onPress={handleCancel}
          disabled={saving}
          accessible
          accessibilityRole="button"
          accessibilityLabel={t('common.cancel')}
          accessibilityState={{ disabled: saving }}
        >
          <Text style={[styles.cancelBtnText, { color: c.textSecondary }]}>
            {t('common.cancel')}
          </Text>
        </Pressable>
        <Pressable
          style={[styles.saveBtn, { backgroundColor: isSaveDisabled ? c.textDisabled : c.primary }]}
          onPress={handleSave}
          disabled={isSaveDisabled}
          accessible
          accessibilityRole="button"
          accessibilityLabel={
            saving ? t('bills.household_saving') : t('bills.household_save_changes')
          }
          accessibilityState={{ disabled: isSaveDisabled }}
        >
          <Text style={styles.saveBtnText}>
            {saving ? t('bills.household_saving') : t('bills.household_save_changes')}
          </Text>
        </Pressable>
      </View>
    </View>
  );
}

// ── Main tab ──────────────────────────────────────────────────────────────────

export function HouseholdTab(): React.JSX.Element {
  const { t } = useTranslation();
  const c = useThemedColors();
  const bills = useRecurringBillsStore((s) => s.bills);
  const profile = useAuthStore((s) => s.profile);
  const housemates = useHousematesStore((s) => s.housemates);
  const [showAddForm, setShowAddForm] = useState(false);

  const openAddForm = useCallback((): void => setShowAddForm(true), []);
  const closeAddForm = useCallback((): void => setShowAddForm(false), []);

  const allPeople = [
    profile ? { id: profile.id, name: profile.name ?? '' } : null,
    ...housemates.map((h) => ({ id: h.id, name: h.name })),
  ]
    .filter((p): p is { id: string; name: string } => Boolean(p?.id && p?.name))
    .filter((p, i, arr) => arr.findIndex((q) => q.id === p.id) === i);

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

      {bills.map((bill) => (
        <BillCard key={bill.id} bill={bill} />
      ))}

      {showAddForm ? (
        <AddBillForm people={allPeople} onClose={closeAddForm} />
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
  content: { padding: sizes.lg, paddingBottom: ms(60), gap: sizes.sm },

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

  // Bill card
  billCard: { borderRadius: sizes.borderRadius, borderWidth: 1, padding: sizes.md, gap: sizes.sm },
  billHeader: { flexDirection: 'row', alignItems: 'flex-start', gap: sizes.sm },
  billIcon: { width: ms(32), alignItems: 'center', paddingTop: ms(2) },
  billHeaderInfo: { flex: 1, gap: ms(4) },
  billName: { fontSize: sizes.fontMd, ...font.bold },
  billMeta: { flexDirection: 'row', alignItems: 'center', gap: sizes.xs, flexWrap: 'wrap' },
  metaChip: {
    borderRadius: sizes.borderRadiusFull,
    paddingHorizontal: sizes.xs,
    paddingVertical: ms(2),
  },
  metaChipText: { fontSize: sizes.fontXs, ...font.semibold },
  typicalAmount: { fontSize: sizes.fontXs },
  deleteBtn: {
    minWidth: ms(44),
    minHeight: ms(44),
    justifyContent: 'center',
    alignItems: 'center',
  },
  billStatus: { flexDirection: 'row', alignItems: 'center', gap: sizes.sm, flexWrap: 'wrap' },
  lastPaid: { fontSize: sizes.fontSm, flex: 1 },
  neverPaid: { fontSize: sizes.fontSm, flex: 1 },
  dueBadge: {
    borderRadius: sizes.borderRadiusFull,
    paddingHorizontal: sizes.sm,
    paddingVertical: ms(3),
  },
  dueBadgeText: { fontSize: sizes.fontXs, ...font.bold },
  billActions: { flexDirection: 'row', alignItems: 'center', gap: sizes.md },
  logBtn: {
    borderRadius: sizes.borderRadiusFull,
    paddingHorizontal: sizes.md,
    paddingVertical: ms(5),
    minHeight: ms(44),
    justifyContent: 'center',
    alignItems: 'center',
  },
  logBtnText: { fontSize: sizes.fontSm, ...font.bold },
  historyLink: { fontSize: sizes.fontSm },

  // Log form
  logForm: { borderTopWidth: 1, paddingTop: sizes.sm, gap: sizes.sm },
  // Stack amount + date vertically (full-width each) so the date can never be
  // squeezed off the row and clipped, whatever react-native-web does with flex.
  logRow: { gap: sizes.sm },
  logAmountInput: {
    borderRadius: sizes.borderRadiusSm,
    borderWidth: 1,
    paddingHorizontal: sizes.sm,
    paddingVertical: sizes.sm,
    fontSize: sizes.fontMd,
  },
  logNoteInput: {
    borderRadius: sizes.borderRadiusSm,
    borderWidth: 1,
    paddingHorizontal: sizes.sm,
    paddingVertical: sizes.sm,
    fontSize: sizes.fontSm,
  },
  splitLabel: {
    fontSize: sizes.fontXs,
    ...font.bold,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  savePaymentBtn: {
    borderRadius: sizes.borderRadius,
    paddingVertical: sizes.sm,
    alignItems: 'center',
  },
  savePaymentBtnText: { color: '#fff', ...font.bold, fontSize: sizes.fontMd },

  // History
  history: { borderTopWidth: 1, paddingTop: sizes.sm, gap: sizes.xs },
  historyRow: { flexDirection: 'row', alignItems: 'center', gap: sizes.xs },
  historyRowTappable: {
    borderWidth: 1,
    borderRadius: sizes.borderRadiusSm,
    paddingVertical: sizes.xs,
    paddingHorizontal: sizes.sm,
    minHeight: ms(44),
  },
  historyMain: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: sizes.sm },
  historyDate: { fontSize: sizes.fontSm },
  historyAmount: { fontSize: sizes.fontMd, ...font.bold, minWidth: ms(56) },
  historyNote: { flex: 1, fontSize: sizes.fontSm, fontStyle: 'italic' },
  historyIconBtn: {
    minWidth: ms(36),
    minHeight: ms(36),
    justifyContent: 'center',
    alignItems: 'center',
  },

  // Edit-payment popup
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.45)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: ms(20),
  },
  modalCard: {
    width: '100%',
    maxWidth: ms(360),
    maxHeight: '85%',
    borderRadius: ms(20),
    padding: sizes.lg,
    gap: sizes.sm,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: ms(12) },
    shadowOpacity: 0.18,
    shadowRadius: 28,
    elevation: 10,
  },
  modalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  modalTitle: { fontSize: sizes.fontLg, ...font.bold },
  modalScroll: { flexGrow: 0 },
  modalScrollContent: { gap: sizes.sm, paddingBottom: sizes.xs },

  // Add form
  addForm: { borderRadius: sizes.borderRadius, borderWidth: 1, padding: sizes.md, gap: sizes.sm },
  addFormTitle: { fontSize: sizes.fontMd, ...font.bold, marginBottom: sizes.xs },
  fieldLabel: {
    fontSize: sizes.fontXs,
    ...font.bold,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  iconRow: { flexDirection: 'row', flexWrap: 'wrap', gap: sizes.xs },
  iconChip: {
    width: ms(56),
    height: ms(56),
    borderRadius: sizes.borderRadiusSm,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 2,
    gap: ms(2),
  },
  iconChipLabel: { fontSize: mf(9), textAlign: 'center' },
  fieldHint: { fontSize: mf(11), marginTop: ms(-2) },
  dateTrigger: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: sizes.sm,
    borderRadius: sizes.borderRadiusSm,
    borderWidth: 1,
    paddingHorizontal: sizes.sm,
    paddingVertical: sizes.sm,
    minHeight: ms(44),
    flexShrink: 0,
  },
  dateTriggerText: { fontSize: sizes.fontSm },
  formError: { fontSize: sizes.fontSm, marginTop: ms(2) },
  addInput: {
    borderRadius: sizes.borderRadiusSm,
    borderWidth: 1,
    paddingHorizontal: sizes.sm,
    paddingVertical: sizes.sm,
    fontSize: sizes.fontMd,
  },
  chipRow: { flexDirection: 'row', flexWrap: 'wrap', gap: sizes.xs },
  chip: {
    paddingHorizontal: sizes.sm,
    paddingVertical: ms(6),
    minHeight: ms(44),
    justifyContent: 'center',
    alignItems: 'center',
    borderRadius: sizes.borderRadiusFull,
    borderWidth: 1,
  },
  chipText: { fontSize: sizes.fontSm },
  addFormActions: {
    flexDirection: 'row',
    gap: sizes.sm,
    justifyContent: 'flex-end',
    marginTop: sizes.xs,
  },
  cancelBtn: {
    paddingHorizontal: sizes.md,
    paddingVertical: sizes.sm,
    minHeight: ms(44),
    justifyContent: 'center',
    alignItems: 'center',
    borderRadius: sizes.borderRadius,
    borderWidth: 1,
  },
  cancelBtnText: { ...font.semibold },
  saveBtn: {
    paddingHorizontal: sizes.md,
    paddingVertical: sizes.sm,
    minHeight: ms(44),
    justifyContent: 'center',
    alignItems: 'center',
    borderRadius: sizes.borderRadius,
  },
  saveBtnText: { color: '#fff', ...font.bold },

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
