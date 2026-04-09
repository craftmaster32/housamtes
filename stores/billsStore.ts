import { create } from 'zustand';
import { devtools } from 'zustand/middleware';
import { supabase } from '@lib/supabase';
import { notifyHousemates } from '@lib/notifyHousemates';

export const CATEGORIES = ['Rent', 'Electricity', 'Water', 'Internet', 'Groceries', 'Other'];

export interface Bill {
  id: string;
  title: string;
  amount: number;
  paidBy: string;
  splitBetween: string[];
  splitAmounts: Record<string, number> | null; // null = equal split
  category: string;
  date: string;
  createdAt: string;
  settled: boolean;
  settledBy: string | null;
  settledAt: string | null;
  notes: string | null;
}

export interface Balance {
  person: string;
  amount: number; // positive = they owe you, negative = you owe them
}

interface BillsStore {
  bills: Bill[];
  isLoading: boolean;
  error: string | null;
  load: (houseId: string) => Promise<void>;
  unsubscribe: () => void;
  addBill: (bill: Omit<Bill, 'id' | 'createdAt' | 'settled' | 'settledBy' | 'settledAt' | 'notes'> & { notes?: string }, houseId: string) => Promise<void>;
  editBill: (id: string, updates: { title: string; amount: number; date: string; notes: string }) => Promise<void>;
  settleBill: (id: string, settledBy: string) => Promise<void>;
  deleteBill: (id: string) => Promise<void>;
}

let _channel: ReturnType<typeof supabase.channel> | null = null;

export const useBillsStore = create<BillsStore>()(
  devtools(
    (set, get) => ({
      bills: [],
      isLoading: true,
      error: null,
      load: async (houseId: string): Promise<void> => {
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
          set({ isLoading: false, error: err instanceof Error ? err.message : 'Failed to load bills' });
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
        // Grab userId before the async insert so we can exclude sender from notification
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
        if (error) throw new Error(`Failed to add bill: ${error.message}`);
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
        notifyHousemates({
          houseId,
          excludeUserId: userId,
          title: '💰 New bill added',
          body: `${data.title} — ₪${data.amount.toFixed(2)}`,
          data: { screen: 'bills' },
          notificationType: 'bill_added',
        });
      },
      editBill: async (id, updates): Promise<void> => {
        const { error } = await supabase
          .from('bills')
          .update({ title: updates.title, amount: updates.amount, date: updates.date, notes: updates.notes })
          .eq('id', id);
        if (error) throw new Error(`Failed to update bill: ${error.message}`);
        set({
          bills: get().bills.map((b) =>
            b.id === id ? { ...b, title: updates.title, amount: updates.amount, date: updates.date, notes: updates.notes } : b
          ),
        });
      },
      settleBill: async (id, settledBy): Promise<void> => {
        const now = new Date().toISOString();
        const { error } = await supabase
          .from('bills')
          .update({ settled: true, settled_by: settledBy, settled_at: now })
          .eq('id', id);
        if (error) throw new Error(`Failed to settle bill: ${error.message}`);
        const bill = get().bills.find((b) => b.id === id);
        set({
          bills: get().bills.map((b) =>
            b.id === id ? { ...b, settled: true, settledBy, settledAt: now } : b
          ),
        });
        if (bill) {
          const { data: sessionData } = await supabase.auth.getSession();
          const userId = sessionData.session?.user.id ?? '';
          const houseRes = await supabase.from('push_tokens').select('house_id').eq('user_id', userId).maybeSingle();
          const houseId = houseRes.data?.house_id;
          if (houseId) {
            notifyHousemates({
              houseId,
              excludeUserId: userId,
              title: '✅ Bill settled',
              body: `${bill.title} marked as settled by ${settledBy}`,
              data: { screen: 'bills' },
              notificationType: 'bill_settled',
            });
          }
        }
      },
      deleteBill: async (id): Promise<void> => {
        const { error } = await supabase.from('bills').delete().eq('id', id);
        if (error) throw new Error(`Failed to delete bill: ${error.message}`);
        set({ bills: get().bills.filter((b) => b.id !== id) });
      },
    }),
    { name: 'bills-store' }
  )
);

export function calculateAllNetBalances(bills: Bill[]): Map<string, number> {
  const net = new Map<string, number>();
  for (const bill of bills) {
    const n = bill.splitBetween.length;
    if (n === 0) continue;
    const share = bill.amount / n;
    net.set(bill.paidBy, (net.get(bill.paidBy) ?? 0) + bill.amount - share);
    for (const person of bill.splitBetween) {
      if (person === bill.paidBy) continue;
      net.set(person, (net.get(person) ?? 0) - share);
    }
  }
  return net;
}

export interface Settlement {
  from: string;
  to: string;
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
  return bill.amount / bill.splitBetween.length;
}

export function calculateBalances(bills: Bill[], currentUser: string): Balance[] {
  const map = new Map<string, number>();

  bills.forEach((bill) => {
    bill.splitBetween.forEach((person) => {
      if (person === bill.paidBy) return;
      const share = getPersonShare(bill, person);
      if (bill.paidBy === currentUser) {
        map.set(person, (map.get(person) ?? 0) + share);
      } else if (person === currentUser) {
        map.set(bill.paidBy, (map.get(bill.paidBy) ?? 0) - share);
      }
    });
  });

  return Array.from(map.entries())
    .map(([person, amount]) => ({ person, amount }))
    .filter((b) => Math.abs(b.amount) > 0.01);
}
