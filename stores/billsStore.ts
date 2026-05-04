import { create } from 'zustand';
import { devtools } from 'zustand/middleware';
import { supabase } from '@lib/supabase';
import { notifyHousemates } from '@lib/notifyHousemates';
import { useSettingsStore } from '@stores/settingsStore';
import { captureError } from '@lib/errorTracking';
import { useAuthStore } from '@stores/authStore';

export const CATEGORIES = [
  'Rent', 'Groceries', 'Food', 'Transport', 'Utilities',
  'Internet', 'Phone', 'Entertainment', 'Health', 'Shopping', 'Travel', 'Other',
];

export interface Bill {
  id: string;
  title: string;
  amount: number;
  paidBy: string;        // user UUID
  splitBetween: string[]; // user UUIDs
  splitAmounts: Record<string, number> | null; // null = equal split; keys are user UUIDs
  category: string;
  date: string;
  createdAt: string;
  settled: boolean;
  settledBy: string | null; // user UUID
  settledAt: string | null;
  notes: string | null;
}

export interface Balance {
  person: string; // user UUID
  amount: number; // positive = they owe you, negative = you owe them
}

interface BillsStore {
  bills: Bill[];
  isLoading: boolean;
  error: string | null;
  load: (houseId: string) => Promise<void>;
  unsubscribe: () => void;
  addBill: (bill: Omit<Bill, 'id' | 'createdAt' | 'settled' | 'settledBy' | 'settledAt' | 'notes'> & { notes?: string }, houseId: string) => Promise<void>;
  editBill: (id: string, updates: { title: string; amount: number; date: string; notes: string; category: string }) => Promise<void>;
  settleBill: (id: string, settledByUserId: string, settledByName: string, houseId: string) => Promise<void>;
  deleteBill: (id: string, houseId: string) => Promise<void>;
}

let _channel: ReturnType<typeof supabase.channel> | null = null;

export const useBillsStore = create<BillsStore>()(
  devtools(
    (set, get) => ({
      bills: [],
      isLoading: true,
      error: null,
      load: async (houseId: string): Promise<void> => {
        if (houseId !== useAuthStore.getState().houseId) {
          console.warn('[bills] house ID mismatch — aborting load');
          set({ isLoading: false });
          return;
        }
        try {
          const { data, error } = await supabase
            .from('bills')
            .select('*')
            .eq('house_id', houseId)
            .order('date', { ascending: false });
          if (error) throw error;
          const bills: Bill[] = (data ?? []).map((r) => ({
            id: r.id,
            title: r.title,
            amount: Number(r.amount),
            paidBy: r.paid_by,
            splitBetween: r.split_between ?? [],
            splitAmounts: r.split_amounts ?? null,
            category: r.category,
            date: r.date,
            createdAt: r.created_at,
            settled: r.settled ?? false,
            settledBy: r.settled_by ?? null,
            settledAt: r.settled_at ?? null,
            notes: r.notes ?? null,
          }));
          set({ bills, isLoading: false, error: null });
        } catch (err) {
          captureError(err, { store: 'bills', houseId });
          set({ isLoading: false, error: 'Could not load bills. Please try again.' });
        }

        if (_channel) { supabase.removeChannel(_channel); }
        _channel = supabase
          .channel(`bills:${houseId}`)
          .on('postgres_changes', { event: '*', schema: 'public', table: 'bills', filter: `house_id=eq.${houseId}` },
            () => { get().load(houseId); })
          .subscribe();
      },
      unsubscribe: (): void => {
        if (_channel) { supabase.removeChannel(_channel); _channel = null; }
      },
      addBill: async (data, houseId): Promise<void> => {
        const { data: sessionData } = await supabase.auth.getSession();
        const userId = sessionData.session?.user.id ?? '';
        const { data: inserted, error } = await supabase
          .from('bills')
          .insert({
            house_id: houseId,
            title: data.title,
            amount: data.amount,
            paid_by: data.paidBy,
            split_between: data.splitBetween,
            split_amounts: data.splitAmounts ?? null,
            category: data.category,
            date: data.date,
            notes: data.notes ?? null,
          })
          .select()
          .single();
        if (error) { captureError(error, { context: 'add-bill', houseId }); throw new Error('Could not save the bill. Please try again.'); }
        const bill: Bill = {
          id: inserted.id,
          title: inserted.title,
          amount: Number(inserted.amount),
          paidBy: inserted.paid_by,
          splitBetween: inserted.split_between ?? [],
          splitAmounts: inserted.split_amounts ?? null,
          category: inserted.category,
          date: inserted.date,
          createdAt: inserted.created_at,
          settled: false,
          settledBy: null,
          settledAt: null,
          notes: inserted.notes ?? null,
        };
        set({ bills: [bill, ...get().bills] });
        if (userId) {
          notifyHousemates({
            houseId,
            excludeUserId: userId,
            title: '💰 New bill added',
            body: `${data.title} — ${useSettingsStore.getState().currency}${data.amount.toFixed(2)}`,
            data: { screen: 'bills' },
            notificationType: 'bill_added',
          });
        }
      },
      editBill: async (id, updates): Promise<void> => {
        const { error } = await supabase
          .from('bills')
          .update({ title: updates.title, amount: updates.amount, date: updates.date, notes: updates.notes, category: updates.category })
          .eq('id', id);
        if (error) { captureError(error, { context: 'edit-bill', billId: id }); throw new Error('Could not update the bill. Please try again.'); }
        set({
          bills: get().bills.map((b) =>
            b.id === id ? { ...b, title: updates.title, amount: updates.amount, date: updates.date, notes: updates.notes, category: updates.category } : b
          ),
        });
      },
      settleBill: async (id, settledByUserId, settledByName, houseId): Promise<void> => {
        const bill = get().bills.find((b) => b.id === id);
        if (!bill) throw new Error('Bill not found');
        if (bill.settled) throw new Error('Bill is already settled');
        const now = new Date().toISOString();
        const { error } = await supabase
          .from('bills')
          .update({ settled: true, settled_by: settledByUserId, settled_at: now })
          .eq('id', id);
        if (error) { captureError(error, { context: 'settle-bill', billId: id }); throw new Error('Could not settle the bill. Please try again.'); }
        set({
          bills: get().bills.map((b) =>
            b.id === id ? { ...b, settled: true, settledBy: settledByUserId, settledAt: now } : b
          ),
        });
        if (settledByUserId) {
          notifyHousemates({
            houseId,
            excludeUserId: settledByUserId,
            title: '✅ Bill settled',
            body: `${bill.title} marked as settled by ${settledByName}`,
            data: { screen: 'bills' },
            notificationType: 'bill_deleted',
          });
        }
      },
      deleteBill: async (id, houseId): Promise<void> => {
        const bill = get().bills.find((b) => b.id === id);
        if (bill?.settled) {
          throw new Error(
            'Settled bills cannot be deleted — settlement history is permanent.'
          );
        }
        const { error } = await supabase.from('bills').delete().eq('id', id);
        if (error) { captureError(error, { context: 'delete-bill', billId: id }); throw new Error('Could not delete the bill. Please try again.'); }
        set({ bills: get().bills.filter((b) => b.id !== id) });
        if (bill) {
          const { data: sessionData } = await supabase.auth.getSession();
          const userId = sessionData.session?.user.id ?? '';
          if (userId) {
            notifyHousemates({
              houseId,
              excludeUserId: userId,
              title: '🗑️ Bill removed',
              body: `${bill.title} was deleted`,
              data: { screen: 'bills' },
              notificationType: 'bill_settled',
            });
          }
        }
      },
    }),
    { name: 'bills-store' }
  )
);

