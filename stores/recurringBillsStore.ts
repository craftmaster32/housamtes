import { create } from 'zustand';
import { devtools } from 'zustand/middleware';
import { parseISO, addMonths, format } from 'date-fns';
import { z } from 'zod';
import { supabase } from '@lib/supabase';
import { captureError } from '@lib/errorTracking';
import { useAuthStore } from '@stores/authStore';
import type { IoniconName } from '@/types/icons';

export type BillFrequency = 'monthly' | 'bimonthly' | 'quarterly';

// Validate edits before they reach Supabase (the edit forms also validate in the UI).
const billChangesSchema = z.object({
  name: z.string().trim().min(1).max(80),
  assignedTo: z.string().min(1),
  frequency: z.enum(['monthly', 'bimonthly', 'quarterly']),
  typicalAmount: z.number().positive().finite(),
  icon: z.string().min(1),
});

const paymentChangesSchema = z.object({
  amount: z.number().positive().finite(),
  paidAt: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  note: z.string(),
  splitBetween: z.array(z.string().min(1)).optional(),
  coversFrom: z
    .string()
    .regex(/^\d{4}-\d{2}-01$/)
    .optional(),
});

/**
 * Thrown when a delete is rejected by the database's permission rules. Supabase
 * reports this as "0 rows deleted" rather than an error, so we detect it ourselves.
 */
export class DeleteNotAllowedError extends Error {
  constructor() {
    super('You do not have permission to delete this.');
    this.name = 'DeleteNotAllowedError';
  }
}

export interface RecurringBill {
  id: string;
  name: string;
  assignedTo: string; // user UUID
  frequency: BillFrequency;
  typicalAmount: number;
  icon: string;
  createdAt: string;
  nextDueDate?: string; // YYYY-MM-DD — used when no payments have been logged yet
}

export interface HouseholdPayment {
  id: string;
  billId: string;
  amount: number;
  paidAt: string; // YYYY-MM-DD
  note: string;
  splitBetween?: string[]; // user UUIDs sharing the cost; undefined = split among all housemates
  coversFrom?: string; // YYYY-MM-01 — first month this payment covers; undefined = month of paidAt
}

export type HistoryKind = 'bill_edit' | 'bill_delete' | 'payment_edit' | 'payment_delete';

/**
 * One audit-log entry for a recurring bill or payment. The database stores the
 * row as it was *before* the edit or delete (`oldData`), plus who did it.
 */
export interface HistoryEntry {
  id: string;
  kind: HistoryKind;
  recordId: string;
  actorId: string | null;
  at: string; // ISO timestamp
  oldData: Record<string, unknown>;
}

const HISTORY_TABLES: Record<string, HistoryKind> = {
  recurring_bills_update: 'bill_edit',
  recurring_bills: 'bill_delete',
  household_payments_update: 'payment_edit',
  household_payments: 'payment_delete',
};

// Newest entries are the useful ones; older history stays in the database.
const HISTORY_LIMIT = 300;

interface RecurringBillsStore {
  bills: RecurringBill[];
  payments: HouseholdPayment[];
  history: HistoryEntry[];
  isLoading: boolean;
  error: string | null;
  clearError: () => void;
  load: (houseId: string) => Promise<void>;
  unsubscribe: () => void;
  addBill: (
    bill: Omit<RecurringBill, 'id' | 'createdAt'>,
    houseId: string
  ) => Promise<RecurringBill>;
  updateBill: (
    id: string,
    changes: Pick<RecurringBill, 'name' | 'assignedTo' | 'frequency' | 'typicalAmount' | 'icon'>
  ) => Promise<void>;
  deleteBill: (id: string) => Promise<void>;
  logPayment: (payment: Omit<HouseholdPayment, 'id'>, houseId: string) => Promise<void>;
  updatePayment: (
    id: string,
    changes: Pick<HouseholdPayment, 'amount' | 'paidAt' | 'note' | 'splitBetween' | 'coversFrom'>
  ) => Promise<void>;
  deletePayment: (id: string) => Promise<void>;
}

interface PaymentRow {
  id: string;
  bill_id: string;
  amount: number | string;
  paid_at: string;
  note: string | null;
  split_between: unknown;
  covers_from?: string | null;
}

