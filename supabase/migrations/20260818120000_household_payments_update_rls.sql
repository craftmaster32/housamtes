-- ============================================================
-- Allow house members to update household payments
-- ============================================================
-- Recurring-bill payments could originally only be added or deleted, so the
-- table shipped with SELECT / INSERT / DELETE row-level-security policies but
-- no UPDATE policy. Editing a logged payment (amount, date, note, split) is a
-- new capability, and with RLS enabled an UPDATE with no matching policy is
-- silently denied — the write touches zero rows and the app reports a save
-- failure. This adds the missing UPDATE policy so any member of the payment's
-- house can edit it, scoped to their own house on both the existing row
-- (USING) and the new values (WITH CHECK) so a payment can't be moved to a
-- house the member isn't in.

DROP POLICY IF EXISTS "house members can update household payments" ON household_payments;
CREATE POLICY "house members can update household payments"
  ON household_payments FOR UPDATE
  USING (house_id IN (SELECT house_id FROM house_members WHERE user_id = auth.uid()))
  WITH CHECK (house_id IN (SELECT house_id FROM house_members WHERE user_id = auth.uid()));
