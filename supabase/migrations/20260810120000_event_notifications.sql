-- Calendar event notifications
-- Two new pushes for calendar events, each with its own per-user toggle:
--   • notify_event_added     — instant ping when a housemate adds an event
--   • notify_event_reminder  — a heads-up before an event happens
-- event_reminder_days_before is the chosen lead time (0 = on the day, up to a week).

ALTER TABLE notification_preferences
  ADD COLUMN IF NOT EXISTS notify_event_added boolean DEFAULT true;

ALTER TABLE notification_preferences
  ADD COLUMN IF NOT EXISTS notify_event_reminder boolean DEFAULT true;

ALTER TABLE notification_preferences
  ADD COLUMN IF NOT EXISTS event_reminder_days_before integer DEFAULT 1; -- 0 | 1 | 2 | 3 | 7
