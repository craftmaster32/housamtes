import { create } from 'zustand';
import { devtools } from 'zustand/middleware';
import { supabase } from '@lib/supabase';
import { captureError } from '@lib/errorTracking';
import { useAuthStore } from '@stores/authStore';

export type BillDueDays = 1 | 2 | 3 | 7;

export interface NotificationPrefs {
  notifyBillAdded: boolean;
  notifyBillSettled: boolean;
  notifyBillDue: boolean;
  billDueDaysBefore: BillDueDays;
  notifyParkingClaimed: boolean;
  notifyParkingReservation: boolean;
  notifyChoreOverdue: boolean;
  notifyChatMessage: boolean;
}

const DEFAULT_PREFS: NotificationPrefs = {
  notifyBillAdded: true,
  notifyBillSettled: true,
  notifyBillDue: true,
  billDueDaysBefore: 2,
  notifyParkingClaimed: true,
  notifyParkingReservation: true,
  notifyChoreOverdue: true,
  notifyChatMessage: true,
};

interface NotificationStore {
  prefs: NotificationPrefs;
  isLoading: boolean;
  error: string | null;
  load: (userId: string, houseId: string) => Promise<void>;
  update: (userId: string, houseId: string, changes: Partial<NotificationPrefs>) => Promise<void>;
  clearError: () => void;
}

function rowToPrefs(row: Record<string, unknown>): NotificationPrefs {
  return {
    notifyBillAdded:          (row.notify_bill_added          ?? true) as boolean,
    notifyBillSettled:        (row.notify_bill_settled        ?? true) as boolean,
    notifyBillDue:            (row.notify_bill_due            ?? true) as boolean,
    billDueDaysBefore:        (row.bill_due_days_before       ?? 2)    as BillDueDays,
    notifyParkingClaimed:     (row.notify_parking_claimed     ?? true) as boolean,
    notifyParkingReservation: (row.notify_parking_reservation ?? true) as boolean,
    notifyChoreOverdue:       (row.notify_chore_overdue       ?? true) as boolean,
    notifyChatMessage:        (row.notify_chat_message        ?? true) as boolean,
  };
}

function prefsToRow(prefs: Partial<NotificationPrefs>): Record<string, unknown> {
  const row: Record<string, unknown> = {};
  if (prefs.notifyBillAdded          !== undefined) row.notify_bill_added          = prefs.notifyBillAdded;
  if (prefs.notifyBillSettled        !== undefined) row.notify_bill_settled        = prefs.notifyBillSettled;
  if (prefs.notifyBillDue            !== undefined) row.notify_bill_due            = prefs.notifyBillDue;
  if (prefs.billDueDaysBefore        !== undefined) row.bill_due_days_before       = prefs.billDueDaysBefore;
  if (prefs.notifyParkingClaimed     !== undefined) row.notify_parking_claimed     = prefs.notifyParkingClaimed;
  if (prefs.notifyParkingReservation !== undefined) row.notify_parking_reservation = prefs.notifyParkingReservation;
  if (prefs.notifyChoreOverdue       !== undefined) row.notify_chore_overdue       = prefs.notifyChoreOverdue;
  if (prefs.notifyChatMessage        !== undefined) row.notify_chat_message        = prefs.notifyChatMessage;
  return row;
}

export const useNotificationStore = create<NotificationStore>()(
  devtools(
    (set, get) => ({
      prefs: { ...DEFAULT_PREFS },
      isLoading: false,
      error: null,

      load: async (userId, houseId): Promise<void> => {
        if (houseId !== useAuthStore.getState().houseId) {
          console.warn('[notifications] house ID mismatch — aborting load');
          return;
        }
        set({ isLoading: true, error: null });
        const { data, error } = await supabase
          .from('notification_preferences')
          .select('*')
          .eq('user_id', userId)
          .eq('house_id', houseId)
          .maybeSingle();
        if (error) {
          captureError(error, { store: 'notifications', userId, houseId });
          set({ isLoading: false, error: 'Could not load notification preferences. Please try again.' });
          return;
        }
        set({
          prefs: data ? rowToPrefs(data as Record<string, unknown>) : { ...DEFAULT_PREFS },
          isLoading: false,
        });
      },

      update: async (userId, houseId, changes): Promise<void> => {
        const previousPrefs = get().prefs;
        set((s) => ({ prefs: { ...s.prefs, ...changes } }));
        const { error } = await supabase
          .from('notification_preferences')
          .upsert(
            { user_id: userId, house_id: houseId, ...prefsToRow(changes) },
            { onConflict: 'user_id,house_id' }
          );
        if (error) {
          captureError(error, { store: 'notifications', userId, houseId });
          set({ prefs: previousPrefs, error: 'Could not save preferences. Please try again.' });
        }
      },

      clearError: (): void => set({ error: null }),
    }),
    { name: 'notification-store' }
  )
);
