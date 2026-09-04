-- Shared appliances (washing machine, dryer, dishwasher).
-- Like the parking spot, but for the house's machines: a member "starts" a
-- machine with a duration (or a saved preset), everyone can see it's in use and
-- how long is left, and when the cycle finishes the house is notified it's free.
--
-- Two tables:
--   appliance_sessions — one active run per machine per house (who, when, ends)
--   appliance_presets  — saved durations the house reuses (e.g. "Eco 2h30")
--
-- The appliance-check Edge Function scans active sessions whose end time has
-- passed and pushes "the machine is free" to the house.

-- ── appliance_sessions ────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS appliance_sessions (
  id            uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  house_id      uuid NOT NULL REFERENCES houses(id) ON DELETE CASCADE,
  appliance     text NOT NULL CHECK (appliance IN ('washer', 'dryer', 'dishwasher')),
  started_by    uuid NOT NULL,
  label         text NOT NULL DEFAULT '',
  started_at    timestamptz NOT NULL DEFAULT now(),
  ends_at       timestamptz NOT NULL,
  is_active     boolean NOT NULL DEFAULT true,
  done_notified boolean NOT NULL DEFAULT false,
  created_at    timestamptz DEFAULT now(),
  updated_at    timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_appliance_sessions_house_id ON appliance_sessions(house_id);
-- Speeds up the cron scan: WHERE is_active AND done_notified = false AND ends_at <= now()
CREATE INDEX IF NOT EXISTS idx_appliance_sessions_due
  ON appliance_sessions(is_active, done_notified, ends_at);
-- At most one active run per machine per house — a second "start" is blocked by
-- the unique index until the first is stopped or finishes.
CREATE UNIQUE INDEX IF NOT EXISTS idx_appliance_sessions_one_active
  ON appliance_sessions(house_id, appliance)
  WHERE is_active;

-- ── appliance_presets ─────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS appliance_presets (
  id               uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  house_id         uuid NOT NULL REFERENCES houses(id) ON DELETE CASCADE,
  appliance        text NOT NULL CHECK (appliance IN ('washer', 'dryer', 'dishwasher')),
  name             text NOT NULL,
  duration_minutes integer NOT NULL CHECK (duration_minutes > 0 AND duration_minutes <= 1440),
  created_by       uuid NOT NULL,
  created_at       timestamptz DEFAULT now(),
  updated_at       timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_appliance_presets_house_id ON appliance_presets(house_id);

-- ── Notification preference ───────────────────────────────────────────────────
ALTER TABLE notification_preferences
  ADD COLUMN IF NOT EXISTS notify_appliance_done boolean NOT NULL DEFAULT true;

-- ── RLS: appliance_sessions ───────────────────────────────────────────────────
ALTER TABLE appliance_sessions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "house members can read appliance sessions" ON appliance_sessions FOR SELECT
  USING (house_id IN (SELECT house_id FROM house_members WHERE user_id = auth.uid()));

CREATE POLICY "house members can insert appliance sessions" ON appliance_sessions FOR INSERT
  WITH CHECK (
    started_by = auth.uid()
    AND house_id IN (SELECT house_id FROM house_members WHERE user_id = auth.uid())
  );

CREATE POLICY "house members can update appliance sessions" ON appliance_sessions FOR UPDATE
  USING (house_id IN (SELECT house_id FROM house_members WHERE user_id = auth.uid()))
  WITH CHECK (house_id IN (SELECT house_id FROM house_members WHERE user_id = auth.uid()));

CREATE POLICY "house members can delete appliance sessions" ON appliance_sessions FOR DELETE
  USING (house_id IN (SELECT house_id FROM house_members WHERE user_id = auth.uid()));

-- ── RLS: appliance_presets ────────────────────────────────────────────────────
ALTER TABLE appliance_presets ENABLE ROW LEVEL SECURITY;

CREATE POLICY "house members can read appliance presets" ON appliance_presets FOR SELECT
  USING (house_id IN (SELECT house_id FROM house_members WHERE user_id = auth.uid()));

CREATE POLICY "house members can insert appliance presets" ON appliance_presets FOR INSERT
  WITH CHECK (
    created_by = auth.uid()
    AND house_id IN (SELECT house_id FROM house_members WHERE user_id = auth.uid())
  );

CREATE POLICY "house members can delete appliance presets" ON appliance_presets FOR DELETE
  USING (house_id IN (SELECT house_id FROM house_members WHERE user_id = auth.uid()));

-- ── Realtime ──────────────────────────────────────────────────────────────────
ALTER PUBLICATION supabase_realtime ADD TABLE appliance_sessions;
ALTER PUBLICATION supabase_realtime ADD TABLE appliance_presets;