function rowToPayment(r: PaymentRow): HouseholdPayment {
  return {
    id: r.id,
    billId: r.bill_id,
    amount: Number(r.amount),
    paidAt: r.paid_at,
    note: r.note ?? '',
    splitBetween:
      Array.isArray(r.split_between) && r.split_between.length > 0
        ? (r.split_between as string[])
        : undefined,
    coversFrom: r.covers_from ?? undefined,
  };
}

/**
 * Deletes one row and reports whether it is actually gone. Row-level security
 * silently skips rows the user may not delete (no error, zero rows), so a
 * "successful" delete that removed nothing must not be treated as done —
 * otherwise the row disappears locally and comes back on the next reload.
 * Returns true when the row is gone (deleted now, or already deleted by someone
 * else) and false when it still exists because the delete was not permitted.
 */
async function deleteRow(
  table: 'recurring_bills' | 'household_payments',
  id: string
): Promise<boolean> {
  const { data, error } = await supabase.from(table).delete().eq('id', id).select('id');
  if (error) throw error;
  if (Array.isArray(data) && data.length > 0) return true;
  const check = await supabase.from(table).select('id').eq('id', id).maybeSingle();
  if (check.error) throw check.error;
  return !check.data;
}

let _channel: ReturnType<typeof supabase.channel> | null = null;
let _channelHouseId: string | null = null;
// Bumped on every load() and unsubscribe(). An in-flight load compares its own
// sequence number against this before committing state or (re)subscribing, so a
// stale load can neither overwrite newer data nor recreate a channel after cleanup.
let _loadSeq = 0;

