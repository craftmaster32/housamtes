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

function shortMonth(monthKey: string, locale: string, withYear: boolean): string {
  const [y, m] = monthKey.split('-');
  return new Date(Number(y), Number(m) - 1, 1).toLocaleDateString(locale, {
    month: 'short',
    ...(withYear ? { year: 'numeric' } : {}),
  });
}

/** The months a payment covers: "Oct 2026", "Sep – Oct 2026", "Dec 2025 – Jan 2026". */
export function coverLabel(from: string, to: string, locale: string): string {
  if (from === to) return shortMonth(to, locale, true);
  const sameYear = from.slice(0, 4) === to.slice(0, 4);
  return `${shortMonth(from, locale, !sameYear)} – ${shortMonth(to, locale, true)}`;
}

/** The span a category's recurring payments cover in this month, or null. */
export function rowCover(item: CategoryRowItem): { from: string; to: string } | null {
  const spans = item.drillDownItems.filter(
    (d) => d.type === 'recurring' && d.coverFrom && d.coverTo
  );
  if (spans.length === 0) return null;
  const from = spans.map((d) => d.coverFrom as string).sort()[0];
  const to = spans
    .map((d) => d.coverTo as string)
    .sort()
    .slice(-1)[0];
  return { from, to };
}

/** A line of "Where it went": a group heading, or one category. */
export type SpendLine =
  | { kind: 'group'; group: 'house' | 'lifestyle'; total: number }
  | { kind: 'row'; item: CategoryRowItem };

/**
 * Splits the month into its regular house bills (first, all shown) and the
 * rest (biggest `top` shown until "N more" is opened).
 */
export function spendLines(
  rows: CategoryRowItem[],
  showAll: boolean,
  top: number
): { lines: SpendLine[]; hiddenCount: number } {
  const house = rows.filter((r) => r.cat.isHouse);
  const other = rows.filter((r) => !r.cat.isHouse);
  const shownOther = showAll ? other : other.slice(0, top);
  const sum = (list: CategoryRowItem[]): number => list.reduce((s, r) => s + r.cat.amount, 0);
  const lines: SpendLine[] = [];
  if (house.length > 0) {
    lines.push({ kind: 'group', group: 'house', total: sum(house) });
    house.forEach((item) => lines.push({ kind: 'row', item }));
  }
  if (other.length > 0) {
    lines.push({ kind: 'group', group: 'lifestyle', total: sum(other) });
    shownOther.forEach((item) => lines.push({ kind: 'row', item }));
  }
  return { lines, hiddenCount: Math.max(0, other.length - top) };
}
