-- Ensure cashback_transactions has a unique constraint on reference_id for credits to prevent duplication
-- Using a partial index to allow multiple debits but only one credit per reference (appointment)
CREATE UNIQUE INDEX IF NOT EXISTS idx_cashback_transactions_unique_credit 
ON public.cashback_transactions (reference_id) 
WHERE (type = 'credit');

-- Update the sync function to be SECURITY DEFINER and handle user_id
CREATE OR REPLACE FUNCTION public.handle_cashback_transaction_sync()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
    v_reference_id UUID;
    v_description TEXT;
    v_user_id UUID;
BEGIN
    -- Get user_id from client if not present in NEW
    v_user_id := COALESCE(NEW.user_id, (SELECT user_id FROM public.clients WHERE id = NEW.client_id));

    -- For credits (INSERT)
    IF (TG_OP = 'INSERT') THEN
        v_reference_id := COALESCE(NEW.appointment_id, NEW.id);
        v_description := 'Cashback ganho' || CASE WHEN NEW.appointment_id IS NOT NULL THEN ' no agendamento #' || substring(NEW.appointment_id::text from 1 for 8) ELSE '' END;
        
        -- Prevent duplicate using the unique index we created above
        BEGIN
            INSERT INTO public.cashback_transactions (company_id, client_id, user_id, amount, type, reference_id, description, created_at)
            VALUES (NEW.company_id, NEW.client_id, v_user_id, NEW.amount, 'credit', v_reference_id, v_description, NEW.created_at);
        EXCEPTION WHEN unique_violation THEN
            -- Silent skip if duplicate
            NULL;
        END;
    END IF;

    -- For usage, expiration or REVERSAL (UPDATE)
    IF (TG_OP = 'UPDATE') THEN
        -- Check if it was used (DEBIT)
        IF (OLD.used_at IS NULL AND NEW.used_at IS NOT NULL) THEN
            v_reference_id := COALESCE(NEW.used_appointment_id, NEW.id);
            v_description := 'Cashback utilizado' || CASE WHEN NEW.used_appointment_id IS NOT NULL THEN ' no agendamento #' || substring(NEW.used_appointment_id::text from 1 for 8) ELSE '' END;

            INSERT INTO public.cashback_transactions (company_id, client_id, user_id, amount, type, reference_id, description, created_at)
            VALUES (NEW.company_id, NEW.client_id, v_user_id, NEW.amount, 'debit', v_reference_id, v_description, NEW.used_at)
            ON CONFLICT DO NOTHING;
        END IF;

        -- Check if it was reversed (CREDIT/ESTORNO)
        IF (OLD.used_at IS NOT NULL AND NEW.used_at IS NULL AND NEW.status = 'active') THEN
            v_reference_id := COALESCE(OLD.used_appointment_id, OLD.id);
            v_description := 'Estorno por cancelamento' || CASE WHEN OLD.used_appointment_id IS NOT NULL THEN ' do agendamento #' || substring(OLD.used_appointment_id::text from 1 for 8) ELSE '' END;

            INSERT INTO public.cashback_transactions (company_id, client_id, user_id, amount, type, reference_id, description, created_at)
            VALUES (NEW.company_id, NEW.client_id, v_user_id, NEW.amount, 'credit', v_reference_id, v_description, NOW())
            ON CONFLICT DO NOTHING;
        END IF;

        -- Check if it expired
        IF (OLD.status != 'expired' AND NEW.status = 'expired') THEN
            INSERT INTO public.cashback_transactions (company_id, client_id, user_id, amount, type, reference_id, description, created_at)
            VALUES (NEW.company_id, NEW.client_id, v_user_id, NEW.amount, 'expire', NEW.id, 'Cashback expirado', NOW())
            ON CONFLICT DO NOTHING;
        END IF;
    END IF;

    RETURN NEW;
END;
$function$;

-- Main Transactional Function for Cashback
CREATE OR REPLACE FUNCTION public.process_appointment_cashback(p_appointment_id UUID)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_apt RECORD;
    v_promo RECORD;
    v_cashback_amount NUMERIC := 0;
    v_total_generated NUMERIC := 0;
    v_count INTEGER := 0;
    v_net_price NUMERIC;
    v_appointment_date DATE;
    v_expires_at TIMESTAMP WITH TIME ZONE;
    v_service_ids UUID[];
