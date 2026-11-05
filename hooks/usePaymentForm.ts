import { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import {
  useRecurringBillsStore,
  DeleteNotAllowedError,
  type HouseholdPayment,
  type RecurringBill,
} from '@stores/recurringBillsStore';
import { useAuthStore } from '@stores/authStore';
import { useSettledPeriodGuard } from '@hooks/useSettledPeriodGuard';
import { useHousematesStore } from '@stores/housematesStore';
import { defaultSplitOn, toMemberSpans } from '@utils/membership';
import { firstCoveredDay } from '@utils/settleUp';
import {
  FREQUENCY_MONTHS,
  monthStart,
  nextUnpaidPeriod,
  paymentPeriod,
  todayISO,
  type CoveragePeriod,
} from '@utils/recurringCoverage';

interface UsePaymentFormArgs {
  bill: RecurringBill;
  payment?: HouseholdPayment; // set = editing that payment, unset = logging a new one
  memberIds: string[];
  visible: boolean;
  onDone: () => void;
}

export interface PaymentForm {
  period: CoveragePeriod;
  periodKnown: boolean; // false for a legacy payment whose coverage was never recorded
  amount: string;
  paidAt: string;
  paidBy: string;
  note: string;
  splitWith: string[];
  error: string;
  saving: boolean;
  canSave: boolean;
  setPeriod: (p: CoveragePeriod) => void;
  setAmount: (v: string) => void;
  setPaidAt: (v: string) => void;
  setPaidBy: (id: string) => void;
  setNote: (v: string) => void;
  toggleSplit: (id: string) => void;
  save: () => Promise<void>;
  remove: () => Promise<void>;
}

/** "12,5" or "12.5" → 12.5; NaN when it isn't a number. */
function parseAmount(text: string): number {
  return parseFloat(text.replace(',', '.'));
}

/** State and actions for the log / edit payment sheet. Resets each time it opens. */
export function usePaymentForm({
  bill,
  payment,
  memberIds,
  visible,
  onDone,
}: UsePaymentFormArgs): PaymentForm {
  const { t } = useTranslation();
  const payments = useRecurringBillsStore((s) => s.payments);
  const logPayment = useRecurringBillsStore((s) => s.logPayment);
  const updatePayment = useRecurringBillsStore((s) => s.updatePayment);
  const deletePayment = useRecurringBillsStore((s) => s.deletePayment);
  const settledGuard = useSettledPeriodGuard();
  const houseId = useAuthStore((s) => s.houseId);

  const housemates = useHousematesStore((s) => s.housemates);
  const initial = useMemo(() => {
    const today = todayISO();
    const known = payment ? paymentPeriod(payment) : null;
    return {
      period:
        known ??
        (payment
          ? { start: monthStart(payment.paidAt), months: FREQUENCY_MONTHS[bill.frequency] }
          : nextUnpaidPeriod(bill, payments, today)),
      periodKnown: payment ? known !== null : true,
      amount: String(payment?.amount ?? bill.typicalAmount),
      paidAt: payment?.paidAt ?? today,
      paidBy: payment?.paidBy ?? bill.assignedTo ?? '',
      note: payment?.note ?? '',
      // An older payment saved without names: start from who lived here that day.
      splitWith: payment?.splitBetween?.length
        ? payment.splitBetween
        : payment
          ? defaultSplitOn(toMemberSpans(housemates), memberIds, payment.paidAt)
          : memberIds,
    };
    // Only recomputed when the sheet opens — later store updates mustn't reset typing.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [visible, payment?.id]);

  const [period, setPeriodState] = useState(initial.period);
  const [periodKnown, setPeriodKnown] = useState(initial.periodKnown);
  const [amount, setAmount] = useState(initial.amount);
  const [paidAt, setPaidAtState] = useState(initial.paidAt);
  const splitTouched = useRef(false);
  const confirmingRef = useRef(false);
  const [paidBy, setPaidBy] = useState(initial.paidBy);
  const [note, setNote] = useState(initial.note);
  const [splitWith, setSplitWith] = useState(initial.splitWith);
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);

  useEffect((): void => {
    if (!visible) return;
    setPeriodState(initial.period);
    setPeriodKnown(initial.periodKnown);
    setAmount(initial.amount);
    setPaidAtState(initial.paidAt);
    setPaidBy(initial.paidBy);
    setNote(initial.note);
    setSplitWith(initial.splitWith);
    splitTouched.current = false;
    setError('');
  }, [visible, initial]);

  // A new payment dated before someone joined isn't theirs: changing the date
  // pre-selects only the people who lived here then (unless edited by hand).
  const setPaidAt = useCallback(
    (value: string): void => {
      setPaidAtState(value);
      if (payment || splitTouched.current) return;
      setSplitWith(defaultSplitOn(toMemberSpans(housemates), memberIds, value));
    },
    [payment, housemates, memberIds]
  );

  const setPeriod = useCallback((p: CoveragePeriod): void => {
    setPeriodState(p);
    setPeriodKnown(true);
  }, []);

  const toggleSplit = useCallback((id: string): void => {
    splitTouched.current = true;
    setSplitWith((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]));
  }, []);

  const parsed = parseAmount(amount);
  const canSave = !saving && !!houseId && parsed > 0 && splitWith.length > 0;

  const save = useCallback(async (): Promise<void> => {
    // A second tap while the settled-month question is open mustn't save twice.
    if (saving || confirmingRef.current) return;
    const value = parseAmount(amount);
    if (!(value > 0)) {
      setError(t('bills.enter_valid_amount'));
      return;
    }
    if (splitWith.length === 0) {
      setError(t('bills.household_split_required'));
      return;
    }
    if (!houseId) {
      setError(t('bills.household_missing'));
      return;
    }
    const fields = {
      amount: value,
      paidAt,
      note: note.trim(),
      splitBetween: splitWith,
      // A legacy payment keeps unknown coverage unless the period was set here.
      coverageStart: periodKnown ? period.start : undefined,
      coverageMonths: periodKnown ? period.months : undefined,
      paidBy: paidBy || undefined,
    };
    // A payment dated in a period that was already settled up changes old
    // balances: ask first, and tell the house once it's saved.
    confirmingRef.current = true;
    // Checked by the months a payment pays for (before and after the change).
    const before = payment ? firstCoveredDay(payment, bill) : null;
    const after = periodKnown
      ? period.start
      : firstCoveredDay({ ...fields, id: '', billId: bill.id }, bill);
    let check;
    try {
      check = await settledGuard.confirmChange(before, after);
    } finally {
      confirmingRef.current = false;
    }
    if (!check.proceed) return;
    const inSettledPeriod = check.settled;
    try {
      setSaving(true);
      setError('');
      if (payment) {
        await updatePayment(payment.id, fields);
      } else {
        await logPayment({ billId: bill.id, ...fields }, houseId);
      }
      if (inSettledPeriod) settledGuard.notifyChange(bill.name);
      onDone();
    } catch {
      setError(t('bills.failed_save'));
    } finally {
      setSaving(false);
    }
  }, [
    saving,
    amount,
    splitWith,
    houseId,
    paidAt,
    note,
    periodKnown,
    period,
    paidBy,
    payment,
    updatePayment,
    logPayment,
    bill,
    settledGuard,
    onDone,
    t,
  ]);

  const remove = useCallback(async (): Promise<void> => {
    if (!payment || saving) return;
    try {
      setSaving(true);
      setError('');
      await deletePayment(payment.id);
      // The delete was confirmed in the sheet (with the settled-period warning
      // when it applies) — tell the house once.
      if (settledGuard.isSettled(firstCoveredDay(payment, bill)))
        settledGuard.notifyChange(bill.name);
      onDone();
    } catch (err) {
      setError(
        err instanceof DeleteNotAllowedError
          ? t('bills.household_delete_not_allowed')
          : t('bills.failed_delete')
      );
    } finally {
      setSaving(false);
    }
  }, [payment, saving, deletePayment, settledGuard, bill, onDone, t]);

  return {
    period,
    periodKnown,
    amount,
    paidAt,
    paidBy,
    note,
    splitWith,
    error,
    saving,
    canSave,
    setPeriod,
    setAmount,
    setPaidAt,
    setPaidBy,
    setNote,
    toggleSplit,
    save,
    remove,
  };
}
