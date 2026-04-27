-- Function to trigger WhatsApp confirmation via Edge Function
CREATE OR REPLACE FUNCTION public.fn_trigger_appointment_confirmation()
RETURNS TRIGGER AS $$
DECLARE
  payload JSONB;
  request_id BIGINT;
BEGIN
  -- Build the payload for the Edge Function
  payload := jsonb_build_object(
    'action', 'send-confirmation',
    'appointmentId', NEW.id,
    'companyId', NEW.company_id
  );

  -- Call the Edge Function using pg_net
  -- We use the service role key for authentication to bypass RLS and profile checks
  SELECT net.http_post(
    url := (SELECT value FROM (SELECT current_setting('app.settings.supabase_url', true) AS value) s) || '/functions/v1/whatsapp-integration',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || (SELECT value FROM (SELECT current_setting('app.settings.service_role_key', true) AS value) s)
    ),
    body := payload
  ) INTO request_id;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Trigger to fire after a new appointment is created
DROP TRIGGER IF EXISTS tr_appointment_confirmation ON public.appointments;
CREATE TRIGGER tr_appointment_confirmation
AFTER INSERT ON public.appointments
FOR EACH ROW
EXECUTE FUNCTION public.fn_trigger_appointment_confirmation();
