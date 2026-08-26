import { useState, useMemo, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { useBillsStore, CATEGORIES, type Bill } from '@stores/billsStore';
import { useRecurringBillsStore } from '@stores/recurringBillsStore';
import { useHousematesStore } from '@stores/housematesStore';

export interface RecurringPaymentRow {
  id: string;
  title: string;
  icon: string;
  amount: number;
  paidBy: string;
  splitBetween: string[];
}

export type BillRow =
  | { kind: 'bill'; key: string; date: string; bill: Bill }
  | { kind: 'payment'; key: string; date: string; payment: RecurringPaymentRow };

export interface BillSection {
  // Stable unique key (the raw YYYY-MM-DD date, or 'Unknown'). `title` is a
  // localized label that can repeat across years, so it must not be used as a key.
  key: string;
  title: string;
  data: BillRow[];
}

/**
 * Human-friendly label for a `YYYY-MM-DD` date: "Today" / "Yesterday" for the
 * two most recent days, otherwise a short localized weekday-month-day string.
 */
function formatDateLabel(dateStr: string, locale: string, t: (key: string) => string): string {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(dateStr)) return t('common.unknown');
  const appLocale = locale === 'he' ? 'he-IL' : locale === 'es' ? 'es-ES' : 'en-GB';
  const today = new Date();
  const pad = (n: number): string => String(n).padStart(2, '0');
  const todayStr = `${today.getFullYear()}-${pad(today.getMonth() + 1)}-${pad(today.getDate())}`;
  const yest = new Date(today);
  yest.setDate(yest.getDate() - 1);
  const yestStr = `${yest.getFullYear()}-${pad(yest.getMonth() + 1)}-${pad(yest.getDate())}`;
  if (dateStr === todayStr) return t('common.today');
  if (dateStr === yestStr) return t('common.yesterday');
  return new Date(`${dateStr}T12:00:00`).toLocaleDateString(appLocale, {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
  });
}

interface UseOneOffBillHistoryResult {
  category: string;
  setCategory: (cat: string) => void;
  presentCategories: string[];
  billSections: BillSection[];
}

/**
 * Builds the one-off expense history for the Bills screen: merges bills and
 * logged recurring payments, derives the categories currently in use, applies
 * the search text and selected-category filters, and groups the result into
 * date-labeled sections. Owns the selected-category state and resets it to
 * "all" when the active category no longer has any expenses.
 */
export function useOneOffBillHistory(search: string): UseOneOffBillHistoryResult {
  const { t, i18n } = useTranslation();
  const bills = useBillsStore((s) => s.bills);
  const householdBills = useRecurringBillsStore((s) => s.bills);
  const payments = useRecurringBillsStore((s) => s.payments);
  const housemates = useHousematesStore((s) => s.housemates);
  const memberIds = useMemo((): string[] => housemates.map((h) => h.id), [housemates]);

  const [category, setCategory] = useState('all');

  // Only surface category chips for categories that actually appear in the
  // current one-off bills, kept in the canonical CATEGORIES order.
  const presentCategories = useMemo((): string[] => {
    const seen = new Set(
      bills.map((b): string => (b.category ?? '').toLowerCase()).filter(Boolean)
    );
    return CATEGORIES.filter((cat): boolean => seen.has(cat.toLowerCase())).map((cat): string =>
      cat.toLowerCase()
    );
  }, [bills]);

  // If the selected category disappears (last bill of that kind deleted/settled
  // away), fall back to "All" so the list can't get stuck showing nothing.
  useEffect((): void => {
    if (category !== 'all' && !presentCategories.includes(category)) setCategory('all');
  }, [presentCategories, category]);

  const billSections = useMemo((): BillSection[] => {
    // Merge one-off bills and logged recurring payments into one date-grouped history.
    const billMeta = new Map(
      householdBills.map((b): [string, { name: string; icon: string; assignedTo: string }] => [
        b.id,
        { name: b.name, icon: b.icon, assignedTo: b.assignedTo },
      ])
    );
    const rows: BillRow[] = [
      ...bills.map(
        (bill): Extract<BillRow, { kind: 'bill' }> => ({
          kind: 'bill' as const,
          key: bill.id,
          date: bill.date,
          bill,
        })
      ),
      ...payments.map((p): Extract<BillRow, { kind: 'payment' }> => {
        const meta = billMeta.get(p.billId);
        return {
          kind: 'payment' as const,
          key: `recurring:${p.id}`,
          date: p.paidAt,
          payment: {
            id: p.id,
            title: meta?.name ?? '',
            icon: meta?.icon ?? 'receipt-outline',
            amount: p.amount,
            paidBy: meta?.assignedTo ?? '',
            splitBetween: p.splitBetween && p.splitBetween.length > 0 ? p.splitBetween : memberIds,
          },
        };
      }),
    ].sort((a, b): number => (b.date ?? '').localeCompare(a.date ?? ''));

    const q = search.trim().toLowerCase();
    const filtered = rows.filter((row): boolean => {
      // Category chips filter the categorised one-off bills; logged recurring
      // payments have no category, so a specific chip hides them.
      if (category !== 'all') {
        if (row.kind !== 'bill') return false;
        if ((row.bill.category ?? '').toLowerCase() !== category) return false;
      }
      if (q) {
        const title = row.kind === 'bill' ? row.bill.title : row.payment.title;
        if (!title.toLowerCase().includes(q)) return false;
      }
      return true;
    });

    const groups: Record<string, BillRow[]> = {};
    for (const row of filtered) {
      const key = row.date || 'Unknown';
      if (!groups[key]) groups[key] = [];
      groups[key].push(row);
    }
    return Object.entries(groups).map(
      ([date, data]): BillSection => ({
        key: date,
        title: formatDateLabel(date, i18n.language, t),
        data,
      })
    );
  }, [bills, payments, householdBills, memberIds, i18n.language, t, search, category]);

  return { category, setCategory, presentCategories, billSections };
}
