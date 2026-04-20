import { supabase } from '@lib/supabase';
import { captureError } from '@lib/errorTracking';

const SUPABASE_URL = process.env.EXPO_PUBLIC_SUPABASE_URL!;
const FUNCTION_URL = `${SUPABASE_URL}/functions/v1/send-push`;

export type NotificationType =
  | 'bill_added'
  | 'bill_settled'
  | 'bill_due'
  | 'parking_claimed'
  | 'parking_reservation'
  | 'chore_overdue'
  | 'chat_message';

interface NotifyParams {
  houseId: string;
  excludeUserId: string;
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
    captureError(err, { context: 'notifyHousemates' });
  }
}
