-- Per-user toggle for the "new task assigned to you" push notification
-- (pairs with the house_tasks table created in the previous migration).

ALTER TABLE notification_preferences
  ADD COLUMN IF NOT EXISTS notify_task_assigned boolean DEFAULT true;
