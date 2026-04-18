-- Reschedule apply-pending-plans cron with X-Cron-Secret header
DO $$
BEGIN
  PERFORM cron.unschedule('apply-pending-plans-daily');
EXCEPTION WHEN OTHERS THEN
  -- Job didn't exist, ignore
  NULL;
END $$;

SELECT cron.schedule(
  'apply-pending-plans-daily',
  '10 3 * * *',
  $$
  SELECT net.http_post(
    url := 'https://fbujndjmainizgmligxt.supabase.co/functions/v1/apply-pending-plans',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'X-Cron-Secret', 'agendae_cron_9X#K2pL@77_secure_2026'
    ),
    body := '{}'::jsonb
  );
  $$
);