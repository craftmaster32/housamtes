-- Personal grocery reminders.
-- Lets a house member schedule a push notification for themselves at a
-- chosen date/time — either about a saved list or a free-form note
-- (e.g. "grab milk and eggs on the way home"). A scheduled Edge Function
-- (grocery-reminder-check) scans for due reminders and sends the push.

CREATE TABLE IF NOT EXISTS grocery_reminders (
  id         uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  house_id   uuid NOT NULL REFERENCES houses(id) ON DELETE CASCADE,
  user_id    uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  list_id    uuid REFERENCES grocery_lists(id) ON DELETE CASCADE,
  label      text NOT NULL,
  remind_at  timestamptz NOT NULL,
  sent       boolean NOT NULL DEFAULT false,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- ── Indexes ───────────────────────────────────────────────────────────────────

CREATE INDEX IF NOT EXISTS idx_grocery_reminders_house_id ON grocery_reminders(house_id);
CREATE INDEX IF NOT EXISTS idx_grocery_reminders_user_id ON grocery_reminders(user_id);

-- Speeds up the cron scan: WHERE sent = false AND remind_at <= now()
CREATE INDEX IF NOT EXISTS idx_grocery_reminders_due ON grocery_reminders(sent, remind_at);

-- ── RLS ───────────────────────────────────────────────────────────────────────

ALTER TABLE grocery_reminders ENABLE ROW LEVEL SECURITY;

-- A reminder is personal — only its owner can see or manage it.
CREATE POLICY "users can read own grocery reminders" ON grocery_reminders FOR SELECT
  USING (
    user_id = auth.uid()
    AND house_id IN (SELECT house_id FROM house_members WHERE user_id = auth.uid())
  );

CREATE POLICY "users can create own grocery reminders" ON grocery_reminders FOR INSERT
  WITH CHECK (
    user_id = auth.uid()
    AND house_id IN (SELECT house_id FROM house_members WHERE user_id = auth.uid())
  );

CREATE POLICY "users can update own grocery reminders" ON grocery_reminders FOR UPDATE
  USING (user_id = auth.uid());

CREATE POLICY "users can delete own grocery reminders" ON grocery_reminders FOR DELETE
  USING (user_id = auth.uid());
