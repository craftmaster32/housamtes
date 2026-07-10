import { supabase } from '@lib/supabase';
import { captureError } from '@lib/errorTracking';

const SUPABASE_URL = process.env.EXPO_PUBLIC_SUPABASE_URL!;
const FUNCTION_URL = `${SUPABASE_URL}/functions/v1/send-push`;

type NotificationType =
  | 'bill_added'
  | 'bill_settled'
  | 'bill_deleted'
  | 'bill_edited'
  | 'bill_due'
  | 'parking_claimed'
  | 'parking_reservation'
  | 'chore_overdue'
  | 'chat_message'
  | 'grocery_shared';

interface NotifyParams {
  houseId: string;
  excludeUserId: string;
  /** When provided, only these user IDs receive the notification (overrides excludeUserId). */
  includeUserIds?: string[];
  title: string;
  body: string;
  data?: Record<string, string>;
  notificationType: NotificationType;
}

/**
 * Send a push notification to all house members except the person
 * who triggered the event. The edge function filters recipients based
 * on each user's notification preferences.
 * Non-fatal — silently catches all errors so a notification failure
 * never breaks the main action.
 */
export async function notifyHousemates({
  houseId,
  excludeUserId,
  includeUserIds,
  title,
  body,
  data,
  notificationType,
}: NotifyParams): Promise<void> {
  try {
    const { data: sessionData } = await supabase.auth.getSession();
    const token = sessionData.session?.access_token;
    if (!token) return;

    const res = await fetch(FUNCTION_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({
        house_id: houseId,
        exclude_user_id: excludeUserId,
        ...(includeUserIds ? { include_user_ids: includeUserIds } : {}),
        title,
        body,
        data,
        notification_type: notificationType,
      }),
    });
    if (!res.ok) {
      throw new Error(`send-push returned ${res.status}`);
    }
  } catch (err) {
    captureError(err, { context: 'notifyHousemates', houseId, excludeUserId });
  }
}
