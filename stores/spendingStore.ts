import { create } from 'zustand';
import { devtools } from 'zustand/middleware';
import { supabase } from '@lib/supabase';
import { captureError } from '@lib/errorTracking';
import { useAuthStore } from '@stores/authStore';

// ── Category metadata ──────────────────────────────────────────────────────────
export const CATEGORY_META: Record<string, { icon: string; color: string }> = {
  rent:           { icon: '🏠', color: '#8B5CF6' },
  electricity:    { icon: '⚡', color: '#F59E0B' },
  water:          { icon: '💧', color: '#3B6FBF' },
  internet:       { icon: '📶', color: '#06B6D4' },
  groceries:      { icon: '🛒', color: '#4FB071' },
  shopping:       { icon: '🛒', color: '#4FB071' },
  'outside food': { icon: '🍕', color: '#E0B24D' },
  food:           { icon: '🍕', color: '#E0B24D' },
  transport:      { icon: '🚗', color: '#64748B' },
  entertainment:  { icon: '🎉', color: '#EC4899' },
  health:         { icon: '🏥', color: '#10B981' },
  other:          { icon: '📦', color: '#8D8F8F' },
};

function categoryMeta(name: string): { icon: string; color: string } {
  return CATEGORY_META[name.toLowerCase()] ?? { icon: '📦', color: '#8D8F8F' };
}

// ── Types ──────────────────────────────────────────────────────────────────────
export interface CategorySpend {
  name: string;
  icon: string;
  color: string;
  amount: number;
}

export interface MonthSpend {
  month: string;          // "2026-03"
  label: string;          // "Mar 2026"
  total: number;          // logged-in user's share
  houseTotal: number;     // full house spending
  categories: CategorySpend[];       // user's share per category
  houseCategories: CategorySpend[];  // house total per category
}

interface SpendingStore {
  months: MonthSpend[];
  isLoading: boolean;
  insight: string | null;
  insightLoading: boolean;
  insightMonth: string | null;
  load: (houseId: string, userName: string) => Promise<void>;
  fetchInsight: (houseId: string, userName: string, currency: string) => Promise<void>;
}

// ── Helpers ────────────────────────────────────────────────────────────────────
function toMonthKey(dateStr: string): string {
  return dateStr.slice(0, 7);
}

function toMonthLabel(monthKey: string): string {
  const [y, m] = monthKey.split('-');
  return new Date(Number(y), Number(m) - 1, 1)
    .toLocaleDateString('en-GB', { month: 'short', year: 'numeric' });
}

