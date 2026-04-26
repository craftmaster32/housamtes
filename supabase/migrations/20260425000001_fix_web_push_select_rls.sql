-- Add missing SELECT policy to web_push_subscriptions.
-- Without this, no explicit rule exists for reads (gap in defence-in-depth).
CREATE POLICY "users can read own web push subscriptions"
  ON web_push_subscriptions FOR SELECT
  USING (user_id = auth.uid());
