-- 1. Update process_appointment_cashback to skip if subscription was used
CREATE OR REPLACE FUNCTION public.process_appointment_cashback(p_appointment_id uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
AS $function$
DECLARE
    v_apt RECORD;
    v_promo RECORD;
    v_incentive_promo RECORD;
    v_cashback_amount NUMERIC := 0;
    v_total_generated NUMERIC := 0;
    v_count INTEGER := 0;
    v_net_price NUMERIC;
    v_appointment_date DATE;
    v_expires_at TIMESTAMP WITH TIME ZONE;
    v_service_ids UUID[];
    v_multiplier NUMERIC := 1;
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

    -- NEW: Check if this appointment was covered by a subscription
    IF EXISTS (SELECT 1 FROM public.subscription_usage WHERE appointment_id = p_appointment_id) THEN
        RETURN jsonb_build_object('generated', false, 'reason', 'Covered by subscription');
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

    -- 6. Check for double cashback incentive in the appointment's promotion
    IF v_apt.promotion_id IS NOT NULL THEN
        SELECT * INTO v_incentive_promo FROM public.promotions WHERE id = v_apt.promotion_id;
        IF v_incentive_promo.metadata->'incentive_config'->>'type' = 'double_cashback' THEN
            v_multiplier := COALESCE((v_incentive_promo.metadata->'incentive_config'->>'multiplier')::numeric, 2);
        END IF;
    END IF;

    -- 7. Find and process all active cashback promotions
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

        -- Apply multiplier if applicable
        v_cashback_amount := v_cashback_amount * v_multiplier;

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

    RETURN jsonb_build_object(
        'generated', true, 
        'count', v_count, 
        'total_amount', v_total_generated
    );
END;
$function$;

-- 2. Add trigger to prevent loyalty points generation for appointments with subscription usage
CREATE OR REPLACE FUNCTION public.fn_prevent_loyalty_on_subscription()
RETURNS TRIGGER AS $$
BEGIN
    -- If a loyalty transaction is being inserted for an appointment
    -- check if that appointment was covered by a subscription
    IF NEW.reference_type = 'appointment' AND NEW.reference_id IS NOT NULL THEN
        IF EXISTS (SELECT 1 FROM public.subscription_usage WHERE appointment_id = NEW.reference_id) THEN
            -- Silent skip: don't insert the transaction
            RETURN NULL;
        END IF;
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Check if trigger already exists to avoid errors
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'tr_prevent_loyalty_on_subscription') THEN
        CREATE TRIGGER tr_prevent_loyalty_on_subscription
        BEFORE INSERT ON public.loyalty_points_transactions
        FOR EACH ROW
        EXECUTE FUNCTION public.fn_prevent_loyalty_on_subscription();
    END IF;
END $$;