export function calculateAllNetBalances(bills: Bill[]): Map<string, number> {
  const net = new Map<string, number>();
  for (const bill of bills) {
    if (bill.settled) continue;
    if (bill.splitBetween.length === 0) continue;
    for (const person of bill.splitBetween) {
      if (person === bill.paidBy) continue;
      const share = getPersonShare(bill, person);
      net.set(bill.paidBy, (net.get(bill.paidBy) ?? 0) + share);
      net.set(person, (net.get(person) ?? 0) - share);
    }
  }
  return net;
}

export interface Settlement {
  from: string; // user UUID
  to: string;   // user UUID
  amount: number;
}

export function settleDebts(netBalances: Map<string, number>): Settlement[] {
  const pos: Array<{ person: string; amount: number }> = [];
  const neg: Array<{ person: string; amount: number }> = [];
  netBalances.forEach((amount, person) => {
    if (amount > 0.01) pos.push({ person, amount });
    else if (amount < -0.01) neg.push({ person, amount: -amount });
  });
  pos.sort((a, b) => b.amount - a.amount);
  neg.sort((a, b) => b.amount - a.amount);
  const result: Settlement[] = [];
  let i = 0, j = 0;
  while (i < pos.length && j < neg.length) {
    const transfer = Math.min(pos[i].amount, neg[j].amount);
    result.push({ from: neg[j].person, to: pos[i].person, amount: transfer });
    pos[i].amount -= transfer;
    neg[j].amount -= transfer;
    if (pos[i].amount < 0.01) i++;
    if (neg[j].amount < 0.01) j++;
  }
  return result;
}

export function getPersonShare(bill: Bill, person: string): number {
  if (bill.splitAmounts && bill.splitAmounts[person] !== undefined) {
    return bill.splitAmounts[person];
  }
  if (bill.splitBetween.length === 0) return 0;
  // Work in whole cents to avoid floating-point errors; payer absorbs any remainder
  const totalCents = Math.round(bill.amount * 100);
  return Math.floor(totalCents / bill.splitBetween.length) / 100;
}

/**
 * Returns the current user's simplified balances after global debt cancellation.
 * Pass the fully combined net map (shared bills + household fairness).
 * Positive amount = that person owes you; negative = you owe them.
 */
export function calculateSimplifiedBalancesForUser(
  allNetBalances: Map<string, number>,
  currentUserId: string
): Balance[] {
  const settlements = settleDebts(allNetBalances);
  const balances: Balance[] = [];
  for (const s of settlements) {
    if (s.from === currentUserId) {
      balances.push({ person: s.to, amount: -s.amount });
    } else if (s.to === currentUserId) {
      balances.push({ person: s.from, amount: s.amount });
    }
  }
  return balances;
}

export function calculateBalances(bills: Bill[], currentUserId: string): Balance[] {
  const map = new Map<string, number>();

  bills.forEach((bill) => {
    if (bill.settled) return;
    bill.splitBetween.forEach((person) => {
      if (person === bill.paidBy) return;
      const share = getPersonShare(bill, person);
      if (bill.paidBy === currentUserId) {
        map.set(person, (map.get(person) ?? 0) + share);
      } else if (person === currentUserId) {
        map.set(bill.paidBy, (map.get(bill.paidBy) ?? 0) - share);
      }
    });
  });

  return Array.from(map.entries())
    .map(([person, amount]) => ({ person, amount }))
    .filter((b) => Math.abs(b.amount) > 0.01);
}
