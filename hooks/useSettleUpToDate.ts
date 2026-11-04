import { useState, useEffect, useCallback, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { useAuthStore } from '@stores/authStore';
import { useHousematesStore } from '@stores/housematesStore';
import { useSettlementPaymentsStore } from '@stores/settlementPaymentsStore';
import { useHouseMoney } from '@hooks/useHouseMoney';
import { pairwiseDebts, planSettleUpTo, type Transfer } from '@utils/settleUp';
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
  confirm: () => void;
}

/** Last day of the previous month as YYYY-MM-DD — the usual "we paid up to" date. */
export function endOfLastMonth(today: string = todayISO()): string {
  const [y, m] = today.split('-').map(Number);
  // Day 0 of this month = last day of the previous month (UTC avoids DST shifts).
  const d = new Date(Date.UTC(y, m - 1, 0));
  return d.toISOString().slice(0, 10);
}

/** State + logic for "Settle up to a date". */
export function useSettleUpToDate(visible: boolean, onDone: () => void): SettleUpToDate {
  const { t } = useTranslation();
  const profile = useAuthStore((s) => s.profile);
  const houseId = useAuthStore((s) => s.houseId) ?? '';
  const housemates = useHousematesStore((s) => s.housemates);
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

  const plan = useMemo((): PlannedTransfer[] => {
    const memberIds = new Set(housemates.map((h) => h.id));
    return planSettleUpTo(net, pairwiseDebts(money, upTo)).map((x) => ({
      ...x,
      // The database only accepts payments between current members that the
      // user is part of; anything else is left for the people involved.
      canRecord: (x.from === myId || x.to === myId) && memberIds.has(x.from) && memberIds.has(x.to),
    }));
  }, [net, money, upTo, housemates, myId]);

  const isFuture = upTo > todayISO();
  const recordable = useMemo(
    () => (isFuture ? [] : plan.filter((x) => x.canRecord)),
    [plan, isFuture]
  );

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

  return { upTo, setUpTo, plan, recordable, saving, error, isFuture, confirm };
}
