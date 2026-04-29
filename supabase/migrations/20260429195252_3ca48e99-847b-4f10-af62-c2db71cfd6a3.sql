-- Drop the problematic trigger first to avoid issues during function update
DROP TRIGGER IF EXISTS tr_appointment_confirmation ON public.appointments;

-- Recreate the function with safety and correct settings
CREATE OR REPLACE FUNCTION public.handle_appointment_confirmation()
RETURNS TRIGGER AS $$
DECLARE
    v_base_url text;
    v_error_msg text;
BEGIN
    -- Only trigger for confirmed appointments
    IF (TG_OP = 'INSERT' AND NEW.status = 'confirmed') OR (TG_OP = 'UPDATE' AND OLD.status != 'confirmed' AND NEW.status = 'confirmed') THEN
        
        -- Try to get the base URL from platform_settings
        SELECT system_url INTO v_base_url FROM public.platform_settings LIMIT 1;
        
        -- Fallback to the known Supabase project URL if missing or invalid
        -- In Supabase projects, the Edge Functions are hosted on the project's URL
        IF v_base_url IS NULL OR v_base_url = '' OR v_base_url NOT LIKE 'https://%' THEN
            v_base_url := 'https://fbujndjmainizgmligxt.supabase.co';
        END IF;

        -- Sub-block to ensure we never block the main transaction
        BEGIN
            -- Using net.http_post from pg_net extension
            -- We avoid querying system_settings as it does not exist.
            -- The Edge Function will handle its own internal auth or we can configure it to allow these calls.
            PERFORM net.http_post(
                url := v_base_url || '/functions/v1/whatsapp-integration',
                headers := jsonb_build_object(
                    'Content-Type', 'application/json',
                    -- We try to pass the current auth if available, otherwise it will be empty
                    -- The Edge Function might fail to authenticate, but this block ensures it doesn't crash the INSERT
                    'Authorization', 'Bearer ' || COALESCE(current_setting('request.headers', true)::json->>'authorization', '')
                ),
                body := jsonb_build_object(
                    'action', 'send-message',
                    'companyId', NEW.company_id,
                    'appointmentId', NEW.id,
                    'type', 'appointment_confirmed'
                ),
                timeout_ms := 2000
            );
        EXCEPTION WHEN OTHERS THEN
            v_error_msg := SQLERRM;
            -- Record error to logs but ALLOW THE TRANSACTION TO PROCEED
            -- This is the "best effort" requirement
            INSERT INTO public.whatsapp_logs (
                company_id,
                appointment_id,
                status,
                error_message,
                source,
                message_type
            ) VALUES (
                NEW.company_id,
                NEW.id,
                'failed',
                'Trigger exception: ' || v_error_msg,
                'trigger_confirmation',
                'automation'
            );
        END;
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Recreate the trigger
CREATE TRIGGER tr_appointment_confirmation
AFTER INSERT OR UPDATE ON public.appointments
FOR EACH ROW EXECUTE FUNCTION handle_appointment_confirmation();