BEGIN
    -- 1. Fetch appointment details
    SELECT a.*, c.user_id as client_user_id
    INTO v_apt
    FROM public.appointments a
    LEFT JOIN public.clients c ON a.client_id = c.id
    WHERE a.id = p_appointment_id;

    IF NOT FOUND THEN
        RETURN jsonb_build_object('generated', false, 'error', 'Appointment not found');
    END IF;

    -- 2. Check if already processed
    IF EXISTS (SELECT 1 FROM public.client_cashback WHERE appointment_id = p_appointment_id) THEN
        RETURN jsonb_build_object('generated', false, 'reason', 'Already processed');
    END IF;

    -- 3. Check status
    IF v_apt.status != 'completed' THEN
        RETURN jsonb_build_object('generated', false, 'reason', 'Appointment not completed');
    END IF;

    -- 4. Calculate net price (after discounts)
    v_net_price := COALESCE(v_apt.final_price, v_apt.total_price, 0);
    v_appointment_date := (v_apt.start_time AT TIME ZONE 'UTC')::date;

    -- 5. Get service IDs for this appointment
    SELECT array_agg(service_id) INTO v_service_ids
    FROM public.appointment_services
    WHERE appointment_id = p_appointment_id;

    -- 6. Find and process all active cashback promotions
    FOR v_promo IN (
        SELECT * FROM public.promotions
        WHERE company_id = v_apt.company_id
          AND promotion_type = 'cashback'
          AND status = 'active'
          AND start_date <= v_appointment_date
          AND end_date >= v_appointment_date
    ) LOOP
        -- Check professional eligibility
        IF v_promo.professional_filter = 'specific' AND v_promo.professional_ids IS NOT NULL THEN
            IF NOT (v_apt.professional_id = ANY(v_promo.professional_ids)) THEN
                CONTINUE;
            END IF;
        END IF;

        -- Check service eligibility
        IF v_promo.service_ids IS NOT NULL AND array_length(v_promo.service_ids, 1) > 0 THEN
            IF NOT (v_service_ids && v_promo.service_ids) THEN
                CONTINUE;
            END IF;
        ELSIF v_promo.service_id IS NOT NULL THEN
            IF NOT (v_promo.service_id = ANY(v_service_ids)) THEN
                CONTINUE;
            END IF;
        END IF;

        -- Calculate amount
        IF v_promo.discount_type = 'percentage' THEN
            v_cashback_amount := v_net_price * COALESCE(v_promo.discount_value, 0) / 100.0;
        ELSE
            v_cashback_amount := COALESCE(v_promo.discount_value, 0);
        END IF;

        IF v_cashback_amount > 0 THEN
            -- Check cumulative
            IF NOT COALESCE(v_promo.cashback_cumulative, true) THEN
                IF EXISTS (
                    SELECT 1 FROM public.client_cashback 
                    WHERE client_id = v_apt.client_id 
                      AND promotion_id = v_promo.id 
                      AND status = 'active'
                ) THEN
                    CONTINUE;
                END IF;
            END IF;

            v_expires_at := NOW() + (COALESCE(v_promo.cashback_validity_days, 30) || ' days')::interval;

            -- Insert into client_cashback
            INSERT INTO public.client_cashback (
                client_id, company_id, promotion_id, appointment_id, 
                amount, status, expires_at, user_id
            ) VALUES (
                v_apt.client_id, v_apt.company_id, v_promo.id, v_apt.id,
                v_cashback_amount, 'active', v_expires_at, v_apt.client_user_id
            );

            v_total_generated := v_total_generated + v_cashback_amount;
            v_count := v_count + 1;
        END IF;
    END LOOP;

    IF v_count > 0 THEN
        RETURN jsonb_build_object(
            'generated', true, 
            'amount', v_total_generated, 
            'promotions_count', v_count,
            'client_id', v_apt.client_id
        );
    ELSE
        RETURN jsonb_build_object('generated', false, 'reason', 'No eligible promotions');
    END IF;
END;
$$;
