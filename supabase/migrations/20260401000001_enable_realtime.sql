-- ============================================================
-- HouseMates — Enable Realtime on all collaborative tables
-- Without this, Supabase won't broadcast changes even if the
-- app subscribes to them.
-- ============================================================

ALTER PUBLICATION supabase_realtime ADD TABLE grocery_items;
ALTER PUBLICATION supabase_realtime ADD TABLE chores;
ALTER PUBLICATION supabase_realtime ADD TABLE bills;
ALTER PUBLICATION supabase_realtime ADD TABLE recurring_bills;
ALTER PUBLICATION supabase_realtime ADD TABLE household_payments;
ALTER PUBLICATION supabase_realtime ADD TABLE parking_sessions;
ALTER PUBLICATION supabase_realtime ADD TABLE parking_reservations;
ALTER PUBLICATION supabase_realtime ADD TABLE chat_messages;
ALTER PUBLICATION supabase_realtime ADD TABLE maintenance_requests;
ALTER PUBLICATION supabase_realtime ADD TABLE proposals;
ALTER PUBLICATION supabase_realtime ADD TABLE events;
ALTER PUBLICATION supabase_realtime ADD TABLE announcements;
ALTER PUBLICATION supabase_realtime ADD TABLE condition_entries;
ALTER PUBLICATION supabase_realtime ADD TABLE house_members;
ALTER PUBLICATION supabase_realtime ADD TABLE photos;