export const useRecurringBillsStore = create<RecurringBillsStore>()(
  devtools(
    (set, get) => ({
      bills: [],
      payments: [],
      history: [],
      isLoading: true,
      error: null,
      clearError: (): void => set({ error: null }),
      load: async (houseId: string): Promise<void> => {
        if (houseId !== useAuthStore.getState().houseId) {
          console.warn('[recurring-bills] house ID mismatch — aborting load');
          set({ isLoading: false });
          return;
        }
        const seq = ++_loadSeq;
        try {
          const [billsRes, paymentsRes, historyRes] = await Promise.all([
            supabase
              .from('recurring_bills')
              .select('*')
              .eq('house_id', houseId)
              .order('created_at'),
            supabase
              .from('household_payments')
              .select('*')
              .eq('house_id', houseId)
              .order('paid_at', { ascending: false }),
            supabase
              .from('audit_log')
              .select('id, table_name, record_id, actor_id, old_data, created_at')
              .eq('house_id', houseId)
              .in('table_name', Object.keys(HISTORY_TABLES))
              .order('created_at', { ascending: false })
              .limit(HISTORY_LIMIT),
          ]);
          // supabase-js resolves (not rejects) on query errors, so surface them
          // explicitly — otherwise a failed fetch would silently blank the lists.
          if (billsRes.error) throw billsRes.error;
          if (paymentsRes.error) throw paymentsRes.error;
          const bills: RecurringBill[] = (billsRes.data ?? []).map((r) => ({
            id: r.id,
            name: r.name,
            assignedTo: r.assigned_to,
            frequency: r.frequency as BillFrequency,
            typicalAmount: Number(r.typical_amount),
            icon: r.icon ?? 'receipt-outline',
            createdAt: r.created_at,
            nextDueDate: r.next_due_date ?? undefined,
          }));
          const payments: HouseholdPayment[] = (paymentsRes.data ?? []).map(rowToPayment);
          // History is a nice-to-have: if it fails to load, still show the bills.
          if (historyRes.error) {
            captureError(historyRes.error, { store: 'recurring-bills-history', houseId });
          }
          const history: HistoryEntry[] = (historyRes.error ? [] : (historyRes.data ?? [])).map(
            (r): HistoryEntry => ({
              id: r.id,
              kind: HISTORY_TABLES[r.table_name],
              recordId: r.record_id,
              actorId: r.actor_id ?? null,
              at: r.created_at,
              oldData: (r.old_data ?? {}) as Record<string, unknown>,
            })
          );
          // A newer load (or unsubscribe) superseded this one — drop its result.
          if (seq !== _loadSeq) return;
          set({ bills, payments, history, isLoading: false, error: null });
        } catch (err) {
          captureError(err, { store: 'recurring-bills', houseId });
          // A newer load (or unsubscribe) superseded this one — drop its result.
          if (seq !== _loadSeq) return;
          set({ isLoading: false, error: 'Could not load bills. Please try again.' });
        }

        // Superseded by a newer load or an unsubscribe while fetching — leave the
        // existing subscription (if any) untouched and never recreate one here.
        if (seq !== _loadSeq) return;
        // Already subscribed for this house: realtime-triggered reloads must not
        // tear the channel down and recreate it on every event.
        if (_channel && _channelHouseId === houseId) return;
        if (_channel) {
          supabase.removeChannel(_channel);
        }
        _channelHouseId = houseId;
        _channel = supabase
          .channel(`recurring-bills:${houseId}`)
          .on(
            'postgres_changes',
            {
              event: '*',
              schema: 'public',
              table: 'recurring_bills',
              filter: `house_id=eq.${houseId}`,
            },
            () => {
              get().load(houseId);
            }
          )
          .on(
            'postgres_changes',
            {
              event: '*',
              schema: 'public',
              table: 'household_payments',
              filter: `house_id=eq.${houseId}`,
            },
            () => {
              get().load(houseId);
            }
          )
          .subscribe();
      },
      unsubscribe: (): void => {
        // Invalidate any in-flight load so it cannot resubscribe after this cleanup.
        _loadSeq++;
        if (_channel) {
          supabase.removeChannel(_channel);
          _channel = null;
          _channelHouseId = null;
        }
      },
      addBill: async (data, houseId): Promise<RecurringBill> => {
        const { data: inserted, error } = await supabase
          .from('recurring_bills')
          .insert({
            house_id: houseId,
            name: data.name,
            assigned_to: data.assignedTo,
            frequency: data.frequency,
            typical_amount: data.typicalAmount,
            icon: data.icon,
            next_due_date: data.nextDueDate ?? null,
          })
          .select()
          .single();
        if (error) {
          captureError(error, { context: 'add-recurring-bill', houseId });
          throw new Error('Could not save the bill. Please try again.');
        }
        const bill: RecurringBill = {
          id: inserted.id,
          name: inserted.name,
          assignedTo: inserted.assigned_to,
          frequency: inserted.frequency as BillFrequency,
          typicalAmount: Number(inserted.typical_amount),
          icon: inserted.icon ?? 'receipt-outline',
          createdAt: inserted.created_at,
          nextDueDate: inserted.next_due_date ?? undefined,
        };
        set({ bills: [...get().bills, bill] });
        return bill;
      },
      updateBill: async (id, changes): Promise<void> => {
        const parsed = billChangesSchema.safeParse(changes);
        if (!parsed.success) {
          throw new Error('Please check the bill details and try again.');
        }
        let updated;
        try {
          const res = await supabase
            .from('recurring_bills')
            .update({
              name: parsed.data.name,
              assigned_to: parsed.data.assignedTo,
              frequency: parsed.data.frequency,
              typical_amount: parsed.data.typicalAmount,
              icon: parsed.data.icon,
            })
            .eq('id', id)
            .select()
            .single();
          if (res.error) throw res.error;
          updated = res.data;
        } catch (err) {
          captureError(err, { context: 'update-recurring-bill', billId: id });
          throw new Error('Could not update the bill. Please try again.');
        }
        set({
          bills: get().bills.map((b) =>
            b.id === id
              ? {
                  ...b,
                  name: updated.name,
                  assignedTo: updated.assigned_to,
                  frequency: updated.frequency as BillFrequency,
                  typicalAmount: Number(updated.typical_amount),
                  icon: updated.icon ?? 'receipt-outline',
                }
              : b
          ),
        });
      },
      deleteBill: async (id): Promise<void> => {
        let removed: boolean;
        try {
          removed = await deleteRow('recurring_bills', id);
        } catch (err) {
          captureError(err, { context: 'delete-recurring-bill', billId: id });
          throw new Error('Could not delete the bill. Please try again.');
        }
        if (!removed) throw new DeleteNotAllowedError();
        set({
          bills: get().bills.filter((b) => b.id !== id),
          payments: get().payments.filter((p) => p.billId !== id),
        });
      },
      logPayment: async (data, houseId): Promise<void> => {
        // Empty array (not null) is the "split among everyone" sentinel — the column is
        // NOT NULL, and the load path treats an empty array the same as "all housemates".
        const splitBetween =
          data.splitBetween && data.splitBetween.length > 0 ? data.splitBetween : [];
        const { data: inserted, error } = await supabase
          .from('household_payments')
          .insert({
            house_id: houseId,
            bill_id: data.billId,
            amount: data.amount,
            paid_at: data.paidAt,
            note: data.note,
            split_between: splitBetween,
            covers_from: data.coversFrom ?? null,
          })
          .select()
          .single();
        if (error) {
          captureError(error, { context: 'log-payment', houseId });
          throw new Error('Could not log the payment. Please try again.');
        }
        set({ payments: [rowToPayment(inserted), ...get().payments] });
      },
      updatePayment: async (id, changes): Promise<void> => {
        const parsed = paymentChangesSchema.safeParse(changes);
        if (!parsed.success) {
          throw new Error('Please check the payment details and try again.');
        }
        // Empty array (not null) is the "split among everyone" sentinel — matches the
        // NOT NULL column and how logPayment / load treat it.
        const splitBetween =
          parsed.data.splitBetween && parsed.data.splitBetween.length > 0
            ? parsed.data.splitBetween
            : [];
        let updated;
        try {
          const res = await supabase
            .from('household_payments')
            .update({
              amount: parsed.data.amount,
              paid_at: parsed.data.paidAt,
              note: parsed.data.note,
              split_between: splitBetween,
              covers_from: parsed.data.coversFrom ?? null,
            })
            .eq('id', id)
            .select()
            .single();
          if (res.error) throw res.error;
          updated = res.data;
        } catch (err) {
          captureError(err, { context: 'update-payment', paymentId: id });
          throw new Error('Could not update the payment. Please try again.');
        }
        set({
          payments: get().payments.map((p) => (p.id === id ? rowToPayment(updated) : p)),
        });
      },
      deletePayment: async (id): Promise<void> => {
        let removed: boolean;
        try {
          removed = await deleteRow('household_payments', id);
        } catch (err) {
          captureError(err, { context: 'delete-payment', paymentId: id });
          throw new Error('Could not delete the payment. Please try again.');
        }
        if (!removed) throw new DeleteNotAllowedError();
        set({ payments: get().payments.filter((p) => p.id !== id) });
      },
    }),
    { name: 'recurring-bills-store' }
  )
);

