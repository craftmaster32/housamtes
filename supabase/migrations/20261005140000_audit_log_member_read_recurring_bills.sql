-- Allow all house members to read recurring-bill change history from audit_log.
-- The existing admin/owner policy remains for full audit access; this policy
-- adds a narrower read for regular members, scoped to the four table_name
-- values the recurring-bills feature queries.
CREATE POLICY "house members can read recurring bill history" ON audit_log FOR SELECT
  USING (
    house_id IN (SELECT public.get_my_house_ids())
    AND table_name IN (
      'recurring_bills',
      'recurring_bills_update',
      'household_payments',
      'household_payments_update'
    )
  );
