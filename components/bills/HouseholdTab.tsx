import { useState, useCallback } from 'react';
import { View, StyleSheet, ScrollView, Pressable, TextInput } from 'react-native';
import { Text } from 'react-native-paper';
import { useTranslation } from 'react-i18next';
import { Ionicons } from '@expo/vector-icons';
import {
  useRecurringBillsStore,
  calculateFairness,
  getLastPayment,
  getNextDueDate,
  BILL_ICONS,
  type RecurringBill,
  type BillFrequency,
} from '@stores/recurringBillsStore';
import { useAuthStore } from '@stores/authStore';
import { useHousematesStore } from '@stores/housematesStore';
import { resolveName } from '@utils/housemates';
import { useSettingsStore } from '@stores/settingsStore';
import { DatePickerModal } from '@components/bills/DatePickerModal';
import { useThemedColors } from '@constants/colors';
import { sizes } from '@constants/sizes';
import { font } from '@constants/typography';

const FREQUENCIES: BillFrequency[] = ['monthly', 'bimonthly', 'quarterly'];

const BILL_ICON_LABELS: Record<string, string> = {
  '🏛️': 'Tax',
  '⚡': 'Electric',
  '💧': 'Water',
  '🔥': 'Gas',
  '📶': 'Internet',
  '🏢': 'Building',
  '🏠': 'Rent',
  '🧾': 'Other',
  '🌡️': 'Heating',
  '♻️': 'Waste',
};

function formatDate(dateStr: string): string {
  const d = new Date(dateStr + 'T00:00:00');
  return `${String(d.getDate()).padStart(2, '0')}/${String(d.getMonth() + 1).padStart(2, '0')}/${d.getFullYear()}`;
}

function dueBadge(
  nextDue: string | null,
  textSecondaryColor: string,
): { key: string; params?: Record<string, string | number>; color: string } | null {
  if (!nextDue) return null;
  const today = new Date(); today.setHours(0, 0, 0, 0);
  const due = new Date(nextDue + 'T00:00:00');
  const diff = Math.round((due.getTime() - today.getTime()) / 86400000);
  if (diff < 0)  return { key: 'bills.household_overdue',  params: { n: Math.abs(diff) }, color: '#D9534F' };
  if (diff === 0) return { key: 'bills.household_due_today', color: '#D9534F' };
  if (diff <= 7)  return { key: 'bills.household_due_in',  params: { n: diff }, color: '#E0B24D' };
  return { key: 'bills.household_due_in', params: { n: diff }, color: textSecondaryColor };
}

// ── Fairness bar ──────────────────────────────────────────────────────────────