function lastNMonths(n: number): string[] {
  const result: string[] = [];
  const now = new Date();
  for (let i = 0; i < n; i++) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    result.push(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`);
  }
  return result;
}

// ── Store ──────────────────────────────────────────────────────────────────────
export const useSpendingStore = create<SpendingStore>()(
  devtools(
    (set) => ({
      months: [],
      isLoading: false,
      insight: null,
      insightLoading: false,
      insightMonth: null,

      load: async (houseId: string, userName: string): Promise<void> => {
        if (houseId !== useAuthStore.getState().houseId) {
          console.warn('[spending] house ID mismatch — aborting load');
          return;
        }
        set({ isLoading: true });
        try {
          const sixMonthsAgo = ((): string => {
            const d = new Date();
            d.setMonth(d.getMonth() - 6);
            return d.toISOString().split('T')[0];
          })();

          const [billsRes, paymentsRes] = await Promise.all([
            supabase
              .from('bills')
              .select('id, amount, paid_by, split_between, date, category')
              .eq('house_id', houseId)
              .gte('date', sixMonthsAgo),
            supabase
              .from('household_payments')
              .select('id, amount, paid_at, recurring_bills(name, assigned_to)')
              .eq('house_id', houseId)
              .gte('paid_at', sixMonthsAgo),
          ]);

          // ── User tally: logged-in user's proportional share ────────────────
          const tally = new Map<string, Map<string, number>>();

          for (const b of billsRes.data ?? []) {
            const splits: string[] = Array.isArray(b.split_between) ? b.split_between : [];
            if (!splits.includes(userName)) continue;
            const share = b.amount / (splits.length || 1);
            const mk = toMonthKey(b.date);
            const cat = (b.category as string | null)?.toLowerCase() ?? 'other';
            if (!tally.has(mk)) tally.set(mk, new Map());
            tally.get(mk)!.set(cat, (tally.get(mk)!.get(cat) ?? 0) + share);
          }

          for (const p of paymentsRes.data ?? []) {
            const rbRaw = p.recurring_bills;
            const rb = (Array.isArray(rbRaw) ? rbRaw[0] : rbRaw) as { name: string; assigned_to: string } | null;
            if (!rb || rb.assigned_to !== userName) continue;
            const mk = toMonthKey(p.paid_at);
            const cat = rb.name.toLowerCase();
            if (!tally.has(mk)) tally.set(mk, new Map());
            tally.get(mk)!.set(cat, (tally.get(mk)!.get(cat) ?? 0) + Number(p.amount));
          }

          // ── House tally: full house spending ──────────────────────────────
          const houseTally = new Map<string, Map<string, number>>();

          for (const b of billsRes.data ?? []) {
            const mk = toMonthKey(b.date);
            const cat = (b.category as string | null)?.toLowerCase() ?? 'other';
            if (!houseTally.has(mk)) houseTally.set(mk, new Map());
            houseTally.get(mk)!.set(cat, (houseTally.get(mk)!.get(cat) ?? 0) + Number(b.amount));
          }

          for (const p of paymentsRes.data ?? []) {
            const rbRaw = p.recurring_bills;
            const rb = (Array.isArray(rbRaw) ? rbRaw[0] : rbRaw) as { name: string; assigned_to: string } | null;
            if (!rb) continue;
            const mk = toMonthKey(p.paid_at);
            const cat = rb.name.toLowerCase();
            if (!houseTally.has(mk)) houseTally.set(mk, new Map());
            houseTally.get(mk)!.set(cat, (houseTally.get(mk)!.get(cat) ?? 0) + Number(p.amount));
          }

          // ── Build MonthSpend[] ─────────────────────────────────────────────
          const months: MonthSpend[] = lastNMonths(6).map((mk) => {
            const catMap = tally.get(mk) ?? new Map();
            const categories: CategorySpend[] = Array.from(catMap.entries())
              .map(([name, amount]) => ({ name, amount, ...categoryMeta(name) }))
              .sort((a, b) => b.amount - a.amount);
            const total = categories.reduce((s, c) => s + c.amount, 0);

            const houseCatMap = houseTally.get(mk) ?? new Map();
            const houseCategories: CategorySpend[] = Array.from(houseCatMap.entries())
              .map(([name, amount]) => ({ name, amount, ...categoryMeta(name) }))
              .sort((a, b) => b.amount - a.amount);
            const houseTotal = houseCategories.reduce((s, c) => s + c.amount, 0);

            return { month: mk, label: toMonthLabel(mk), total, categories, houseTotal, houseCategories };
          });

          set({ months, isLoading: false });
        } catch (err) {
          captureError(err, { store: 'spending', houseId });
          set({ isLoading: false });
        }
      },

      fetchInsight: async (houseId: string, userName: string, currency: string): Promise<void> => {
        const state = useSpendingStore.getState();
        const currentMonth = state.months[0]?.month;
        if (!currentMonth || !state.months.length) return;
        if (state.insightMonth === currentMonth && state.insight) return;

        set({ insightLoading: true });
        try {
          const { data, error } = await supabase.functions.invoke('spending-analysis', {
            body: { months: state.months.slice(0, 3), userName, currency },
          });
          if (error) throw error;
          set({
            insight: (data as { insight: string }).insight,
            insightMonth: currentMonth,
            insightLoading: false,
          });
        } catch (err) {
          captureError(err, { store: 'spending', action: 'fetchInsight', houseId });
          set({ insightLoading: false });
        }
      },
    }),
    { name: 'spending-store' }
  )
);
