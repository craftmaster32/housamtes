-- user_consents: server-side proof of clickwrap agreement.
-- Records who agreed, to which version of the terms, and when.
-- This is the legal evidence that a clickwrap agreement was formed.
CREATE TABLE IF NOT EXISTS user_consents (
  id              uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id         uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  terms_version   text NOT NULL,          -- e.g. '2026-04-25'
  agreed_at       timestamptz NOT NULL DEFAULT now(),
  ip_hint         text,                   -- first 3 octets only, e.g. '192.168.1'
  platform        text,                   -- 'ios' | 'android' | 'web'
  created_at      timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_user_consents_user_id ON user_consents(user_id);

ALTER TABLE user_consents ENABLE ROW LEVEL SECURITY;

-- Users can read their own consent record (needed for data subject access requests)
CREATE POLICY "users can read own consents"
  ON user_consents FOR SELECT
  USING (user_id = auth.uid());

-- Users can insert their own consent (called immediately after signup)
CREATE POLICY "users can insert own consent"
  ON user_consents FOR INSERT
  WITH CHECK (user_id = auth.uid());

-- No UPDATE or DELETE from client — consent records are immutable.
-- Only service role can delete (on account deletion cascade).


-- deletion_requests: audit trail for GDPR right-to-erasure requests.
-- Inserted by the delete-account edge function before calling admin.deleteUser.
CREATE TABLE IF NOT EXISTS deletion_requests (
  id           uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id      uuid NOT NULL,   -- no FK — auth user will be deleted imminently
  requested_at timestamptz NOT NULL DEFAULT now(),
  completed_at timestamptz,
  status       text NOT NULL DEFAULT 'pending'  -- 'pending' | 'completed'
);

CREATE INDEX IF NOT EXISTS idx_deletion_requests_user_id ON deletion_requests(user_id);

ALTER TABLE deletion_requests ENABLE ROW LEVEL SECURITY;

-- No client access — service role only (edge function uses service role key)
