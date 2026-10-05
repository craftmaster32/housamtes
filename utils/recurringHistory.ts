import type {
  BillFrequency,
  HistoryEntry,
  HistoryKind,
  HouseholdPayment,
  RecurringBill,
} from '@stores/recurringBillsStore';

/** First day of the month a date falls in: "2026-09-24" → "2026-09-01". */
function monthStart(dateStr: string): string {
  return `${dateStr.slice(0, 7)}-01`;
}

/** The parts of a payment the change history compares. */
export interface PaymentSnapshot {
  billId: string;
  amount: number;
  paidAt: string; // YYYY-MM-DD
  coversFrom: string; // YYYY-MM-01 — explicit, or implied by paidAt
  note: string;
  splitBetween: string[]; // empty = everyone
}

/** The parts of a recurring bill the change history compares. */
export interface BillSnapshot {
  name: string;
  assignedTo: string;
  frequency: BillFrequency;
  typicalAmount: number;
}

export type HistoryChange =
  | { field: 'amount'; from: number; to: number }
  | { field: 'paidAt'; from: string; to: string }
  | { field: 'coversFrom'; from: string; to: string }
  | { field: 'note'; from: string; to: string }
  | { field: 'split'; from: string[]; to: string[] }
  | { field: 'name'; from: string; to: string }
  | { field: 'assignedTo'; from: string; to: string }
  | { field: 'frequency'; from: BillFrequency; to: BillFrequency }
  | { field: 'typicalAmount'; from: number; to: number };

/** One readable line of history: who did what to which bill, and when. */
export interface HistoryItem {
  id: string;
  kind: HistoryKind;
  at: string;
  actorId: string | null;
  billId: string; // the bill this belongs to (a payment's bill, or the bill itself)
  changes: HistoryChange[]; // edits only
  payment?: PaymentSnapshot; // payment edits/deletes: the payment before the change
  bill?: BillSnapshot; // bill deletes: the bill as it was
}

function str(v: unknown): string {
  return typeof v === 'string' ? v : '';
}

function num(v: unknown): number {
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
}

function strArray(v: unknown): string[] {
  return Array.isArray(v) ? v.filter((x): x is string => typeof x === 'string') : [];
}

function isFrequency(v: unknown): v is BillFrequency {
  return v === 'monthly' || v === 'bimonthly' || v === 'quarterly';
}

/** Payment snapshot from an audit-log row (snake_case, as stored). */
export function paymentFromRow(row: Record<string, unknown>): PaymentSnapshot {
  const paidAt = str(row.paid_at);
  const coversFrom = str(row.covers_from);
  return {
    billId: str(row.bill_id),
    amount: num(row.amount),
    paidAt,
    coversFrom: coversFrom || (paidAt ? monthStart(paidAt) : ''),
    note: str(row.note),
    splitBetween: strArray(row.split_between),
  };
}

/** Payment snapshot from the live store. */
export function paymentFromLive(p: HouseholdPayment): PaymentSnapshot {
  return {
    billId: p.billId,
    amount: p.amount,
    paidAt: p.paidAt,
    coversFrom: p.coversFrom ?? monthStart(p.paidAt),
    note: p.note,
    splitBetween: p.splitBetween ?? [],
  };
}

/** Bill snapshot from an audit-log row (snake_case, as stored). */
export function billFromRow(row: Record<string, unknown>): BillSnapshot {
  return {
    name: str(row.name),
    assignedTo: str(row.assigned_to),
    frequency: isFrequency(row.frequency) ? row.frequency : 'monthly',
    typicalAmount: num(row.typical_amount),
  };
}

/** Bill snapshot from the live store. */
export function billFromLive(b: RecurringBill): BillSnapshot {
  return {
    name: b.name,
    assignedTo: b.assignedTo,
    frequency: b.frequency,
    typicalAmount: b.typicalAmount,
  };
}

function sameSet(a: string[], b: string[]): boolean {
  return a.length === b.length && [...a].sort().join('|') === [...b].sort().join('|');
}

