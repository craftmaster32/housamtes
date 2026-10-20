-- Tasks and Chores become one list: copy every existing chore into house_tasks
-- once, so nothing a house already wrote down is lost. The chores table itself
-- is left untouched (nothing is deleted); the app stops reading it.
--
-- • The chore keeps its id, so re-running this migration copies nothing twice
--   (ON CONFLICT DO NOTHING).
-- • Chores have no creator column, but house_tasks.created_by is required:
--   use the person the chore was assigned to if they are still in the house,
--   otherwise the house owner (falling back to the earliest member). A house
--   with no members at all has nobody to show the task to, so it is skipped.
-- • assigned_to is kept only while that person is still a member (house_tasks
--   requires the assignee to be a member of the same house).
-- • Chores had no priority or details beyond notes: medium priority, notes as
--   the description.

INSERT INTO house_tasks (
  id, house_id, title, description, priority, assigned_to, due_date,
  is_done, completed_at, created_by, created_at, recurrence, recurrence_day
)
SELECT
  c.id,
  c.house_id,
  c.title,
  COALESCE(c.notes, ''),
  'medium',
  assignee.user_id,
  c.due_date,
  COALESCE(c.is_done, false),
  c.completed_at,
  COALESCE(assignee.user_id, fallback.user_id),
  COALESCE(c.created_at, now()),
  CASE WHEN c.recurrence IN ('weekly', 'monthly') THEN c.recurrence ELSE 'once' END,
  CASE WHEN c.recurrence IN ('weekly', 'monthly') THEN c.recurrence_day END
FROM chores c
LEFT JOIN house_members assignee
  ON assignee.house_id = c.house_id AND assignee.user_id = c.assigned_to
LEFT JOIN LATERAL (
  SELECT hm.user_id
  FROM house_members hm
  WHERE hm.house_id = c.house_id
  ORDER BY (hm.role = 'owner') DESC, hm.joined_at ASC NULLS LAST
  LIMIT 1
) fallback ON true
WHERE COALESCE(assignee.user_id, fallback.user_id) IS NOT NULL
ON CONFLICT (id) DO NOTHING;
