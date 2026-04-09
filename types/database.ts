// TypeScript types for every Supabase database table
// These are updated as new tables are added in each phase

export interface UserProfile {
  id: string;
  full_name: string;
  avatar_color: string;
  push_token: string | null;
  notification_prefs: NotificationPrefs;
  created_at: string;
  updated_at: string;
}

export interface NotificationPrefs {
  new_bill: boolean;
  bill_due: boolean;
  bill_settled: boolean;
  parking_claimed: boolean;
  parking_released: boolean;
  parking_request: boolean;
  parking_approved: boolean;
  chore_due: boolean;
  task_assigned: boolean;
  new_message: boolean;
}

export interface House {
  id: string;
  name: string;
  address: string | null;
  invite_code: string;
  parking_advance_days: number;
  parking_approval_type: 'all_members' | 'any_one_member';
  created_by_user_id: string;
  created_at: string;
  updated_at: string;
}

export interface HouseMember {
  id: string;
  house_id: string;
  user_id: string;
  role: 'admin' | 'member';
  joined_at: string;
}

// Joined types (when querying with relations)
export interface HouseMemberWithProfile extends HouseMember {
  user_profiles: UserProfile;
}
