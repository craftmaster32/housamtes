import { create } from 'zustand';
import { devtools } from 'zustand/middleware';
import { z } from 'zod';
import { supabase } from '@lib/supabase';
import { captureError } from '@lib/errorTracking';
import { notifyHousemates } from '@lib/notifyHousemates';
import { useAuthStore } from '@stores/authStore';
import type { SettlementPayment, Transfer } from '@utils/settleUp';
import { todayISO } from '@utils/recurringCoverage';

const DATE = /^\d{4}-\d{2}-\d{2}$/;

const paymentSchema = z
  .object({
    from: z.string().min(1),
    to: z.string().min(1),
    amount: z.number().positive().finite().max(10_000_000),
    paidOn: z.string().regex(DATE),
    coversUntil: z.string().regex(DATE).nullable(),
    note: z.string().trim().max(200).nullable(),
  })
  .refine((p) => p.from !== p.to, { message: 'Payer and receiver must be different' });

export interface NewSettlementPayment {
  from: string;
  to: string;
  amount: number;
  paidOn: string;
  note: string | null;
}

interface SettlementPaymentsStore {
  payments: SettlementPayment[];
  isLoading: boolean;
  error: string | null;
  clearError: () => void;
  load: (houseId: string) => Promise<void>;
  unsubscribe: () => void;
  /** Record one payment between two housemates. The current user must be one of them. */
  recordPayment: (
    payment: NewSettlementPayment,
    houseId: string,
    names: { fromName: string; toName: string; money: string }
  ) => Promise<void>;
  /** Record the transfers from "Settle up to a date" in one go. */
  recordSettleUpTo: (
    transfers: Transfer[],
    upTo: string,
    houseId: string,
    actorName: string
  ) => Promise<void>;
  /** Fix a recorded payment's amount, date or note (payer or receiver only). */
  updatePayment: (
    id: string,
    changes: { amount: number; paidOn: string; note: string | null },
    names: { fromName: string; toName: string; money: string }
  ) => Promise<void>;
  /** Undo a payment (payer or receiver only). Balances go back to how they were. */
  deletePayment: (
    id: string,
    names?: { fromName: string; toName: string; money: string }
  ) => Promise<void>;
}

interface SettlementRow {
  id: string;
  from_user: string;
  to_user: string;
  amount: number | string;
  paid_on: string;
  covers_until: string | null;
  note: string | null;
  created_by: string;
  created_at: string;
  updated_at?: string | null;
}

function rowToPayment(r: SettlementRow): SettlementPayment {
  return {
    id: r.id,
    from: r.from_user,
    to: r.to_user,
    amount: Number(r.amount),
    paidOn: r.paid_on,
    coversUntil: r.covers_until ?? null,
    note: r.note ?? null,
    createdBy: r.created_by,
    createdAt: r.created_at,
    updatedAt: r.updated_at ?? r.created_at,
  };
}

const byNewest = (a: SettlementPayment, b: SettlementPayment): number =>
  b.paidOn.localeCompare(a.paidOn) || b.createdAt.localeCompare(a.createdAt);

/** Thrown when the database refuses a delete (only the payer or receiver may undo). */
export class SettlementDeleteNotAllowedError extends Error {
  constructor() {
    super('Only the two people in this payment can delete it.');
    this.name = 'SettlementDeleteNotAllowedError';
  }
}

let _channel: ReturnType<typeof supabase.channel> | null = null;
let _channelHouseId: string | null = null;
// Bumped on every load() and unsubscribe() so a stale load can't overwrite newer
// data or recreate a channel after cleanup (same pattern as the bills stores).
let _loadSeq = 0;