// ── Helpers ────────────────────────────────────────────────────────────────────

const FREQUENCY_MONTHS: Record<BillFrequency, number> = {
  monthly: 1,
  bimonthly: 2,
  quarterly: 3,
};

// Ionicon names offered in the bill-icon picker (new bills store these).
export const BILL_ICONS: IoniconName[] = [
  'business-outline',
  'flash-outline',
  'water-outline',
  'flame-outline',
  'wifi-outline',
  'business',
  'home-outline',
  'receipt-outline',
  'thermometer-outline',
  'trash-outline',
];

// Legacy bills stored an emoji in the `icon` column. Map those to the matching
// Ionicon so existing data keeps rendering after the switch to icon-name picks.
const LEGACY_BILL_ICONS: Record<string, IoniconName> = {
  '🏛️': 'business-outline',
  '⚡': 'flash-outline',
  '💧': 'water-outline',
  '🔥': 'flame-outline',
  '📶': 'wifi-outline',
  '🏢': 'business',
  '🏠': 'home-outline',
  '🧾': 'receipt-outline',
  '🌡️': 'thermometer-outline',
  '♻️': 'trash-outline',
};

const VALID_BILL_ICONS = new Set<string>(BILL_ICONS);

// Resolve whatever is stored in a bill's `icon` field (legacy emoji or a new
// Ionicon name) to a renderable Ionicon name.
export function resolveBillIcon(stored: string | null | undefined): IoniconName {
  if (stored && VALID_BILL_ICONS.has(stored)) return stored as IoniconName;
  if (stored && LEGACY_BILL_ICONS[stored]) return LEGACY_BILL_ICONS[stored];
  return 'receipt-outline';
}

export function getLastPayment(
  billId: string,
  payments: HouseholdPayment[]
): HouseholdPayment | null {
  return (
    payments
      .filter((p) => p.billId === billId)
      .sort((a, b) => b.paidAt.localeCompare(a.paidAt))[0] ?? null
  );
}

/** First day of the month a date falls in: "2026-09-24" → "2026-09-01". */
export function monthStart(dateStr: string): string {
  return `${dateStr.slice(0, 7)}-01`;
}

/** Shift a YYYY-MM-01 month by `n` months (negative goes back). */
export function shiftMonth(monthStr: string, n: number): string {
  return format(addMonths(parseISO(monthStr), n), 'yyyy-MM-01');
}

