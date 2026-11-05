import { useCallback, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { Alert } from '@lib/alert';
import { notifyHousemates } from '@lib/notifyHousemates';
import { useAuthStore } from '@stores/authStore';
import { useSettlementPaymentsStore } from '@stores/settlementPaymentsStore';
import { formatDateDDMMYYYY } from '@utils/dates';
import { latestSettledUntil } from '@utils/settleUp';

type Dates = (string | null | undefined)[];

/** Result of asking before a change: go ahead or not, and whether it touches a settled month. */
export interface SettledCheck {
  proceed: boolean;
  /** True only when the change is in a settled month (send the settled-period message). */
  settled: boolean;
}

export interface SettledPeriodGuard {
  /** Latest "settled up to" date in the house (YYYY-MM-DD), or null. */
  settledUntil: string | null;
  /** True if any of these dates falls in a period that was already settled. */
  isSettled: (...dates: Dates) => boolean;
  /** The warning text for a change in a settled period. */
  warning: () => string;
  /**
   * Makes sure the settle-up payments are loaded, then asks first if any date
   * is in a settled month. If they can't be loaded, says so and asks — it
   * never silently assumes "not settled".
   */
  confirmChange: (...dates: Dates) => Promise<SettledCheck>;
  /** Tell the rest of the house, in one message, that a settled period changed. */
  notifyChange: (itemTitle: string) => void;
}

/** The latest settled date from the store as it is right now (not the last render). */
const settledUntilNow = (): string | null =>
  latestSettledUntil(useSettlementPaymentsStore.getState().payments);

/**
 * Guards changes to expenses from a period that was already settled up.
 *
 * Settle-up payments already recorded are real money and stay as they are;
 * changing an old expense just shows up as a new difference in the balances.
 * So the change is allowed — but never silently.
 */
export function useSettledPeriodGuard(): SettledPeriodGuard {
  const { t } = useTranslation();
  const payments = useSettlementPaymentsStore((s) => s.payments);
  const load = useSettlementPaymentsStore((s) => s.load);
  const houseId = useAuthStore((s) => s.houseId);
  const profile = useAuthStore((s) => s.profile);
  const settledUntil = useMemo(() => latestSettledUntil(payments), [payments]);

  const isSettled = useCallback(
    (...dates: Dates): boolean => {
      const until = settledUntilNow();
      return until !== null && dates.some((d) => !!d && d <= until);
    },
    // Re-created when payments change so render-time callers stay up to date.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [payments]
  );

  const warning = useCallback(
    (): string =>
      t('bills.settled_change_body', { date: formatDateDDMMYYYY(settledUntilNow() ?? '') }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [payments, t]
  );

  const ask = useCallback(
    (title: string, body: string): Promise<boolean> =>
      new Promise((resolve) => {
        Alert.alert(title, body, [
          { text: t('common.cancel'), style: 'cancel', onPress: (): void => resolve(false) },
          { text: t('bills.settled_change_confirm'), onPress: (): void => resolve(true) },
        ]);
      }),
    [t]
  );

  const confirmChange = useCallback(
    async (...dates: Dates): Promise<SettledCheck> => {
      // Still loading, or the last load failed: load now before deciding.
      const state = useSettlementPaymentsStore.getState();
      if ((state.isLoading || state.error) && houseId) await load(houseId);
      if (useSettlementPaymentsStore.getState().error) {
        const proceed = await ask(
          t('bills.settled_unknown_title'),
          t('bills.settled_unknown_body')
        );
        return { proceed, settled: false };
      }
      if (!isSettled(...dates)) return { proceed: true, settled: false };
      const proceed = await ask(t('bills.settled_change_title'), warning());
      return { proceed, settled: true };
    },
    [houseId, load, ask, isSettled, warning, t]
  );

  const notifyChange = useCallback(
    (itemTitle: string): void => {
      const until = settledUntilNow();
      if (!houseId || !profile?.id || !until) return;
      notifyHousemates({
        houseId,
        excludeUserId: profile.id,
        copyKey: 'settled_period_changed',
        copyParams: { name: profile.name ?? '', billTitle: itemTitle, date: until },
        data: { screen: 'bills' },
        notificationType: 'bill_edited',
      });
    },
    [houseId, profile?.id, profile?.name]
  );

  return useMemo(
    (): SettledPeriodGuard => ({ settledUntil, isSettled, warning, confirmChange, notifyChange }),
    [settledUntil, isSettled, warning, confirmChange, notifyChange]
  );
}
