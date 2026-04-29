CREATE OR REPLACE FUNCTION public.handle_appointment_confirmation()
RETURNS TRIGGER AS $$
DECLARE
    v_url text;
    v_error_msg text;
BEGIN
    -- Only trigger for confirmed appointments
    IF (TG_OP = 'INSERT' AND NEW.status = 'confirmed') OR (TG_OP = 'UPDATE' AND OLD.status != 'confirmed' AND NEW.status = 'confirmed') THEN
        
        -- The direct Supabase Edge Function URL for this project
        v_url := 'https://fbujndjmainizgmligxt.supabase.co/functions/v1/whatsapp-integration';

        -- Sub-block to ensure we never block the main transaction
        BEGIN
            -- Call the Edge Function asynchronously via pg_net
            PERFORM net.http_post(
                url := v_url,
                body := jsonb_build_object(
                    'action', 'send-message',
                    'companyId', NEW.company_id,
                    'appointmentId', NEW.id,
                    'type', 'appointment_confirmed'
                ),
                headers := jsonb_build_object(
                    'Content-Type', 'application/json',
                    -- Forward the current authorization header if present (RPC/Web requests)
                    'Authorization', 'Bearer ' || COALESCE(current_setting('request.headers', true)::json->>'authorization', '')
                ),
                timeout_milliseconds := 2000
            );
        EXCEPTION WHEN OTHERS THEN
            v_error_msg := SQLERRM;
            -- Record error to logs but allow the main transaction to complete
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
