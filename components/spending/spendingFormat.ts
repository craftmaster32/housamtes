import type { CategorySpend, DrillDownItem } from '@stores/spendingStore';

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
