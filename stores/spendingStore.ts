import type * as React from 'react';
import { create } from 'zustand';
import { devtools } from 'zustand/middleware';
import type { Ionicons } from '@expo/vector-icons';
import { supabase } from '@lib/supabase';
import { captureError } from '@lib/errorTracking';
import { useAuthStore } from '@stores/authStore';

type IoniconName = React.ComponentProps<typeof Ionicons>['name'];

// ── Category metadata ──────────────────────────────────────────────────────────
export const CATEGORY_META: Record<string, { icon: IoniconName; color: string }> = {
  rent: { icon: 'home', color: '#8B5CF6' },
  electricity: { icon: 'flash', color: '#F59E0B' },
  water: { icon: 'water', color: '#3B6FBF' },
  internet: { icon: 'wifi', color: '#06B6D4' },
  gas: { icon: 'flame', color: '#EF4444' },
  tax: { icon: 'business', color: '#6366F1' },
  taxes: { icon: 'business', color: '#6366F1' },
  insurance: { icon: 'shield-checkmark', color: '#7C3AED' },
  arnona: { icon: 'business', color: '#6366F1' },
  groceries: { icon: 'cart', color: '#4FB071' },
  shopping: { icon: 'bag-handle', color: '#10B981' },
  'outside food': { icon: 'fast-food', color: '#E0B24D' },
  food: { icon: 'fast-food', color: '#E0B24D' },
  transport: { icon: 'car', color: '#64748B' },
  entertainment: { icon: 'film', color: '#EC4899' },
  health: { icon: 'medkit', color: '#10B981' },
  other: { icon: 'cube', color: '#8D8F8F' },
};

function categoryMeta(name: string): { icon: IoniconName; color: string } {
  return CATEGORY_META[name.toLowerCase()] ?? { icon: 'cube', color: '#8D8F8F' };
}

// ── House-bill classification ────────────────────────────────────────────────────
// Keyword-based matching so names like "Electricity Bill" or "Wifi" still land in
// House Bills. Hebrew terms are included so ארנונה, חשמל, מים … don't fall through
// to Lifestyle. Recurring household bills are always treated as house bills too —
// see `isHouse` below — regardless of what they're named.
const HOUSE_BILL_KEYWORDS = [
  // English
  'rent',
  'electric',
  'water',
  'internet',
  'wifi',
  'gas',
  'tax',
  'arnona',
  'insurance',
  'maintenance',
  'rates',
  'mortgage',
  'strata',
  'municipal',
  'building',
  'utilities',
  'utility',
  'phone',
  'broadband',
  'council',
  'body corporate',
  // Hebrew
  'ארנונה', // arnona (municipal tax)
  'חשמל', // electricity
  'מים', // water
  'גז', // gas
  'אינטרנט', // internet
  'שכירות', // rent
  'שכ"ד', // rent (abbrev.)
  'ועד בית', // building committee / HOA
  'ביטוח', // insurance
  'דמי ניהול', // management fees
  'מיסים', // taxes
];

// Short generic keywords that risk matching as substrings of unrelated words (e.g. "tax" → "taxi",
// "rent" → "parenting", "gas" → "vegas").
const BOUNDARY_PATTERNS: Readonly<Record<string, RegExp>> = {
  tax: /\btax\b/,
  arnona: /\barnona\b/,
  rent: /\brent\b/,
  gas: /\bgas\b/,
};

export function isHouseCategoryName(name: string): boolean {
  const n = name.toLowerCase();
  return HOUSE_BILL_KEYWORDS.some((kw): boolean => {
    const pattern = BOUNDARY_PATTERNS[kw];
    return pattern ? pattern.test(n) : n.includes(kw);
  });
}

// ── Types ──────────────────────────────────────────────────────────────────────
export interface CategorySpend {
  name: string;
  icon: IoniconName;
  color: string;
  amount: number;
  isHouse: boolean; // true → belongs in the House Bills section, not Lifestyle
}

export interface DrillDownItem {
  id: string;
  title: string;
  amount: number;
  date: string;
  type: 'bill' | 'recurring';
}

export interface MonthSpend {
  month: string; // "2026-03"
  label: string; // "Mar 2026"
  total: number; // logged-in user's share
  houseTotal: number; // full house spending
  categories: CategorySpend[]; // user's share per category
  houseCategories: CategorySpend[]; // house total per category
  billsByCategory: Record<string, DrillDownItem[]>; // raw items per category for drill-down
}

