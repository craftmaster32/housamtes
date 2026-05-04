import { create } from 'zustand';
import { devtools } from 'zustand/middleware';
import { supabase } from '@lib/supabase';
import { captureError } from '@lib/errorTracking';
import { useAuthStore } from '@stores/authStore';

export type BillFrequency = 'monthly' | 'bimonthly' | 'quarterly';

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
}

interface RecurringBillsStore {
  bills: RecurringBill[];
  payments: HouseholdPayment[];
  isLoading: boolean;
  error: string | null;
  load: (houseId: string) => Promise<void>;
  unsubscribe: () => void;
  addBill: (bill: Omit<RecurringBill, 'id' | 'createdAt'>, houseId: string) => Promise<void>;
  deleteBill: (id: string) => Promise<void>;
  logPayment: (payment: Omit<HouseholdPayment, 'id'>, houseId: string) => Promise<void>;
  deletePayment: (id: string) => Promise<void>;
}

let _channel: ReturnType<typeof supabase.channel> | null = null;

export const useRecurringBillsStore = create<RecurringBillsStore>()(
  devtools(
    (set, get) => ({
      bills: [],
      payments: [],
      isLoading: true,
      error: null,
      load: async (houseId: string): Promise<void> => {
        if (houseId !== useAuthStore.getState().houseId) {
          console.warn('[recurring-bills] house ID mismatch — aborting load');
          return;
        }
        try {
          const [billsRes, paymentsRes] = await Promise.all([
            supabase.from('recurring_bills').select('*').eq('house_id', houseId).order('created_at'),
            supabase.from('household_payments').select('*').eq('house_id', houseId).order('paid_at', { ascending: false }),
          ]);
          const bills: RecurringBill[] = (billsRes.data ?? []).map((r) => ({
            id: r.id,
            name: r.name,
            assignedTo: r.assigned_to,
            frequency: r.frequency as BillFrequency,
            typicalAmount: Number(r.typical_amount),
            icon: r.icon ?? '🧾',
            createdAt: r.created_at,
            nextDueDate: r.next_due_date ?? undefined,
          }));
          const payments: HouseholdPayment[] = (paymentsRes.data ?? []).map((r) => ({
            id: r.id,
            billId: r.bill_id,
            amount: Number(r.amount),
            paidAt: r.paid_at,
            note: r.note ?? '',
          }));
          set({ bills, payments, isLoading: false, error: null });
        } catch (err) {
          captureError(err, { store: 'recurring-bills', houseId });
          set({ isLoading: false, error: 'Could not load bills. Please try again.' });
        }

        if (_channel) { supabase.removeChannel(_channel); }
        _channel = supabase
          .channel(`recurring-bills:${houseId}`)
          .on('postgres_changes', { event: '*', schema: 'public', table: 'recurring_bills', filter: `house_id=eq.${houseId}` },
            () => { get().load(houseId); })
          .on('postgres_changes', { event: '*', schema: 'public', table: 'household_payments', filter: `house_id=eq.${houseId}` },
            () => { get().load(houseId); })
          .subscribe();
      },
      unsubscribe: (): void => {
        if (_channel) { supabase.removeChannel(_channel); _channel = null; }
      },
      addBill: async (data, houseId): Promise<void> => {
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
        if (error) { captureError(error, { context: 'add-recurring-bill', houseId }); throw new Error('Could not save the bill. Please try again.'); }
        const bill: RecurringBill = {
          id: inserted.id,
          name: inserted.name,
          assignedTo: inserted.assigned_to,
          frequency: inserted.frequency as BillFrequency,
          typicalAmount: Number(inserted.typical_amount),
          icon: inserted.icon ?? '🧾',
          createdAt: inserted.created_at,
          nextDueDate: inserted.next_due_date ?? undefined,
        };
        set({ bills: [...get().bills, bill] });
      },
      deleteBill: async (id): Promise<void> => {
        const { error } = await supabase.from('recurring_bills').delete().eq('id', id);
        if (error) { captureError(error, { context: 'delete-recurring-bill', billId: id }); throw new Error('Could not delete the bill. Please try again.'); }
        set({
          bills: get().bills.filter((b) => b.id !== id),
          payments: get().payments.filter((p) => p.billId !== id),
        });
      },
      logPayment: async (data, houseId): Promise<void> => {
        const { data: inserted, error } = await supabase
          .from('household_payments')
          .insert({ house_id: houseId, bill_id: data.billId, amount: data.amount, paid_at: data.paidAt, note: data.note })
          .select()
          .single();
        if (error) { captureError(error, { context: 'log-payment', houseId }); throw new Error('Could not log the payment. Please try again.'); }
        const payment: HouseholdPayment = {
          id: inserted.id,
          billId: inserted.bill_id,
          amount: Number(inserted.amount),
          paidAt: inserted.paid_at,
          note: inserted.note ?? '',
        };
        set({ payments: [payment, ...get().payments] });
      },
      deletePayment: async (id): Promise<void> => {
        const { error } = await supabase.from('household_payments').delete().eq('id', id);
        if (error) { captureError(error, { context: 'delete-payment', paymentId: id }); throw new Error('Could not delete the payment. Please try again.'); }
        set({ payments: get().payments.filter((p) => p.id !== id) });
      },
    }),
    { name: 'recurring-bills-store' }
  )
);

// ── Helpers ────────────────────────────────────────────────────────────────────

export const FREQUENCY_MONTHS: Record<BillFrequency, number> = {
  monthly: 1,
  bimonthly: 2,
  quarterly: 3,
};

export const BILL_ICONS = ['🏛️', '⚡', '💧', '🔥', '📶', '🏢', '🏠', '🧾', '🌡️', '♻️'];

export function getLastPayment(billId: string, payments: HouseholdPayment[]): HouseholdPayment | null {
  return payments
    .filter((p) => p.billId === billId)
    .sort((a, b) => b.paidAt.localeCompare(a.paidAt))[0] ?? null;
}

export function getNextDueDate(bill: RecurringBill, payments: HouseholdPayment[]): string | null {
  const last = getLastPayment(bill.id, payments);
  if (last) {
    const d = new Date(last.paidAt + 'T00:00:00');
    d.setMonth(d.getMonth() + FREQUENCY_MONTHS[bill.frequency]);
    return d.toISOString().split('T')[0];
  }
  return bill.nextDueDate ?? null;
}

export interface FairnessEntry {
  person: string;
  total: number;
  balance: number;
}

export function calculateFairness(bills: RecurringBill[], payments: HouseholdPayment[]): FairnessEntry[] {
  const totals = new Map<string, number>();
  for (const p of payments) {
    const bill = bills.find((b) => b.id === p.billId);
    if (!bill) continue;
    totals.set(bill.assignedTo, (totals.get(bill.assignedTo) ?? 0) + p.amount);
  }
  if (totals.size === 0) return [];
  const grandTotal = Array.from(totals.values()).reduce((s, v) => s + v, 0);
  const fairShare = grandTotal / totals.size;
  return Array.from(totals.entries())
    .map(([person, total]) => ({ person, total, balance: total - fairShare }))
    .sort((a, b) => b.total - a.total);
}
