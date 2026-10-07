-- Structured coverage for recurring-bill payments.
--
-- Until now the months a payment paid for lived mostly in its free-text note
-- ("יוני-יולי", "נר אוג-ספט"). This makes coverage structured:
--   coverage_start  — first day of the first month covered (was covers_from)
--   coverage_months — how many months it covers (defaults to the bill's frequency)
--   paid_by         — who actually paid (NULL = the bill's assigned payer)
-- and backfills existing payments by reading Hebrew month ranges from the note.
-- Rows whose note can't be read keep NULL coverage; the app shows their note.
--
-- RLS: household_payments already has RLS enabled with a policy per operation
-- (read / insert / update / delete, all scoped to the member's house). New
-- columns are covered by those row policies; paid_by is additionally checked
-- by a trigger so a payment can't be credited to someone outside the house.

ALTER TABLE household_payments ENABLE ROW LEVEL SECURITY;

-- ── 1. Columns ──────────────────────────────────────────────────────────────
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'household_payments'
      AND column_name = 'covers_from'
  ) AND NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'household_payments'
      AND column_name = 'coverage_start'
  ) THEN
    ALTER TABLE household_payments RENAME COLUMN covers_from TO coverage_start;
  END IF;

  IF EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'household_payments_covers_from_check'
      AND conrelid = 'public.household_payments'::regclass
  ) THEN
    ALTER TABLE household_payments
      RENAME CONSTRAINT household_payments_covers_from_check
      TO household_payments_coverage_start_check;
  END IF;
END $$;

