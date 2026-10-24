-- Tasks and Chores become one list (owner decision, Oct 2026): house_tasks
-- gains the chores "Repeat" setting. Same values the chores table and the
-- chore-due-reminder function already use:
--   recurrence     'once' | 'weekly' | 'monthly'
--   recurrence_day weekly: 'Sun'…'Sat', monthly: '1'…'31', else NULL
-- The copy of existing chores into house_tasks ships in the next migration
-- file (one logical change per file).

ALTER TABLE house_tasks
  ADD COLUMN IF NOT EXISTS recurrence     text NOT NULL DEFAULT 'once',
  ADD COLUMN IF NOT EXISTS recurrence_day text;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'house_tasks_recurrence_check'
  ) THEN
    ALTER TABLE house_tasks
      ADD CONSTRAINT house_tasks_recurrence_check
      CHECK (recurrence IN ('once', 'weekly', 'monthly'));
  END IF;
END $$;

-- The daily reminder and "Reset repeating" both look up repeating tasks only.
CREATE INDEX IF NOT EXISTS idx_house_tasks_recurrence
  ON house_tasks(recurrence)
  WHERE recurrence <> 'once';
