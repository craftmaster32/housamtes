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
import { colors } from '@constants/colors';
import { sizes } from '@constants/sizes';

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

function dueBadge(nextDue: string | null): { key: string; params?: Record<string, string | number>; color: string } | null {
  if (!nextDue) return null;
  const today = new Date(); today.setHours(0, 0, 0, 0);
  const due = new Date(nextDue + 'T00:00:00');
  const diff = Math.round((due.getTime() - today.getTime()) / 86400000);
  if (diff < 0) return { key: 'bills.household_overdue', params: { n: Math.abs(diff) }, color: colors.negative };
  if (diff === 0) return { key: 'bills.household_due_today', color: colors.negative };
  if (diff <= 7) return { key: 'bills.household_due_in', params: { n: diff }, color: colors.warning };
  return { key: 'bills.household_due_in', params: { n: diff }, color: colors.textSecondary };
}

// ── Fairness bar ──────────────────────────────────────────────────────────────

function FairnessSection(): React.JSX.Element {
  const { t } = useTranslation();
  const bills = useRecurringBillsStore((s) => s.bills);
  const payments = useRecurringBillsStore((s) => s.payments);
  const currency = useSettingsStore((s) => s.currency);
  const fairness = calculateFairness(bills, payments);

  if (fairness.length === 0) return <></>;

  const maxTotal = Math.max(...fairness.map((f) => f.total), 1);

  return (
    <View style={styles.fairnessCard}>
      <Text style={styles.fairnessTitle}>{t('bills.household_contributions')}</Text>
      {fairness.map((f) => (
        <View key={f.person} style={styles.fairnessRow}>
          <Text style={styles.fairnessPerson}>{f.person}</Text>
          <View style={styles.barTrack}>
            <View style={[styles.barFill, {
              width: `${(f.total / maxTotal) * 100}%` as unknown as number,
              backgroundColor: f.balance >= 0 ? colors.positive : colors.negative,
            }]} />
          </View>
          <Text style={styles.fairnessAmount}>{currency}{f.total.toFixed(0)}</Text>
          <Text style={[styles.fairnessBalance, { color: f.balance >= 0 ? colors.positive : colors.negative }]}>
            {f.balance >= 0 ? `+${currency}${f.balance.toFixed(0)}` : `-${currency}${Math.abs(f.balance).toFixed(0)}`}
          </Text>
        </View>
      ))}
      <Text style={styles.fairnessNote}>{t('bills.household_balance_note')}</Text>
    </View>
  );
}

// ── Bill card ─────────────────────────────────────────────────────────────────