/** The months one billing period starting at `start` (YYYY-MM-01) spans. */
export function periodMonths(start: string, frequency: BillFrequency): string[] {
  return Array.from({ length: FREQUENCY_MONTHS[frequency] }, (_, i) => shiftMonth(start, i));
}

/**
 * The months a payment pays for, as YYYY-MM-01 strings. A monthly bill covers one
 * month, bimonthly two and quarterly three, starting at `coversFrom` — or, for
 * payments logged before coverage was recorded, the month the payment was made.
 */
export function getCoveredMonths(payment: HouseholdPayment, frequency: BillFrequency): string[] {
  return periodMonths(payment.coversFrom ?? monthStart(payment.paidAt), frequency);
}

/**
 * Which month(s) a new payment for this bill should cover by default: the period
 * right after the latest one already paid, or the payment's own month when the
 * bill has no payments yet.
 */
export function suggestCoversFrom(
  bill: RecurringBill,
  payments: HouseholdPayment[],
  paidAt: string
): string {
  const covered = payments
    .filter((p) => p.billId === bill.id)
    .flatMap((p) => getCoveredMonths(p, bill.frequency))
    .sort();
  const latest = covered[covered.length - 1];
  return latest ? shiftMonth(latest, 1) : monthStart(paidAt);
}

/**
 * Human label for a run of covered months, e.g. "Sep 2026", "Sep – Oct 2026",
 * or "Dec 2026 – Feb 2027" when the period crosses a year.
 */
export function formatCoverage(months: string[], locale: string): string {
  if (months.length === 0) return '';
  const toDate = (m: string): Date => new Date(Number(m.slice(0, 4)), Number(m.slice(5, 7)) - 1, 1);
  const first = toDate(months[0]);
  const last = toDate(months[months.length - 1]);
  const monthYear = (d: Date): string =>
    d.toLocaleDateString(locale, { month: 'short', year: 'numeric' });
  if (months.length === 1) return monthYear(first);
  const firstLabel =
    first.getFullYear() === last.getFullYear()
      ? first.toLocaleDateString(locale, { month: 'short' })
      : monthYear(first);
  return `${firstLabel} – ${monthYear(last)}`;
}

export function getNextDueDate(bill: RecurringBill, payments: HouseholdPayment[]): string | null {
  const last = getLastPayment(bill.id, payments);
  if (last) {
    return format(addMonths(parseISO(last.paidAt), FREQUENCY_MONTHS[bill.frequency]), 'yyyy-MM-dd');
  }
  return bill.nextDueDate ?? null;
}

export interface FairnessEntry {
  person: string;
  total: number; // amount this person has actually paid (as the bill's assignee)
  balance: number; // paid minus their fair share of what they're split into (feeds Settle Up)
}

/**
 * Net contribution model for recurring household bills.
 *
 * Every logged payment is credited to the person the bill is assigned to (the payer),
 * and its cost is shared equally among the people in `splitBetween`. When a payment has
 * no explicit split, it is shared among all current housemates (`memberIds`). Each
 * person's balance = what they paid − their share of everything, so positive means they
 * are owed money and negative means they owe. Balances always sum to ~0, so they feed
 * straight into Settle Up.
 */
export function calculateFairness(
  bills: RecurringBill[],
  payments: HouseholdPayment[],
  memberIds: string[] = []
): FairnessEntry[] {
  const paid = new Map<string, number>();
  const owed = new Map<string, number>();
  const people = new Set<string>();

  for (const p of payments) {
    const bill = bills.find((b) => b.id === p.billId);
    if (!bill) continue;
    const payer = bill.assignedTo;
    people.add(payer);
    paid.set(payer, (paid.get(payer) ?? 0) + p.amount);

    const split =
      p.splitBetween && p.splitBetween.length > 0
        ? p.splitBetween
        : memberIds.length > 0
          ? memberIds
          : [payer];
    const share = p.amount / split.length;
    for (const m of split) {
      people.add(m);
      owed.set(m, (owed.get(m) ?? 0) + share);
    }
  }

  if (paid.size === 0) return [];

  return Array.from(people)
    .map((person) => {
      const total = paid.get(person) ?? 0;
      return { person, total, balance: total - (owed.get(person) ?? 0) };
    })
    .filter((e) => e.total > 0.005 || Math.abs(e.balance) > 0.005)
    .sort((a, b) => b.total - a.total);
}
