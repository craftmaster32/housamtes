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
  gas:            { icon: '🔥', color: '#EF4444' },
  tax:            { icon: '🏛️', color: '#6366F1' },
  taxes:          { icon: '🏛️', color: '#6366F1' },
  insurance:      { icon: '🛡️', color: '#7C3AED' },
  arnona:         { icon: '🏛️', color: '#6366F1' },
  groceries:      { icon: '🛒', color: '#4FB071' },
  shopping:       { icon: '🛍️', color: '#10B981' },
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

export interface DrillDownItem {
  id: string;
  title: string;
  amount: number;
  date: string;
  type: 'bill' | 'recurring';
}

export interface MonthSpend {
  month: string;          // "2026-03"
  label: string;          // "Mar 2026"
  total: number;          // logged-in user's share
  houseTotal: number;     // full house spending
  categories: CategorySpend[];       // user's share per category
  houseCategories: CategorySpend[];  // house total per category
  billsByCategory: Record<string, DrillDownItem[]>; // raw items per category for drill-down
}

interface SpendingStore {
  months: MonthSpend[];
  isLoading: boolean;
  error: string | null;
  insight: string | null;
  insightError: string | null;
  insightLoading: boolean;
  insightMonth: string | null;
  insightCurrency: string | null;
  insightUser: string | null;
  load: (houseId: string, userName: string) => Promise<void>;
  fetchInsight: (houseId: string, userName: string, currency: string) => Promise<void>;
}

interface SpendingInsightResponse {
  insight?: string;
  error?: string;
}

interface JsonBodyContext {
  clone: () => { json: () => Promise<unknown> };
}

// ── Helpers ────────────────────────────────────────────────────────────────────
type Frequency = 'monthly' | 'bimonthly' | 'quarterly';
const FREQ_MONTHS: Record<Frequency, number> = { monthly: 1, bimonthly: 2, quarterly: 3 };

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

// Splits a recurring payment across the months it covers.
// e.g. bimonthly payment paid on 2026-05-10 covers Apr + May → share = 0.5 each.
function paymentMonthShares(paidAt: string, frequency: Frequency): Array<{ monthKey: string; share: number }> {
  const n = FREQ_MONTHS[frequency];
  const paid = new Date(paidAt + 'T00:00:00');
  const result: Array<{ monthKey: string; share: number }> = [];
  for (let i = n - 1; i >= 0; i--) {
    const d = new Date(paid.getFullYear(), paid.getMonth() - i, 1);
    result.push({
      monthKey: `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`,
      share: 1 / n,
    });
  }
  return result;
}

function addToTally(
  tally: Map<string, Map<string, number>>,
  monthKey: string,
  cat: string,
  amount: number,
): void {
  if (!tally.has(monthKey)) tally.set(monthKey, new Map());
  tally.get(monthKey)!.set(cat, (tally.get(monthKey)!.get(cat) ?? 0) + amount);
}

function getPayloadError(payload: unknown): string | null {
  if (!payload || typeof payload !== 'object') return null;
  const result = payload as SpendingInsightResponse;
  return typeof result.error === 'string' && result.error.trim() ? result.error.trim() : null;
}

function getPayloadInsight(payload: unknown): string {
  if (!payload || typeof payload !== 'object') {
    throw new Error('AI analysis did not return a response.');
  }
  const result = payload as SpendingInsightResponse;
  const payloadError = getPayloadError(result);
  if (payloadError) throw new Error(payloadError);
  if (typeof result.insight !== 'string' || !result.insight.trim()) {
    throw new Error('AI analysis came back empty. Try again.');
  }
  return result.insight.trim();
}

function hasJsonBodyContext(value: unknown): value is JsonBodyContext {
  if (!value || typeof value !== 'object') return false;
  const candidate = value as Partial<JsonBodyContext>;
  return typeof candidate.clone === 'function';
}

function getErrorContext(err: unknown): unknown {
  if (!err || typeof err !== 'object' || !('context' in err)) return null;
  return (err as { context?: unknown }).context ?? null;
}

async function readFunctionError(err: unknown): Promise<string | null> {
  const context = getErrorContext(err);
  if (!hasJsonBodyContext(context)) return null;

  const payload = await context.clone().json().catch(() => null);
  return getPayloadError(payload);
}

function toFriendlyInsightError(message: string | null): string {
  if (!message) return 'AI analysis is not available right now. Try again.';
  if (message.includes('ANTHROPIC_API_KEY') || message.toLowerCase().includes('not connected')) {
    return 'AI analysis is not connected yet. Add the Claude API key in Supabase secrets.';
  }
  if (message.toLowerCase().includes('rate limit')) {
    return 'AI analysis is busy right now. Try again in a minute.';
  }
  if (message.toLowerCase().includes('network')) {
    return 'AI analysis could not reach the server. Check your connection and try again.';
  }
  return message;
}

