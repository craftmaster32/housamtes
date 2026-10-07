import { useState, useCallback } from 'react';
import { View, StyleSheet, Pressable, Modal, ScrollView, TextInput } from 'react-native';
import { Text } from 'react-native-paper';
import { useTranslation } from 'react-i18next';
import { Ionicons } from '@expo/vector-icons';
import type { HouseholdPayment, RecurringBill } from '@stores/recurringBillsStore';
import { usePaymentForm } from '@hooks/usePaymentForm';
import { DatePickerModal } from '@components/bills/DatePickerModal';
import { Alert } from '@lib/alert';
import { useSettingsStore } from '@stores/settingsStore';
import { font } from '@constants/typography';
import { formatDateDDMMYYYY } from '@utils/dates';
import { formatPeriod } from '@utils/recurringCoverage';
import { mf, ms } from '@utils/responsive';
import { formatMoney } from './money';
import { PeriodStepper } from './PeriodStepper';
import { SheetHeader } from './SheetHeader';
import { ChoiceChips, type ChoiceOption } from './ChoiceChips';
import { useRecurringPalette } from './palette';

interface PaymentSheetProps {
  visible: boolean;
  bill: RecurringBill;
  payment?: HouseholdPayment; // set = edit this payment (with a delete option)
  people: ChoiceOption[];
  onClose: () => void;
}

/** Bottom sheet to log a payment for a bill, or edit / delete a logged one. */
export function PaymentSheet({
  visible,
  bill,
  payment,
  people,
  onClose,
}: PaymentSheetProps): React.JSX.Element {
  const { t, i18n } = useTranslation();
  const p = useRecurringPalette();
  const currency = useSettingsStore((s) => s.currency);
  const form = usePaymentForm({
    bill,
    payment,
    memberIds: people.map((x) => x.id),
    visible,
    onDone: onClose,
  });
  const [showDatePicker, setShowDatePicker] = useState(false);
  const isEdit = payment !== undefined;

  const close = useCallback((): void => {
    if (!form.saving) onClose();
  }, [form.saving, onClose]);
  const openDatePicker = useCallback((): void => setShowDatePicker(true), []);
  const closeDatePicker = useCallback((): void => setShowDatePicker(false), []);
  const { setPaidAt, remove } = form;
  const handleDateSelect = useCallback(
    (val: string): void => {
      setPaidAt(val);
      setShowDatePicker(false);
    },
    [setPaidAt]
  );

  const confirmDelete = useCallback((): void => {
    if (!payment) return;
    const periodLabel = form.periodKnown
      ? formatPeriod(form.period, i18n.language)
      : payment.note || formatDateDDMMYYYY(payment.paidAt);
    Alert.alert(
      t('bills.household_delete_payment_title'),
      t('bills.household_delete_payment_body', {
        amount: formatMoney(currency, payment.amount),
        period: periodLabel,
      }),
      [
        { text: t('common.cancel'), style: 'cancel' },
        { text: t('common.delete'), style: 'destructive', onPress: (): void => void remove() },
      ]
    );
  }, [payment, currency, form.periodKnown, form.period, i18n.language, remove, t]);

  const inputStyle = [styles.input, { borderColor: p.border, color: p.text }];

  return (
    <>
      <Modal visible={visible} transparent animationType="slide" onRequestClose={close}>
        <View style={[styles.overlay, { backgroundColor: p.overlay }]}>
          <Pressable
            style={styles.backdrop}
            onPress={close}
            accessibilityRole="button"
            accessibilityLabel={t('common.close')}
          />
          <View style={[styles.sheet, { backgroundColor: p.card }]} accessibilityViewIsModal>
            <SheetHeader
              eyebrow={isEdit ? t('bills.edit_payment') : t('bills.recurring_log_payment')}
              title={bill.name}
              onClose={close}
            />

            <ScrollView contentContainerStyle={styles.body} keyboardShouldPersistTaps="handled">
              <PeriodStepper
                label={t('bills.recurring_period_covered')}
                value={form.period}
                caption={
                  !form.periodKnown
                    ? t('bills.recurring_period_unknown')
                    : isEdit
                      ? undefined
                      : t('bills.recurring_next_unpaid')
                }
                onChange={form.setPeriod}
              />

              <View style={styles.twoCol}>
                <View style={styles.col}>
                  <Text style={[styles.label, { color: p.muted }]}>
                    {t('bills.recurring_amount')}
                  </Text>
                  <TextInput
                    style={[inputStyle, styles.amount]}
                    value={form.amount}
                    onChangeText={form.setAmount}
                    keyboardType="decimal-pad"
                    accessibilityLabel={t('bills.recurring_amount')}
                    accessibilityHint={t('bills.hint_amount_paid')}
                  />
                </View>
                <View style={styles.col}>
                  <Text style={[styles.label, { color: p.muted }]}>
                    {t('bills.recurring_paid_on')}
                  </Text>
                  <Pressable
                    style={[inputStyle, styles.dateBtn]}
                    onPress={openDatePicker}
                    accessible
                    accessibilityRole="button"
                    accessibilityLabel={`${t('bills.recurring_paid_on')}: ${formatDateDDMMYYYY(form.paidAt)}`}
                    accessibilityHint={t('bills.select_payment_date')}
                  >
                    <Text style={[styles.dateText, { color: p.text }]}>
                      {formatDateDDMMYYYY(form.paidAt)}
                    </Text>
                    <Ionicons name="calendar-outline" size={18} color={p.primary} />
                  </Pressable>
                </View>
              </View>

              {people.length > 0 && (
                <ChoiceChips
                  label={t('bills.recurring_paid_by')}
                  options={people}
                  selected={form.paidBy ? [form.paidBy] : []}
                  mode="single"
                  onToggle={form.setPaidBy}
                />
              )}

              {people.length > 1 && (
                <ChoiceChips
                  label={t('bills.household_split_between')}
                  options={people}
                  selected={form.splitWith}
                  mode="multi"
                  onToggle={form.toggleSplit}
                />
              )}

              <View>
                <Text style={[styles.label, { color: p.muted }]}>{t('bills.household_note')}</Text>
                <TextInput
                  style={inputStyle}
                  value={form.note}
                  onChangeText={form.setNote}
                  accessibilityLabel={t('bills.household_note')}
                  accessibilityHint={t('bills.hint_optional_note')}
                />
              </View>

              {!!form.error && (
                <Text style={[styles.error, { color: p.overdueText }]} accessibilityRole="alert">
                  {form.error}
                </Text>
              )}

              <Pressable
                style={({ pressed }) => [
                  styles.primaryBtn,
                  { backgroundColor: p.primary },
                  (!form.canSave || pressed) && styles.dimmed,
                ]}
                onPress={form.save}
                disabled={!form.canSave}
                accessible
                accessibilityRole="button"
                accessibilityState={{ disabled: !form.canSave, busy: form.saving }}
              >
                <Text style={[styles.primaryText, { color: p.onPrimary }]}>
                  {form.saving
                    ? t('bills.household_saving')
                    : isEdit
                      ? t('bills.household_save_changes')
                      : t('bills.recurring_save_payment')}
                </Text>
              </Pressable>

              {isEdit && (
                <Pressable
                  style={styles.deleteBtn}
                  onPress={confirmDelete}
                  disabled={form.saving}
                  accessible
                  accessibilityRole="button"
                >
                  <Text style={[styles.deleteText, { color: p.overdueText }]}>
                    {t('bills.delete_payment')}
                  </Text>
                </Pressable>
              )}
            </ScrollView>
          </View>
        </View>
      </Modal>

      {/* Sibling of the sheet (not nested) — nested RN Modals misbehave on Android. */}
      <DatePickerModal
        visible={showDatePicker}
        value={form.paidAt}
        onSelect={handleDateSelect}
        onClose={closeDatePicker}
      />
    </>
  );
}

