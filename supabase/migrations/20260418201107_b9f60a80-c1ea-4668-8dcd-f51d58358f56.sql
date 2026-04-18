-- Schedule daily run of apply-pending-plans edge function via pg_cron
DO $$
DECLARE
  v_url text := 'https://fbujndjmainizgmligxt.supabase.co/functions/v1/apply-pending-plans';
  v_anon text := 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImZidWpuZGptYWluaXpnbWxpZ3h0Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzQ1NTE0MDEsImV4cCI6MjA5MDEyNzQwMX0.8fE-Vbdl7M3znTbfFR_VZ-a-AG18yEE6wGEOZn2XLPQ';
BEGIN
  -- Unschedule previous version if exists
  PERFORM cron.unschedule(jobid)
  FROM cron.job
  WHERE jobname = 'apply-pending-plans-daily';

  PERFORM cron.schedule(
    'apply-pending-plans-daily',
    '10 3 * * *',
    format($cmd$
      SELECT net.http_post(
        url := %L,
        headers := jsonb_build_object(
          'Content-Type', 'application/json',
          'Authorization', 'Bearer ' || %L
        ),
        body := '{}'::jsonb
      );
    $cmd$, v_url, v_anon)
  );
END $$;