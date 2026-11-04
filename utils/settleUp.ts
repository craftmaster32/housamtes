import { calculateAllNetBalances, settleDebts, type Bill } from '@stores/billsStore';
import {
  calculateFairness,
  type HouseholdPayment,
  type RecurringBill,
} from '@stores/recurringBillsStore';

/**
 * Money paid directly from one housemate to another to settle up.
 * Lowers what `from` owes `to` by exactly `amount`.
 */
export interface SettlementPayment {
  id: string;
  from: string; // user UUID who paid
  to: string; // user UUID who received
  amount: number;
  paidOn: string; // YYYY-MM-DD the money changed hands
  coversUntil: string | null; // YYYY-MM-DD when recorded via "Settle up to a date" (label only)
  note: string | null;
  createdBy: string;
  createdAt: string;
}

/** One suggested transfer: `from` pays `to` this much. */
export interface Transfer {
  from: string;
  to: string;
  amount: number;
}

/** Net balance per person. Positive = is owed money, negative = owes money. */
export type NetBalances = Map<string, number>;

export interface HouseMoney {
  bills: Bill[];
  householdBills: RecurringBill[];
  householdPayments: HouseholdPayment[];
  memberIds: string[];
  settlementPayments: SettlementPayment[];
}

const cents = (n: number): number => Math.round(n * 100) / 100;

/**
 * Adds settle-up payments to a balance map: the payer's debt goes down and the
 * receiver's credit goes down by the same amount, so the map still sums to ~0.
 */
export function applySettlementPayments(
  net: NetBalances,
  payments: SettlementPayment[]
): NetBalances {
  const out = new Map(net);
  for (const p of payments) {
    out.set(p.from, (out.get(p.from) ?? 0) + p.amount);
    out.set(p.to, (out.get(p.to) ?? 0) - p.amount);
  }
  return out;
}

/**
 * Everyone's balance for the whole house: unsettled one-off bills + recurring
 * bill payments − settle-up payments.
 *
 * With `upTo` (YYYY-MM-DD), only expenses dated on or before that day count.
 * Settle-up payments always count in full, whatever their date: money paid
 * pays off the oldest debts first.
 */
export function computeHouseNet(money: HouseMoney, upTo?: string): NetBalances {
  const bills = money.bills.filter((b) => !b.settled && (upTo === undefined || b.date <= upTo));
  const payments =
    upTo === undefined
      ? money.householdPayments
      : money.householdPayments.filter((p) => p.paidAt <= upTo);

  const net = new Map(calculateAllNetBalances(bills));
  for (const { person, balance } of calculateFairness(
    money.householdBills,
    payments,
    money.memberIds
  )) {
    net.set(person, (net.get(person) ?? 0) + balance);
  }
  return applySettlementPayments(net, money.settlementPayments);
}

/**
 * The payments needed to be "all square up to this date".
 *
 * Starts from the fewest transfers that clear everything owed up to the date,
 * then caps each one so it never pushes anyone past zero on their CURRENT
 * balance. That guarantees settling up to a date can never make someone owe
 * more, or turn money they're owed into a debt (e.g. someone who already
 * paid extra keeps that credit).
 */
export function planSettleUpTo(currentNet: NetBalances, upToNet: NetBalances): Transfer[] {
  const running = new Map(currentNet);
  const plan: Transfer[] = [];
  for (const t of settleDebts(new Map(upToNet))) {
    const debt = Math.max(0, -(running.get(t.from) ?? 0));
    const credit = Math.max(0, running.get(t.to) ?? 0);
    const amount = cents(Math.min(t.amount, debt, credit));
    if (amount < 0.01) continue;
    plan.push({ from: t.from, to: t.to, amount });
    running.set(t.from, (running.get(t.from) ?? 0) + amount);
    running.set(t.to, (running.get(t.to) ?? 0) - amount);
  }
  return plan;
}

/**
 * How much `from` can pay `to` before it becomes an overpayment: the smaller
 * of what `from` owes in total and what `to` is owed in total. 0 if `from`
 * owes nothing or `to` is owed nothing.
 */
export function maxOwedBetween(net: NetBalances, from: string, to: string): number {
  const debt = Math.max(0, -(net.get(from) ?? 0));
  const credit = Math.max(0, net.get(to) ?? 0);
  return cents(Math.min(debt, credit));
}
