// TypeScript types for every Supabase database table
// These are updated as new tables are added in each phase

export interface HouseTaskRow {
  id: string;
  house_id: string;
  title: string;
  description: string | null;
  priority: string | null;
  assigned_to: string | null;
  due_date: string | null;
  is_done: boolean | null;
  completed_at: string | null;
  completed_by: string | null;
  created_by: string;
  created_at: string;
  updated_at: string | null;
}

export interface ExpenseCategoryRow {
  id: string;
  name: string;
  icon: string;
  color: string;
  is_default: boolean;
  sort_order: number;
}