function BillCard({ bill }: { bill: RecurringBill }): React.JSX.Element {
  const { t } = useTranslation();
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
  const badge = dueBadge(nextDue);
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

  return (
    <View style={styles.billCard}>
      {/* Header row */}
      <View style={styles.billHeader}>
        <Text style={styles.billIcon}>{bill.icon}</Text>
        <View style={styles.billHeaderInfo}>
          <Text style={styles.billName}>{bill.name}</Text>
          <View style={styles.billMeta}>
            <View style={styles.metaChip}>
              <Text style={styles.metaChipText}>{resolveName(bill.assignedTo, housemates)}</Text>
            </View>
            <View style={styles.metaChip}>
              <Text style={styles.metaChipText}>{t(`bills.freq_${bill.frequency}`)}</Text>
            </View>
            <Text style={styles.typicalAmount}>~{currency}{bill.typicalAmount}</Text>
          </View>
        </View>
        <Pressable onPress={() => deleteBill(bill.id)} style={styles.deleteBtn} accessibilityRole="button" hitSlop={8}>
          <Ionicons name="close" size={16} color={colors.textSecondary} />
        </Pressable>
      </View>

      {/* Last payment + due date */}
      <View style={styles.billStatus}>
        {last ? (
          <Text style={styles.lastPaid}>{t('bills.household_last_paid')} {formatDate(last.paidAt)} · {currency}{last.amount.toFixed(0)}</Text>
        ) : (
          <Text style={styles.neverPaid}>{t('bills.household_no_payments')}</Text>
        )}
        {badge && (
          <View style={[styles.dueBadge, { backgroundColor: badge.color + '18' }]}>
            <Text style={[styles.dueBadgeText, { color: badge.color }]}>{t(badge.key, badge.params)}</Text>
          </View>
        )}
      </View>

      {/* Actions */}
      <View style={styles.billActions}>
        <Pressable style={styles.logBtn} onPress={() => setLogging((v) => !v)}>
          <Text style={styles.logBtnText}>{logging ? t('common.cancel') : t('bills.household_log_payment')}</Text>
        </Pressable>
        {billPayments.length > 0 && (
          <Pressable onPress={() => setShowHistory((v) => !v)}>
            <Text style={styles.historyLink}>{showHistory ? t('bills.household_hide_history') : `${t('bills.household_history')} (${billPayments.length})`}</Text>
          </Pressable>
        )}
      </View>

      {/* Log payment inline form */}
      {logging && (
        <View style={styles.logForm}>
          <View style={styles.logRow}>
            <TextInput
              style={styles.logAmountInput}
              value={amount}
              onChangeText={setAmount}
              keyboardType="decimal-pad"
              placeholder={t('bills.household_amount')}
              placeholderTextColor={colors.textDisabled}
            />
            <Pressable
              style={styles.dateTrigger}
              onPress={() => setShowLogDatePicker(true)}
              accessible
              accessibilityRole="button"
              accessibilityLabel="Select payment date"
            >
              <Ionicons name="calendar-outline" size={15} color={colors.primary} />
              <Text style={styles.dateTriggerText}>{formatDate(date)}</Text>
            </Pressable>
          </View>
          <DatePickerModal
            visible={showLogDatePicker}
            value={date}
            onSelect={(val) => { setDate(val); setShowLogDatePicker(false); }}
            onClose={() => setShowLogDatePicker(false)}
          />
          <TextInput
            style={styles.logNoteInput}
            value={note}
            onChangeText={setNote}
            placeholder={t('bills.household_note')}
            placeholderTextColor={colors.textDisabled}
          />
          <Pressable style={styles.savePaymentBtn} onPress={handleLog}>
            <Text style={styles.savePaymentBtnText}>{t('bills.household_save_payment')}</Text>
          </Pressable>
        </View>
      )}

      {/* Payment history */}
      {showHistory && (
        <View style={styles.history}>
          {billPayments.map((p) => (
            <View key={p.id} style={styles.historyRow}>
              <Text style={styles.historyDate}>{formatDate(p.paidAt)}</Text>
              <Text style={styles.historyAmount}>{currency}{p.amount.toFixed(0)}</Text>
              {p.note ? <Text style={styles.historyNote}>{p.note}</Text> : null}
              <Pressable onPress={() => deletePayment(p.id)} hitSlop={8}>
                <Ionicons name="close" size={14} color={colors.textSecondary} />
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
      // Auto-log the first payment so spending analysis accounts for all covered months
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

  return (
    <View style={styles.addForm}>
      <Text style={styles.addFormTitle}>{t('bills.household_new_recurring')}</Text>

      {/* Icon picker */}
      <Text style={styles.fieldLabel}>{t('bills.household_icon')}</Text>
      <View style={styles.iconRow}>
        {BILL_ICONS.map((ic) => (
          <Pressable
            key={ic}
            style={[styles.iconChip, icon === ic && styles.iconChipActive]}
            onPress={() => setIcon(ic)}
            accessible
            accessibilityRole="radio"
            accessibilityLabel={BILL_ICON_LABELS[ic] ?? ic}
            accessibilityState={{ selected: icon === ic }}
          >
            <Text style={styles.iconChipEmoji}>{ic}</Text>
            <Text style={[styles.iconChipLabel, icon === ic && styles.iconChipLabelActive]}>
              {BILL_ICON_LABELS[ic] ?? ''}
            </Text>
          </Pressable>
        ))}
      </View>

      {/* Name */}
      <Text style={styles.fieldLabel}>{t('bills.household_bill_name')}</Text>
      <TextInput
        style={styles.addInput}
        value={name}
        onChangeText={setName}
        placeholder={t('bills.household_bill_name_placeholder')}
        placeholderTextColor={colors.textDisabled}
        autoCorrect={false}
      />

      {/* Assigned to */}
      <Text style={styles.fieldLabel}>{t('bills.household_who_pays')}</Text>
      <View style={styles.chipRow}>
        {people.map((p) => (
          <Pressable
            key={p.id}
            style={[styles.chip, assignedTo === p.id && styles.chipActive]}
            onPress={() => setAssignedTo(p.id)}
          >
            <Text style={[styles.chipText, assignedTo === p.id && styles.chipTextActive]}>{p.name}</Text>
          </Pressable>
        ))}
      </View>

      {/* Frequency */}
      <Text style={styles.fieldLabel}>{t('bills.household_how_often')}</Text>
      <View style={styles.chipRow}>
        {FREQUENCIES.map((f) => (
          <Pressable
            key={f}
            style={[styles.chip, frequency === f && styles.chipActive]}
            onPress={() => setFrequency(f)}
          >
            <Text style={[styles.chipText, frequency === f && styles.chipTextActive]}>{t(`bills.freq_${f}`)}</Text>
          </Pressable>
        ))}
      </View>

      {/* Typical amount */}
      <Text style={styles.fieldLabel}>{t('bills.household_typical_amount')}</Text>
      <TextInput
        style={styles.addInput}
        value={typicalAmount}
        onChangeText={setTypicalAmount}
        keyboardType="decimal-pad"
        placeholder="0"
        placeholderTextColor={colors.textDisabled}
      />

      {/* Last paid date */}
      <Text style={styles.fieldLabel}>Last paid date (optional)</Text>
      <Text style={styles.fieldHint}>
        When did you last pay this? {"We'll"} track the next due date and add it to your spending history.
      </Text>
      <Pressable
        style={styles.dateTrigger}
        onPress={() => setShowAddDatePicker(true)}
        accessible
        accessibilityRole="button"
        accessibilityLabel="Select last paid date"
      >
        <Ionicons name="calendar-outline" size={16} color={colors.primary} />
        <Text style={lastPaidDate ? styles.dateTriggerText : styles.dateTriggerPlaceholder}>
          {lastPaidDate ? formatDate(lastPaidDate) : 'Tap to select date'}
        </Text>
      </Pressable>
      <DatePickerModal
        visible={showAddDatePicker}
        value={lastPaidDate}
        onSelect={(val) => { setLastPaidDate(val); setShowAddDatePicker(false); }}
        onClose={() => setShowAddDatePicker(false)}
      />

      {!!error && <Text style={styles.formError}>{error}</Text>}

      <View style={styles.addFormActions}>
        <Pressable style={styles.cancelBtn} onPress={onClose}>
          <Text style={styles.cancelBtnText}>{t('common.cancel')}</Text>
        </Pressable>
        <Pressable
          style={[styles.saveBtn, (saving || !name.trim() || !typicalAmount) && styles.saveBtnDisabled]}
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
  const bills = useRecurringBillsStore((s) => s.bills);
  const profile = useAuthStore((s) => s.profile);
  const housemates = useHousematesStore((s) => s.housemates);
  const [showAddForm, setShowAddForm] = useState(false);

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
          <Text style={styles.emptyTitle}>{t('bills.household_no_bills')}</Text>
          <Text style={styles.emptyText}>{t('bills.household_no_bills_hint')}</Text>
        </View>
      )}

      {bills.map((bill) => <BillCard key={bill.id} bill={bill} />)}

      {showAddForm ? (
        <AddBillForm people={allPeople} onClose={() => setShowAddForm(false)} />
      ) : (
        <Pressable style={styles.addBillBtn} onPress={() => setShowAddForm(true)}>
          <Text style={styles.addBillBtnText}>{t('bills.household_add_recurring')}</Text>
        </Pressable>
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  content: { padding: sizes.lg, paddingBottom: 60, gap: sizes.sm },

  // Fairness
  fairnessCard: { backgroundColor: colors.white, borderRadius: sizes.borderRadius, padding: sizes.md, gap: sizes.sm },
  fairnessTitle: { fontSize: sizes.fontSm, fontWeight: '700', color: colors.textSecondary, letterSpacing: 0.5, textTransform: 'uppercase' },
  fairnessRow: { flexDirection: 'row', alignItems: 'center', gap: sizes.xs },
  fairnessPerson: { width: 64, fontSize: sizes.fontSm, color: colors.textPrimary, fontWeight: '600' },
  barTrack: { flex: 1, height: 8, backgroundColor: colors.background, borderRadius: 4, overflow: 'hidden' },
  barFill: { height: 8, borderRadius: 4 },
  fairnessAmount: { width: 56, fontSize: sizes.fontSm, color: colors.textPrimary, textAlign: 'right' },
  fairnessBalance: { width: 56, fontSize: sizes.fontXs, fontWeight: '700', textAlign: 'right' },
  fairnessNote: { fontSize: 11, color: colors.textDisabled, marginTop: sizes.xs },

  // Bill card
  billCard: { backgroundColor: colors.white, borderRadius: sizes.borderRadius, padding: sizes.md, gap: sizes.sm },
  billHeader: { flexDirection: 'row', alignItems: 'flex-start', gap: sizes.sm },
  billIcon: { fontSize: 28, lineHeight: 36 },
  billHeaderInfo: { flex: 1, gap: 4 },
  billName: { fontSize: sizes.fontMd, fontWeight: '700', color: colors.textPrimary },
  billMeta: { flexDirection: 'row', alignItems: 'center', gap: sizes.xs, flexWrap: 'wrap' },
  metaChip: { backgroundColor: colors.primary + '15', borderRadius: sizes.borderRadiusFull, paddingHorizontal: sizes.xs, paddingVertical: 2 },
  metaChipText: { fontSize: sizes.fontXs, color: colors.primary, fontWeight: '600' },
  typicalAmount: { fontSize: sizes.fontXs, color: colors.textSecondary },
  deleteBtn: { padding: 4 },
  deleteBtnText: { color: colors.textDisabled, fontSize: sizes.fontSm },
  billStatus: { flexDirection: 'row', alignItems: 'center', gap: sizes.sm, flexWrap: 'wrap' },
  lastPaid: { fontSize: sizes.fontSm, color: colors.textSecondary, flex: 1 },
  neverPaid: { fontSize: sizes.fontSm, color: colors.textDisabled, flex: 1 },
  dueBadge: { borderRadius: sizes.borderRadiusFull, paddingHorizontal: sizes.sm, paddingVertical: 3 },
  dueBadgeText: { fontSize: sizes.fontXs, fontWeight: '700' },
  billActions: { flexDirection: 'row', alignItems: 'center', gap: sizes.md },
  logBtn: { backgroundColor: colors.primary + '15', borderRadius: sizes.borderRadiusFull, paddingHorizontal: sizes.md, paddingVertical: 5 },
  logBtnText: { color: colors.primary, fontSize: sizes.fontSm, fontWeight: '700' },
  historyLink: { color: colors.textSecondary, fontSize: sizes.fontSm },

  // Log form
  logForm: { borderTopWidth: 1, borderTopColor: colors.border, paddingTop: sizes.sm, gap: sizes.sm },
  logRow: { flexDirection: 'row', gap: sizes.sm },
  logAmountInput: { flex: 1, backgroundColor: colors.background, borderRadius: sizes.borderRadiusSm, borderWidth: 1, borderColor: colors.border, paddingHorizontal: sizes.sm, paddingVertical: sizes.sm, fontSize: sizes.fontMd, color: colors.textPrimary },
  logNoteInput: { backgroundColor: colors.background, borderRadius: sizes.borderRadiusSm, borderWidth: 1, borderColor: colors.border, paddingHorizontal: sizes.sm, paddingVertical: sizes.sm, fontSize: sizes.fontSm, color: colors.textPrimary },
  savePaymentBtn: { backgroundColor: colors.primary, borderRadius: sizes.borderRadius, paddingVertical: sizes.sm, alignItems: 'center' },
  savePaymentBtnText: { color: colors.white, fontWeight: '700', fontSize: sizes.fontMd },

  // History
  history: { borderTopWidth: 1, borderTopColor: colors.border, paddingTop: sizes.sm, gap: sizes.xs },
  historyRow: { flexDirection: 'row', alignItems: 'center', gap: sizes.sm },
  historyDate: { fontSize: sizes.fontSm, color: colors.textSecondary, width: 80 },
  historyAmount: { fontSize: sizes.fontSm, fontWeight: '600', color: colors.textPrimary },
  historyNote: { flex: 1, fontSize: sizes.fontSm, color: colors.textSecondary, fontStyle: 'italic' },
  historyDelete: { color: colors.textDisabled, fontSize: sizes.fontXs, paddingHorizontal: 4 },

  // Add form
  addForm: { backgroundColor: colors.white, borderRadius: sizes.borderRadius, padding: sizes.md, gap: sizes.sm },
  addFormTitle: { fontSize: sizes.fontMd, fontWeight: '700', color: colors.textPrimary, marginBottom: sizes.xs },
  fieldLabel: { fontSize: sizes.fontXs, fontWeight: '700', color: colors.textSecondary, textTransform: 'uppercase', letterSpacing: 0.5 },
  iconRow: { flexDirection: 'row', flexWrap: 'wrap', gap: sizes.xs },
  iconChip: { width: 56, height: 56, borderRadius: sizes.borderRadiusSm, backgroundColor: colors.background, justifyContent: 'center', alignItems: 'center', borderWidth: 2, borderColor: 'transparent', gap: 2 },
  iconChipActive: { borderColor: colors.primary, backgroundColor: colors.primary + '12' },
  iconChipEmoji: { fontSize: 20 },
  iconChipLabel: { fontSize: 9, color: colors.textSecondary, textAlign: 'center' },
  iconChipLabelActive: { color: colors.primary },
  fieldHint: { fontSize: 11, color: colors.textDisabled, marginTop: -2 },
  dateTrigger: {
    flexDirection: 'row', alignItems: 'center', gap: sizes.sm,
    backgroundColor: colors.background, borderRadius: sizes.borderRadiusSm,
    borderWidth: 1, borderColor: colors.border,
    paddingHorizontal: sizes.sm, paddingVertical: sizes.sm, minHeight: 44,
  },
  dateTriggerText: { flex: 1, fontSize: sizes.fontSm, color: colors.textPrimary },
  dateTriggerPlaceholder: { flex: 1, fontSize: sizes.fontSm, color: colors.textDisabled },
  formError: { fontSize: sizes.fontSm, color: colors.negative, marginTop: 2 },
  addInput: { backgroundColor: colors.background, borderRadius: sizes.borderRadiusSm, borderWidth: 1, borderColor: colors.border, paddingHorizontal: sizes.sm, paddingVertical: sizes.sm, fontSize: sizes.fontMd, color: colors.textPrimary },
  chipRow: { flexDirection: 'row', flexWrap: 'wrap', gap: sizes.xs },
  chip: { paddingHorizontal: sizes.sm, paddingVertical: 6, borderRadius: sizes.borderRadiusFull, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.white },
  chipActive: { backgroundColor: colors.primary, borderColor: colors.primary },
  chipText: { fontSize: sizes.fontSm, color: colors.textPrimary },
  chipTextActive: { color: colors.white },
  addFormActions: { flexDirection: 'row', gap: sizes.sm, justifyContent: 'flex-end', marginTop: sizes.xs },
  cancelBtn: { paddingHorizontal: sizes.md, paddingVertical: sizes.sm, borderRadius: sizes.borderRadius, borderWidth: 1, borderColor: colors.border },
  cancelBtnText: { color: colors.textSecondary, fontWeight: '600' },
  saveBtn: { backgroundColor: colors.primary, paddingHorizontal: sizes.md, paddingVertical: sizes.sm, borderRadius: sizes.borderRadius },
  saveBtnDisabled: { backgroundColor: colors.textDisabled },
  saveBtnText: { color: colors.white, fontWeight: '700' },

  // Add bill button
  addBillBtn: { borderWidth: 2, borderColor: colors.border, borderStyle: 'dashed', borderRadius: sizes.borderRadius, paddingVertical: sizes.md, alignItems: 'center' },
  addBillBtnText: { color: colors.primary, fontWeight: '700', fontSize: sizes.fontMd },

  // Empty
  emptySection: { alignItems: 'center', paddingVertical: sizes.xl },
  emptyTitle: { color: colors.textPrimary, fontWeight: 'bold', marginBottom: sizes.xs },
  emptyText: { color: colors.textSecondary, textAlign: 'center', fontSize: sizes.fontSm },
});
