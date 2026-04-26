-- Rate-limit log for the send-push edge function.
-- The edge function (service role) inserts one row per call, then counts rows
-- in the last 60 s for that user. Rows older than 5 minutes are purged on each write.
CREATE TABLE IF NOT EXISTS push_rate_log (
  id         uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id    uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  house_id   uuid NOT NULL REFERENCES houses(id) ON DELETE CASCADE,
  created_at timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_push_rate_log_user_time ON push_rate_log(user_id, created_at);

ALTER TABLE push_rate_log ENABLE ROW LEVEL SECURITY;
-- No direct client access — only the edge function (service role) may write/read.