// ── Store ──────────────────────────────────────────────────────────────────────
export const useSpendingStore = create<SpendingStore>()(
  devtools(
    (set) => ({
      months: [],
      isLoading: false,
      error: null,
      insight: null,
      insightError: null,
      insightLoading: false,
      insightMonth: null,
      insightCurrency: null,
      insightUser: null,

      load: async (houseId: string, userName: string): Promise<void> => {
        if (houseId !== useAuthStore.getState().houseId) {
          console.warn('[spending] house ID mismatch — aborting load');
          return;
        }
        const currentUserId = useAuthStore.getState().profile?.id ?? userName;
        set({ isLoading: true, error: null });
        try {
          const sixMonthsAgo = ((): string => {
            const d = new Date();
            d.setMonth(d.getMonth() - 6);
            return d.toISOString().split('T')[0];
          })();

          const [billsRes, paymentsRes] = await Promise.all([
            supabase
              .from('bills')
              .select('id, title, amount, paid_by, split_between, date, category')
              .eq('house_id', houseId)
              .gte('date', sixMonthsAgo),
            supabase
              .from('household_payments')
              .select('id, amount, paid_at, recurring_bills(name, assigned_to, frequency)')
              .eq('house_id', houseId)
              .gte('paid_at', sixMonthsAgo),
          ]);
          if (billsRes.error) throw billsRes.error;
          if (paymentsRes.error) throw paymentsRes.error;

          const tally       = new Map<string, Map<string, number>>();
          const houseTally  = new Map<string, Map<string, number>>();
          const detailTally = new Map<string, Map<string, DrillDownItem[]>>();

          const addDetail = (mk: string, cat: string, item: DrillDownItem): void => {
            if (!detailTally.has(mk)) detailTally.set(mk, new Map());
            const m = detailTally.get(mk)!;
            if (!m.has(cat)) m.set(cat, []);
            m.get(cat)!.push(item);
          };

          // ── One-off bills ──────────────────────────────────────────────────
          for (const b of billsRes.data ?? []) {
            const splits: string[] = Array.isArray(b.split_between) ? b.split_between : [];
            const mk  = toMonthKey(b.date);
            const cat = (b.category as string | null)?.toLowerCase() ?? 'other';
            const amt = Number(b.amount);

            addToTally(houseTally, mk, cat, amt);
            addDetail(mk, cat, { id: b.id, title: (b.title as string) || cat, amount: amt, date: b.date, type: 'bill' });
            if (currentUserId && splits.includes(currentUserId)) {
              addToTally(tally, mk, cat, amt / (splits.length || 1));
            }
          }

          // ── Recurring payments — split proportionally across covered months ─
          for (const p of paymentsRes.data ?? []) {
            const rbRaw = p.recurring_bills;
            const rb = (Array.isArray(rbRaw) ? rbRaw[0] : rbRaw) as {
              name: string;
              assigned_to: string;
              frequency: string;
            } | null;
            if (!rb) continue;

            const freq: Frequency = rb.frequency in FREQ_MONTHS
              ? (rb.frequency as Frequency)
              : 'monthly';
            const cat    = rb.name.toLowerCase();
            const n      = FREQ_MONTHS[freq];
            const shares = paymentMonthShares(p.paid_at, freq);

            for (const { monthKey, share } of shares) {
              const sliceAmt = Number(p.amount) * share;
              addToTally(houseTally, monthKey, cat, sliceAmt);
              addDetail(monthKey, cat, {
                id: `${p.id}_${monthKey}`,
                title: n > 1 ? `${rb.name} (${n}-month split)` : rb.name,
                amount: sliceAmt,
                date: p.paid_at,
                type: 'recurring',
              });
              if (currentUserId && rb.assigned_to === currentUserId) {
                addToTally(tally, monthKey, cat, sliceAmt);
              }
            }
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

            const billsByCategory: Record<string, DrillDownItem[]> = {};
            const detailMap = detailTally.get(mk);
            if (detailMap) {
              for (const [catName, items] of detailMap.entries()) {
                billsByCategory[catName] = [...items].sort((a, b) => b.amount - a.amount);
              }
            }

            return { month: mk, label: toMonthLabel(mk), total, categories, houseTotal, houseCategories, billsByCategory };
          });

          set({ months, isLoading: false });
        } catch (err) {
          captureError(err, { store: 'spending', houseId });
          set({ isLoading: false, error: 'Failed to load spending data' });
        }
      },

      fetchInsight: async (houseId: string, userName: string, currency: string): Promise<void> => {
        const state = useSpendingStore.getState();
        const currentMonth = state.months[0]?.month;
        if (!currentMonth || !state.months.length) return;
        if (
          state.insightMonth === currentMonth &&
          state.insightCurrency === currency &&
          state.insightUser === userName &&
          state.insight
        ) return;

        set({ insightLoading: true, insightError: null });
        try {
          const { data, error } = await supabase.functions.invoke('spending-analysis', {
            body: { months: state.months.slice(0, 3), userName, currency },
          });
          if (error) throw error;
          const insight = getPayloadInsight(data);
          set({
            insight,
            insightError: null,
            insightMonth: currentMonth,
            insightCurrency: currency,
            insightUser: userName,
            insightLoading: false,
          });
        } catch (err) {
          const serverMessage = await readFunctionError(err);
          const localMessage = err instanceof Error ? err.message : null;
          captureError(err, { store: 'spending', action: 'fetchInsight', houseId });
          set({
            insightLoading: false,
            insightError: toFriendlyInsightError(serverMessage ?? localMessage),
          });
        }
      },
    }),
    { name: 'spending-store' }
  )
);
