import { useState, useCallback, useEffect, useMemo } from 'react';
import { View, Pressable, TextInput, StyleSheet, Platform } from 'react-native';
import { Text } from 'react-native-paper';
import { useTranslation } from 'react-i18next';
import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { PageSheet } from '@components/shared/PageSheet';
import { SheetButton } from '@components/shared/SheetButton';
import { NotebookPaper } from '@components/shared/NotebookPaper';
import { Money } from '@components/shared/Money';
import { UnderlineInput } from '@components/bills/form/UnderlineInput';
import { DatePickerModal } from '@components/bills/DatePickerModal';
import { useSettleWithForm, parseAmount } from '@hooks/useSettleWithForm';
import { useMemberName } from '@hooks/useMemberName';
import { useHeadingFont } from '@hooks/useHeadingFont';
import { useHandFont } from '@hooks/useHandFont';
import { useAuthStore } from '@stores/authStore';
import { useSettingsStore } from '@stores/settingsStore';
import { useThemedColors } from '@constants/colors';
import { formatFull, splitMoney } from '@constants/currencies';
import { font, heading } from '@constants/typography';
import { formatDateDDMMYYYY } from '@utils/dates';
import { mf, ms } from '@utils/responsive';
import type { SettlementPayment, Transfer } from '@utils/settleUp';

interface SettleWithSheetProps {
  visible: boolean;
  /** Settle this pair (amount = what's left). */
  transfer?: Transfer | null;
  /** Or change / delete this recorded payment. */
  payment?: SettlementPayment | null;
  /** Already paid between them in this open period ("₪30 already paid"). */
  paidSoFar?: number;
  onClose: () => void;
}

/**
 * "Settle with Maya" — like Splitwise, on the house's notebook paper: what's
 * left in big numbers, one tap to mark it all paid, or write in part of it and
 * see what's left after it. Opened on a recorded payment, it edits or deletes.
 */
