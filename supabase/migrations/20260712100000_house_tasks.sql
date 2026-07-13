-- House task list (FEATURES.md 4.4).
-- Shared to-do list for the house: title, description, priority,
-- optional assignee and due date. Completed tasks stay in history.
-- The matching notification preference column ships in the next
-- migration file (one logical change per file).

CREATE TABLE IF NOT EXISTS house_tasks (
  id           uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  house_id     uuid NOT NULL REFERENCES houses(id) ON DELETE CASCADE,
  title        text NOT NULL,
  description  text NOT NULL DEFAULT '',
  priority     text NOT NULL DEFAULT 'medium' CHECK (priority IN ('low','medium','high')),
  assigned_to  uuid,
  due_date     date,
  is_done      boolean NOT NULL DEFAULT false,
  completed_at timestamptz,
  completed_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_by   uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  created_at   timestamptz DEFAULT now(),
  updated_at   timestamptz DEFAULT now(),
  -- A task can only be assigned to a member of the same house. When that
  -- membership is deleted (member leaves), the task simply becomes
  -- unassigned instead of blocking the removal.
  CONSTRAINT house_tasks_assignee_is_member
    FOREIGN KEY (house_id, assigned_to)
    REFERENCES house_members(house_id, user_id)
    ON DELETE SET NULL (assigned_to)
);

CREATE INDEX IF NOT EXISTS idx_house_tasks_house_id ON house_tasks(house_id);
CREATE INDEX IF NOT EXISTS idx_house_tasks_assigned_to ON house_tasks(assigned_to);
CREATE INDEX IF NOT EXISTS idx_house_tasks_created_by ON house_tasks(created_by);

ALTER TABLE house_tasks ENABLE ROW LEVEL SECURITY;

CREATE POLICY "house members can read tasks"
  ON house_tasks FOR SELECT
  USING (house_id IN (SELECT house_id FROM house_members WHERE user_id = auth.uid()));

CREATE POLICY "house members can insert tasks"
  ON house_tasks FOR INSERT
  WITH CHECK (
    created_by = auth.uid() AND
    house_id IN (SELECT house_id FROM house_members WHERE user_id = auth.uid())
  );

-- Any member can update (mark complete, reassign) — matches chores.
CREATE POLICY "house members can update tasks"
  ON house_tasks FOR UPDATE
  USING (house_id IN (SELECT house_id FROM house_members WHERE user_id = auth.uid()));

-- Delete restricted to the creator or an admin/owner, matching the
-- tightened delete policies on the other shared tables.
CREATE POLICY "creator or admin can delete tasks"
  ON house_tasks FOR DELETE
  USING (
    created_by = auth.uid() OR
    house_id IN (
      SELECT house_id FROM house_members
      WHERE user_id = auth.uid() AND role IN ('owner', 'admin')
    )
  );

CREATE TRIGGER trg_house_tasks_updated_at
  BEFORE UPDATE ON house_tasks
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- Idempotent realtime registration — re-running this migration must not fail
-- if house_tasks is already a member of the publication.
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime' AND schemaname = 'public' AND tablename = 'house_tasks'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE house_tasks;
  END IF;
END $$;
