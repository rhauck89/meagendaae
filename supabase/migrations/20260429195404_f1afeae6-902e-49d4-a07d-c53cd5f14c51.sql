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
        IF v_base_url IS NULL OR v_base_url = '' OR v_base_url NOT LIKE 'https://%' THEN
            v_base_url := 'https://fbujndjmainizgmligxt.supabase.co';
        END IF;

        -- Sub-block to ensure we never block the main transaction
        BEGIN
            -- Fix parameter names for pg_net: timeout_milliseconds
            PERFORM net.http_post(
                url := v_base_url || '/functions/v1/whatsapp-integration',
                body := jsonb_build_object(
                    'action', 'send-message',
                    'companyId', NEW.company_id,
                    'appointmentId', NEW.id,
                    'type', 'appointment_confirmed'
                ),
                headers := jsonb_build_object(
                    'Content-Type', 'application/json',
                    'Authorization', 'Bearer ' || COALESCE(current_setting('request.headers', true)::json->>'authorization', '')
                ),
                timeout_milliseconds := 2000
            );
        EXCEPTION WHEN OTHERS THEN
            v_error_msg := SQLERRM;
            -- Record error to logs but ALLOW THE TRANSACTION TO PROCEED
            -- We must include the 'phone' column as it has a NOT NULL constraint
            INSERT INTO public.whatsapp_logs (
                company_id,
                appointment_id,
                phone,
                status,
                error_message,
                source,
                message_type
            ) VALUES (
                NEW.company_id,
                NEW.id,
                COALESCE(NEW.client_whatsapp, '00000000000'),
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