function FairnessSection(): React.JSX.Element {
  const { t } = useTranslation();
  const c = useThemedColors();
  const bills = useRecurringBillsStore((s) => s.bills);
  const payments = useRecurringBillsStore((s) => s.payments);
  const currency = useSettingsStore((s) => s.currency);
  const fairness = calculateFairness(bills, payments);

  if (fairness.length === 0) return <></>;

  const maxTotal = Math.max(...fairness.map((f) => f.total), 1);

  return (
    <View style={[styles.fairnessCard, { backgroundColor: c.surface, borderColor: c.border, borderWidth: 1 }]}>
      <Text style={[styles.fairnessTitle, { color: c.textSecondary }]}>{t('bills.household_contributions')}</Text>
      {fairness.map((f) => (
        <View key={f.person} style={styles.fairnessRow}>
          <Text style={[styles.fairnessPerson, { color: c.textPrimary }]}>{f.person}</Text>
          <View style={[styles.barTrack, { backgroundColor: c.surfaceSecondary }]}>
            <View style={[styles.barFill, {
              width: `${(f.total / maxTotal) * 100}%` as unknown as number,
              backgroundColor: f.balance >= 0 ? c.positive : c.negative,
            }]} />
          </View>
          <Text style={[styles.fairnessAmount, { color: c.textPrimary }]}>{currency}{f.total.toFixed(0)}</Text>
          <Text style={[styles.fairnessBalance, { color: f.balance >= 0 ? c.positive : c.negative }]}>
            {f.balance >= 0 ? `+${currency}${f.balance.toFixed(0)}` : `-${currency}${Math.abs(f.balance).toFixed(0)}`}
          </Text>
        </View>
      ))}
      <Text style={[styles.fairnessNote, { color: c.textDisabled }]}>{t('bills.household_balance_note')}</Text>
    </View>
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
  const housemates = useHousematesStore((s) => s.housemates);
  const currency = useSettingsStore((s) => s.currency);

  const todayStr = new Date().toISOString().split('T')[0];
  const [logging, setLogging] = useState(false);
  const [amount, setAmount] = useState(String(bill.typicalAmount));
  const [date, setDate] = useState(todayStr);
  const [note, setNote] = useState('');
  const [showHistory, setShowHistory] = useState(false);
  const [showLogDatePicker, setShowLogDatePicker] = useState(false);

  const last = getLastPayment(bill.id, payments);
  const nextDue = getNextDueDate(bill, payments);
  const badge = dueBadge(nextDue, c.textSecondary);
  const billPayments = payments
    .filter((p) => p.billId === bill.id)
    .sort((a, b) => b.paidAt.localeCompare(a.paidAt));

  const handleLog = useCallback(async () => {
    const parsed = parseFloat(amount);
    if (!amount || isNaN(parsed) || parsed <= 0 || !houseId) return;
    await logPayment({ billId: bill.id, amount: parsed, paidAt: date, note }, houseId);
    setLogging(false);
    setAmount(String(bill.typicalAmount));
    setDate(todayStr);
    setNote('');
  }, [amount, date, note, bill.id, bill.typicalAmount, logPayment, houseId, todayStr]);

  const handleDeleteBill    = useCallback(() => deleteBill(bill.id), [deleteBill, bill.id]);
  const toggleLogging       = useCallback(() => setLogging((v) => !v), []);
  const toggleShowHistory   = useCallback(() => setShowHistory((v) => !v), []);
  const openLogDatePicker   = useCallback(() => setShowLogDatePicker(true), []);
  const closeLogDatePicker  = useCallback(() => setShowLogDatePicker(false), []);
  const handleLogDateSelect = useCallback((val: string) => { setDate(val); setShowLogDatePicker(false); }, []);

  return (
    <View style={[styles.billCard, { backgroundColor: c.surface, borderColor: c.border }]}>
      {/* Header row */}
      <View style={styles.billHeader}>
        <Text style={styles.billIcon}>{bill.icon}</Text>
        <View style={styles.billHeaderInfo}>
          <Text style={[styles.billName, { color: c.textPrimary }]}>{bill.name}</Text>
          <View style={styles.billMeta}>
            <View style={[styles.metaChip, { backgroundColor: c.primary + '20' }]}>
              <Text style={[styles.metaChipText, { color: c.primary }]}>{resolveName(bill.assignedTo, housemates)}</Text>
            </View>
            <View style={[styles.metaChip, { backgroundColor: c.primary + '20' }]}>
              <Text style={[styles.metaChipText, { color: c.primary }]}>{t(`bills.freq_${bill.frequency}`)}</Text>
            </View>
            <Text style={[styles.typicalAmount, { color: c.textSecondary }]}>~{currency}{bill.typicalAmount}</Text>
          </View>
        </View>
        <Pressable onPress={handleDeleteBill} style={styles.deleteBtn} accessibilityRole="button" hitSlop={8}>
          <Ionicons name="close" size={16} color={c.textSecondary} />
        </Pressable>
      </View>

      {/* Last payment + due date */}
      <View style={styles.billStatus}>
        {last ? (
          <Text style={[styles.lastPaid, { color: c.textSecondary }]}>{t('bills.household_last_paid')} {formatDate(last.paidAt)} · {currency}{last.amount.toFixed(0)}</Text>
        ) : (
          <Text style={[styles.neverPaid, { color: c.textDisabled }]}>{t('bills.household_no_payments')}</Text>
        )}
        {badge && (
          <View style={[styles.dueBadge, { backgroundColor: badge.color + '18' }]}>
            <Text style={[styles.dueBadgeText, { color: badge.color }]}>{t(badge.key, badge.params)}</Text>
          </View>
        )}
      </View>

      {/* Actions */}
      <View style={styles.billActions}>
        <Pressable style={[styles.logBtn, { backgroundColor: c.primary + '20' }]} onPress={toggleLogging}>
          <Text style={[styles.logBtnText, { color: c.primary }]}>{logging ? t('common.cancel') : t('bills.household_log_payment')}</Text>
        </Pressable>
        {billPayments.length > 0 && (
          <Pressable onPress={toggleShowHistory}>
            <Text style={[styles.historyLink, { color: c.textSecondary }]}>{showHistory ? t('bills.household_hide_history') : `${t('bills.household_history')} (${billPayments.length})`}</Text>
          </Pressable>
        )}
      </View>

      {/* Log payment inline form */}
      {logging && (
        <View style={[styles.logForm, { borderTopColor: c.border }]}>
          <View style={styles.logRow}>
            <TextInput
              style={[styles.logAmountInput, { backgroundColor: c.background, borderColor: c.border, color: c.textPrimary }]}
              value={amount}
              onChangeText={setAmount}
              keyboardType="decimal-pad"
              placeholder={t('bills.household_amount')}
              placeholderTextColor={c.textDisabled}
            />
            <Pressable
              style={[styles.dateTrigger, { backgroundColor: c.background, borderColor: c.border }]}
              onPress={openLogDatePicker}
              accessible
              accessibilityRole="button"
              accessibilityLabel="Select payment date"
            >
              <Ionicons name="calendar-outline" size={15} color={c.primary} />
              <Text style={[styles.dateTriggerText, { color: c.textPrimary }]}>{formatDate(date)}</Text>
            </Pressable>
          </View>
          <DatePickerModal
            visible={showLogDatePicker}
            value={date}
            onSelect={handleLogDateSelect}
            onClose={closeLogDatePicker}
          />
          <TextInput
            style={[styles.logNoteInput, { backgroundColor: c.background, borderColor: c.border, color: c.textPrimary }]}
            value={note}
            onChangeText={setNote}
            placeholder={t('bills.household_note')}
            placeholderTextColor={c.textDisabled}
          />
          <Pressable style={[styles.savePaymentBtn, { backgroundColor: c.primary }]} onPress={handleLog}>
            <Text style={styles.savePaymentBtnText}>{t('bills.household_save_payment')}</Text>
          </Pressable>
        </View>
      )}

      {/* Payment history */}
      {showHistory && (
        <View style={[styles.history, { borderTopColor: c.border }]}>
          {billPayments.map((p) => (
            <View key={p.id} style={styles.historyRow}>
              <Text style={[styles.historyDate, { color: c.textSecondary }]}>{formatDate(p.paidAt)}</Text>
              <Text style={[styles.historyAmount, { color: c.textPrimary }]}>{currency}{p.amount.toFixed(0)}</Text>
              {p.note ? <Text style={[styles.historyNote, { color: c.textSecondary }]}>{p.note}</Text> : null}
              <Pressable onPress={() => deletePayment(p.id)} hitSlop={8}>
                <Ionicons name="close" size={14} color={c.textSecondary} />
              </Pressable>
            </View>
          ))}
        </View>
      )}
    </View>
  );
}

// ── Add bill form ─────────────────────────────────────────────────────────────

interface PersonOption { id: string; name: string; }

function AddBillForm({ people, onClose }: { people: PersonOption[]; onClose: () => void }): React.JSX.Element {
  const { t } = useTranslation();
  const c = useThemedColors();
  const addBill    = useRecurringBillsStore((s) => s.addBill);
  const logPayment = useRecurringBillsStore((s) => s.logPayment);
  const houseId    = useAuthStore((s) => s.houseId);
  const [name, setName] = useState('');
  const [assignedTo, setAssignedTo] = useState(people[0]?.id ?? '');
  const [frequency, setFrequency] = useState<BillFrequency>('monthly');
  const [typicalAmount, setTypicalAmount] = useState('');
  const [icon, setIcon] = useState(BILL_ICONS[0]);
  const [lastPaidDate, setLastPaidDate] = useState('');
  const [showAddDatePicker, setShowAddDatePicker] = useState(false);
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);

  const handleSave = useCallback(async () => {
    if (!name.trim()) { setError('Please enter a bill name.'); return; }
    const amt = parseFloat(typicalAmount);
    if (!typicalAmount || isNaN(amt) || amt <= 0) { setError('Please enter a valid amount.'); return; }
    if (!houseId) return;
    try {
      setSaving(true);
      const newBill = await addBill(
        { name: name.trim(), assignedTo, frequency, typicalAmount: amt, icon },
        houseId,
      );
      if (lastPaidDate) {
        await logPayment({ billId: newBill.id, amount: amt, paidAt: lastPaidDate, note: '' }, houseId);
      }
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not save the bill. Please try again.');
    } finally {
      setSaving(false);
    }
  }, [name, assignedTo, frequency, typicalAmount, icon, lastPaidDate, addBill, logPayment, houseId, onClose]);

  const openAddDatePicker   = useCallback(() => setShowAddDatePicker(true), []);
  const closeAddDatePicker  = useCallback(() => setShowAddDatePicker(false), []);
  const handleAddDateSelect = useCallback((val: string) => { setLastPaidDate(val); setShowAddDatePicker(false); }, []);

  return (
    <View style={[styles.addForm, { backgroundColor: c.surface, borderColor: c.border }]}>
      <Text style={[styles.addFormTitle, { color: c.textPrimary }]}>{t('bills.household_new_recurring')}</Text>

      {/* Icon picker */}
      <Text style={[styles.fieldLabel, { color: c.textSecondary }]}>{t('bills.household_icon')}</Text>
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
            accessibilityLabel={BILL_ICON_LABELS[ic] ?? ic}
            accessibilityState={{ selected: icon === ic }}
          >
            <Text style={styles.iconChipEmoji}>{ic}</Text>
            <Text style={[styles.iconChipLabel, { color: icon === ic ? c.primary : c.textSecondary }]}>
              {BILL_ICON_LABELS[ic] ?? ''}
            </Text>
          </Pressable>
        ))}
      </View>

      {/* Name */}
      <Text style={[styles.fieldLabel, { color: c.textSecondary }]}>{t('bills.household_bill_name')}</Text>
      <TextInput
        style={[styles.addInput, { backgroundColor: c.background, borderColor: c.border, color: c.textPrimary }]}
        value={name}
        onChangeText={setName}
        placeholder={t('bills.household_bill_name_placeholder')}
        placeholderTextColor={c.textDisabled}
        autoCorrect={false}
      />

      {/* Assigned to */}
      <Text style={[styles.fieldLabel, { color: c.textSecondary }]}>{t('bills.household_who_pays')}</Text>
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
          >
            <Text style={[styles.chipText, { color: assignedTo === p.id ? '#fff' : c.textPrimary }]}>{p.name}</Text>
          </Pressable>
        ))}
      </View>

      {/* Frequency */}
      <Text style={[styles.fieldLabel, { color: c.textSecondary }]}>{t('bills.household_how_often')}</Text>
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
          >
            <Text style={[styles.chipText, { color: frequency === f ? '#fff' : c.textPrimary }]}>{t(`bills.freq_${f}`)}</Text>
          </Pressable>
        ))}
      </View>

      {/* Typical amount */}
      <Text style={[styles.fieldLabel, { color: c.textSecondary }]}>{t('bills.household_typical_amount')}</Text>
      <TextInput
        style={[styles.addInput, { backgroundColor: c.background, borderColor: c.border, color: c.textPrimary }]}
        value={typicalAmount}
        onChangeText={setTypicalAmount}
        keyboardType="decimal-pad"
        placeholder="0"
        placeholderTextColor={c.textDisabled}
      />

      {/* Last paid date */}
      <Text style={[styles.fieldLabel, { color: c.textSecondary }]}>{t('bills.household_last_paid_label')}</Text>
      <Text style={[styles.fieldHint, { color: c.textDisabled }]}>{t('bills.household_last_paid_help')}</Text>
      <Pressable
        style={[styles.dateTrigger, { backgroundColor: c.background, borderColor: c.border }]}
        onPress={openAddDatePicker}
        accessible
        accessibilityRole="button"
        accessibilityLabel="Select last paid date"
      >
        <Ionicons name="calendar-outline" size={16} color={c.primary} />
        <Text style={[styles.dateTriggerText, { color: lastPaidDate ? c.textPrimary : c.textDisabled }]}>
          {lastPaidDate ? formatDate(lastPaidDate) : t('bills.household_tap_select_date')}
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
        <Pressable style={[styles.cancelBtn, { borderColor: c.border }]} onPress={onClose}>
          <Text style={[styles.cancelBtnText, { color: c.textSecondary }]}>{t('common.cancel')}</Text>
        </Pressable>
        <Pressable
          style={[styles.saveBtn, { backgroundColor: c.primary }, (saving || !name.trim() || !typicalAmount) && { backgroundColor: c.textDisabled }]}
          onPress={handleSave}
          disabled={saving}
        >
          <Text style={styles.saveBtnText}>{saving ? 'Saving…' : t('bills.household_add_bill')}</Text>
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

  const openAddForm  = useCallback(() => setShowAddForm(true), []);
  const closeAddForm = useCallback(() => setShowAddForm(false), []);

  const allPeople = [
    profile ? { id: profile.id, name: profile.name ?? '' } : null,
    ...housemates.map((h) => ({ id: h.id, name: h.name })),
  ].filter((p): p is { id: string; name: string } => Boolean(p?.id && p?.name))
   .filter((p, i, arr) => arr.findIndex((q) => q.id === p.id) === i);

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <FairnessSection />

      {bills.length === 0 && !showAddForm && (
        <View style={styles.emptySection}>
          <Text style={[styles.emptyTitle, { color: c.textPrimary }]}>{t('bills.household_no_bills')}</Text>
          <Text style={[styles.emptyText, { color: c.textSecondary }]}>{t('bills.household_no_bills_hint')}</Text>
        </View>
      )}

      {bills.map((bill) => <BillCard key={bill.id} bill={bill} />)}

      {showAddForm ? (
        <AddBillForm people={allPeople} onClose={closeAddForm} />
      ) : (
        <Pressable style={[styles.addBillBtn, { borderColor: c.border }]} onPress={openAddForm}>
          <Text style={[styles.addBillBtnText, { color: c.primary }]}>{t('bills.household_add_recurring')}</Text>
        </Pressable>
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  content: { padding: sizes.lg, paddingBottom: 60, gap: sizes.sm },

  // Fairness
  fairnessCard:    { borderRadius: sizes.borderRadius, padding: sizes.md, gap: sizes.sm },
  fairnessTitle:   { fontSize: sizes.fontSm, ...font.bold, letterSpacing: 0.5, textTransform: 'uppercase' },
  fairnessRow:     { flexDirection: 'row', alignItems: 'center', gap: sizes.xs },
  fairnessPerson:  { width: 64, fontSize: sizes.fontSm, ...font.semibold },
  barTrack:        { flex: 1, height: 8, borderRadius: 4, overflow: 'hidden' },
  barFill:         { height: 8, borderRadius: 4 },
  fairnessAmount:  { width: 56, fontSize: sizes.fontSm, textAlign: 'right' },
  fairnessBalance: { width: 56, fontSize: sizes.fontXs, ...font.bold, textAlign: 'right' },
  fairnessNote:    { fontSize: 11, marginTop: sizes.xs },

  // Bill card
  billCard:       { borderRadius: sizes.borderRadius, borderWidth: 1, padding: sizes.md, gap: sizes.sm },
  billHeader:     { flexDirection: 'row', alignItems: 'flex-start', gap: sizes.sm },
  billIcon:       { fontSize: 28, lineHeight: 36 },
  billHeaderInfo: { flex: 1, gap: 4 },
  billName:       { fontSize: sizes.fontMd, ...font.bold },
  billMeta:       { flexDirection: 'row', alignItems: 'center', gap: sizes.xs, flexWrap: 'wrap' },
  metaChip:       { borderRadius: sizes.borderRadiusFull, paddingHorizontal: sizes.xs, paddingVertical: 2 },
  metaChipText:   { fontSize: sizes.fontXs, ...font.semibold },
  typicalAmount:  { fontSize: sizes.fontXs },
  deleteBtn:      { padding: 4 },
  billStatus:     { flexDirection: 'row', alignItems: 'center', gap: sizes.sm, flexWrap: 'wrap' },
  lastPaid:       { fontSize: sizes.fontSm, flex: 1 },
  neverPaid:      { fontSize: sizes.fontSm, flex: 1 },
  dueBadge:       { borderRadius: sizes.borderRadiusFull, paddingHorizontal: sizes.sm, paddingVertical: 3 },
  dueBadgeText:   { fontSize: sizes.fontXs, ...font.bold },
  billActions:    { flexDirection: 'row', alignItems: 'center', gap: sizes.md },
  logBtn:         { borderRadius: sizes.borderRadiusFull, paddingHorizontal: sizes.md, paddingVertical: 5, minHeight: 44, justifyContent: 'center', alignItems: 'center' },
  logBtnText:     { fontSize: sizes.fontSm, ...font.bold },
  historyLink:    { fontSize: sizes.fontSm },

  // Log form
  logForm:         { borderTopWidth: 1, paddingTop: sizes.sm, gap: sizes.sm },
  logRow:          { flexDirection: 'row', gap: sizes.sm },
  logAmountInput:  { flex: 1, borderRadius: sizes.borderRadiusSm, borderWidth: 1, paddingHorizontal: sizes.sm, paddingVertical: sizes.sm, fontSize: sizes.fontMd },
  logNoteInput:    { borderRadius: sizes.borderRadiusSm, borderWidth: 1, paddingHorizontal: sizes.sm, paddingVertical: sizes.sm, fontSize: sizes.fontSm },
  savePaymentBtn:  { borderRadius: sizes.borderRadius, paddingVertical: sizes.sm, alignItems: 'center' },
  savePaymentBtnText: { color: '#fff', ...font.bold, fontSize: sizes.fontMd },

  // History
  history:       { borderTopWidth: 1, paddingTop: sizes.sm, gap: sizes.xs },
  historyRow:    { flexDirection: 'row', alignItems: 'center', gap: sizes.sm },
  historyDate:   { fontSize: sizes.fontSm, width: 80 },
  historyAmount: { fontSize: sizes.fontSm, ...font.semibold },
  historyNote:   { flex: 1, fontSize: sizes.fontSm, fontStyle: 'italic' },

  // Add form
  addForm:        { borderRadius: sizes.borderRadius, borderWidth: 1, padding: sizes.md, gap: sizes.sm },
  addFormTitle:   { fontSize: sizes.fontMd, ...font.bold, marginBottom: sizes.xs },
  fieldLabel:     { fontSize: sizes.fontXs, ...font.bold, textTransform: 'uppercase', letterSpacing: 0.5 },
  iconRow:        { flexDirection: 'row', flexWrap: 'wrap', gap: sizes.xs },
  iconChip:       { width: 56, height: 56, borderRadius: sizes.borderRadiusSm, justifyContent: 'center', alignItems: 'center', borderWidth: 2, gap: 2 },
  iconChipEmoji:  { fontSize: 20 },
  iconChipLabel:  { fontSize: 9, textAlign: 'center' },
  fieldHint:      { fontSize: 11, marginTop: -2 },
  dateTrigger: {
    flexDirection: 'row', alignItems: 'center', gap: sizes.sm,
    borderRadius: sizes.borderRadiusSm,
    borderWidth: 1,
    paddingHorizontal: sizes.sm, paddingVertical: sizes.sm, minHeight: 44,
  },
  dateTriggerText: { flex: 1, fontSize: sizes.fontSm },
  formError:      { fontSize: sizes.fontSm, marginTop: 2 },
  addInput:       { borderRadius: sizes.borderRadiusSm, borderWidth: 1, paddingHorizontal: sizes.sm, paddingVertical: sizes.sm, fontSize: sizes.fontMd },
  chipRow:        { flexDirection: 'row', flexWrap: 'wrap', gap: sizes.xs },
  chip:           { paddingHorizontal: sizes.sm, paddingVertical: 6, borderRadius: sizes.borderRadiusFull, borderWidth: 1 },
  chipText:       { fontSize: sizes.fontSm },
  addFormActions: { flexDirection: 'row', gap: sizes.sm, justifyContent: 'flex-end', marginTop: sizes.xs },
  cancelBtn:      { paddingHorizontal: sizes.md, paddingVertical: sizes.sm, borderRadius: sizes.borderRadius, borderWidth: 1 },
  cancelBtnText:  { ...font.semibold },
  saveBtn:        { paddingHorizontal: sizes.md, paddingVertical: sizes.sm, borderRadius: sizes.borderRadius },
  saveBtnText:    { color: '#fff', ...font.bold },

  // Add bill button
  addBillBtn:     { borderWidth: 2, borderStyle: 'dashed', borderRadius: sizes.borderRadius, paddingVertical: sizes.md, alignItems: 'center' },
  addBillBtnText: { ...font.bold, fontSize: sizes.fontMd },

  // Empty
  emptySection: { alignItems: 'center', paddingVertical: sizes.xl },
  emptyTitle:   { ...font.bold, marginBottom: sizes.xs },
  emptyText:    { textAlign: 'center', fontSize: sizes.fontSm },
});
