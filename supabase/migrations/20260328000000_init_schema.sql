-- ============================================================
-- Nestiq — Initial Schema
-- ============================================================

-- ── STEP 1: CREATE ALL TABLES ───────────────────────────────

CREATE TABLE IF NOT EXISTS houses (
  id            uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  name          text NOT NULL,
  invite_code   text NOT NULL UNIQUE,
  created_by    uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  created_at    timestamptz DEFAULT now(),
  updated_at    timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_houses_invite_code ON houses(invite_code);

CREATE TABLE IF NOT EXISTS profiles (
  id            uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  name          text NOT NULL,
  avatar_color  text NOT NULL DEFAULT '#6366f1',
  created_at    timestamptz DEFAULT now(),
  updated_at    timestamptz DEFAULT now()
);

CREATE TABLE IF NOT EXISTS house_members (
  id         uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  house_id   uuid NOT NULL REFERENCES houses(id) ON DELETE CASCADE,
  user_id    uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  joined_at  timestamptz DEFAULT now(),
  UNIQUE(house_id, user_id)
);

CREATE INDEX IF NOT EXISTS idx_house_members_house_id ON house_members(house_id);
CREATE INDEX IF NOT EXISTS idx_house_members_user_id ON house_members(user_id);

CREATE TABLE IF NOT EXISTS bills (
  id              uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  house_id        uuid NOT NULL REFERENCES houses(id) ON DELETE CASCADE,
  title           text NOT NULL,
  amount          numeric(10,2) NOT NULL,
  paid_by         text NOT NULL,
  split_between   text[] NOT NULL DEFAULT '{}',
  date            date NOT NULL,
  category        text NOT NULL DEFAULT 'other',
  notes           text,
  created_at      timestamptz DEFAULT now(),
  updated_at      timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_bills_house_id ON bills(house_id);
CREATE INDEX IF NOT EXISTS idx_bills_date ON bills(date);

CREATE TABLE IF NOT EXISTS recurring_bills (
  id               uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  house_id         uuid NOT NULL REFERENCES houses(id) ON DELETE CASCADE,
  name             text NOT NULL,
  assigned_to      text NOT NULL,
  frequency        text NOT NULL DEFAULT 'monthly' CHECK (frequency IN ('monthly','bimonthly','quarterly')),
  typical_amount   numeric(10,2) NOT NULL DEFAULT 0,
  icon             text NOT NULL DEFAULT '🧾',
  created_at       timestamptz DEFAULT now(),
  updated_at       timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_recurring_bills_house_id ON recurring_bills(house_id);

CREATE TABLE IF NOT EXISTS household_payments (
  id           uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  house_id     uuid NOT NULL REFERENCES houses(id) ON DELETE CASCADE,
  bill_id      uuid NOT NULL REFERENCES recurring_bills(id) ON DELETE CASCADE,
  amount       numeric(10,2) NOT NULL,
  paid_at      date NOT NULL,
  note         text,
  created_at   timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_household_payments_house_id ON household_payments(house_id);
CREATE INDEX IF NOT EXISTS idx_household_payments_bill_id ON household_payments(bill_id);

CREATE TABLE IF NOT EXISTS parking_sessions (
  id           uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  house_id     uuid NOT NULL REFERENCES houses(id) ON DELETE CASCADE,
  occupant     text NOT NULL,
  start_time   timestamptz NOT NULL DEFAULT now(),
  is_active    boolean NOT NULL DEFAULT true,
  created_at   timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_parking_sessions_house_id ON parking_sessions(house_id);

CREATE TABLE IF NOT EXISTS parking_reservations (
  id             uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  house_id       uuid NOT NULL REFERENCES houses(id) ON DELETE CASCADE,
  requested_by   text NOT NULL,
  date           date NOT NULL,
  note           text,
  status         text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','approved')),
  created_at     timestamptz DEFAULT now(),
  updated_at     timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_parking_reservations_house_id ON parking_reservations(house_id);

CREATE TABLE IF NOT EXISTS grocery_items (
  id            uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  house_id      uuid NOT NULL REFERENCES houses(id) ON DELETE CASCADE,
  name          text NOT NULL,
  quantity      text,
  bought_count  integer NOT NULL DEFAULT 0,
  added_by      text NOT NULL,
  is_checked    boolean NOT NULL DEFAULT false,
  category      text,
  created_at    timestamptz DEFAULT now(),
  updated_at    timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_grocery_house_id ON grocery_items(house_id);

CREATE TABLE IF NOT EXISTS chores (
  id              uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  house_id        uuid NOT NULL REFERENCES houses(id) ON DELETE CASCADE,
  title           text NOT NULL,
  assigned_to     text,
  due_date        date,
  is_done         boolean NOT NULL DEFAULT false,
  recurrence      text,
  notes           text,
  created_at      timestamptz DEFAULT now(),
  updated_at      timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_chores_house_id ON chores(house_id);

CREATE TABLE IF NOT EXISTS events (
  id           uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  house_id     uuid NOT NULL REFERENCES houses(id) ON DELETE CASCADE,
  title        text NOT NULL,
  date         date NOT NULL,
  time         text,
  description  text,
  created_by   text NOT NULL,
  created_at   timestamptz DEFAULT now(),
  updated_at   timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_events_house_id ON events(house_id);
CREATE INDEX IF NOT EXISTS idx_events_date ON events(date);

CREATE TABLE IF NOT EXISTS announcements (
  id           uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  house_id     uuid NOT NULL REFERENCES houses(id) ON DELETE CASCADE,
  text         text NOT NULL,
  author       text NOT NULL,
  is_pinned    boolean NOT NULL DEFAULT false,
  created_at   timestamptz DEFAULT now(),
  updated_at   timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_announcements_house_id ON announcements(house_id);

CREATE TABLE IF NOT EXISTS chat_messages (
  id           uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  house_id     uuid NOT NULL REFERENCES houses(id) ON DELETE CASCADE,
  sender       text NOT NULL,
  text         text NOT NULL,
  created_at   timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_chat_house_id ON chat_messages(house_id);
CREATE INDEX IF NOT EXISTS idx_chat_created_at ON chat_messages(created_at);

CREATE TABLE IF NOT EXISTS maintenance_requests (
  id            uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  house_id      uuid NOT NULL REFERENCES houses(id) ON DELETE CASCADE,
  title         text NOT NULL,
  description   text,
  category      text NOT NULL DEFAULT 'other',
  status        text NOT NULL DEFAULT 'open' CHECK (status IN ('open','in_progress','resolved')),
  reported_by   text NOT NULL,
  resolved_at   timestamptz,
  created_at    timestamptz DEFAULT now(),
  updated_at    timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_maintenance_house_id ON maintenance_requests(house_id);

CREATE TABLE IF NOT EXISTS proposals (
  id           uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  house_id     uuid NOT NULL REFERENCES houses(id) ON DELETE CASCADE,
  title        text NOT NULL,
  description  text,
  created_by   text NOT NULL,
  is_open      boolean NOT NULL DEFAULT true,
  votes        jsonb NOT NULL DEFAULT '[]',
  created_at   timestamptz DEFAULT now(),
  updated_at   timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_proposals_house_id ON proposals(house_id);

CREATE TABLE IF NOT EXISTS condition_entries (
  id           uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  house_id     uuid NOT NULL REFERENCES houses(id) ON DELETE CASCADE,
  area         text NOT NULL,
  condition    text NOT NULL CHECK (condition IN ('good','fair','poor')),
  type         text NOT NULL CHECK (type IN ('move_in','update','damage')),
  description  text,
  recorded_by  text NOT NULL,
  date         date NOT NULL,
  photos       text[] NOT NULL DEFAULT '{}',
  created_at   timestamptz DEFAULT now(),
  updated_at   timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_condition_house_id ON condition_entries(house_id);

-- ── STEP 2: ENABLE RLS ON ALL TABLES ────────────────────────

ALTER TABLE houses ENABLE ROW LEVEL SECURITY;
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE house_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE bills ENABLE ROW LEVEL SECURITY;
ALTER TABLE recurring_bills ENABLE ROW LEVEL SECURITY;
ALTER TABLE household_payments ENABLE ROW LEVEL SECURITY;
ALTER TABLE parking_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE parking_reservations ENABLE ROW LEVEL SECURITY;
ALTER TABLE grocery_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE chores ENABLE ROW LEVEL SECURITY;
ALTER TABLE events ENABLE ROW LEVEL SECURITY;
ALTER TABLE announcements ENABLE ROW LEVEL SECURITY;
ALTER TABLE chat_messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE maintenance_requests ENABLE ROW LEVEL SECURITY;
ALTER TABLE proposals ENABLE ROW LEVEL SECURITY;
ALTER TABLE condition_entries ENABLE ROW LEVEL SECURITY;

-- ── STEP 3: RLS POLICIES ────────────────────────────────────

-- houses
CREATE POLICY "house members can read their house"
  ON houses FOR SELECT
  USING (id IN (SELECT house_id FROM house_members WHERE user_id = auth.uid()));

CREATE POLICY "creator can update house"
  ON houses FOR UPDATE
  USING (created_by = auth.uid());

-- profiles
CREATE POLICY "users can read all profiles in their house"
  ON profiles FOR SELECT
  USING (
    id IN (
      SELECT user_id FROM house_members
      WHERE house_id IN (SELECT house_id FROM house_members WHERE user_id = auth.uid())
    )
  );

CREATE POLICY "users can update own profile"
  ON profiles FOR UPDATE
  USING (id = auth.uid());

CREATE POLICY "users can insert own profile"
  ON profiles FOR INSERT
  WITH CHECK (id = auth.uid());

-- house_members
CREATE POLICY "house members can read membership"
  ON house_members FOR SELECT
  USING (house_id IN (SELECT house_id FROM house_members WHERE user_id = auth.uid()));

CREATE POLICY "users can join a house (insert own row)"
  ON house_members FOR INSERT
  WITH CHECK (user_id = auth.uid());

CREATE POLICY "users can leave a house (delete own row)"
  ON house_members FOR DELETE
  USING (user_id = auth.uid());

-- bills
CREATE POLICY "house members can read bills"
  ON bills FOR SELECT
  USING (house_id IN (SELECT house_id FROM house_members WHERE user_id = auth.uid()));

CREATE POLICY "house members can insert bills"
  ON bills FOR INSERT
  WITH CHECK (house_id IN (SELECT house_id FROM house_members WHERE user_id = auth.uid()));

CREATE POLICY "house members can update bills"
  ON bills FOR UPDATE
  USING (house_id IN (SELECT house_id FROM house_members WHERE user_id = auth.uid()));

CREATE POLICY "house members can delete bills"
  ON bills FOR DELETE
  USING (house_id IN (SELECT house_id FROM house_members WHERE user_id = auth.uid()));

-- recurring_bills
CREATE POLICY "house members can read recurring bills"
  ON recurring_bills FOR SELECT
  USING (house_id IN (SELECT house_id FROM house_members WHERE user_id = auth.uid()));

CREATE POLICY "house members can insert recurring bills"
  ON recurring_bills FOR INSERT
  WITH CHECK (house_id IN (SELECT house_id FROM house_members WHERE user_id = auth.uid()));

CREATE POLICY "house members can update recurring bills"
  ON recurring_bills FOR UPDATE
  USING (house_id IN (SELECT house_id FROM house_members WHERE user_id = auth.uid()));

CREATE POLICY "house members can delete recurring bills"
  ON recurring_bills FOR DELETE
  USING (house_id IN (SELECT house_id FROM house_members WHERE user_id = auth.uid()));

-- household_payments
CREATE POLICY "house members can read household payments"
  ON household_payments FOR SELECT
  USING (house_id IN (SELECT house_id FROM house_members WHERE user_id = auth.uid()));

CREATE POLICY "house members can insert household payments"
  ON household_payments FOR INSERT
  WITH CHECK (house_id IN (SELECT house_id FROM house_members WHERE user_id = auth.uid()));

CREATE POLICY "house members can delete household payments"
  ON household_payments FOR DELETE
  USING (house_id IN (SELECT house_id FROM house_members WHERE user_id = auth.uid()));

-- parking_sessions
CREATE POLICY "house members can read parking sessions"
  ON parking_sessions FOR SELECT
  USING (house_id IN (SELECT house_id FROM house_members WHERE user_id = auth.uid()));

CREATE POLICY "house members can insert parking sessions"
  ON parking_sessions FOR INSERT
  WITH CHECK (house_id IN (SELECT house_id FROM house_members WHERE user_id = auth.uid()));

CREATE POLICY "house members can update parking sessions"
  ON parking_sessions FOR UPDATE
  USING (house_id IN (SELECT house_id FROM house_members WHERE user_id = auth.uid()));

CREATE POLICY "house members can delete parking sessions"
  ON parking_sessions FOR DELETE
  USING (house_id IN (SELECT house_id FROM house_members WHERE user_id = auth.uid()));

-- parking_reservations
CREATE POLICY "house members can read parking reservations"
  ON parking_reservations FOR SELECT
  USING (house_id IN (SELECT house_id FROM house_members WHERE user_id = auth.uid()));

CREATE POLICY "house members can insert parking reservations"
  ON parking_reservations FOR INSERT
  WITH CHECK (house_id IN (SELECT house_id FROM house_members WHERE user_id = auth.uid()));

CREATE POLICY "house members can update parking reservations"
  ON parking_reservations FOR UPDATE
  USING (house_id IN (SELECT house_id FROM house_members WHERE user_id = auth.uid()));

CREATE POLICY "house members can delete parking reservations"
  ON parking_reservations FOR DELETE
  USING (house_id IN (SELECT house_id FROM house_members WHERE user_id = auth.uid()));

-- grocery_items
CREATE POLICY "house members can read grocery"
  ON grocery_items FOR SELECT
  USING (house_id IN (SELECT house_id FROM house_members WHERE user_id = auth.uid()));

CREATE POLICY "house members can insert grocery"
  ON grocery_items FOR INSERT
  WITH CHECK (house_id IN (SELECT house_id FROM house_members WHERE user_id = auth.uid()));

CREATE POLICY "house members can update grocery"
  ON grocery_items FOR UPDATE
  USING (house_id IN (SELECT house_id FROM house_members WHERE user_id = auth.uid()));

CREATE POLICY "house members can delete grocery"
  ON grocery_items FOR DELETE
  USING (house_id IN (SELECT house_id FROM house_members WHERE user_id = auth.uid()));

-- chores
CREATE POLICY "house members can read chores"
  ON chores FOR SELECT
  USING (house_id IN (SELECT house_id FROM house_members WHERE user_id = auth.uid()));

CREATE POLICY "house members can insert chores"
  ON chores FOR INSERT
  WITH CHECK (house_id IN (SELECT house_id FROM house_members WHERE user_id = auth.uid()));

CREATE POLICY "house members can update chores"
  ON chores FOR UPDATE
  USING (house_id IN (SELECT house_id FROM house_members WHERE user_id = auth.uid()));

CREATE POLICY "house members can delete chores"
  ON chores FOR DELETE
  USING (house_id IN (SELECT house_id FROM house_members WHERE user_id = auth.uid()));

-- events
CREATE POLICY "house members can read events"
  ON events FOR SELECT
  USING (house_id IN (SELECT house_id FROM house_members WHERE user_id = auth.uid()));

CREATE POLICY "house members can insert events"
  ON events FOR INSERT
  WITH CHECK (house_id IN (SELECT house_id FROM house_members WHERE user_id = auth.uid()));

CREATE POLICY "house members can update events"
  ON events FOR UPDATE
  USING (house_id IN (SELECT house_id FROM house_members WHERE user_id = auth.uid()));

CREATE POLICY "house members can delete events"
  ON events FOR DELETE
  USING (house_id IN (SELECT house_id FROM house_members WHERE user_id = auth.uid()));

-- announcements
CREATE POLICY "house members can read announcements"
  ON announcements FOR SELECT
  USING (house_id IN (SELECT house_id FROM house_members WHERE user_id = auth.uid()));

CREATE POLICY "house members can insert announcements"
  ON announcements FOR INSERT
  WITH CHECK (house_id IN (SELECT house_id FROM house_members WHERE user_id = auth.uid()));

CREATE POLICY "house members can update announcements"
  ON announcements FOR UPDATE
  USING (house_id IN (SELECT house_id FROM house_members WHERE user_id = auth.uid()));

CREATE POLICY "house members can delete announcements"
  ON announcements FOR DELETE
  USING (house_id IN (SELECT house_id FROM house_members WHERE user_id = auth.uid()));

-- chat_messages
CREATE POLICY "house members can read chat"
  ON chat_messages FOR SELECT
  USING (house_id IN (SELECT house_id FROM house_members WHERE user_id = auth.uid()));

CREATE POLICY "house members can insert chat"
  ON chat_messages FOR INSERT
  WITH CHECK (house_id IN (SELECT house_id FROM house_members WHERE user_id = auth.uid()));

-- maintenance_requests
CREATE POLICY "house members can read maintenance"
  ON maintenance_requests FOR SELECT
  USING (house_id IN (SELECT house_id FROM house_members WHERE user_id = auth.uid()));

CREATE POLICY "house members can insert maintenance"
  ON maintenance_requests FOR INSERT
  WITH CHECK (house_id IN (SELECT house_id FROM house_members WHERE user_id = auth.uid()));

CREATE POLICY "house members can update maintenance"
  ON maintenance_requests FOR UPDATE
  USING (house_id IN (SELECT house_id FROM house_members WHERE user_id = auth.uid()));

CREATE POLICY "house members can delete maintenance"
  ON maintenance_requests FOR DELETE
  USING (house_id IN (SELECT house_id FROM house_members WHERE user_id = auth.uid()));

-- proposals
CREATE POLICY "house members can read proposals"
  ON proposals FOR SELECT
  USING (house_id IN (SELECT house_id FROM house_members WHERE user_id = auth.uid()));

CREATE POLICY "house members can insert proposals"
  ON proposals FOR INSERT
  WITH CHECK (house_id IN (SELECT house_id FROM house_members WHERE user_id = auth.uid()));

CREATE POLICY "house members can update proposals"
  ON proposals FOR UPDATE
  USING (house_id IN (SELECT house_id FROM house_members WHERE user_id = auth.uid()));

CREATE POLICY "house members can delete proposals"
  ON proposals FOR DELETE
  USING (house_id IN (SELECT house_id FROM house_members WHERE user_id = auth.uid()));

-- condition_entries
CREATE POLICY "house members can read condition"
  ON condition_entries FOR SELECT
  USING (house_id IN (SELECT house_id FROM house_members WHERE user_id = auth.uid()));

CREATE POLICY "house members can insert condition"
  ON condition_entries FOR INSERT
  WITH CHECK (house_id IN (SELECT house_id FROM house_members WHERE user_id = auth.uid()));

CREATE POLICY "house members can update condition"
  ON condition_entries FOR UPDATE
  USING (house_id IN (SELECT house_id FROM house_members WHERE user_id = auth.uid()));

CREATE POLICY "house members can delete condition"
  ON condition_entries FOR DELETE
  USING (house_id IN (SELECT house_id FROM house_members WHERE user_id = auth.uid()));

-- ── STEP 4: TRIGGERS ────────────────────────────────────────

CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_houses_updated_at BEFORE UPDATE ON houses FOR EACH ROW EXECUTE FUNCTION update_updated_at();
CREATE TRIGGER trg_profiles_updated_at BEFORE UPDATE ON profiles FOR EACH ROW EXECUTE FUNCTION update_updated_at();
CREATE TRIGGER trg_bills_updated_at BEFORE UPDATE ON bills FOR EACH ROW EXECUTE FUNCTION update_updated_at();
CREATE TRIGGER trg_recurring_bills_updated_at BEFORE UPDATE ON recurring_bills FOR EACH ROW EXECUTE FUNCTION update_updated_at();
CREATE TRIGGER trg_parking_reservations_updated_at BEFORE UPDATE ON parking_reservations FOR EACH ROW EXECUTE FUNCTION update_updated_at();
CREATE TRIGGER trg_grocery_updated_at BEFORE UPDATE ON grocery_items FOR EACH ROW EXECUTE FUNCTION update_updated_at();
CREATE TRIGGER trg_chores_updated_at BEFORE UPDATE ON chores FOR EACH ROW EXECUTE FUNCTION update_updated_at();
CREATE TRIGGER trg_events_updated_at BEFORE UPDATE ON events FOR EACH ROW EXECUTE FUNCTION update_updated_at();
CREATE TRIGGER trg_announcements_updated_at BEFORE UPDATE ON announcements FOR EACH ROW EXECUTE FUNCTION update_updated_at();
CREATE TRIGGER trg_maintenance_updated_at BEFORE UPDATE ON maintenance_requests FOR EACH ROW EXECUTE FUNCTION update_updated_at();
CREATE TRIGGER trg_proposals_updated_at BEFORE UPDATE ON proposals FOR EACH ROW EXECUTE FUNCTION update_updated_at();
CREATE TRIGGER trg_condition_updated_at BEFORE UPDATE ON condition_entries FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- ── STEP 5: AUTO-CREATE PROFILE ON SIGNUP ───────────────────

CREATE OR REPLACE FUNCTION handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO profiles (id, name, avatar_color)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data->>'name', 'Unknown'),
    COALESCE(NEW.raw_user_meta_data->>'avatar_color', '#6366f1')
  );
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER trg_on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION handle_new_user();