const styles = StyleSheet.create({
  overlay: { flex: 1, justifyContent: 'flex-end' },
  backdrop: { ...StyleSheet.absoluteFillObject },
  sheet: {
    borderTopLeftRadius: ms(24),
    borderTopRightRadius: ms(24),
    maxHeight: '92%',
    width: '100%',
    maxWidth: 560,
    alignSelf: 'center',
  },
  body: { padding: ms(20), paddingBottom: ms(32), gap: ms(18) },
  twoCol: { flexDirection: 'row', gap: ms(12) },
  col: { flex: 1, minWidth: 0 },
  label: { fontSize: mf(13), ...font.medium, marginBottom: ms(6) },
  input: {
    minHeight: ms(48),
    borderWidth: 1,
    borderRadius: ms(12),
    paddingHorizontal: ms(14),
    fontSize: mf(16),
    ...font.regular,
  },
  amount: { writingDirection: 'ltr' },
  dateBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  dateText: { fontSize: mf(16), ...font.regular },
  error: { fontSize: mf(14), ...font.medium },
  primaryBtn: {
    minHeight: ms(52),
    borderRadius: ms(14),
    alignItems: 'center',
    justifyContent: 'center',
  },
  dimmed: { opacity: 0.6 },
  primaryText: { fontSize: mf(16), ...font.semibold },
  deleteBtn: { minHeight: ms(44), alignItems: 'center', justifyContent: 'center' },
  deleteText: { fontSize: mf(15), ...font.semibold },
});
