-- Put the parking-check Edge Function on a timer (every 5 minutes).
--
-- It was deployed but never scheduled, so reservations were only handed over
-- when someone happened to open the app, and the "spot needed soon" / "please
-- free the spot" reminders never went out. Every message it sends is guarded
-- by a flag or status change, so running it often never repeats one.
--
-- Only runs where pg_cron + pg_net exist (the live project; staging has
-- neither). The project URL is read from the existing reminder jobs so this
-- file never hard-codes which project it is applied to. No secret is put in
-- the job: CRON_SECRET isn't set on the project yet, and arming it (for every
-- scheduled job at once, without copying the secret into job commands) is a
-- separate change.
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

  EXECUTE format(
    $q$SELECT cron.schedule('parking-check', '*/5 * * * *', %L)$q$,
    format(
      $c$select net.http_post(
  url := %L,
  headers := '{"Content-Type": "application/json"}'::jsonb,
  body := '{}'::jsonb,
  timeout_milliseconds := 10000
);$c$,
      base_url || '/functions/v1/parking-check'
    )
  );
END
$$;
