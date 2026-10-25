-- Demo activity for the TEST house "Dizengoff 42" on the STAGING database only.
-- Run by the "Seed staging demo data" workflow; never part of the migrations,
-- so it can't reach the live app.
--
-- The house's existing members (the owner's test account, Maya, Noam) "use the
-- app" for six months: they log the recurring house bills and everyday shared
-- expenses, each paying in turn and splitting with everyone or a few people.
-- Everything it adds is marked 'demo-data' and it only runs once.
DO $$
DECLARE
  h uuid;
  m uuid[];
  n int;
  ago int;
  i int;
  month_start date;
  payer uuid;
  split uuid[];
  rb record;
  ex record;
BEGIN
  SELECT id INTO h FROM houses WHERE name = 'Dizengoff 42' LIMIT 1;
  IF h IS NULL THEN
    RAISE EXCEPTION 'Test house "Dizengoff 42" not found';
  END IF;

  IF EXISTS (SELECT 1 FROM bills WHERE house_id = h AND notes = 'demo-data') THEN
    RAISE NOTICE 'Demo activity is already there, nothing added.';
    RETURN;
  END IF;

  SELECT array_agg(user_id ORDER BY joined_at, user_id) INTO m
    FROM house_members WHERE house_id = h;
  n := coalesce(array_length(m, 1), 0);
  IF n = 0 THEN
    RAISE EXCEPTION 'The test house has no members';
  END IF;

  -- The usual house bills (kept if the house already has them).
  i := 0;
  FOR rb IN
    SELECT * FROM (VALUES
      ('Rent', 6900, 'home', 'monthly'),
      ('Electricity', 480, 'flash', 'bimonthly'),
      ('Internet', 120, 'wifi', 'monthly'),
      ('Water', 210, 'water', 'bimonthly'),
      ('Arnona', 690, 'business', 'bimonthly')
    ) AS v(name, amount, icon, freq)
  LOOP
    INSERT INTO recurring_bills (house_id, name, assigned_to, frequency, typical_amount, icon)
    SELECT h, rb.name, m[1 + (i % n)], rb.freq, rb.amount, rb.icon
    WHERE NOT EXISTS (
      SELECT 1 FROM recurring_bills WHERE house_id = h AND lower(name) = lower(rb.name)
    );
    i := i + 1;
  END LOOP;

  -- Six months of paying them, a different housemate paying each time.
  FOR ago IN REVERSE 5..0 LOOP
    month_start := (date_trunc('month', current_date) - make_interval(months => ago))::date;
    i := 0;
    FOR rb IN
      SELECT r.id, r.name, r.frequency, r.typical_amount
        FROM recurring_bills r
       WHERE r.house_id = h
         AND lower(r.name) IN ('rent', 'electricity', 'internet', 'water', 'arnona')
       ORDER BY r.name
    LOOP
      i := i + 1;
      CONTINUE WHEN rb.frequency = 'bimonthly' AND ago % 2 = 1;
      CONTINUE WHEN rb.frequency = 'quarterly' AND ago % 3 <> 0;
      INSERT INTO household_payments (house_id, bill_id, amount, paid_at, paid_by, note)
      VALUES (
        h,
        rb.id,
        CASE WHEN lower(rb.name) = 'rent' THEN rb.typical_amount
             ELSE round(rb.typical_amount * (0.85 + ((ago * 7 + i) % 5) * 0.07), 2) END,
        least(month_start + (2 + i * 3), current_date),
        m[1 + ((ago + i) % n)],
        'demo-data'
      );
    END LOOP;
  END LOOP;

  -- Everyday shared spending.
  FOR ago IN REVERSE 5..0 LOOP
    month_start := (date_trunc('month', current_date) - make_interval(months => ago))::date;
    i := 0;
    FOR ex IN
      SELECT * FROM (VALUES
        ('Shufersal big shop', 'groceries', 240, 'all'),
        ('Market veg', 'groceries', 85, 'all'),
        ('Cleaning stuff', 'other', 60, 'all'),
        ('Pizza night', 'food', 180, 'some'),
        ('Sushi', 'food', 260, 'some'),
        ('Taxi home', 'transport', 70, 'two'),
        ('Cinema', 'entertainment', 150, 'some'),
        ('Netflix', 'entertainment', 55, 'all'),
        ('New shower curtain', 'shopping', 95, 'all'),
        ('Pharmacy', 'health', 48, 'two')
      ) AS v(title, category, base, who)
    LOOP
      i := i + 1;
      -- Not everything happens every month.
      CONTINUE WHEN (ago + i) % 3 = 0 AND ex.category <> 'groceries';
      payer := m[1 + ((ago * 3 + i) % n)];
      split := CASE ex.who
        WHEN 'all' THEN m
        WHEN 'two' THEN ARRAY(SELECT DISTINCT unnest(ARRAY[payer, m[1 + ((ago * 3 + i + 1) % n)]]))
        ELSE ARRAY(
          SELECT DISTINCT u FROM unnest(m) WITH ORDINALITY AS t(u, k)
           WHERE (k + ago + i) % 4 <> 0 OR u = payer
        )
      END;
      INSERT INTO bills (house_id, title, amount, paid_by, split_between, date, category, notes)
      VALUES (
        h,
        ex.title,
        round(ex.base * (0.8 + ((ago * 5 + i * 3) % 9) * 0.06), 2),
        payer,
        split,
        least(month_start + (1 + (i * 3 + ago) % 25), current_date),
        ex.category,
        'demo-data'
      );
    END LOOP;
  END LOOP;

  RAISE NOTICE 'Demo activity added for % housemates.', n;
END $$;