ALTER TABLE household_payments ADD COLUMN IF NOT EXISTS coverage_start date;
ALTER TABLE household_payments ADD COLUMN IF NOT EXISTS coverage_months smallint;
ALTER TABLE household_payments
  ADD COLUMN IF NOT EXISTS paid_by uuid REFERENCES auth.users(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_household_payments_paid_by ON household_payments(paid_by);

-- ── 2. Backfill ─────────────────────────────────────────────────────────────
-- Hebrew month word → month number. Full and short names; a leading "ו"
-- ("and") is accepted, e.g. "יוני ויולי".
CREATE OR REPLACE FUNCTION pg_temp.hebrew_month(word text) RETURNS int
LANGUAGE sql IMMUTABLE AS $$
  SELECT CASE w
    WHEN 'ינואר' THEN 1 WHEN 'ינו' THEN 1
    WHEN 'פברואר' THEN 2 WHEN 'פבר' THEN 2 WHEN 'פב' THEN 2
    WHEN 'מרץ' THEN 3 WHEN 'מרס' THEN 3 WHEN 'מרצ' THEN 3
    WHEN 'אפריל' THEN 4 WHEN 'אפר' THEN 4
    WHEN 'מאי' THEN 5
    WHEN 'יוני' THEN 6 WHEN 'יונ' THEN 6
    WHEN 'יולי' THEN 7 WHEN 'יול' THEN 7
    WHEN 'אוגוסט' THEN 8 WHEN 'אוג' THEN 8
    WHEN 'ספטמבר' THEN 9 WHEN 'ספט' THEN 9 WHEN 'ספ' THEN 9
    WHEN 'אוקטובר' THEN 10 WHEN 'אוק' THEN 10
    WHEN 'נובמבר' THEN 11 WHEN 'נוב' THEN 11
    WHEN 'דצמבר' THEN 12 WHEN 'דצמ' THEN 12 WHEN 'דצ' THEN 12
  END
  FROM (SELECT word AS w) x;
$$;

CREATE OR REPLACE FUNCTION pg_temp.note_months(note text) RETURNS int[]
LANGUAGE plpgsql IMMUTABLE AS $$
DECLARE
  tok text;
  m int;
  found int[] := '{}';
BEGIN
  IF note IS NULL THEN
    RETURN found;
  END IF;
  -- Words are runs of Hebrew letters; dashes, geresh, digits etc. separate them.
  FOREACH tok IN ARRAY regexp_split_to_array(note, '[^א-ת]+') LOOP
    CONTINUE WHEN tok = '';
    m := pg_temp.hebrew_month(tok);
    IF m IS NULL AND left(tok, 1) = 'ו' THEN
      m := pg_temp.hebrew_month(substr(tok, 2));
    END IF;
    IF m IS NOT NULL THEN
      found := found || m;
    END IF;
  END LOOP;
  RETURN found;
END;
$$;

-- Extract a 4-digit year explicitly stated in the note (e.g. "דצמ 2026" → 2026).
CREATE OR REPLACE FUNCTION pg_temp.note_year(note text) RETURNS int
LANGUAGE sql IMMUTABLE AS $$
  SELECT (regexp_match(note, '\m(20[0-9]{2})\M'))[1]::int;
$$;

-- Months named in the note → (start date, month count). When the note contains
-- an explicit year that year is used directly; otherwise the year that puts the
-- first covered month closest to the payment date is chosen, so a "נוב-דצמ"
-- payment made in January lands on the previous November.
CREATE OR REPLACE FUNCTION pg_temp.parse_coverage(
  note text, paid_at date, freq_months int,
  OUT start_month date, OUT months int
)
LANGUAGE plpgsql IMMUTABLE AS $$
DECLARE
  found int[] := pg_temp.note_months(note);
  explicit_year int := pg_temp.note_year(note);
  first_m int;
  last_m int;
  paid_month date := date_trunc('month', paid_at)::date;
  candidate date;
  k int;
BEGIN
  IF array_length(found, 1) IS NULL THEN
    RETURN;
  END IF;
  first_m := found[1];
  last_m := found[array_length(found, 1)];
  -- A single month name marks where the period starts; a range gives its length.
  months := CASE
    WHEN array_length(found, 1) = 1 THEN freq_months
    ELSE ((last_m - first_m + 12) % 12) + 1
  END;
  IF explicit_year IS NOT NULL THEN
    -- Note contains an explicit year — use it directly.
    start_month := make_date(explicit_year, first_m, 1);
  ELSE
    -- No year in note — pick candidate year closest to the payment date.
    FOR k IN -1..1 LOOP
      candidate := make_date(extract(year FROM paid_at)::int + k, first_m, 1);
      IF start_month IS NULL
         OR abs(candidate - paid_month) < abs(start_month - paid_month) THEN
        start_month := candidate;
      END IF;
    END LOOP;
  END IF;
END;
$$;

-- The backfill is a data migration, not a member's edit: keep it out of the
-- change history so the app doesn't show "Someone changed" on every payment.
ALTER TABLE household_payments DISABLE TRIGGER audit_household_payments_update;

-- Payments logged with an explicit start month (since 2026-10-05) keep it and
-- cover one billing period.
UPDATE household_payments hp
SET coverage_months = CASE rb.frequency
  WHEN 'bimonthly' THEN 2 WHEN 'quarterly' THEN 3 ELSE 1 END
FROM recurring_bills rb
WHERE rb.id = hp.bill_id
  AND hp.coverage_start IS NOT NULL
  AND hp.coverage_months IS NULL;

-- Everything else: read the note.
UPDATE household_payments hp
SET coverage_start = parsed.start_month,
    coverage_months = parsed.months
FROM (
  SELECT src.id, c.start_month, c.months
  FROM household_payments src
  JOIN recurring_bills rb ON rb.id = src.bill_id
  CROSS JOIN LATERAL pg_temp.parse_coverage(
    src.note, src.paid_at,
    CASE rb.frequency WHEN 'bimonthly' THEN 2 WHEN 'quarterly' THEN 3 ELSE 1 END
  ) AS c
  WHERE src.coverage_start IS NULL
) AS parsed
WHERE parsed.id = hp.id
  AND parsed.start_month IS NOT NULL;

ALTER TABLE household_payments ENABLE TRIGGER audit_household_payments_update;

DO $$
DECLARE
  unparsed int;
BEGIN
  SELECT count(*) INTO unparsed FROM household_payments WHERE coverage_start IS NULL;
  RAISE NOTICE 'household_payments coverage backfill: % row(s) left without coverage', unparsed;
END $$;

-- ── 3. Constraints ──────────────────────────────────────────────────────────
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'household_payments_coverage_start_check'
      AND conrelid = 'public.household_payments'::regclass
  ) THEN
    ALTER TABLE household_payments VALIDATE CONSTRAINT household_payments_coverage_start_check;
  ELSE
    ALTER TABLE household_payments
      ADD CONSTRAINT household_payments_coverage_start_check
      CHECK (coverage_start IS NULL OR EXTRACT(DAY FROM coverage_start) = 1);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'household_payments_coverage_months_check'
      AND conrelid = 'public.household_payments'::regclass
  ) THEN
    -- Start and length go together: both set, or both unknown.
    ALTER TABLE household_payments
      ADD CONSTRAINT household_payments_coverage_months_check
      CHECK (
        (coverage_start IS NULL AND coverage_months IS NULL)
        OR (coverage_start IS NOT NULL AND coverage_months BETWEEN 1 AND 12)
      );
  END IF;
