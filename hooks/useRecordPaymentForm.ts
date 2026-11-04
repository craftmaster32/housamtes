import { useState, useEffect, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import { Alert } from '@lib/alert';
import { useAuthStore } from '@stores/authStore';
import { useSettingsStore } from '@stores/settingsStore';
import { useSettlementPaymentsStore } from '@stores/settlementPaymentsStore';
import { useHouseMoney } from '@hooks/useHouseMoney';
import { useMemberName } from '@hooks/useMemberName';
import { formatFull } from '@constants/currencies';
import { maxOwedBetween, type Transfer } from '@utils/settleUp';
import { todayISO } from '@utils/recurringCoverage';

interface Options {
  visible: boolean;
  plan: Transfer[];
  peopleIds: string[];
  onDone: () => void;
}

export interface RecordPaymentForm {
  from: string;
  to: string;
  amount: string;
  paidOn: string;
  note: string;
  saving: boolean;
  error: string;
  /** The current user isn't the payer or receiver, so it can't be saved. */
  notInvolved: boolean;
  canSave: boolean;
  setFrom: (id: string) => void;
  setTo: (id: string) => void;
  setAmount: (v: string) => void;
  setPaidOn: (v: string) => void;
  setNote: (v: string) => void;
  save: () => void;
}

/** Turns "120,50" / "120.50" into 120.5; NaN when it isn't a number. */
function parseAmount(raw: string): number {
  const cleaned = raw.replace(',', '.').trim();
  if (!/^\d+(\.\d{0,2})?$/.test(cleaned)) return NaN;
  return Number(cleaned);
}

/** State + save logic for "Record a payment" ("Dana paid Maya ₪500"). */
export function useRecordPaymentForm({
  visible,
  plan,
  peopleIds,
  onDone,
}: Options): RecordPaymentForm {
  const { t } = useTranslation();
  const myId = useAuthStore((s) => s.profile?.id ?? '');
  const houseId = useAuthStore((s) => s.houseId) ?? '';
  const currencyCode = useSettingsStore((s) => s.currencyCode);
  const recordPayment = useSettlementPaymentsStore((s) => s.recordPayment);
  const { net } = useHouseMoney();
  const memberName = useMemberName();

  const [from, setFromState] = useState('');
  const [to, setTo] = useState('');
  const [amount, setAmount] = useState('');
  const [paidOn, setPaidOn] = useState(todayISO());
  const [note, setNote] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  // Each time the sheet opens, start from the user's own suggested transfer.
  useEffect((): void => {
    if (!visible) return;
    const mine = plan.find((x) => x.from === myId || x.to === myId);
    const fallbackOther = peopleIds.find((id) => id !== myId) ?? '';
    setFromState(mine ? mine.from : myId);
    setTo(mine ? mine.to : fallbackOther);
    setAmount(mine ? mine.amount.toFixed(2) : '');
    setPaidOn(todayISO());
    setNote('');
    setError('');
    // Only re-seed when the sheet opens, not on every balance change while it's open.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [visible]);

  const setFrom = useCallback(
    (id: string): void => {
      setFromState(id);
      // Paying yourself makes no sense — move the receiver to someone else.
      if (id === to) setTo(peopleIds.find((p) => p !== id) ?? '');
    },
    [to, peopleIds]
  );

  const value = parseAmount(amount);
  const notInvolved = from !== '' && to !== '' && myId !== from && myId !== to;
  const canSave = !saving && from !== '' && to !== '' && from !== to && !notInvolved && value > 0;

  const doSave = useCallback(async (): Promise<void> => {
    setSaving(true);
    setError('');
    try {
      await recordPayment({ from, to, amount: value, paidOn, note: note.trim() || null }, houseId, {
        fromName: memberName(from),
        toName: memberName(to),
        money: formatFull(value, currencyCode),
      });
      onDone();
    } catch (err) {
      setError(err instanceof Error ? err.message : t('bills.settle_save_failed'));
    } finally {
      setSaving(false);
    }
  }, [recordPayment, from, to, value, paidOn, note, houseId, memberName, currencyCode, onDone, t]);

  const save = useCallback((): void => {
    if (!canSave) return;
    const owed = maxOwedBetween(net, from, to);
    if (value <= owed + 0.005) {
      void doSave();
      return;
    }
    // More than is owed: allowed, but say exactly what will happen first.
    const names = { from: memberName(from), to: memberName(to) };
    const extra = formatFull(value - owed, currencyCode);
    Alert.alert(
      t('bills.settle_overpay_title'),
      owed < 0.01
        ? t('bills.settle_overpay_none', { ...names, extra })
        : t('bills.settle_overpay_body', {
            ...names,
            owed: formatFull(owed, currencyCode),
            extra,
          }),
      [
        { text: t('common.cancel'), style: 'cancel' },
        { text: t('bills.settle_overpay_confirm'), onPress: (): void => void doSave() },
      ]
    );
  }, [canSave, net, from, to, value, doSave, memberName, currencyCode, t]);

  return {
    from,
    to,
    amount,
    paidOn,
    note,
    saving,
    error,
    notInvolved,
    canSave,
    setFrom,
    setTo,
    setAmount,
    setPaidOn,
    setNote,
    save,
  };
}
