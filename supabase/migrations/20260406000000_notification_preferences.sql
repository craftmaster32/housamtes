-- Notification preferences — one row per user per house
-- Controls which push notifications each user receives

CREATE TABLE IF NOT EXISTS notification_preferences (
  id                        uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id                   uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  house_id                  uuid NOT NULL REFERENCES houses(id) ON DELETE CASCADE,

  -- Bills
  notify_bill_added         boolean NOT NULL DEFAULT true,
  notify_bill_settled       boolean NOT NULL DEFAULT true,
  notify_bill_due           boolean NOT NULL DEFAULT true,
  bill_due_days_before      integer NOT NULL DEFAULT 2,   -- 1 | 2 | 3 | 7

  -- Parking
  notify_parking_claimed    boolean NOT NULL DEFAULT true,
  notify_parking_reservation boolean NOT NULL DEFAULT true,

  -- Chores
  notify_chore_overdue      boolean NOT NULL DEFAULT true,

  -- Chat
  notify_chat_message       boolean NOT NULL DEFAULT true,

  created_at                timestamptz DEFAULT now(),
  updated_at                timestamptz DEFAULT now(),

  UNIQUE(user_id, house_id)
);

CREATE INDEX IF NOT EXISTS idx_notif_prefs_user_id  ON notification_preferences(user_id);
CREATE INDEX IF NOT EXISTS idx_notif_prefs_house_id ON notification_preferences(house_id);

ALTER TABLE notification_preferences ENABLE ROW LEVEL SECURITY;

CREATE POLICY "users can read own notification prefs"
  ON notification_preferences FOR SELECT
  USING (user_id = auth.uid());

CREATE POLICY "users can insert own notification prefs"
  ON notification_preferences FOR INSERT
  WITH CHECK (user_id = auth.uid());

CREATE POLICY "users can update own notification prefs"
  ON notification_preferences FOR UPDATE
  USING (user_id = auth.uid());

CREATE POLICY "users can delete own notification prefs"
  ON notification_preferences FOR DELETE
  USING (user_id = auth.uid());

CREATE TRIGGER trg_notif_prefs_updated_at
  BEFORE UPDATE ON notification_preferences
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();
