import type { CategorySpend, DrillDownItem, MonthSpend } from '@stores/spendingStore';

export type SpendingView = 'house' | 'personal';

export interface CategoryRowItem {
  cat: CategorySpend;
  myAmount: number;
  prevHouseAmount: number;
  sectionTotal: number;
  drillDownItems: DrillDownItem[];
}

export function fmtFull(n: number, sym: string): string {
  return `${sym}${n.toFixed(2)}`;
}

export function fmtShort(n: number, sym: string): string {
  if (n >= 1000) return `${sym}${(n / 1000).toFixed(1)}k`;
  return `${sym}${n.toFixed(0)}`;
}

export function pctChange(current: number, previous: number): number | null {
  if (previous === 0) return null;
  return Math.round(((current - previous) / previous) * 100);
}

/** Whole amounts with thousands commas, for the list and the chart: "₪8,032". */
export function fmtWhole(n: number, sym: string): string {
  return `${sym}${Math.round(n).toLocaleString('en-US')}`;
}

/**
 * The chosen month's categories for the "Where it went" list, biggest first.
 * House view lists the house's spending (with your share of each); Personal
 * lists only yours. `sectionTotal` is the whole month, for the colour strip.
 */
export function categoryRows(
  current: MonthSpend | undefined,
  previous: MonthSpend | undefined,
  view: SpendingView
): CategoryRowItem[] {
  if (!current) return [];
  const house = view === 'house';
  const cats = (house ? current.houseCategories : current.categories).filter((c) => c.amount > 0);
  const prevCats = house ? previous?.houseCategories : previous?.categories;
  const total = cats.reduce((s, c) => s + c.amount, 0);
  return cats
    .map(
      (cat): CategoryRowItem => ({
        cat,
        myAmount: house ? (current.categories.find((c) => c.name === cat.name)?.amount ?? 0) : 0,
        prevHouseAmount: prevCats?.find((c) => c.name === cat.name)?.amount ?? 0,
        sectionTotal: total,
        drillDownItems: current.billsByCategory[cat.name] ?? [],
      })
    )
    .sort((a, b) => b.cat.amount - a.cat.amount);
}
