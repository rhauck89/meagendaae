-- Keep process_appointment_cashback response compatible with the dashboard UI.
-- The app historically read `amount`, while the RPC returned `total_amount`.
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
    SELECT a.*, c.user_id as client_user_id
    INTO v_apt
    FROM public.appointments a
    LEFT JOIN public.clients c ON a.client_id = c.id
    WHERE a.id = p_appointment_id;

    IF NOT FOUND THEN
        RETURN jsonb_build_object('generated', false, 'error', 'Appointment not found');
    END IF;

    IF EXISTS (SELECT 1 FROM public.subscription_usage WHERE appointment_id = p_appointment_id) THEN
        RETURN jsonb_build_object('generated', false, 'reason', 'Covered by subscription');
    END IF;

    IF EXISTS (SELECT 1 FROM public.client_cashback WHERE appointment_id = p_appointment_id) THEN
        RETURN jsonb_build_object('generated', false, 'reason', 'Already processed');
    END IF;

    IF v_apt.status != 'completed' THEN
        RETURN jsonb_build_object('generated', false, 'reason', 'Appointment not completed');
    END IF;

    v_net_price := COALESCE(v_apt.final_price, v_apt.total_price, 0);
    v_appointment_date := (v_apt.start_time AT TIME ZONE 'UTC')::date;

    SELECT array_agg(service_id) INTO v_service_ids
    FROM public.appointment_services
    WHERE appointment_id = p_appointment_id;

    IF v_apt.promotion_id IS NOT NULL THEN
        SELECT * INTO v_incentive_promo FROM public.promotions WHERE id = v_apt.promotion_id;
        IF v_incentive_promo.metadata->'incentive_config'->>'type' = 'double_cashback' THEN
            v_multiplier := COALESCE((v_incentive_promo.metadata->'incentive_config'->>'multiplier')::numeric, 2);
        END IF;
    END IF;

    FOR v_promo IN (
        SELECT * FROM public.promotions
        WHERE company_id = v_apt.company_id
          AND promotion_type = 'cashback'
          AND status = 'active'
          AND start_date <= v_appointment_date
          AND end_date >= v_appointment_date
    ) LOOP
        IF v_promo.professional_filter = 'specific' AND v_promo.professional_ids IS NOT NULL THEN
            IF NOT (v_apt.professional_id = ANY(v_promo.professional_ids)) THEN
                CONTINUE;
            END IF;
        END IF;

        IF v_promo.service_ids IS NOT NULL AND array_length(v_promo.service_ids, 1) > 0 THEN
            IF NOT (v_service_ids && v_promo.service_ids) THEN
                CONTINUE;
            END IF;
        ELSIF v_promo.service_id IS NOT NULL THEN
            IF NOT (v_promo.service_id = ANY(v_service_ids)) THEN
                CONTINUE;
            END IF;
        END IF;

        IF v_promo.discount_type = 'percentage' THEN
            v_cashback_amount := v_net_price * COALESCE(v_promo.discount_value, 0) / 100.0;
        ELSE
            v_cashback_amount := COALESCE(v_promo.discount_value, 0);
        END IF;

        v_cashback_amount := v_cashback_amount * v_multiplier;

        IF v_cashback_amount > 0 THEN
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
        'generated', v_count > 0,
        'count', v_count,
        'amount', v_total_generated,
        'total_amount', v_total_generated
    );
END;
$function$;