END $$;

-- ── 4. Defaults + payer check on write ──────────────────────────────────────
-- coverage_months defaults to the bill's frequency (a column DEFAULT can't
-- read another table), and paid_by must be a member of the payment's house.
-- paid_by is only checked when it is set or changed, so editing an old payment
-- credited to someone who has since left the house still works.
CREATE OR REPLACE FUNCTION fn_household_payment_defaults() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.coverage_start IS NULL THEN
    NEW.coverage_months := NULL;
  ELSIF NEW.coverage_months IS NULL THEN
    SELECT CASE frequency WHEN 'bimonthly' THEN 2 WHEN 'quarterly' THEN 3 ELSE 1 END
      INTO NEW.coverage_months
      FROM recurring_bills WHERE id = NEW.bill_id;
  END IF;

  IF NEW.paid_by IS NOT NULL
     AND (TG_OP = 'INSERT' OR NEW.paid_by IS DISTINCT FROM OLD.paid_by)
     AND NOT EXISTS (
       SELECT 1 FROM house_members
       WHERE house_id = NEW.house_id AND user_id = NEW.paid_by
     )
  THEN
    RAISE EXCEPTION 'paid_by must be a member of the house'
      USING ERRCODE = 'check_violation';
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS household_payments_defaults ON household_payments;
CREATE TRIGGER household_payments_defaults
  BEFORE INSERT OR UPDATE ON household_payments
  FOR EACH ROW EXECUTE FUNCTION fn_household_payment_defaults();

-- ── 5. Audit edits to the new columns too ───────────────────────────────────
CREATE OR REPLACE FUNCTION fn_audit_household_payment_update() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF (OLD.amount          IS DISTINCT FROM NEW.amount)          OR
     (OLD.paid_at         IS DISTINCT FROM NEW.paid_at)         OR
     (OLD.note            IS DISTINCT FROM NEW.note)            OR
     (OLD.split_between   IS DISTINCT FROM NEW.split_between)   OR
     (OLD.coverage_start  IS DISTINCT FROM NEW.coverage_start)  OR
     (OLD.coverage_months IS DISTINCT FROM NEW.coverage_months) OR
     (OLD.paid_by         IS DISTINCT FROM NEW.paid_by)
  THEN
    INSERT INTO audit_log(house_id, actor_id, table_name, record_id, old_data)
    VALUES (OLD.house_id, auth.uid(), 'household_payments_update', OLD.id, to_jsonb(OLD));
  END IF;
  RETURN NULL;
END;
$$;
