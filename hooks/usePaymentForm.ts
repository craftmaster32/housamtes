import { useState, useEffect, useCallback, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import {
  useRecurringBillsStore,
  DeleteNotAllowedError,
  type HouseholdPayment,
  type RecurringBill,
} from '@stores/recurringBillsStore';
import { useAuthStore } from '@stores/authStore';
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
  const houseId = useAuthStore((s) => s.houseId);

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
      splitWith: payment?.splitBetween?.length ? payment.splitBetween : memberIds,
    };
    // Only recomputed when the sheet opens — later store updates mustn't reset typing.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [visible, payment?.id]);

  const [period, setPeriodState] = useState(initial.period);
  const [periodKnown, setPeriodKnown] = useState(initial.periodKnown);
  const [amount, setAmount] = useState(initial.amount);
  const [paidAt, setPaidAt] = useState(initial.paidAt);
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
    setPaidAt(initial.paidAt);
    setPaidBy(initial.paidBy);
    setNote(initial.note);
    setSplitWith(initial.splitWith);
    setError('');
  }, [visible, initial]);

  const setPeriod = useCallback((p: CoveragePeriod): void => {
    setPeriodState(p);
    setPeriodKnown(true);
  }, []);

  const toggleSplit = useCallback((id: string): void => {
    setSplitWith((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]));
  }, []);

  const parsed = parseAmount(amount);
  const canSave = !saving && !!houseId && parsed > 0 && splitWith.length > 0;

  const save = useCallback(async (): Promise<void> => {
    if (saving) return;
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
    try {
      setSaving(true);
      setError('');
      if (payment) {
        await updatePayment(payment.id, fields);
      } else {
        await logPayment({ billId: bill.id, ...fields }, houseId);
      }
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
    bill.id,
    onDone,
    t,
  ]);

  const remove = useCallback(async (): Promise<void> => {
    if (!payment || saving) return;
    try {
      setSaving(true);
      setError('');
      await deletePayment(payment.id);
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
  }, [payment, saving, deletePayment, onDone, t]);

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
