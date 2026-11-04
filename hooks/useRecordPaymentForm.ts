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
import { formatDateDDMMYYYY } from '@utils/dates';

/** Same payer, receiver and amount within this many days = probably recorded twice. */
const DUPLICATE_WINDOW_DAYS = 7;

function daysBetween(a: string, b: string): number {
  return (Date.parse(`${a}T12:00:00Z`) - Date.parse(`${b}T12:00:00Z`)) / 86_400_000;
}

/** Ask a yes/no question; resolves true only if the confirm button is tapped. */
function confirm(
  title: string,
  body: string,
  confirmText: string,
  cancelText: string
): Promise<boolean> {
  return new Promise((resolve) => {
    Alert.alert(title, body, [
      { text: cancelText, style: 'cancel', onPress: (): void => resolve(false) },
      { text: confirmText, onPress: (): void => resolve(true) },
    ]);
  });
}

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
  /** The chosen date is after today. */
  isFuture: boolean;
  /** The most this payer can settle with this receiver right now (brings them to 0). */
  maxSettle: number;
  /** The amount is more than `maxSettle` — anything extra must be added as a bill. */
  tooMuch: boolean;
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
  const isFuture = paidOn > todayISO();
  // A settle-up can only bring a debt down to zero, never past it. Money
  // beyond that isn't paying anyone back — it's a new expense (add a bill).
  const maxSettle = from && to && from !== to ? maxOwedBetween(net, from, to) : 0;
  const tooMuch = value > 0 && value > maxSettle + 0.005;
  const canSave =
    !saving &&
    from !== '' &&
    to !== '' &&
    from !== to &&
    !notInvolved &&
    value > 0 &&
    !isFuture &&
    !tooMuch;

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

  const payments = useSettlementPaymentsStore((s) => s.payments);

  const save = useCallback((): void => {
    if (!canSave) return;
    const run = async (): Promise<void> => {
      // 1) The same payment may already be in the app — e.g. both people
      //    recorded it. Recording it twice would count the money twice.
      const dupe = payments.find(
        (p) =>
          p.from === from &&
          p.to === to &&
          Math.abs(p.amount - value) < 0.005 &&
          Math.abs(daysBetween(p.paidOn, paidOn)) <= DUPLICATE_WINDOW_DAYS
      );
      if (
        dupe &&
        !(await confirm(
          t('bills.settle_dupe_title'),
          t('bills.settle_dupe_body', {
            from: memberName(from),
            to: memberName(to),
            money: formatFull(value, currencyCode),
            date: formatDateDDMMYYYY(dupe.paidOn),
          }),
          t('bills.settle_dupe_confirm'),
          t('common.cancel')
        ))
      ) {
        return;
      }

      await doSave();
    };
    void run();
  }, [canSave, payments, from, to, value, paidOn, doSave, memberName, currencyCode, t]);

  return {
    from,
    to,
    amount,
    paidOn,
    note,
    saving,
    error,
    notInvolved,
    isFuture,
    maxSettle,
    tooMuch,
    canSave,
    setFrom,
    setTo,
    setAmount,
    setPaidOn,
    setNote,
    save,
  };
}
