-- Update the cashback transaction sync function to handle reversals
CREATE OR REPLACE FUNCTION public.handle_cashback_transaction_sync()
 RETURNS trigger
 LANGUAGE plpgsql
AS $function$
DECLARE
    v_reference_id UUID;
    v_description TEXT;
BEGIN
    -- For credits (INSERT)
    IF (TG_OP = 'INSERT') THEN
        v_reference_id := COALESCE(NEW.appointment_id, NEW.id);
        v_description := 'Cashback ganho' || CASE WHEN NEW.appointment_id IS NOT NULL THEN ' no agendamento #' || substring(NEW.appointment_id::text from 1 for 8) ELSE '' END;
        
        -- Prevent duplicate if already inserted manually by frontend (transition period)
        IF NOT EXISTS (
            SELECT 1 FROM public.cashback_transactions 
            WHERE client_id = NEW.client_id 
              AND amount = NEW.amount 
              AND type = 'credit' 
              AND (reference_id = v_reference_id OR reference_id = NEW.id)
        ) THEN
            INSERT INTO public.cashback_transactions (company_id, client_id, amount, type, reference_id, description, created_at)
            VALUES (NEW.company_id, NEW.client_id, NEW.amount, 'credit', v_reference_id, v_description, NEW.created_at);
        END IF;
    END IF;

    -- For usage, expiration or REVERSAL (UPDATE)
    IF (TG_OP = 'UPDATE') THEN
        -- Check if it was used (DEBIT)
        IF (OLD.used_at IS NULL AND NEW.used_at IS NOT NULL) THEN
            v_reference_id := COALESCE(NEW.used_appointment_id, NEW.id);
            v_description := 'Cashback utilizado' || CASE WHEN NEW.used_appointment_id IS NOT NULL THEN ' no agendamento #' || substring(NEW.used_appointment_id::text from 1 for 8) ELSE '' END;

            IF NOT EXISTS (
                SELECT 1 FROM public.cashback_transactions 
                WHERE client_id = NEW.client_id 
                  AND type = 'debit' 
                  AND (reference_id = v_reference_id OR reference_id = NEW.id)
            ) THEN
                INSERT INTO public.cashback_transactions (company_id, client_id, amount, type, reference_id, description, created_at)
                VALUES (NEW.company_id, NEW.client_id, NEW.amount, 'debit', v_reference_id, v_description, NEW.used_at);
            END IF;
        END IF;

        -- Check if it was reversed (CREDIT/ESTORNO)
        -- Logic: used_at transitions from NOT NULL to NULL and status becomes active
        IF (OLD.used_at IS NOT NULL AND NEW.used_at IS NULL AND NEW.status = 'active') THEN
            v_reference_id := COALESCE(OLD.used_appointment_id, OLD.id);
            v_description := 'Estorno por cancelamento' || CASE WHEN OLD.used_appointment_id IS NOT NULL THEN ' do agendamento #' || substring(OLD.used_appointment_id::text from 1 for 8) ELSE '' END;

            -- Prevent duplicate reversal log for the same reference
            IF NOT EXISTS (
                SELECT 1 FROM public.cashback_transactions 
                WHERE client_id = NEW.client_id 
                  AND type = 'credit' 
                  AND reference_id = v_reference_id
                  AND (description LIKE 'Estorno%' OR description LIKE '%cancelamento%')
            ) THEN
                INSERT INTO public.cashback_transactions (company_id, client_id, amount, type, reference_id, description, created_at)
                VALUES (NEW.company_id, NEW.client_id, NEW.amount, 'credit', v_reference_id, v_description, NOW());
            END IF;
        END IF;

        -- Check if it expired
        IF (OLD.status != 'expired' AND NEW.status = 'expired') THEN
            IF NOT EXISTS (
                SELECT 1 FROM public.cashback_transactions 
                WHERE client_id = NEW.client_id 
                  AND type = 'expire' 
                  AND reference_id = NEW.id
            ) THEN
                INSERT INTO public.cashback_transactions (company_id, client_id, amount, type, reference_id, description, created_at)
                VALUES (NEW.company_id, NEW.client_id, NEW.amount, 'expire', NEW.id, 'Cashback expirado', NOW());
            END IF;
        END IF;
    END IF;

    RETURN NEW;
END;
$function$;

-- Create function to handle appointment cancellation and revert cashback
CREATE OR REPLACE FUNCTION public.handle_appointment_cancellation_cashback()
 RETURNS trigger
 LANGUAGE plpgsql
AS $function$
BEGIN
    -- If appointment is cancelled or no_show and it wasn't completed before
    IF (NEW.status = 'cancelled' OR NEW.status = 'no_show') 
       AND (OLD.status IS DISTINCT FROM NEW.status) 
       AND (OLD.status != 'completed') THEN
        
        -- Revert any cashback used for this appointment
        -- This update will trigger handle_cashback_transaction_sync to log the credit
        UPDATE public.client_cashback
        SET status = 'active',
            used_at = NULL,
            used_appointment_id = NULL
        WHERE used_appointment_id = NEW.id
          AND status = 'used';
    END IF;
    RETURN NEW;
END;
$function$;

-- Create the trigger on appointments table
DROP TRIGGER IF EXISTS trg_handle_appointment_cancellation_cashback ON public.appointments;
CREATE TRIGGER trg_handle_appointment_cancellation_cashback
AFTER UPDATE ON public.appointments
FOR EACH ROW
EXECUTE FUNCTION public.handle_appointment_cancellation_cashback();
