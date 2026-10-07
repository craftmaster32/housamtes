import { useState, useCallback } from 'react';
import { View, StyleSheet, Pressable, TextInput } from 'react-native';
import { Text } from 'react-native-paper';
import { useTranslation } from 'react-i18next';
import { Ionicons } from '@expo/vector-icons';
import {
  useRecurringBillsStore,
  BILL_ICONS,
  resolveBillIcon,
  type BillFrequency,
  type RecurringBill,
} from '@stores/recurringBillsStore';
import { useAuthStore } from '@stores/authStore';
import { DatePickerModal } from '@components/bills/DatePickerModal';
import { font } from '@constants/typography';
import { formatDateDDMMYYYY } from '@utils/dates';
import { getErrorMessage } from '@utils/errors';
import { FREQUENCY_MONTHS, monthStart } from '@utils/recurringCoverage';
import { mf, ms } from '@utils/responsive';
import { BillIconPicker } from './BillIconPicker';
import { ChoiceChips, type ChoiceOption } from './ChoiceChips';
import { useRecurringPalette } from './palette';

const FREQUENCIES: BillFrequency[] = ['monthly', 'bimonthly', 'quarterly'];

interface RecurringBillFormProps {
  bill?: RecurringBill; // set = edit this bill; unset = add a new one
  people: ChoiceOption[];
  onClose: () => void;
}

