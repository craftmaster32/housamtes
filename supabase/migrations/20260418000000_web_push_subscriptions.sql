-- Web push subscriptions for browser-based notifications (Vercel web app)
CREATE TABLE IF NOT EXISTS web_push_subscriptions (
  id          uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id     uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  house_id    uuid NOT NULL REFERENCES houses(id) ON DELETE CASCADE,
  endpoint    text NOT NULL,
  p256dh      text NOT NULL,
  auth        text NOT NULL,
  created_at  timestamptz DEFAULT now(),
  updated_at  timestamptz DEFAULT now(),
  UNIQUE(user_id, house_id)
);

CREATE INDEX IF NOT EXISTS idx_web_push_house_id ON web_push_subscriptions(house_id);
CREATE INDEX IF NOT EXISTS idx_web_push_user_id  ON web_push_subscriptions(user_id);

ALTER TABLE web_push_subscriptions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "users can insert own web push subscription"
  ON web_push_subscriptions FOR INSERT
  WITH CHECK (user_id = auth.uid());

CREATE POLICY "users can update own web push subscription"
  ON web_push_subscriptions FOR UPDATE
  USING (user_id = auth.uid());

CREATE POLICY "users can delete own web push subscription"
  ON web_push_subscriptions FOR DELETE
  USING (user_id = auth.uid());
