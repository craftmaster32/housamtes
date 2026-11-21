import { useState, useEffect, useCallback, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { Alert } from '@lib/alert';
import { useAuthStore } from '@stores/authStore';
import { useSettingsStore } from '@stores/settingsStore';
import {
  useSettlementPaymentsStore,
  SettlementDeleteNotAllowedError,
} from '@stores/settlementPaymentsStore';
import { useHouseMoney } from '@hooks/useHouseMoney';
import { useMemberName } from '@hooks/useMemberName';
import { formatFull } from '@constants/currencies';
import {
  applySettlementPayments,
  maxOwedBetween,
  type SettlementPayment,
  type Transfer,
} from '@utils/settleUp';
import { todayISO } from '@utils/recurringCoverage';
import { formatDateDDMMYYYY } from '@utils/dates';

/** Same payer, receiver and amount within this many days = probably recorded twice. */
const DUPLICATE_WINDOW_DAYS = 7;

function daysBetween(a: string, b: string): number {
  return (Date.parse(`${a}T12:00:00Z`) - Date.parse(`${b}T12:00:00Z`)) / 86_400_000;
}

/** Turns "120,50" / "120.50" into 120.5; NaN when it isn't a number. */
export function parseAmount(raw: string): number {
  const cleaned = raw.replace(',', '.').trim();
  if (!/^\d+(\.\d{0,2})?$/.test(cleaned)) return NaN;
  return Number(cleaned);
}

interface Options {
  visible: boolean;
  /** A new settle-up for this pair (amount = what's left to settle). */
  transfer?: Transfer | null;
  /** Or an existing payment to change or delete. */
  payment?: SettlementPayment | null;
  onDone: () => void;
}

export interface SettleWithForm {
  isEdit: boolean;
  from: string;
  to: string;
  /** The most that can be settled between them: brings it to zero. */
  maxSettle: number;
  amount: string;
  paidOn: string;
  note: string;
  saving: boolean;
  error: string;
  tooMuch: boolean;
  isFuture: boolean;
  canSave: boolean;
  /** The current user is the payer or receiver (only they can save or delete). */
  isParty: boolean;
  setAmount: (v: string) => void;
  setPaidOn: (v: string) => void;
  setNote: (v: string) => void;
  /** One tap: everything left is paid. */
  payAll: () => void;
  save: () => void;
  remove: () => void;
}

/** Ask a yes/no question; resolves true only if the confirm button is tapped. */
function ask(
  title: string,
  body: string,
  yes: string,
  no: string,
  destructive = false
): Promise<boolean> {
  return new Promise((resolve) => {
    Alert.alert(title, body, [
      { text: no, style: 'cancel', onPress: (): void => resolve(false) },
      {
        text: yes,
        style: destructive ? 'destructive' : 'default',
        onPress: (): void => resolve(true),
      },
    ]);
  });
}

/**
 * "Settle with Maya": pay everything left in one tap, pay part of it, or fix /
 * delete a payment already recorded. A settle-up only ever brings a debt down
 * to zero — anything beyond that is new spending (a bill).
 */
export function useSettleWithForm({ visible, transfer, payment, onDone }: Options): SettleWithForm {
  const { t } = useTranslation();
  const myId = useAuthStore((s) => s.profile?.id ?? '');
  const houseId = useAuthStore((s) => s.houseId) ?? '';
  const currencyCode = useSettingsStore((s) => s.currencyCode);
  const payments = useSettlementPaymentsStore((s) => s.payments);
  const recordPayment = useSettlementPaymentsStore((s) => s.recordPayment);
  const updatePayment = useSettlementPaymentsStore((s) => s.updatePayment);
  const deletePayment = useSettlementPaymentsStore((s) => s.deletePayment);
  const { net } = useHouseMoney();
  const memberName = useMemberName();

  const isEdit = !!payment;
  const from = payment?.from ?? transfer?.from ?? '';
  const to = payment?.to ?? transfer?.to ?? '';

  // When editing, the payment's own amount is "back on the table".
  const maxSettle = useMemo((): number => {
    if (!from || !to) return 0;
    const base = payment
      ? applySettlementPayments(net, [{ ...payment, amount: -payment.amount }])
      : net;
    return maxOwedBetween(base, from, to);
  }, [net, from, to, payment]);

  const [amount, setAmount] = useState('');
  const [paidOn, setPaidOn] = useState(todayISO());
  const [note, setNote] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  useEffect((): void => {
    if (!visible) return;
    setAmount(payment ? payment.amount.toFixed(2) : '');
    setPaidOn(payment?.paidOn ?? todayISO());
    setNote(payment?.note ?? '');
    setError('');
    // Only when the sheet opens — later balance changes mustn't reset typing.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [visible, payment?.id]);

  const value = parseAmount(amount);
  const tooMuch = value > 0 && value > maxSettle + 0.005;
  const isFuture = paidOn > todayISO();
  const isParty = myId !== '' && (myId === from || myId === to);
  const canSave = !saving && isParty && value > 0 && !tooMuch && !isFuture;

  const names = useCallback(
    (money: number) => ({
      fromName: memberName(from),
      toName: memberName(to),
      money: formatFull(money, currencyCode),
    }),
    [memberName, from, to, currencyCode]
  );

  const write = useCallback(
    async (amountToSave: number): Promise<void> => {
      setSaving(true);
      setError('');
      try {
        if (payment) {
          await updatePayment(
            payment.id,
            { amount: amountToSave, paidOn, note: note.trim() || null },
            names(amountToSave)
          );
        } else {
          await recordPayment(
            { from, to, amount: amountToSave, paidOn, note: note.trim() || null },
            houseId,
            names(amountToSave)
          );
        }
        onDone();
      } catch (err) {
        setError(err instanceof Error ? err.message : t('bills.settle_save_failed'));
      } finally {
        setSaving(false);
      }
    },
    [payment, updatePayment, recordPayment, from, to, paidOn, note, houseId, names, onDone, t]
  );

  /** The same payment may already be in the app (both people recorded it). */
  const confirmNotDuplicate = useCallback(
    async (amountToSave: number): Promise<boolean> => {
      if (payment) return true;
      const dupe = payments.find(
        (p) =>
          p.from === from &&
          p.to === to &&
          Math.abs(p.amount - amountToSave) < 0.005 &&
          Math.abs(daysBetween(p.paidOn, paidOn)) <= DUPLICATE_WINDOW_DAYS
      );
      if (!dupe) return true;
      return ask(
        t('bills.settle_dupe_title'),
        t('bills.settle_dupe_body', {
          from: memberName(from),
          to: memberName(to),
          money: formatFull(amountToSave, currencyCode),
          date: formatDateDDMMYYYY(dupe.paidOn),
        }),
        t('bills.settle_dupe_confirm'),
        t('common.cancel')
      );
    },
    [payment, payments, from, to, paidOn, memberName, currencyCode, t]
  );

  const payAll = useCallback((): void => {
    if (saving || !isParty || maxSettle < 0.01 || isFuture) return;
    void (async (): Promise<void> => {
      if (await confirmNotDuplicate(maxSettle)) await write(maxSettle);
    })();
  }, [saving, isParty, maxSettle, isFuture, confirmNotDuplicate, write]);

  const save = useCallback((): void => {
    if (!canSave) return;
    void (async (): Promise<void> => {
      if (await confirmNotDuplicate(value)) await write(value);
    })();
  }, [canSave, confirmNotDuplicate, value, write]);

  const remove = useCallback((): void => {
    if (!payment || saving || !isParty) return;
    void (async (): Promise<void> => {
      const money = formatFull(payment.amount, currencyCode);
      const ok = await ask(
        t('bills.settle_delete_title'),
        t('bills.settle_delete_body', { from: memberName(from), to: memberName(to), money }),
        t('common.delete'),
        t('common.cancel'),
        true
      );
      if (!ok) return;
      setSaving(true);
      try {
        await deletePayment(payment.id, names(payment.amount));
        onDone();
      } catch (err) {
        setError(
          err instanceof SettlementDeleteNotAllowedError
            ? t('bills.settle_delete_not_allowed')
            : t('bills.settle_delete_failed')
        );
      } finally {
        setSaving(false);
      }
    })();
  }, [
    payment,
    saving,
    isParty,
    currencyCode,
    memberName,
    from,
    to,
    deletePayment,
    names,
    onDone,
    t,
  ]);

  return {
    isEdit,
    from,
    to,
    maxSettle,
    amount,
    paidOn,
    note,
    saving,
    error,
    tooMuch,
    isFuture,
    canSave,
    isParty,
    setAmount,
    setPaidOn,
    setNote,
    payAll,
    save,
    remove,
  };
}
