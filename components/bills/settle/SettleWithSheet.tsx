import { useState, useCallback, useEffect } from 'react';
import { View, Pressable, ScrollView, TextInput } from 'react-native';
import { Text } from 'react-native-paper';
import { useTranslation } from 'react-i18next';
import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { DatePickerModal } from '@components/bills/DatePickerModal';
import { useRecurringPalette } from '@components/bills/recurring/palette';
import { useSettleWithForm } from '@hooks/useSettleWithForm';
import { useMemberName } from '@hooks/useMemberName';
import { useAuthStore } from '@stores/authStore';
import { useSettingsStore } from '@stores/settingsStore';
import { formatFull } from '@constants/currencies';
import { formatDateDDMMYYYY } from '@utils/dates';
import type { SettlementPayment, Transfer } from '@utils/settleUp';
import { SettleSheet } from './SettleSheet';
import { settleStyles as styles } from './settleStyles';

interface SettleWithSheetProps {
  visible: boolean;
  /** Settle this pair (amount = what's left). */
  transfer?: Transfer | null;
  /** Or change / delete this recorded payment. */
  payment?: SettlementPayment | null;
  /** Already paid between them in this open period (shown as "₪50 paid"). */
  paidSoFar?: number;
  onClose: () => void;
}

/**
 * "Settle with Maya" — like Splitwise: one tap to mark everything paid, or
 * enter part of it. Opened on a recorded payment, it edits or deletes it.
 */
