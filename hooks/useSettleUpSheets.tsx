import { useState, useCallback, useMemo } from 'react';
import { useSettlementPaymentsStore } from '@stores/settlementPaymentsStore';
import type { SettlementPayment, Transfer } from '@utils/settleUp';
import { SettleWithSheet } from '@components/bills/settle/SettleWithSheet';
import { SettleUpToDateSheet } from '@components/bills/settle/SettleUpToDateSheet';

export interface SettleUpSheetsState {
  /** "Settle" on a line of the settle-up plan. */
  openSettle: (transfer: Transfer) => void;
  /** Tap a settle-up in the Bills history to change or delete it. */
  openEdit: (payment: SettlementPayment) => void;
  /** "Settle up to a date". */
  openUpTo: () => void;
  /** Already paid from → to in the open period (after the latest settle-up date). */
  paidSoFar: (t: Transfer) => number;
  sheets: React.JSX.Element;
}

/**
 * All the settle-up sheets for the Bills page in one place: settle a line,
 * edit/delete a recorded payment, or settle up to a date.
 */
export function useSettleUpSheets(): SettleUpSheetsState {
  const payments = useSettlementPaymentsStore((s) => s.payments);
  const [settleTarget, setSettleTarget] = useState<Transfer | null>(null);
  const [editTarget, setEditTarget] = useState<SettlementPayment | null>(null);
  const [showUpTo, setShowUpTo] = useState(false);

  const openSettle = useCallback((transfer: Transfer): void => setSettleTarget(transfer), []);
  const openEdit = useCallback((payment: SettlementPayment): void => setEditTarget(payment), []);
  const openUpTo = useCallback((): void => setShowUpTo(true), []);
  const closeSettle = useCallback((): void => setSettleTarget(null), []);
  const closeEdit = useCallback((): void => setEditTarget(null), []);
  const closeUpTo = useCallback((): void => setShowUpTo(false), []);

  // Partial payments since the last "settle up to a date": shown as "₪50 paid".
  const paidSoFar = useMemo(() => {
    const since = payments.reduce<string>(
      (max, p) => (p.coversUntil && p.coversUntil > max ? p.coversUntil : max),
      ''
    );
    const sums = new Map<string, number>();
    for (const p of payments) {
      if (p.coversUntil || p.paidOn <= since) continue;
      const key = `${p.from}|${p.to}`;
      sums.set(key, (sums.get(key) ?? 0) + p.amount);
    }
    return (t: Transfer): number => sums.get(`${t.from}|${t.to}`) ?? 0;
  }, [payments]);

  const sheets = (
    <>
      <SettleWithSheet
        visible={settleTarget !== null}
        transfer={settleTarget}
        paidSoFar={settleTarget ? paidSoFar(settleTarget) : 0}
        onClose={closeSettle}
      />
      <SettleWithSheet visible={editTarget !== null} payment={editTarget} onClose={closeEdit} />
      <SettleUpToDateSheet visible={showUpTo} onClose={closeUpTo} />
    </>
  );

  return { openSettle, openEdit, openUpTo, paidSoFar, sheets };
}
