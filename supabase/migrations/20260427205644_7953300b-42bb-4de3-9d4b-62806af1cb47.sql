-- Update the trigger function with robust error handling and fail-safe logic
CREATE OR REPLACE FUNCTION public.fn_trigger_appointment_confirmation()
RETURNS TRIGGER AS $$
DECLARE
  payload JSONB;
  request_id BIGINT;
  _url TEXT;
  _key TEXT;
BEGIN
  -- Build the payload for the Edge Function
  payload := jsonb_build_object(
    'action', 'send-confirmation',
    'appointmentId', NEW.id,
    'companyId', NEW.company_id
  );

  -- Attempt to get configuration
  -- Using COALESCE to provide a hardcoded fallback for the project URL if the setting is missing
  _url := COALESCE(
    current_setting('app.settings.supabase_url', true),
    'https://fbujndjmainizgmligxt.supabase.co'
  );
  
  _key := current_setting('app.settings.service_role_key', true);

  -- Validation and execution
  IF _url IS NOT NULL AND _key IS NOT NULL THEN
    BEGIN
      -- Call the Edge Function using pg_net
      SELECT net.http_post(
        url := _url || '/functions/v1/whatsapp-integration',
        headers := jsonb_build_object(
          'Content-Type', 'application/json',
          'Authorization', 'Bearer ' || _key
        ),
        body := payload
      ) INTO request_id;
    EXCEPTION WHEN OTHERS THEN
      -- Record failure in logs instead of raising exception
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
  ELSE
    -- Log configuration failure
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
      'Missing config: URL=' || COALESCE(_url, 'MISSING') || ', Key=' || (CASE WHEN _key IS NULL THEN 'MISSING' ELSE 'PRESENT' END)
    );
  END IF;

  -- CRITICAL: Always return NEW to allow the appointment to be created
  RETURN NEW;
EXCEPTION WHEN OTHERS THEN
  -- Ultimate fail-safe: if logging fails or anything else, don't crash the appointment creation
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Ensure the trigger is active (it should be, but let's be sure it's AFTER INSERT)
-- The trigger was already created as 'tr_appointment_confirmation'
