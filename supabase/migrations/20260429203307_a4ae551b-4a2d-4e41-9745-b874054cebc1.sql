CREATE OR REPLACE FUNCTION public.handle_appointment_review()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
AS $function$
DECLARE
    v_url text;
    v_error_msg text;
BEGIN
    -- Trigger when status changes to 'completed'
    IF (OLD.status IS DISTINCT FROM NEW.status AND NEW.status = 'completed') THEN
        
        -- The direct Supabase Edge Function URL
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
                    'type', 'post_service_review'
                ),
                headers := jsonb_build_object(
                    'Content-Type', 'application/json',
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
                'Review Trigger exception: ' || v_error_msg,
                'trigger_review',
                'automation'
            );
        END;
    END IF;
    RETURN NEW;
END;
$function$;

-- Create trigger
DROP TRIGGER IF EXISTS tr_appointment_review ON public.appointments;
CREATE TRIGGER tr_appointment_review
AFTER UPDATE ON public.appointments
FOR EACH ROW
EXECUTE FUNCTION public.handle_appointment_review();