export function SettleWithSheet({
  visible,
  transfer,
  payment,
  paidSoFar = 0,
  onClose,
}: SettleWithSheetProps): React.JSX.Element {
  const { t } = useTranslation();
  const p = useRecurringPalette();
  const myId = useAuthStore((s) => s.profile?.id ?? '');
  const currencyCode = useSettingsStore((s) => s.currencyCode);
  const memberName = useMemberName();
  const form = useSettleWithForm({ visible, transfer, payment, onDone: onClose });
  const [showPart, setShowPart] = useState(false);
  const [showDate, setShowDate] = useState(false);

  useEffect((): void => {
    if (visible) setShowPart(false);
  }, [visible]);

  const name = (id: string): string =>
    id === myId ? t('bills.you_label') : memberName(id).split(' ')[0];
  const title = t('bills.settle_pays', { from: name(form.from), to: name(form.to) });
  const money = (n: number): string => formatFull(n, currencyCode);

  const close = useCallback((): void => {
    if (!form.saving) onClose();
  }, [form.saving, onClose]);
  const openPart = useCallback((): void => setShowPart(true), []);
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
  const addAsBill = useCallback((): void => {
    onClose();
    router.push('/(tabs)/bills/add');
  }, [onClose]);

  const showForm = form.isEdit || showPart;
  const inputStyle = [styles.input, { borderColor: p.border, color: p.text }];

  return (
    <>
      <SettleSheet
        visible={visible}
        eyebrow={form.isEdit ? t('bills.settle_edit_eyebrow') : t('bills.settle_up')}
        title={title}
        onClose={close}
      >
        <ScrollView contentContainerStyle={styles.body} keyboardShouldPersistTaps="handled">
          {/* What's left between them, in big numbers. */}
          {!form.isEdit && (
            <View>
              <Text style={[styles.bigAmount, { color: p.text }]}>{money(form.maxSettle)}</Text>
              <Text style={[styles.help, { color: p.muted }]}>
                {paidSoFar >= 0.01
                  ? t('bills.settle_left_after_paid', { paid: money(paidSoFar) })
                  : t('bills.settle_left')}
              </Text>
            </View>
          )}

          {!form.isEdit && !form.isParty && (
            <Text style={[styles.help, { color: p.muted }]}>{t('bills.settle_not_involved')}</Text>
          )}

          {!form.isEdit && form.isParty && form.maxSettle >= 0.01 && (
            <Pressable
              style={({ pressed }) => [
                styles.primaryBtn,
                { backgroundColor: p.primary },
                (form.saving || pressed) && styles.dimmed,
              ]}
              onPress={form.payAll}
              disabled={form.saving}
              accessibilityRole="button"
              accessibilityState={{ busy: form.saving }}
            >
              <Text style={[styles.primaryText, { color: p.onPrimary }]}>
                {form.saving
                  ? t('bills.household_saving')
                  : t('bills.settle_paid_all', { money: money(form.maxSettle) })}
              </Text>
            </Pressable>
          )}

          {!form.isEdit && form.isParty && !showPart && form.maxSettle >= 0.01 && (
            <Pressable
              style={({ pressed }) => [styles.linkBtn, styles.centered, pressed && styles.dimmed]}
              onPress={openPart}
              accessibilityRole="button"
            >
              <Text style={[styles.linkText, { color: p.primary }]}>
                {t('bills.settle_paid_part')}
              </Text>
            </Pressable>
          )}

          {showForm && form.isParty && (
            <>
              <View style={styles.twoCol}>
                <View style={styles.col}>
                  <Text style={[styles.label, { color: p.muted }]}>
                    {t('bills.recurring_amount')}
                  </Text>
                  <TextInput
                    style={[inputStyle, styles.ltr]}
                    value={form.amount}
                    onChangeText={form.setAmount}
                    keyboardType="decimal-pad"
                    autoFocus={!form.isEdit}
                    accessibilityLabel={t('bills.recurring_amount')}
                    accessibilityHint={t('bills.settle_amount_hint')}
                  />
                </View>
                <View style={styles.col}>
                  <Text style={[styles.label, { color: p.muted }]}>
                    {t('bills.recurring_paid_on')}
                  </Text>
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

              {form.isEdit && (
                <View>
                  <Text style={[styles.label, { color: p.muted }]}>
                    {t('bills.household_note')}
                  </Text>
                  <TextInput
                    style={inputStyle}
                    value={form.note}
                    onChangeText={form.setNote}
                    maxLength={200}
                    accessibilityLabel={t('bills.household_note')}
                    accessibilityHint={t('bills.hint_optional_note')}
                  />
                </View>
              )}

              {form.tooMuch && (
                <View style={styles.tooMuch} accessibilityRole="alert">
                  <Text style={[styles.error, { color: p.overdueText }]}>
                    {form.maxSettle < 0.01
                      ? t('bills.settle_nothing_owed', {
                          from: memberName(form.from),
                          to: memberName(form.to),
                        })
                      : t('bills.settle_too_much', {
                          from: memberName(form.from),
                          to: memberName(form.to),
                          max: money(form.maxSettle),
                        })}
                  </Text>
                  <Pressable
                    style={({ pressed }) => [styles.linkBtn, pressed && styles.dimmed]}
                    onPress={addAsBill}
                    accessibilityRole="button"
                  >
                    <Text style={[styles.linkText, { color: p.primary }]}>
                      {t('bills.settle_add_as_bill')}
                    </Text>
                  </Pressable>
                </View>
              )}
              {form.isFuture && (
                <Text style={[styles.error, { color: p.overdueText }]} accessibilityRole="alert">
                  {t('bills.settle_future_date')}
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
                  {form.saving
                    ? t('bills.household_saving')
                    : form.isEdit
                      ? t('bills.household_save_changes')
                      : t('bills.settle_record_save')}
                </Text>
              </Pressable>
            </>
          )}

          {form.isEdit && !form.isParty && (
            <Text style={[styles.help, { color: p.muted }]}>
              {t('bills.settle_edit_not_party')}
            </Text>
          )}

          {!!form.error && (
            <Text style={[styles.error, { color: p.overdueText }]} accessibilityRole="alert">
              {form.error}
            </Text>
          )}

          {form.isEdit && form.isParty && (
            <Pressable
              style={({ pressed }) => [styles.linkBtn, styles.centered, pressed && styles.dimmed]}
              onPress={form.remove}
              disabled={form.saving}
              accessibilityRole="button"
            >
              <Text style={[styles.linkText, { color: p.overdueText }]}>
                {t('bills.settle_delete_title')}
              </Text>
            </Pressable>
          )}
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
