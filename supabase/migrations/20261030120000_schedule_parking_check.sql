-- Put the parking-check Edge Function on a timer (every 5 minutes).
--
-- It was deployed but never scheduled, so reservations were only handed over
-- when someone happened to open the app, and the "spot needed soon" / "please
-- free the spot" reminders never went out. Every message it sends is guarded
-- by a flag or status change, so running it often never repeats one.
--
-- Only runs where pg_cron + pg_net exist (the live project; staging has
-- neither). The project URL and the x-cron-secret header (checked by
-- _shared/cronAuth.ts once CRON_SECRET is set) are copied from the existing
-- reminder jobs, so this file never hard-codes the project or a secret.
-- cron.schedule with an existing job name updates that job, so re-running
-- this is safe.

DO $$
DECLARE
  base_url text;
  cron_secret text;
  headers jsonb := '{"Content-Type": "application/json"}'::jsonb;
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

  EXECUTE $q$
    SELECT substring(command FROM '"x-cron-secret"\s*:\s*"([^"]+)"')
    FROM cron.job
    WHERE command LIKE '%x-cron-secret%'
    ORDER BY jobid
    LIMIT 1
  $q$ INTO cron_secret;

  IF cron_secret IS NOT NULL THEN
    headers := headers || jsonb_build_object('x-cron-secret', cron_secret);
  END IF;

  EXECUTE format(
    $q$SELECT cron.schedule('parking-check', '*/5 * * * *', %L)$q$,
    format(
      $c$select net.http_post(
  url := %L,
  headers := %L::jsonb,
  body := '{}'::jsonb,
  timeout_milliseconds := 10000
);$c$,
      base_url || '/functions/v1/parking-check',
      headers::text
    )
  );
END
$$;