export function diffPayments(before: PaymentSnapshot, after: PaymentSnapshot): HistoryChange[] {
  const changes: HistoryChange[] = [];
  if (before.amount !== after.amount) {
    changes.push({ field: 'amount', from: before.amount, to: after.amount });
  }
  if (before.paidAt !== after.paidAt) {
    changes.push({ field: 'paidAt', from: before.paidAt, to: after.paidAt });
  }
  if (before.coversFrom !== after.coversFrom) {
    changes.push({ field: 'coversFrom', from: before.coversFrom, to: after.coversFrom });
  }
  if (before.note !== after.note) {
    changes.push({ field: 'note', from: before.note, to: after.note });
  }
  if (!sameSet(before.splitBetween, after.splitBetween)) {
    changes.push({ field: 'split', from: before.splitBetween, to: after.splitBetween });
  }
  return changes;
}

export function diffBills(before: BillSnapshot, after: BillSnapshot): HistoryChange[] {
  const changes: HistoryChange[] = [];
  if (before.name !== after.name) {
    changes.push({ field: 'name', from: before.name, to: after.name });
  }
  if (before.typicalAmount !== after.typicalAmount) {
    changes.push({ field: 'typicalAmount', from: before.typicalAmount, to: after.typicalAmount });
  }
  if (before.assignedTo !== after.assignedTo) {
    changes.push({ field: 'assignedTo', from: before.assignedTo, to: after.assignedTo });
  }
  if (before.frequency !== after.frequency) {
    changes.push({ field: 'frequency', from: before.frequency, to: after.frequency });
  }
  return changes;
}

/**
 * Turns raw audit-log entries into readable history, newest first.
 *
 * The log stores each row as it was *before* a change. So the "after" side of
 * an edit is the next newer entry for the same row (an edit or the delete), or
 * the live row when it was the latest change. Edits whose "after" can't be
 * found (a row whose later history fell outside the loaded window) are skipped
 * rather than shown wrong, as are edits that changed nothing we display.
 */
export function buildHistory(
  entries: HistoryEntry[],
  bills: RecurringBill[],
  payments: HouseholdPayment[]
): HistoryItem[] {
  const newestFirst = [...entries].sort((a, b) => b.at.localeCompare(a.at));
  const liveBills = new Map(bills.map((b): [string, RecurringBill] => [b.id, b]));
  const livePayments = new Map(payments.map((p): [string, HouseholdPayment] => [p.id, p]));
  // Newest already-seen entry per row: the state right after the entry being processed.
  const newerByRecord = new Map<string, HistoryEntry>();
  const items: HistoryItem[] = [];

  for (const entry of newestFirst) {
    const newer = newerByRecord.get(entry.recordId);
    newerByRecord.set(entry.recordId, entry);

    if (entry.kind === 'payment_delete') {
      const payment = paymentFromRow(entry.oldData);
      items.push({ ...base(entry), billId: payment.billId, changes: [], payment });
      continue;
    }
    if (entry.kind === 'bill_delete') {
      items.push({
        ...base(entry),
        billId: entry.recordId,
        changes: [],
        bill: billFromRow(entry.oldData),
      });
      continue;
    }
    if (entry.kind === 'payment_edit') {
      const before = paymentFromRow(entry.oldData);
      const live = livePayments.get(entry.recordId);
      const after = newer ? paymentFromRow(newer.oldData) : live ? paymentFromLive(live) : null;
      if (!after) continue;
      const changes = diffPayments(before, after);
      if (changes.length > 0) {
        items.push({ ...base(entry), billId: before.billId, changes, payment: before });
      }
      continue;
    }
    // bill_edit
    const before = billFromRow(entry.oldData);
    const live = liveBills.get(entry.recordId);
    const after = newer ? billFromRow(newer.oldData) : live ? billFromLive(live) : null;
    if (!after) continue;
    const changes = diffBills(before, after);
    if (changes.length > 0) {
      items.push({ ...base(entry), billId: entry.recordId, changes });
    }
  }
  return items;
}

function base(entry: HistoryEntry): Pick<HistoryItem, 'id' | 'kind' | 'at' | 'actorId'> {
  return { id: entry.id, kind: entry.kind, at: entry.at, actorId: entry.actorId };
}
