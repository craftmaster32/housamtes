import {
  calculateAllNetBalances,
  getPersonShare,
  settleDebts,
  type Bill,
} from '@stores/billsStore';
import {
  calculateFairness,
  type HouseholdPayment,
  type RecurringBill,
} from '@stores/recurringBillsStore';
import { membersOn, type MemberSpan } from '@utils/membership';

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
  /** Housemates with join/leave dates — "split with everyone" means everyone there that day. */
  members: MemberSpan[];
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
    money.members
  )) {
    net.set(person, (net.get(person) ?? 0) + balance);
  }
  return applySettlementPayments(net, money.settlementPayments);
}

/**
 * Who owes whom directly, pair by pair, for expenses up to `upTo` (all when
 * omitted): each person in a split owes the person who fronted the money.
 * Settle-up payments are taken off the pair they were paid between.
 *
 * This is the "real" view (like Splitwise with "simplify debts" off): Dana
 * owes Maya because Maya paid the rent — not a shortcut like "Dana → Tom".
 * Each pair is netted, so it appears at most once. Biggest first.
 */
export function pairwiseDebts(money: HouseMoney, upTo?: string): Transfer[] {
  // Key "a|b" with a < b; positive = a owes b, negative = b owes a.
  const pairs = new Map<string, number>();
  const owe = (debtor: string, creditor: string, amount: number): void => {
    if (!debtor || !creditor || debtor === creditor || amount === 0) return;
    const [a, b] = debtor < creditor ? [debtor, creditor] : [creditor, debtor];
    const key = `${a}|${b}`;
    pairs.set(key, (pairs.get(key) ?? 0) + (debtor === a ? amount : -amount));
  };

  for (const bill of money.bills) {
    if (bill.settled || (upTo !== undefined && bill.date > upTo)) continue;
    for (const person of bill.splitBetween) owe(person, bill.paidBy, getPersonShare(bill, person));
  }

  for (const p of money.householdPayments) {
    if (upTo !== undefined && p.paidAt > upTo) continue;
    const bill = money.householdBills.find((b) => b.id === p.billId);
    if (!bill) continue; // same rule as calculateFairness: orphaned payments don't count
    const payer = p.paidBy ?? bill.assignedTo;
    const presentThen =
      p.splitBetween && p.splitBetween.length > 0 ? [] : membersOn(money.members, p.paidAt);
    const split =
      p.splitBetween && p.splitBetween.length > 0
        ? p.splitBetween
        : presentThen.length > 0
          ? presentThen
          : [payer];
    const share = p.amount / split.length;
    for (const person of split) owe(person, payer, share);
  }

  // Paying someone lowers what you owe them (or makes them owe you).
  for (const s of money.settlementPayments) owe(s.to, s.from, s.amount);

  const transfers: Transfer[] = [];
  pairs.forEach((value, key) => {
    const [a, b] = key.split('|');
    const amount = cents(Math.abs(value));
    if (amount < 0.01) return;
    transfers.push(value > 0 ? { from: a, to: b, amount } : { from: b, to: a, amount });
  });
  return transfers.sort((x, y) => y.amount - x.amount);
}

/**
 * The payments needed to be "all square up to this date".
 *
 * `upToDebts` is what each pair owes for expenses up to the date (from
 * `pairwiseDebts`). If recording all of it leaves nobody worse off, that is
 * exactly the plan — real routes, "Dana pays Maya because Maya paid the rent".
 *
 * Otherwise someone has a credit that settling would wipe out (they already
 * paid extra), so each person's change is limited: nobody may end up owing
 * more, or flip from being owed to owing. The limited changes are then met
 * using the real routes first, and the fewest extra transfers for the rest.
 */
export function planSettleUpTo(currentNet: NetBalances, upToDebts: Transfer[]): Transfer[] {
  // How each person's balance would change if every pair settled.
  const change = new Map<string, number>();
  for (const t of upToDebts) {
    change.set(t.from, (change.get(t.from) ?? 0) + t.amount);
    change.set(t.to, (change.get(t.to) ?? 0) - t.amount);
  }

  // The best each person may end at: between their current balance and zero.
  const target = new Map<string, number>();
  let safe = true;
  change.forEach((delta, person) => {
    const now = currentNet.get(person) ?? 0;
    const after = now + delta;
    const limited =
      now >= 0 ? Math.min(Math.max(after, 0), now) : Math.max(Math.min(after, 0), now);
    if (Math.abs(limited - after) > 0.01) safe = false;
    target.set(person, limited);
  });
  if (safe) return upToDebts.filter((t) => t.amount >= 0.01);

  // Payers raise their balance toward 0, receivers lower theirs toward 0.
  const pay = new Map<string, number>();
  const receive = new Map<string, number>();
  let payTotal = 0;
  let receiveTotal = 0;
  target.forEach((tgt, person) => {
    const d = tgt - (currentNet.get(person) ?? 0);
    if (d > 0) {
      pay.set(person, d);
      payTotal += d;
    } else if (d < 0) {
      receive.set(person, -d);
      receiveTotal += -d;
    }
  });
  // Money in must equal money out — shrink the bigger side to match.
  const total = Math.min(payTotal, receiveTotal);
  if (total < 0.01) return [];
  const scale = (m: Map<string, number>, sum: number): void => {
    m.forEach((v, k) => m.set(k, (v * total) / sum));
  };
  scale(pay, payTotal);
  scale(receive, receiveTotal);

  const plan = new Map<string, number>();
  const add = (from: string, to: string, amount: number): void => {
    const key = `${from}|${to}`;
    plan.set(key, (plan.get(key) ?? 0) + amount);
    pay.set(from, (pay.get(from) ?? 0) - amount);
    receive.set(to, (receive.get(to) ?? 0) - amount);
  };
  // 1) Real routes first.
  for (const t of upToDebts) {
    const amount = Math.min(t.amount, pay.get(t.from) ?? 0, receive.get(t.to) ?? 0);
    if (amount > 0) add(t.from, t.to, amount);
  }
  // 2) Whatever is left, with the fewest transfers.
  const rest = new Map<string, number>();
  pay.forEach((v, k) => rest.set(k, (rest.get(k) ?? 0) - v));
  receive.forEach((v, k) => rest.set(k, (rest.get(k) ?? 0) + v));
  for (const t of settleDebts(rest)) add(t.from, t.to, t.amount);

  const out: Transfer[] = [];
  plan.forEach((amount, key) => {
    const [from, to] = key.split('|');
    const rounded = cents(amount);
    if (rounded >= 0.01) out.push({ from, to, amount: rounded });
  });
  return out.sort((x, y) => y.amount - x.amount);
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

/**
 * The latest "settled up to" date in the house (YYYY-MM-DD), or null if
 * nobody has used "Settle up to a date" yet.
 */
export function latestSettledUntil(payments: SettlementPayment[]): string | null {
  let latest: string | null = null;
  for (const p of payments) {
    if (p.coversUntil && (latest === null || p.coversUntil > latest)) latest = p.coversUntil;
  }
  return latest;
}