interface SpendingStore {
  months: MonthSpend[];
  isLoading: boolean;
  error: string | null;
  clearError: () => void;
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
  return new Date(Number(y), Number(m) - 1, 1).toLocaleDateString('en-GB', {
    month: 'short',
    year: 'numeric',
  });
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
function paymentMonthShares(
  paidAt: string,
  frequency: Frequency
): Array<{ monthKey: string; share: number }> {
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
  amount: number
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

  const payload = await context
    .clone()
    .json()
    .catch(() => null);
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
  return 'AI analysis is not available right now. Try again.';
}

// ── Store ──────────────────────────────────────────────────────────────────────
export const useSpendingStore = create<SpendingStore>()(
  devtools(
    (set) => ({
      months: [],
      isLoading: false,
      error: null,
      clearError: (): void => set({ error: null }),
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

          const [billsRes, paymentsRes, membersRes] = await Promise.all([
            supabase
              .from('bills')
              .select('id, title, amount, paid_by, split_between, date, category')
              .eq('house_id', houseId)
              .gte('date', sixMonthsAgo),
            supabase
              .from('household_payments')
              .select(
                'id, amount, paid_at, split_between, recurring_bills(name, assigned_to, frequency)'
              )
              .eq('house_id', houseId)
              .gte('paid_at', sixMonthsAgo),
            supabase.from('house_members').select('user_id').eq('house_id', houseId),
          ]);
          if (billsRes.error) throw billsRes.error;
          if (paymentsRes.error) throw paymentsRes.error;
          if (membersRes.error) throw membersRes.error;

          // Everyone currently in the house — the default split for a recurring
          // payment that doesn't name specific people (empty split_between).
          const memberIds: string[] = (membersRes.data ?? [])
            .map((m): string => m.user_id as string)
            .filter(Boolean);

          const tally = new Map<string, Map<string, number>>();
          const houseTally = new Map<string, Map<string, number>>();
          const detailTally = new Map<string, Map<string, DrillDownItem[]>>();
          // Category names sourced from recurring household bills — always house bills.
          const recurringCategories = new Set<string>();

          const addDetail = (mk: string, cat: string, item: DrillDownItem): void => {
            if (!detailTally.has(mk)) detailTally.set(mk, new Map());
            const m = detailTally.get(mk)!;
            if (!m.has(cat)) m.set(cat, []);
            m.get(cat)!.push(item);
          };

          // ── One-off bills ──────────────────────────────────────────────────
          for (const b of billsRes.data ?? []) {
            const splits: string[] = Array.isArray(b.split_between) ? b.split_between : [];
            const mk = toMonthKey(b.date);
            const cat = (b.category as string | null)?.toLowerCase() ?? 'other';
            const amt = Number(b.amount);

            addToTally(houseTally, mk, cat, amt);
            addDetail(mk, cat, {
              id: b.id,
              title: (b.title as string) || cat,
              amount: amt,
              date: b.date,
              type: 'bill',
            });
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

            const freq: Frequency =
              rb.frequency in FREQ_MONTHS ? (rb.frequency as Frequency) : 'monthly';
            const cat = rb.name.toLowerCase();
            recurringCategories.add(cat);
            const n = FREQ_MONTHS[freq];
            const shares = paymentMonthShares(p.paid_at, freq);

            // Who shares this payment's cost — mirrors calculateFairness in the
            // recurring-bills store. An explicit split wins; an empty split means
            // "everyone in the house"; with no members known, the payer alone.
            const paymentSplit: string[] =
              Array.isArray(p.split_between) && p.split_between.length > 0
                ? (p.split_between as string[])
                : memberIds.length > 0
                  ? memberIds
                  : [rb.assigned_to];
            const isUserSharing = !!currentUserId && paymentSplit.includes(currentUserId);
            const userFraction = isUserSharing ? 1 / paymentSplit.length : 0;

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
              // The user's own share of the monthly slice — the bill divided by
              // the number of people splitting it, not the whole house amount.
              if (userFraction > 0) {
                addToTally(tally, monthKey, cat, sliceAmt * userFraction);
              }
            }
          }

          // ── Build MonthSpend[] ─────────────────────────────────────────────
          const classifyHouse = (name: string): boolean =>
            recurringCategories.has(name) || isHouseCategoryName(name);

          const months: MonthSpend[] = lastNMonths(6).map((mk): MonthSpend => {
            const catMap = tally.get(mk) ?? new Map();
            const categories: CategorySpend[] = Array.from(catMap.entries())
              .map(
                ([name, amount]): CategorySpend => ({
                  name,
                  amount,
                  isHouse: classifyHouse(name),
                  ...categoryMeta(name),
                })
              )
              .sort((a, b): number => b.amount - a.amount);
            const total = categories.reduce((s, c) => s + c.amount, 0);

            const houseCatMap = houseTally.get(mk) ?? new Map();
            const houseCategories: CategorySpend[] = Array.from(houseCatMap.entries())
              .map(
                ([name, amount]): CategorySpend => ({
                  name,
                  amount,
                  isHouse: classifyHouse(name),
                  ...categoryMeta(name),
                })
              )
              .sort((a, b): number => b.amount - a.amount);
            const houseTotal = houseCategories.reduce((s, c) => s + c.amount, 0);

            const billsByCategory: Record<string, DrillDownItem[]> = {};
            const detailMap = detailTally.get(mk);
            if (detailMap) {
              for (const [catName, items] of detailMap.entries()) {
                billsByCategory[catName] = [...items].sort((a, b) => b.amount - a.amount);
              }
            }

            return {
              month: mk,
              label: toMonthLabel(mk),
              total,
              categories,
              houseTotal,
              houseCategories,
              billsByCategory,
            };
          });

          set({ months, isLoading: false });
        } catch (err) {
          captureError(err, { store: 'spending', houseId, userId: currentUserId });
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
        )
          return;

        set({ insightLoading: true, insightError: null, insight: null });
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
            insight: null,
            insightLoading: false,
            insightError: toFriendlyInsightError(serverMessage ?? localMessage),
          });
        }
      },
    }),
    { name: 'spending-store' }
  )
);
