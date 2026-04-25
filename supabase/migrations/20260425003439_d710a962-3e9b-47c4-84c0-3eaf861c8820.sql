CREATE OR REPLACE FUNCTION public.handle_cashback_transaction_sync()
RETURNS TRIGGER AS $$
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

    -- For usage or expiration (UPDATE)
    IF (TG_OP = 'UPDATE') THEN
        -- Check if it was used
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
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;