export function SettleWithSheet({
  visible,
  transfer,
  payment,
  paidSoFar = 0,
  onClose,
}: SettleWithSheetProps): React.JSX.Element {
  const { t } = useTranslation();
  const c = useThemedColors();
  const headingFont = useHeadingFont('semibold');
  const handFont = useHandFont();
  const myId = useAuthStore((s) => s.profile?.id ?? '');
  const currencyCode = useSettingsStore((s) => s.currencyCode);
  const memberName = useMemberName();
  const form = useSettleWithForm({ visible, transfer, payment, onDone: onClose });
  const [showPart, setShowPart] = useState(false);
  const [showDate, setShowDate] = useState(false);
  const curSymbol = useMemo(() => splitMoney(0, currencyCode).symbol, [currencyCode]);

  useEffect((): void => {
    if (visible) setShowPart(false);
  }, [visible]);

  const first = (id: string): string =>
    id === myId ? t('bills.you_label') : memberName(id).split(' ')[0];
  const title = t('bills.settle_pays', { from: first(form.from), to: first(form.to) });
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

  const writing = form.isEdit || showPart;
  const typed = parseAmount(form.amount);
  const leftAfter = form.maxSettle - (typed > 0 ? typed : 0);

  // The handwritten line under the amount: always says what's left.
  const note = !writing
    ? paidSoFar >= 0.01
      ? t('bills.settle_already_paid', { money: money(paidSoFar) })
      : ''
    : form.tooMuch
      ? ''
      : !(typed > 0)
        ? t('bills.settle_left_now', { money: money(form.maxSettle) })
        : leftAfter < 0.01
          ? t('bills.settle_all_settled_after')
          : t('bills.settle_left_after', { money: money(leftAfter) });

  return (
    <>
      <PageSheet
        visible={visible}
        eyebrow={form.isEdit ? t('bills.settle_edit_eyebrow') : t('bills.settle_up')}
        title={title}
        onClose={close}
      >
        {/* The amount, written on a notebook page — like New expense. */}
        <NotebookPaper>
          <Text style={[styles.paperLabel, { color: c.paperMuted }]}>
            {writing ? t('bills.settle_amount_paid') : t('bills.settle_left')}
          </Text>
          {writing ? (
            <View style={styles.amountRow}>
              <Text style={[styles.amountCur, headingFont, { color: c.paperMuted }]}>
                {curSymbol}
              </Text>
              <TextInput
                value={form.amount}
                onChangeText={form.setAmount}
                keyboardType="decimal-pad"
                placeholder="0.00"
                placeholderTextColor={c.paperMuted}
                underlineColorAndroid="transparent"
                autoFocus={!form.isEdit}
                editable={form.isParty}
                style={[styles.amountInput, headingFont, { color: c.paperInk }]}
                accessibilityLabel={t('bills.recurring_amount')}
                accessibilityHint={t('bills.settle_amount_hint')}
              />
            </View>
          ) : (
            <Money
              amount={form.maxSettle}
              currencyCode={currencyCode}
              size={ms(52)}
              color={c.paperInk}
              mutedColor={c.paperMuted}
              wholeFamily={heading.semibold.fontFamily}
              style={styles.amountShown}
            />
          )}
          {!!note && <Text style={[styles.hand, handFont, { color: c.paperMuted }]}>{note}</Text>}
        </NotebookPaper>

        {!form.isParty && (
          <Text style={[styles.help, { color: c.textSecondary }]}>
            {form.isEdit ? t('bills.settle_edit_not_party') : t('bills.settle_not_involved')}
          </Text>
        )}

        {/* One tap: everything left is paid. */}
        {!writing && form.isParty && form.maxSettle >= 0.01 && (
          <>
            <SheetButton
              label={
                form.saving
                  ? t('bills.household_saving')
                  : t('bills.settle_paid_all', { money: money(form.maxSettle) })
              }
              onPress={form.payAll}
              disabled={form.saving}
              loading={form.saving}
            />
            <Pressable
              style={({ pressed }) => [styles.link, pressed && styles.pressed]}
              onPress={openPart}
              accessibilityRole="button"
            >
              <Text style={[styles.linkText, { color: c.primary }]}>
                {t('bills.settle_paid_part')}
              </Text>
            </Pressable>
          </>
        )}

        {writing && form.isParty && (
          <>
            {/* Date, written on a line. */}
            <Pressable
              style={[styles.dateRow, { borderBottomColor: c.border }]}
              onPress={openDate}
              accessibilityRole="button"
              accessibilityLabel={`${t('bills.recurring_paid_on')}: ${formatDateDDMMYYYY(form.paidOn)}`}
              accessibilityHint={t('bills.select_payment_date')}
            >
              <Text style={[styles.label, { color: c.textSecondary }]}>
                {t('bills.recurring_paid_on')}
              </Text>
              <View style={styles.dateValue}>
                <Text style={[styles.value, { color: c.textPrimary }]}>
                  {formatDateDDMMYYYY(form.paidOn)}
                </Text>
                <Ionicons name="calendar-outline" size={18} color={c.textSecondary} />
              </View>
            </Pressable>

            {form.isEdit && (
              <UnderlineInput
                label={t('bills.household_note')}
                value={form.note}
                onChangeText={form.setNote}
                accessibilityLabel={t('bills.household_note')}
                accessibilityHint={t('bills.hint_optional_note')}
              />
            )}

            {form.tooMuch && (
              <View>
                <Text style={[styles.error, { color: c.danger }]} accessibilityRole="alert">
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
                  style={({ pressed }) => [styles.linkStart, pressed && styles.pressed]}
                  onPress={addAsBill}
                  accessibilityRole="button"
                >
                  <Text style={[styles.linkText, { color: c.primary }]}>
                    {t('bills.settle_add_as_bill')}
                  </Text>
                </Pressable>
              </View>
            )}
            {form.isFuture && (
              <Text style={[styles.error, { color: c.danger }]} accessibilityRole="alert">
                {t('bills.settle_future_date')}
              </Text>
            )}

            <SheetButton
              label={
                form.saving
                  ? t('bills.household_saving')
                  : form.isEdit
                    ? t('bills.household_save_changes')
                    : t('bills.settle_record_save')
              }
              onPress={form.save}
              disabled={!form.canSave}
              loading={form.saving}
            />
          </>
        )}

        {!!form.error && (
          <Text style={[styles.error, { color: c.danger }]} accessibilityRole="alert">
            {form.error}
          </Text>
        )}

        {form.isEdit && form.isParty && (
          <Pressable
            style={({ pressed }) => [styles.link, pressed && styles.pressed]}
            onPress={form.remove}
            disabled={form.saving}
            accessibilityRole="button"
          >
            <Text style={[styles.linkText, { color: c.danger }]}>
              {t('bills.settle_delete_title')}
            </Text>
          </Pressable>
        )}
      </PageSheet>

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

const styles = StyleSheet.create({
  paperLabel: { fontSize: mf(16), ...font.bold },
  amountRow: { flexDirection: 'row', alignItems: 'baseline', gap: ms(6), marginTop: ms(10) },
  amountCur: { fontSize: mf(30) },
  // Money stays LTR so digits and symbol don't reorder under Hebrew.
  amountInput: {
    flex: 1,
    minWidth: 0,
    fontSize: mf(52),
    letterSpacing: -1.5,
    padding: 0,
    margin: 0,
    writingDirection: 'ltr',
    // No square focus box on the web — it's written on the page.
    ...(Platform.OS === 'web' ? ({ outlineStyle: 'none' } as object) : null),
  },
  amountShown: { marginTop: ms(6), writingDirection: 'ltr' },
  hand: { fontSize: mf(22), marginTop: ms(6) },
  help: { fontSize: mf(14.5), ...font.medium, lineHeight: mf(20) },
  link: { minHeight: 44, alignItems: 'center', justifyContent: 'center' },
  linkStart: { minHeight: 44, justifyContent: 'center' },
  linkText: { fontSize: mf(16), ...font.bold },
  pressed: { opacity: 0.6 },
  dateRow: { borderBottomWidth: 1.5, paddingBottom: ms(8), minHeight: 44 },
  label: { fontSize: mf(13.5), ...font.bold, marginBottom: ms(4) },
  dateValue: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  value: { fontSize: mf(17), ...font.semibold },
  error: { fontSize: mf(14), ...font.medium, lineHeight: mf(20) },
});
