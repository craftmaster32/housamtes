import { useState, useCallback, useMemo } from 'react';
import { View, Pressable, ScrollView, TextInput } from 'react-native';
import { Text } from 'react-native-paper';
import { useTranslation } from 'react-i18next';
import { Ionicons } from '@expo/vector-icons';
import { DatePickerModal } from '@components/bills/DatePickerModal';
import { ChoiceChips, type ChoiceOption } from '@components/bills/recurring/ChoiceChips';
import { useRecurringPalette } from '@components/bills/recurring/palette';
import { useRecordPaymentForm } from '@hooks/useRecordPaymentForm';
import { formatDateDDMMYYYY } from '@utils/dates';
import type { Transfer } from '@utils/settleUp';
import { SettleSheet } from './SettleSheet';
import { settleStyles as styles } from './settleStyles';

interface RecordPaymentSheetProps {
  visible: boolean;
  people: ChoiceOption[];
  plan: Transfer[];
  onClose: () => void;
}

/** "Record a payment": one housemate paid another any amount (full or partial). */
export function RecordPaymentSheet({
  visible,
  people,
  plan,
  onClose,
}: RecordPaymentSheetProps): React.JSX.Element {
  const { t } = useTranslation();
  const p = useRecurringPalette();
  const peopleIds = useMemo(() => people.map((x) => x.id), [people]);
  const form = useRecordPaymentForm({ visible, plan, peopleIds, onDone: onClose });
  const [showDate, setShowDate] = useState(false);
  const receivers = useMemo(() => people.filter((x) => x.id !== form.from), [people, form.from]);

  const close = useCallback((): void => {
    if (!form.saving) onClose();
  }, [form.saving, onClose]);
  const openDate = useCallback((): void => setShowDate(true), []);
  const closeDate = useCallback((): void => setShowDate(false), []);
  const { setPaidOn } = form;
  const pickDate = useCallback(
    (v: string): void => {
      setPaidOn(v);
      setShowDate(false);
    },
    [setPaidOn]
  );

  const inputStyle = [styles.input, { borderColor: p.border, color: p.text }];

  return (
    <>
      <SettleSheet
        visible={visible}
        eyebrow={t('bills.settle_up')}
        title={t('bills.settle_record_title')}
        onClose={close}
      >
        <ScrollView contentContainerStyle={styles.body} keyboardShouldPersistTaps="handled">
          <Text style={[styles.help, { color: p.muted }]}>{t('bills.settle_record_help')}</Text>

          <ChoiceChips
            label={t('bills.settle_who_paid')}
            options={people}
            selected={form.from ? [form.from] : []}
            mode="single"
            onToggle={form.setFrom}
            avatars
          />
          <ChoiceChips
            label={t('bills.settle_who_received')}
            options={receivers}
            selected={form.to ? [form.to] : []}
            mode="single"
            onToggle={form.setTo}
            avatars
          />

          <View style={styles.twoCol}>
            <View style={styles.col}>
              <Text style={[styles.label, { color: p.muted }]}>{t('bills.recurring_amount')}</Text>
              <TextInput
                style={[inputStyle, styles.ltr]}
                value={form.amount}
                onChangeText={form.setAmount}
                keyboardType="decimal-pad"
                accessibilityLabel={t('bills.recurring_amount')}
                accessibilityHint={t('bills.settle_amount_hint')}
              />
            </View>
            <View style={styles.col}>
              <Text style={[styles.label, { color: p.muted }]}>{t('bills.recurring_paid_on')}</Text>
              <Pressable
                style={[inputStyle, styles.dateBtn]}
                onPress={openDate}
                accessibilityRole="button"
                accessibilityLabel={`${t('bills.recurring_paid_on')}: ${formatDateDDMMYYYY(form.paidOn)}`}
                accessibilityHint={t('bills.select_payment_date')}
              >
                <Text style={[styles.dateText, { color: p.text }]}>
                  {formatDateDDMMYYYY(form.paidOn)}
                </Text>
                <Ionicons name="calendar-outline" size={18} color={p.muted} />
              </Pressable>
            </View>
          </View>

          <View>
            <Text style={[styles.label, { color: p.muted }]}>{t('bills.household_note')}</Text>
            <TextInput
              style={inputStyle}
              value={form.note}
              onChangeText={form.setNote}
              maxLength={200}
              accessibilityLabel={t('bills.household_note')}
              accessibilityHint={t('bills.hint_optional_note')}
            />
          </View>

          {form.isFuture && (
            <Text style={[styles.error, { color: p.overdueText }]} accessibilityRole="alert">
              {t('bills.settle_future_date')}
            </Text>
          )}
          {form.notInvolved && (
            <Text style={[styles.error, { color: p.overdueText }]} accessibilityRole="alert">
              {t('bills.settle_not_involved')}
            </Text>
          )}
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
            accessibilityRole="button"
            accessibilityState={{ disabled: !form.canSave, busy: form.saving }}
          >
            <Text style={[styles.primaryText, { color: p.onPrimary }]}>
              {form.saving ? t('bills.household_saving') : t('bills.settle_record_save')}
            </Text>
          </Pressable>
        </ScrollView>
      </SettleSheet>

      {/* Sibling of the sheet (not nested) — nested RN Modals misbehave on Android. */}
      <DatePickerModal
        visible={showDate}
        value={form.paidOn}
        onSelect={pickDate}
        onClose={closeDate}
      />
    </>
  );
}
