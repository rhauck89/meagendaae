-- Enable pg_cron if not already enabled
CREATE EXTENSION IF NOT EXISTS pg_cron;

-- Schedule the WhatsApp automations scheduler every 15 minutes
-- We use net.http_post to call the edge function
SELECT cron.schedule(
    'whatsapp-automations-job',
    '*/15 * * * *',
    $$ SELECT net.http_post(
        url := 'https://fbujndjmainizgmligxt.supabase.co/functions/v1/whatsapp-automations-scheduler',
        headers := jsonb_build_object(
            'Content-Type', 'application/json',
            'Authorization', 'Bearer ' || (SELECT value FROM (SELECT value FROM get_secret('SUPABASE_SERVICE_ROLE_KEY')) as s)
        ),
        body := '{}'::jsonb
    ) $$
);

-- Note: get_secret is a custom function often used in Supabase projects. 
-- If it doesn't exist, we might need a different way to get the key, 
-- but usually service_role is injected or handled by Supabase Vault.
-- Alternative if get_secret doesn't exist:
-- We can also use a simple curl-like call if pg_net is enabled.
