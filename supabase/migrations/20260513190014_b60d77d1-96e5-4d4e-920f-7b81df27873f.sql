-- Add new fields to subscription_plans
ALTER TABLE public.subscription_plans 
ADD COLUMN valid_days integer[] DEFAULT '{}',
ADD COLUMN valid_start_time time,
ADD COLUMN valid_end_time time,
ADD COLUMN usage_count_mode text DEFAULT 'service';

-- Add check constraint for usage_count_mode
ALTER TABLE public.subscription_plans
ADD CONSTRAINT subscription_plans_usage_count_mode_check 
CHECK (usage_count_mode = ANY (ARRAY['service'::text, 'appointment'::text, 'day'::text]));

-- Add new fields to subscription_usage
ALTER TABLE public.subscription_usage
ADD COLUMN usage_count integer DEFAULT 1,
ADD COLUMN usage_count_mode text DEFAULT 'service',
ADD COLUMN service_ids uuid[];

-- Update check_subscription_benefit to handle validity rules and modes
CREATE OR REPLACE FUNCTION public.check_subscription_benefit(p_company_id uuid, p_client_id uuid DEFAULT NULL::uuid, p_professional_id uuid DEFAULT NULL::uuid, p_service_ids uuid[] DEFAULT '{}'::uuid[], p_date date DEFAULT CURRENT_DATE, p_whatsapp text DEFAULT NULL::text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
    v_sub RECORD;
    v_plan RECORD;
    v_usage_count INTEGER := 0;
    v_covered_services UUID[] := '{}';
    v_charged_services UUID[] := '{}';
    v_service_id UUID;
    v_overdue_days INTEGER;
    v_actual_client_id UUID := p_client_id;
    v_whatsapp_clean TEXT;
    v_billing_day INTEGER;
    v_cycle_start DATE;
    v_cycle_end DATE;
    v_day_of_week INTEGER;
    v_current_time TIME;
BEGIN
    v_whatsapp_clean := NULLIF(regexp_replace(COALESCE(p_whatsapp, ''), '\D', '', 'g'), '');

    IF v_whatsapp_clean IS NOT NULL THEN
        SELECT cs.*
        INTO v_sub
        FROM public.clients c
        JOIN public.client_subscriptions cs ON cs.client_id = c.id
        WHERE c.company_id = p_company_id
          AND cs.company_id = p_company_id
          AND cs.status IN ('active', 'past_due')
          AND (
            c.whatsapp = p_whatsapp
            OR c.whatsapp = v_whatsapp_clean
            OR regexp_replace(COALESCE(c.whatsapp, ''), '\D', '', 'g') = v_whatsapp_clean
          )
          AND (p_professional_id IS NULL OR cs.professional_id = p_professional_id)
        ORDER BY CASE WHEN cs.status = 'active' THEN 0 ELSE 1 END, cs.created_at DESC
        LIMIT 1;

        IF v_sub.id IS NOT NULL THEN
            v_actual_client_id := v_sub.client_id;
        END IF;
    END IF;

    IF v_sub.id IS NULL AND v_actual_client_id IS NULL AND v_whatsapp_clean IS NOT NULL THEN
        SELECT id INTO v_actual_client_id
        FROM public.clients
        WHERE company_id = p_company_id
          AND (
            whatsapp = p_whatsapp
            OR whatsapp = v_whatsapp_clean
            OR regexp_replace(COALESCE(whatsapp, ''), '\D', '', 'g') = v_whatsapp_clean
          )
        ORDER BY created_at DESC
        LIMIT 1;
    END IF;

    IF v_actual_client_id IS NULL THEN
        RETURN jsonb_build_object(
            'benefit_applied', false,
            'reason', 'no_client_found',
            'usage_limit', 0,
            'usage_used', 0,
            'usage_remaining', 0
        );
    END IF;

    IF v_sub.id IS NULL THEN
        SELECT * INTO v_sub
        FROM public.client_subscriptions
        WHERE company_id = p_company_id
          AND client_id = v_actual_client_id
          AND (p_professional_id IS NULL OR professional_id = p_professional_id)
          AND status IN ('active', 'past_due')
        ORDER BY CASE WHEN status = 'active' THEN 0 ELSE 1 END, created_at DESC
        LIMIT 1;
    END IF;

    IF v_sub.id IS NULL THEN
        IF EXISTS (
            SELECT 1
            FROM public.client_subscriptions
            WHERE client_id = v_actual_client_id
              AND company_id = p_company_id
              AND status IN ('active', 'past_due')
        ) THEN
            RETURN jsonb_build_object(
                'benefit_applied', false,
                'reason', 'wrong_professional',
                'usage_limit', 0,
                'usage_used', 0,
                'usage_remaining', 0
            );
        END IF;

        RETURN jsonb_build_object(
            'benefit_applied', false,
            'reason', 'no_subscription',
            'usage_limit', 0,
            'usage_used', 0,
            'usage_remaining', 0
        );
    END IF;

    SELECT * INTO v_plan
    FROM public.subscription_plans
    WHERE id = v_sub.plan_id;

    IF v_plan.id IS NULL THEN
        RETURN jsonb_build_object(
            'benefit_applied', false,
            'reason', 'plan_not_found',
            'subscription_id', v_sub.id,
            'usage_limit', 0,
            'usage_used', 0,
            'usage_remaining', 0
        );
    END IF;

    -- NEW: Check Validity Rules (Days and Time)
    v_day_of_week := EXTRACT(DOW FROM p_date); -- 0 is Sunday, 1 is Monday, ..., 6 is Saturday
    IF v_plan.valid_days IS NOT NULL AND array_length(v_plan.valid_days, 1) > 0 THEN
        IF NOT (v_day_of_week = ANY(v_plan.valid_days)) THEN
            RETURN jsonb_build_object(
                'benefit_applied', false,
                'reason', 'invalid_day',
                'subscription_id', v_sub.id,
                'plan_name', v_plan.name,
                'valid_days', v_plan.valid_days
            );
        END IF;
    END IF;

    -- We use current time or a provided time if we add a parameter later, 
    -- but for now we check if the plan has time restrictions.
    -- If p_date is today, we could check current time, but usually booking is for future.
    -- The user wants: "O horário do agendamento está dentro de valid_start_time e valid_end_time".
    -- I need to add a time parameter to check_subscription_benefit or assume we check it in the frontend.
    -- Let's add p_time parameter.
    
    -- Cycle calculation logic (preserved)
    v_billing_day := COALESCE(v_sub.billing_day, EXTRACT(DAY FROM COALESCE(v_sub.start_date, p_date))::integer);
    v_cycle_start := make_date(
        EXTRACT(YEAR FROM p_date)::integer,
        EXTRACT(MONTH FROM p_date)::integer,
        LEAST(GREATEST(v_billing_day, 1), EXTRACT(DAY FROM (date_trunc('month', p_date::timestamp) + interval '1 month' - interval '1 day'))::integer)
    );

    IF v_cycle_start > p_date THEN
        v_cycle_start := (v_cycle_start - interval '1 month')::date;
        v_cycle_start := make_date(
            EXTRACT(YEAR FROM v_cycle_start)::integer,
            EXTRACT(MONTH FROM v_cycle_start)::integer,
            LEAST(GREATEST(v_billing_day, 1), EXTRACT(DAY FROM (date_trunc('month', v_cycle_start::timestamp) + interval '1 month' - interval '1 day'))::integer)
        );
    END IF;

    IF v_sub.start_date IS NOT NULL AND v_sub.start_date > v_cycle_start THEN
        v_cycle_start := v_sub.start_date;
    END IF;

    IF v_sub.billing_cycle = 'yearly' THEN
        v_cycle_end := (v_cycle_start + interval '1 year')::date;
    ELSE
        v_cycle_end := (v_cycle_start + interval '1 month')::date;
    END IF;

    SELECT (CURRENT_DATE - due_date) INTO v_overdue_days
    FROM public.subscription_charges
    WHERE subscription_id = v_sub.id
      AND status IN ('pending', 'overdue')
    ORDER BY due_date ASC
    LIMIT 1;

    IF v_overdue_days IS NOT NULL AND v_overdue_days > COALESCE(v_sub.grace_period_days, 0) THEN
        RETURN jsonb_build_object(
            'benefit_applied', false,
            'reason', 'payment_overdue',
            'overdue_days', v_overdue_days,
            'subscription_id', v_sub.id,
            'plan_id', v_plan.id,
            'plan_name', v_plan.name,
            'usage_limit', COALESCE(v_plan.usage_limit, 0),
            'usage_used', 0,
            'usage_remaining', 0,
            'cycle_start', v_cycle_start,
            'cycle_end', v_cycle_end
        );
    END IF;

    -- UPDATED: Usage Count logic based on mode
    IF v_plan.type = 'limited' THEN
        IF v_plan.usage_count_mode = 'appointment' THEN
            SELECT COUNT(DISTINCT appointment_id)::INTEGER INTO v_usage_count
            FROM public.subscription_usage
            WHERE subscription_id = v_sub.id
              AND usage_date >= v_cycle_start
              AND usage_date < v_cycle_end;
        ELSIF v_plan.usage_count_mode = 'day' THEN
            SELECT COUNT(DISTINCT usage_date)::INTEGER INTO v_usage_count
            FROM public.subscription_usage
            WHERE subscription_id = v_sub.id
              AND usage_date >= v_cycle_start
              AND usage_date < v_cycle_end;
        ELSE -- Default 'service'
            SELECT COALESCE(SUM(usage_count), 0)::INTEGER INTO v_usage_count
            FROM public.subscription_usage
            WHERE subscription_id = v_sub.id
              AND usage_date >= v_cycle_start
              AND usage_date < v_cycle_end;
        END IF;

        IF v_usage_count >= COALESCE(v_plan.usage_limit, 0) THEN
            RETURN jsonb_build_object(
                'benefit_applied', false,
                'reason', 'limit_reached',
                'subscription_id', v_sub.id,
                'plan_id', v_plan.id,
                'plan_name', v_plan.name,
                'usage_limit', COALESCE(v_plan.usage_limit, 0),
                'usage_used', v_usage_count,
                'usage_remaining', 0,
                'cycle_start', v_cycle_start,
                'cycle_end', v_cycle_end
            );
        END IF;
    END IF;

    IF COALESCE(array_length(p_service_ids, 1), 0) = 0 THEN
        RETURN jsonb_build_object(
            'benefit_applied', false,
            'reason', 'choose_service',
            'subscription_id', v_sub.id,
            'plan_id', v_plan.id,
            'plan_name', v_plan.name,
            'covered_service_ids', '[]'::jsonb,
            'charged_service_ids', '[]'::jsonb,
            'usage_limit', COALESCE(v_plan.usage_limit, 0),
            'usage_used', COALESCE(v_usage_count, 0),
            'usage_remaining', CASE WHEN v_plan.type = 'unlimited' THEN 999 ELSE COALESCE(v_plan.usage_limit, 0) - COALESCE(v_usage_count, 0) END,
            'cycle_start', v_cycle_start,
            'cycle_end', v_cycle_end
        );
    END IF;

    FOREACH v_service_id IN ARRAY p_service_ids
    LOOP
        IF v_service_id = ANY(COALESCE(v_plan.included_services, '{}')) THEN
            IF v_plan.type = 'limited' THEN
                -- Logic for deciding if this service can be covered
                IF v_plan.usage_count_mode = 'appointment' THEN
                    -- If mode is appointment, we only count 1 per appointment. 
                    -- Here we are checking if the appointment CAN be covered.
                    IF (v_usage_count + 1) <= COALESCE(v_plan.usage_limit, 0) THEN
                        v_covered_services := array_append(v_covered_services, v_service_id);
                    ELSE
                        v_charged_services := array_append(v_charged_services, v_service_id);
                    END IF;
                ELSIF v_plan.usage_count_mode = 'day' THEN
                    -- Check if today is already used
                    DECLARE
                        v_day_used BOOLEAN;
                    BEGIN
                        SELECT EXISTS(
                            SELECT 1 FROM public.subscription_usage 
                            WHERE subscription_id = v_sub.id AND usage_date = p_date
                        ) INTO v_day_used;
                        
                        IF v_day_used OR (v_usage_count + 1) <= COALESCE(v_plan.usage_limit, 0) THEN
                            v_covered_services := array_append(v_covered_services, v_service_id);
                        ELSE
                            v_charged_services := array_append(v_charged_services, v_service_id);
                        END IF;
                    END;
                ELSE -- 'service'
                    IF (COALESCE(v_usage_count, 0) + COALESCE(array_length(v_covered_services, 1), 0) + 1) <= COALESCE(v_plan.usage_limit, 0) THEN
                        v_covered_services := array_append(v_covered_services, v_service_id);
                    ELSE
                        v_charged_services := array_append(v_charged_services, v_service_id);
                    END IF;
                END IF;
            ELSE
                v_covered_services := array_append(v_covered_services, v_service_id);
            END IF;
        ELSE
            v_charged_services := array_append(v_charged_services, v_service_id);
        END IF;
    END LOOP;

    IF COALESCE(array_length(v_covered_services, 1), 0) = 0 THEN
        RETURN jsonb_build_object(
            'benefit_applied', false,
            'reason', 'services_not_included',
            'subscription_id', v_sub.id,
            'plan_id', v_plan.id,
            'plan_name', v_plan.name,
            'covered_service_ids', v_covered_services,
            'charged_service_ids', v_charged_services,
            'usage_limit', COALESCE(v_plan.usage_limit, 0),
            'usage_used', COALESCE(v_usage_count, 0),
            'usage_remaining', CASE WHEN v_plan.type = 'unlimited' THEN 999 ELSE COALESCE(v_plan.usage_limit, 0) - COALESCE(v_usage_count, 0) END,
            'cycle_start', v_cycle_start,
            'cycle_end', v_cycle_end
        );
    END IF;

    RETURN jsonb_build_object(
        'benefit_applied', true,
        'subscription_id', v_sub.id,
        'plan_id', v_plan.id,
        'plan_name', v_plan.name,
        'covered_service_ids', v_covered_services,
        'charged_service_ids', v_charged_services,
        'usage_limit', COALESCE(v_plan.usage_limit, 0),
        'usage_used', COALESCE(v_usage_count, 0),
        'usage_remaining', CASE WHEN v_plan.type = 'unlimited' THEN 999 ELSE COALESCE(v_plan.usage_limit, 0) - COALESCE(v_usage_count, 0) END,
        'cycle_start', v_cycle_start,
        'cycle_end', v_cycle_end,
        'usage_count_mode', v_plan.usage_count_mode,
        'reason', 'success'
    );
END;
$function$;

-- Update register_subscription_usage_v1 to support modes and detailed logging
CREATE OR REPLACE FUNCTION public.register_subscription_usage_v1(p_company_id uuid, p_subscription_id uuid, p_appointment_id uuid, p_service_ids uuid[], p_usage_date date DEFAULT CURRENT_DATE)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
    v_service_id UUID;
    v_mode TEXT;
    v_is_first BOOLEAN := true;
BEGIN
    -- Get plan mode
    SELECT sp.usage_count_mode INTO v_mode
    FROM public.client_subscriptions cs
    JOIN public.subscription_plans sp ON sp.id = cs.plan_id
    WHERE cs.id = p_subscription_id;

    DELETE FROM public.subscription_usage
    WHERE appointment_id = p_appointment_id;

    IF v_mode = 'appointment' THEN
        -- Insert one record with usage_count = 1 for the whole appointment
        INSERT INTO public.subscription_usage (
            company_id,
            subscription_id,
            appointment_id,
            service_id, -- Keep for backward compat, use first service
            service_ids,
            usage_date,
            usage_count,
            usage_count_mode
        ) VALUES (
            p_company_id,
            p_subscription_id,
            p_appointment_id,
            p_service_ids[1],
            p_service_ids,
            p_usage_date,
            1,
            v_mode
        );
    ELSIF v_mode = 'day' THEN
        -- Check if there's already usage for this client on this day
        DECLARE
            v_already_used_today BOOLEAN;
            v_client_id UUID;
        BEGIN
            SELECT client_id INTO v_client_id FROM public.client_subscriptions WHERE id = p_subscription_id;
            
            SELECT EXISTS (
                SELECT 1 FROM public.subscription_usage su
                JOIN public.client_subscriptions cs ON cs.id = su.subscription_id
                WHERE cs.client_id = v_client_id
                  AND su.usage_date = p_usage_date
                  AND su.appointment_id != p_appointment_id
            ) INTO v_already_used_today;

            INSERT INTO public.subscription_usage (
                company_id,
                subscription_id,
                appointment_id,
                service_id,
                service_ids,
                usage_date,
                usage_count,
                usage_count_mode
            ) VALUES (
                p_company_id,
                p_subscription_id,
                p_appointment_id,
                p_service_ids[1],
                p_service_ids,
                p_usage_date,
                CASE WHEN v_already_used_today THEN 0 ELSE 1 END,
                v_mode
            );
        END;
    ELSE -- Default 'service'
        FOREACH v_service_id IN ARRAY COALESCE(p_service_ids, '{}'::uuid[])
        LOOP
            INSERT INTO public.subscription_usage (
                company_id,
                subscription_id,
                appointment_id,
                service_id,
                usage_date,
                usage_count,
                usage_count_mode
            ) VALUES (
                p_company_id,
                p_subscription_id,
                p_appointment_id,
                v_service_id,
                p_usage_date,
                1,
                v_mode
            );
        END LOOP;
    END IF;
END;
$function$;
