import { useState, useEffect, useCallback, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { useAuthStore } from '@stores/authStore';
import { useHousematesStore } from '@stores/housematesStore';
import { useSettlementPaymentsStore } from '@stores/settlementPaymentsStore';
import { useHouseMoney } from '@hooks/useHouseMoney';
import { isSafeToRecord, pairwiseDebts, planSettleUpTo, type Transfer } from '@utils/settleUp';
import { todayISO } from '@utils/recurringCoverage';

export interface PlannedTransfer extends Transfer {
  /** The current user is the payer or receiver, so they can record it. */
  canRecord: boolean;
}

export interface SettleUpToDate {
  upTo: string;
  setUpTo: (date: string) => void;
  plan: PlannedTransfer[];
  recordable: PlannedTransfer[];
  saving: boolean;
  error: string;
  /** The chosen date is after today — nothing can be settled yet. */
  isFuture: boolean;
  /** The user's part isn't safe on its own: the others must settle theirs first. */
  othersFirst: boolean;
  confirm: () => void;
}

/** Last day of the previous month as YYYY-MM-DD — the usual "we paid up to" date. */
export function endOfLastMonth(today: string = todayISO()): string {
  const [y, m] = today.split('-').map(Number);
  // Day 0 of this month = last day of the previous month (UTC avoids DST shifts).
  const d = new Date(Date.UTC(y, m - 1, 0));
  return d.toISOString().slice(0, 10);
}

/** The day after a YYYY-MM-DD date. */
export function nextDay(date: string): string {
  const d = new Date(`${date}T12:00:00Z`);
  d.setUTCDate(d.getUTCDate() + 1);
  return d.toISOString().slice(0, 10);
}

/** The day before a YYYY-MM-DD date. */
export function previousDay(date: string): string {
  const d = new Date(`${date}T12:00:00Z`);
  d.setUTCDate(d.getUTCDate() - 1);
  return d.toISOString().slice(0, 10);
}

/** The last day of each of the `count` months before this one, newest first. */
export function recentMonthEnds(count: number, today: string = todayISO()): string[] {
  const ends: string[] = [];
  let end = endOfLastMonth(today);
  for (let i = 0; i < count; i++) {
    ends.push(end);
    end = endOfLastMonth(end);
  }
  return ends;
}

/** State + logic for "Settle up to a date". */
export function useSettleUpToDate(visible: boolean, onDone: () => void): SettleUpToDate {
  const { t } = useTranslation();
  const profile = useAuthStore((s) => s.profile);
  const houseId = useAuthStore((s) => s.houseId) ?? '';
  const housemates = useHousematesStore((s) => s.housemates);
  const formerMembers = useHousematesStore((s) => s.formerMembers);
  const recordSettleUpTo = useSettlementPaymentsStore((s) => s.recordSettleUpTo);
  const { money, net } = useHouseMoney();
  const myId = profile?.id ?? '';

  const [upTo, setUpTo] = useState(endOfLastMonth());
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  useEffect((): void => {
    if (!visible) return;
    setUpTo(endOfLastMonth());
    setError('');
  }, [visible]);

  // Who a payment can be recorded with: anyone in the house now, or someone
  // who has left (a debt with them can still be paid back).
  const recordableWith = useMemo(
    () => new Set([...housemates.map((h) => h.id), ...formerMembers.map((f) => f.id)]),
    [housemates, formerMembers]
  );
  const isFuture = upTo > todayISO();

  const { plan, recordable, othersFirst } = useMemo(() => {
    const mark = (list: Transfer[]): PlannedTransfer[] =>
      list.map((x) => ({
        ...x,
        // The database only accepts payments the user is part of; anything
        // else is left for the people involved.
        canRecord:
          (x.from === myId || x.to === myId) &&
          recordableWith.has(x.from) &&
          recordableWith.has(x.to),
      }));
    const mine = (list: PlannedTransfer[]): PlannedTransfer[] => list.filter((x) => x.canRecord);
    const debts = pairwiseDebts(money, upTo);

    // 1) Who-actually-owes-whom routes, if the part this user can record is
    //    safe on its own.
    const real = mark(planSettleUpTo(net, debts));
    if (isSafeToRecord(net, mine(real))) {
      return { plan: real, recordable: isFuture ? [] : mine(real), othersFirst: false };
    }
    // 2) Otherwise the direct route (Dana pays Maya, skipping the middle).
    const direct = mark(planSettleUpTo(net, debts, { direct: true }));
    if (isSafeToRecord(net, mine(direct))) {
      return { plan: direct, recordable: isFuture ? [] : mine(direct), othersFirst: false };
    }
    // 3) Still not safe alone: the others need to settle their part first.
    return { plan: real, recordable: [] as PlannedTransfer[], othersFirst: true };
  }, [net, money, upTo, myId, recordableWith, isFuture]);

  const confirm = useCallback((): void => {
    if (saving || recordable.length === 0) return;
    setSaving(true);
    setError('');
    recordSettleUpTo(
      recordable.map(({ from, to, amount }) => ({ from, to, amount })),
      upTo,
      houseId,
      profile?.name ?? ''
    )
      .then(onDone)
      .catch((err: unknown) => {
        setError(err instanceof Error ? err.message : t('bills.settle_save_failed'));
      })
      .finally(() => setSaving(false));
  }, [saving, recordable, recordSettleUpTo, upTo, houseId, profile?.name, onDone, t]);

  return { upTo, setUpTo, plan, recordable, saving, error, isFuture, othersFirst, confirm };
}
