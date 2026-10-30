-- Put the parking-check Edge Function on a timer (every 5 minutes).
--
-- It was deployed but never scheduled, so reservations were only handed over
-- when someone happened to open the app, and the "spot needed soon" / "please
-- free the spot" reminders never went out. Every message it sends is guarded
-- by a flag or status change, so running it often never repeats one.
--
-- Only runs where pg_cron + pg_net exist (the live project; staging has
-- neither). The project URL is copied from an existing cron job. The
-- x-cron-secret header is resolved at execution time via JSON parsing so the
-- secret is never embedded in the stored cron command or written to cron logs.
-- cron.schedule with an existing job name updates that job, so re-running
-- this is safe.

DO $$
DECLARE
  base_url text;
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_extension WHERE extname = 'pg_cron')
     OR NOT EXISTS (SELECT 1 FROM pg_extension WHERE extname = 'pg_net') THEN
    RAISE NOTICE 'pg_cron/pg_net not installed — parking-check not scheduled';
    RETURN;
  END IF;

  EXECUTE $q$
    SELECT substring(command FROM 'https://[a-z0-9]+\.supabase\.co')
    FROM cron.job
    WHERE command LIKE '%/functions/v1/%'
    ORDER BY jobid
    LIMIT 1
  $q$ INTO base_url;

  IF base_url IS NULL THEN
    RAISE NOTICE 'No existing Edge Function cron job to copy the project URL from — parking-check not scheduled';
    RETURN;
  END IF;

  -- The stored command resolves x-cron-secret at execution time by extracting
  -- the headers JSON from an existing cron job and parsing it with the jsonb
  -- ->> operator (properly decodes escape sequences). The secret therefore
  -- never appears in the cron.job command column or in pg_cron log entries.
  EXECUTE format(
    $q$SELECT cron.schedule('parking-check', '*/5 * * * *', %L)$q$,
    format(
      $c$select net.http_post(
  url := %L,
  headers := (
    select '{"Content-Type": "application/json"}'::jsonb
      || case when s is not null
              then jsonb_build_object('x-cron-secret', s)
              else '{}'::jsonb
         end
    from (
      select (regexp_match(command, 'headers\s*:=\s*''(\{[^'']+\})'''))[1]::jsonb
               ->> 'x-cron-secret' as s
      from cron.job
      where command like '%%x-cron-secret%%'
        and jobname <> 'parking-check'
      order by jobid
      limit 1
    ) t
  ),
  body := '{}'::jsonb,
  timeout_milliseconds := 10000
);$c$,
      base_url || '/functions/v1/parking-check'
    )
  );
END
$$;
