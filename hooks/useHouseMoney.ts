import { useMemo } from 'react';
import { useBillsStore } from '@stores/billsStore';
import { useRecurringBillsStore } from '@stores/recurringBillsStore';
import { useHousematesStore } from '@stores/housematesStore';
import { useSettlementPaymentsStore } from '@stores/settlementPaymentsStore';
import { toMemberSpans } from '@utils/membership';
import { computeHouseNet, type HouseMoney, type NetBalances } from '@utils/settleUp';

interface HouseMoneyResult {
  money: HouseMoney;
  /** Everyone's current balance. Positive = is owed, negative = owes. */
  net: NetBalances;
}

/**
 * The house's money in one place: one-off bills, recurring bill payments and
 * settle-up payments. Every screen that shows "who owes whom" reads from here,
 * so they can never disagree.
 */
export function useHouseMoney(): HouseMoneyResult {
  const bills = useBillsStore((s) => s.bills);
  const householdBills = useRecurringBillsStore((s) => s.bills);
  const householdPayments = useRecurringBillsStore((s) => s.payments);
  const housemates = useHousematesStore((s) => s.housemates);
  const formerMembers = useHousematesStore((s) => s.formerMembers);
  const settlementPayments = useSettlementPaymentsStore((s) => s.payments);

  return useMemo((): HouseMoneyResult => {
    const money: HouseMoney = {
      bills,
      householdBills,
      householdPayments,
      members: toMemberSpans(housemates, formerMembers),
      settlementPayments,
    };
    return { money, net: computeHouseNet(money) };
  }, [bills, householdBills, householdPayments, housemates, formerMembers, settlementPayments]);
}
