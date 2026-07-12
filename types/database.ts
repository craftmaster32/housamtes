// TypeScript types for every Supabase database table
// These are updated as new tables are added in each phase

export interface ExpenseCategoryRow {
  id: string;
  name: string;
  icon: string;
  color: string;
  is_default: boolean;
  sort_order: number;
}