/** Add or edit a recurring bill: icon, name, payer, frequency, usual amount. */
export function RecurringBillForm({
  bill,
  people,
  onClose,
}: RecurringBillFormProps): React.JSX.Element {
  const { t } = useTranslation();
  const p = useRecurringPalette();
  const addBill = useRecurringBillsStore((s) => s.addBill);
  const updateBill = useRecurringBillsStore((s) => s.updateBill);
  const logPayment = useRecurringBillsStore((s) => s.logPayment);
  const houseId = useAuthStore((s) => s.houseId);
  const [name, setName] = useState(bill?.name ?? '');
  const [assignedTo, setAssignedTo] = useState(bill?.assignedTo ?? people[0]?.id ?? '');
  const [frequency, setFrequency] = useState<BillFrequency>(bill?.frequency ?? 'monthly');
  const [typicalAmount, setTypicalAmount] = useState(bill ? String(bill.typicalAmount) : '');
  const [icon, setIcon] = useState(bill ? resolveBillIcon(bill.icon) : BILL_ICONS[0]);
  const [lastPaidDate, setLastPaidDate] = useState('');
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);
  const [createdId, setCreatedId] = useState<string | null>(null);

  const amount = parseFloat(typicalAmount.replace(',', '.'));
  const canSave = !saving && !!houseId && !!name.trim() && !!assignedTo && amount > 0;

  const handleSave = useCallback(async (): Promise<void> => {
    if (saving) return;
    if (!name.trim()) return setError(t('bills.household_name_required'));
    if (!(amount > 0)) return setError(t('bills.household_invalid_amount'));
    if (!assignedTo) return setError(t('bills.household_assignee_required'));
    if (!houseId) return setError(t('bills.household_missing'));
    const fields = { name: name.trim(), assignedTo, frequency, typicalAmount: amount, icon };
    try {
      setSaving(true);
      if (bill) {
        await updateBill(bill.id, fields);
      } else {
        let billId = createdId;
        if (!billId) {
          billId = (await addBill(fields, houseId)).id;
          setCreatedId(billId);
        }
        if (lastPaidDate) {
          // The last payment covers the billing period starting the month it was paid.
          await logPayment(
            {
              billId,
              amount,
              paidAt: lastPaidDate,
              note: '',
              coverageStart: monthStart(lastPaidDate),
              coverageMonths: FREQUENCY_MONTHS[frequency],
              paidBy: assignedTo,
            },
            houseId
          );
        }
      }
      onClose();
    } catch (err) {
      setError(getErrorMessage(err, t('bills.failed_save')));
    } finally {
      setSaving(false);
    }
  }, [
    saving,
    name,
    amount,
    assignedTo,
    houseId,
    frequency,
    icon,
    bill,
    updateBill,
    addBill,
    lastPaidDate,
    logPayment,
    createdId,
    onClose,
    t,
  ]);

  const handleCancel = useCallback((): void => {
    if (!saving) onClose();
  }, [saving, onClose]);
  const selectFrequency = useCallback((id: string): void => setFrequency(id as BillFrequency), []);
  const openDatePicker = useCallback((): void => setShowDatePicker(true), []);
  const closeDatePicker = useCallback((): void => setShowDatePicker(false), []);
  const handleDateSelect = useCallback((val: string): void => {
    setLastPaidDate(val);
    setShowDatePicker(false);
  }, []);

  const inputStyle = [styles.input, { borderColor: p.border, color: p.text }];

  return (
    <View style={[styles.form, { backgroundColor: p.card, borderColor: p.border }]}>
      <Text style={[styles.title, { color: p.text }]}>
        {bill ? t('bills.household_edit_bill') : t('bills.household_new_recurring')}
      </Text>

      <Text style={[styles.label, { color: p.muted }]}>{t('bills.household_icon')}</Text>
      <BillIconPicker value={icon} onChange={setIcon} />

      <Text style={[styles.label, { color: p.muted }]}>{t('bills.household_bill_name')}</Text>
      <TextInput
        style={inputStyle}
        value={name}
        onChangeText={setName}
        placeholder={t('bills.household_bill_name_placeholder')}
        placeholderTextColor={p.muted}
        autoCorrect={false}
        accessibilityLabel={t('bills.household_bill_name')}
        accessibilityHint={t('bills.hint_bill_name')}
      />

      <ChoiceChips
        label={t('bills.household_who_pays')}
        options={people}
        selected={[assignedTo]}
        mode="single"
        onToggle={setAssignedTo}
      />

      <ChoiceChips
        label={t('bills.household_how_often')}
        options={FREQUENCIES.map((f) => ({ id: f, name: t(`bills.freq_${f}`) }))}
        selected={[frequency]}
        mode="single"
        onToggle={selectFrequency}
      />

      <Text style={[styles.label, { color: p.muted }]}>{t('bills.recurring_usual_amount')}</Text>
      <TextInput
        style={[inputStyle, styles.ltr]}
        value={typicalAmount}
        onChangeText={setTypicalAmount}
        keyboardType="decimal-pad"
        placeholder="0"
        placeholderTextColor={p.muted}
        accessibilityLabel={t('bills.recurring_usual_amount')}
        accessibilityHint={t('bills.hint_typical_amount')}
      />

      {!bill && (
        <>
          <Text style={[styles.label, { color: p.muted }]}>
            {t('bills.household_last_paid_label')}
          </Text>
          <Text style={[styles.hint, { color: p.muted }]}>
            {t('bills.household_last_paid_help')}
          </Text>
          <Pressable
            style={[inputStyle, styles.dateBtn]}
            onPress={openDatePicker}
            accessible
            accessibilityRole="button"
            accessibilityLabel={t('bills.select_last_paid_date')}
          >
            <Ionicons name="calendar-outline" size={16} color={p.primary} />
            <Text style={[styles.dateText, { color: p.text }]}>
              {lastPaidDate
                ? formatDateDDMMYYYY(lastPaidDate)
                : t('bills.household_tap_select_date')}
            </Text>
          </Pressable>
          <DatePickerModal
            visible={showDatePicker}
            value={lastPaidDate}
            onSelect={handleDateSelect}
            onClose={closeDatePicker}
          />
        </>
      )}

      {!!error && <Text style={[styles.error, { color: p.overdueText }]}>{error}</Text>}

      <View style={styles.actions}>
        <Pressable
          style={[styles.btn, styles.cancelBtn, { borderColor: p.border }]}
          onPress={handleCancel}
          disabled={saving}
          accessible
          accessibilityRole="button"
          accessibilityState={{ disabled: saving }}
        >
          <Text style={[styles.btnText, { color: p.text }]}>{t('common.cancel')}</Text>
        </Pressable>
        <Pressable
          style={[styles.btn, { backgroundColor: p.primary }, !canSave && styles.dimmed]}
          onPress={handleSave}
          disabled={!canSave}
          accessible
          accessibilityRole="button"
          accessibilityState={{ disabled: !canSave, busy: saving }}
        >
          <Text style={[styles.btnText, { color: p.onPrimary }]}>
            {saving
              ? t('bills.household_saving')
              : bill
                ? t('bills.household_save_changes')
                : t('bills.household_add_bill')}
          </Text>
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  form: { borderRadius: ms(18), borderWidth: 1, padding: ms(16), gap: ms(12) },
  title: { fontSize: mf(17), ...font.semibold },
  label: { fontSize: mf(13), ...font.medium, marginBottom: ms(-4) },
  hint: { fontSize: mf(12), ...font.regular },
  input: {
    minHeight: ms(48),
    borderWidth: 1,
    borderRadius: ms(12),
    paddingHorizontal: ms(14),
    fontSize: mf(16),
    ...font.regular,
  },
  ltr: { writingDirection: 'ltr' },
  dateBtn: { flexDirection: 'row', alignItems: 'center', gap: ms(8) },
  dateText: { fontSize: mf(15), ...font.regular },
  error: { fontSize: mf(14), ...font.medium },
  actions: { flexDirection: 'row', justifyContent: 'flex-end', gap: ms(10), marginTop: ms(4) },
  btn: {
    minHeight: ms(44),
    paddingHorizontal: ms(18),
    borderRadius: ms(12),
    alignItems: 'center',
    justifyContent: 'center',
  },
  cancelBtn: { borderWidth: 1 },
  btnText: { fontSize: mf(15), ...font.semibold },
  dimmed: { opacity: 0.6 },
});