export const useSettlementPaymentsStore = create<SettlementPaymentsStore>()(
  devtools(
    (set, get) => ({
      payments: [],
      isLoading: true,
      error: null,
      clearError: (): void => set({ error: null }),

      load: async (houseId: string): Promise<void> => {
        if (houseId !== useAuthStore.getState().houseId) {
          set({ isLoading: false });
          return;
        }
        const seq = ++_loadSeq;
        try {
          const { data, error } = await supabase
            .from('settlement_payments')
            .select('*')
            .eq('house_id', houseId)
            .order('paid_on', { ascending: false });
          if (error) throw error;
          const payments = ((data ?? []) as SettlementRow[]).map(rowToPayment).sort(byNewest);
          if (seq !== _loadSeq) return;
          set({ payments, isLoading: false, error: null });
        } catch (err) {
          captureError(err, { store: 'settlement-payments', houseId });
          if (seq !== _loadSeq) return;
          set({ isLoading: false, error: 'Could not load settle-up payments. Please try again.' });
        }

        if (seq !== _loadSeq) return;
        if (_channel && _channelHouseId === houseId) return;
        if (_channel) supabase.removeChannel(_channel);
        _channelHouseId = houseId;
        _channel = supabase
          .channel(`settlement-payments:${houseId}`)
          .on(
            'postgres_changes',
            {
              event: '*',
              schema: 'public',
              table: 'settlement_payments',
              filter: `house_id=eq.${houseId}`,
            },
            () => {
              get().load(houseId);
            }
          )
          .subscribe();
      },

      unsubscribe: (): void => {
        _loadSeq++;
        if (_channel) {
          supabase.removeChannel(_channel);
          _channel = null;
          _channelHouseId = null;
        }
      },

      recordPayment: async (payment, houseId, names): Promise<void> => {
        const parsed = paymentSchema.safeParse({ ...payment, coversUntil: null });
        if (!parsed.success) throw new Error('Please check the payment details and try again.');
        if (parsed.data.paidOn > todayISO()) {
          throw new Error('The payment date can’t be in the future.');
        }
        const userId = useAuthStore.getState().profile?.id ?? '';
        if (userId !== parsed.data.from && userId !== parsed.data.to) {
          throw new Error('You can only record payments you paid or received.');
        }
        const { data, error } = await supabase
          .from('settlement_payments')
          .insert({
            house_id: houseId,
            from_user: parsed.data.from,
            to_user: parsed.data.to,
            amount: parsed.data.amount,
            paid_on: parsed.data.paidOn,
            note: parsed.data.note || null,
            created_by: userId,
          })
          .select()
          .single();
        if (error) {
          captureError(error, { context: 'record-settlement', houseId, userId });
          throw new Error('Could not save the payment. Please try again.');
        }
        set({ payments: [rowToPayment(data as SettlementRow), ...get().payments].sort(byNewest) });

        const other = userId === parsed.data.from ? parsed.data.to : parsed.data.from;
        notifyHousemates({
          houseId,
          excludeUserId: userId,
          includeUserIds: [other],
          copyKey: 'settlement_payment',
          copyParams: { fromName: names.fromName, toName: names.toName, money: names.money },
          data: { screen: 'bills' },
          notificationType: 'bill_settled',
        });
      },

      recordSettleUpTo: async (transfers, upTo, houseId, actorName): Promise<void> => {
        const userId = useAuthStore.getState().profile?.id ?? '';
        const today = todayISO();
        const rows = transfers.map((t) => ({
          from: t.from,
          to: t.to,
          amount: t.amount,
          paidOn: today,
          coversUntil: upTo,
          note: null,
        }));
        if (rows.length === 0) return;
        if (upTo > today) throw new Error('Pick today or an earlier date.');
        for (const r of rows) {
          if (!paymentSchema.safeParse(r).success) {
            throw new Error('Please check the payment details and try again.');
          }
          if (userId !== r.from && userId !== r.to) {
            throw new Error('You can only record payments you paid or received.');
          }
        }
        // Goes through a database function that locks the house and refuses if
        // this phone hasn't seen the latest payments — so two people confirming
        // at once can't record the same month twice. All rows save, or none.
        const seen = get().payments;
        // Newest change the phone has seen: a new payment or an edit.
        const seenLatest = seen.reduce<string | null>((max, p) => {
          const changed = p.updatedAt > p.createdAt ? p.updatedAt : p.createdAt;
          return max === null || changed > max ? changed : max;
        }, null);
        const { data, error } = await supabase.rpc('record_settle_up_to', {
          p_house_id: houseId,
          p_up_to: upTo,
          p_paid_on: today,
          p_seen_count: seen.length,
          p_seen_latest: seenLatest,
          p_transfers: rows.map((r) => ({ from: r.from, to: r.to, amount: r.amount })),
        });
        if (error) {
          if (error.message?.includes('stale_balances')) {
            await get().load(houseId);
            throw new Error(
              'Someone just recorded a payment. Check the updated numbers and confirm again.'
            );
          }
          captureError(error, { context: 'settle-up-to', houseId, userId });
          throw new Error('Could not save the settle-up. Please try again.');
        }
        const added = ((data ?? []) as SettlementRow[]).map(rowToPayment);
        set({ payments: [...added, ...get().payments].sort(byNewest) });

        const others = Array.from(new Set(rows.map((r) => (r.from === userId ? r.to : r.from))));
        notifyHousemates({
          houseId,
          excludeUserId: userId,
          includeUserIds: others,
          copyKey: 'settled_up_to',
          copyParams: { name: actorName, date: upTo },
          data: { screen: 'bills' },
          notificationType: 'bill_settled',
        });
      },

      updatePayment: async (id, changes, names): Promise<void> => {
        const before = get().payments.find((p) => p.id === id);
        if (!before) throw new Error('Could not find that payment.');
        const parsed = paymentSchema.safeParse({
          from: before.from,
          to: before.to,
          amount: changes.amount,
          paidOn: changes.paidOn,
          coversUntil: before.coversUntil,
          note: changes.note,
        });
        if (!parsed.success) throw new Error('Please check the payment details and try again.');
        if (parsed.data.paidOn > todayISO()) {
          throw new Error('The payment date can’t be in the future.');
        }
        const userId = useAuthStore.getState().profile?.id ?? '';
        if (userId !== before.from && userId !== before.to) {
          throw new Error('Only the two people in this payment can change it.');
        }
        const { data, error } = await supabase
          .from('settlement_payments')
          .update({
            amount: parsed.data.amount,
            paid_on: parsed.data.paidOn,
            note: parsed.data.note || null,
          })
          .eq('id', id)
          .select();
        if (error) {
          captureError(error, { context: 'edit-settlement', settlementId: id });
          throw new Error('Could not save the change. Please try again.');
        }
        const row = (data as SettlementRow[] | null)?.[0];
        // RLS refusals come back as "0 rows updated", not as an error.
        if (!row) throw new Error('Only the two people in this payment can change it.');
        set({
          payments: get()
            .payments.map((p) => (p.id === id ? rowToPayment(row) : p))
            .sort(byNewest),
        });
        const houseId = useAuthStore.getState().houseId ?? '';
        const other = userId === before.from ? before.to : before.from;
        if (houseId) {
          notifyHousemates({
            houseId,
            excludeUserId: userId,
            includeUserIds: [other],
            copyKey: 'settlement_edited',
            copyParams: names,
            data: { screen: 'bills' },
            notificationType: 'bill_settled',
          });
        }
      },

      deletePayment: async (id, names): Promise<void> => {
        const before = get().payments.find((p) => p.id === id);
        let removed = false;
        try {
          const { data, error } = await supabase
            .from('settlement_payments')
            .delete()
            .eq('id', id)
            .select('id');
          if (error) throw error;
          // RLS refusals come back as "0 rows deleted", not as an error.
          removed = Array.isArray(data) && data.length > 0;
        } catch (err) {
          captureError(err, { context: 'delete-settlement', settlementId: id });
          throw new Error('Could not delete the payment. Please try again.');
        }
        if (!removed) throw new SettlementDeleteNotAllowedError();
        set({ payments: get().payments.filter((p) => p.id !== id) });
        // Tell the other person once — their balance just went back up.
        const userId = useAuthStore.getState().profile?.id ?? '';
        const houseId = useAuthStore.getState().houseId ?? '';
        if (before && names && houseId) {
          const other = userId === before.from ? before.to : before.from;
          notifyHousemates({
            houseId,
            excludeUserId: userId,
            includeUserIds: [other],
            copyKey: 'settlement_deleted',
            copyParams: names,
            data: { screen: 'bills' },
            notificationType: 'bill_settled',
          });
        }
      },
    }),
    { name: 'settlement-payments-store' }
  )
);
