CREATE OR REPLACE FUNCTION public.fn_trigger_appointment_confirmation()
RETURNS TRIGGER AS $$
DECLARE
  payload JSONB;
  request_id BIGINT;
  _url TEXT;
  _key TEXT;
BEGIN
  -- Build the payload
  payload := jsonb_build_object(
    'action', 'send-confirmation',
    'appointmentId', NEW.id,
    'companyId', NEW.company_id
  );

  -- Get configuration with hardcoded fallbacks
  _url := COALESCE(
    current_setting('app.settings.supabase_url', true),
    'https://fbujndjmainizgmligxt.supabase.co'
  );
  
  _key := COALESCE(
    current_setting('app.settings.service_role_key', true),
    'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImZidWpuZGptYWluaXpnbWxpZ3h0Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3NDU1MTQwMSwiZXhwIjoyMDkwMTI3NDAxfQ.qrhQ5TLyL_KSb8LD0DPqZRYRr14JzEkn7XjibSldsOA'
  );

  -- Only proceed if we have both
  IF _url IS NOT NULL AND _key IS NOT NULL THEN
    BEGIN
      SELECT net.http_post(
        url := _url || '/functions/v1/whatsapp-integration',
        headers := jsonb_build_object(
          'Content-Type', 'application/json',
          'Authorization', 'Bearer ' || _key
        ),
        body := payload
      ) INTO request_id;
    EXCEPTION WHEN OTHERS THEN
      -- Log internal error
      INSERT INTO public.whatsapp_logs (
        company_id,
        appointment_id,
        message_type,
        status,
        source,
        error_message
      ) VALUES (
        NEW.company_id,
        NEW.id,
        'confirmation',
        'error',
        'trigger',
        'HTTP call failed: ' || SQLERRM
      );
    END;
  END IF;

  RETURN NEW;
EXCEPTION WHEN OTHERS THEN
  -- Ultimate fail-safe
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
