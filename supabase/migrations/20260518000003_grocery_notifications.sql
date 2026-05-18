-- Add grocery shared notification preference.
-- Controls whether a user receives a push notification when a housemate
-- shares their grocery draft with the house.

ALTER TABLE notification_preferences
  ADD COLUMN IF NOT EXISTS notify_grocery_shared boolean DEFAULT true;
