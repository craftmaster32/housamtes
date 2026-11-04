import { useCallback, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { Alert } from '@lib/alert';
import { notifyHousemates } from '@lib/notifyHousemates';
import { useAuthStore } from '@stores/authStore';
import { useSettlementPaymentsStore } from '@stores/settlementPaymentsStore';
import { formatDateDDMMYYYY } from '@utils/dates';
import { latestSettledUntil } from '@utils/settleUp';

export interface SettledPeriodGuard {
  /** Latest "settled up to" date in the house (YYYY-MM-DD), or null. */
  settledUntil: string | null;
  /** True if any of these dates falls in a period that was already settled. */
  isSettled: (...dates: (string | null | undefined)[]) => boolean;
  /** The warning text for a change in a settled period. */
  warning: () => string;
  /**
   * If any date is in a settled period, ask first. Resolves true when it's
   * fine to go ahead (not settled, or the user confirmed).
   */
  confirmChange: (...dates: (string | null | undefined)[]) => Promise<boolean>;
  /** Tell the rest of the house, in one message, that a settled period changed. */
  notifyChange: (itemTitle: string) => void;
}

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
  const houseId = useAuthStore((s) => s.houseId);
  const profile = useAuthStore((s) => s.profile);
  const settledUntil = useMemo(() => latestSettledUntil(payments), [payments]);

  const isSettled = useCallback(
    (...dates: (string | null | undefined)[]): boolean =>
      settledUntil !== null && dates.some((d) => !!d && d <= settledUntil),
    [settledUntil]
  );

  const warning = useCallback(
    (): string => t('bills.settled_change_body', { date: formatDateDDMMYYYY(settledUntil ?? '') }),
    [settledUntil, t]
  );

  const confirmChange = useCallback(
    (...dates: (string | null | undefined)[]): Promise<boolean> => {
      if (!isSettled(...dates)) return Promise.resolve(true);
      return new Promise((resolve) => {
        Alert.alert(t('bills.settled_change_title'), warning(), [
          { text: t('common.cancel'), style: 'cancel', onPress: (): void => resolve(false) },
          { text: t('bills.settled_change_confirm'), onPress: (): void => resolve(true) },
        ]);
      });
    },
    [isSettled, warning, t]
  );

  const notifyChange = useCallback(
    (itemTitle: string): void => {
      if (!houseId || !profile?.id || !settledUntil) return;
      notifyHousemates({
        houseId,
        excludeUserId: profile.id,
        copyKey: 'settled_period_changed',
        copyParams: { name: profile.name ?? '', billTitle: itemTitle, date: settledUntil },
        data: { screen: 'bills' },
        notificationType: 'bill_edited',
      });
    },
    [houseId, profile?.id, profile?.name, settledUntil]
  );

  return useMemo(
    (): SettledPeriodGuard => ({ settledUntil, isSettled, warning, confirmChange, notifyChange }),
    [settledUntil, isSettled, warning, confirmChange, notifyChange]
  );
}
