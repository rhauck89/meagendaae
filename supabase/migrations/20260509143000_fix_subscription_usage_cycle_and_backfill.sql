-- Keep subscription usage aligned with the real billing cycle and repair
-- already-created appointments that were covered by a subscription but did
-- not receive subscription_usage rows.

CREATE UNIQUE INDEX IF NOT EXISTS idx_subscription_usage_unique_appointment_service
ON public.subscription_usage(appointment_id, service_id, subscription_id);

CREATE OR REPLACE FUNCTION public.register_subscription_usage_v1(
    p_company_id UUID,
    p_subscription_id UUID,
    p_appointment_id UUID,
    p_service_ids UUID[],
    p_usage_date DATE DEFAULT CURRENT_DATE
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_service_id UUID;
BEGIN
    DELETE FROM public.subscription_usage
    WHERE appointment_id = p_appointment_id;

    FOREACH v_service_id IN ARRAY COALESCE(p_service_ids, '{}'::uuid[])
    LOOP
        INSERT INTO public.subscription_usage (
            company_id,
            subscription_id,
            appointment_id,
            service_id,
            usage_date
        ) VALUES (
            p_company_id,
            p_subscription_id,
            p_appointment_id,
            v_service_id,
            p_usage_date
        )
        ON CONFLICT (appointment_id, service_id, subscription_id)
        DO UPDATE SET usage_date = EXCLUDED.usage_date;
    END LOOP;
END;
$$;

CREATE OR REPLACE FUNCTION public.check_subscription_benefit(
    p_company_id uuid,
    p_client_id uuid DEFAULT NULL,
    p_professional_id uuid DEFAULT NULL,
    p_service_ids uuid[] DEFAULT '{}',
    p_date date DEFAULT CURRENT_DATE,
    p_whatsapp text DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
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

    IF v_plan.type = 'limited' THEN
        SELECT COUNT(*)::INTEGER INTO v_usage_count
        FROM public.subscription_usage
        WHERE subscription_id = v_sub.id
          AND usage_date >= v_cycle_start
          AND usage_date < v_cycle_end;

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
                IF (COALESCE(v_usage_count, 0) + COALESCE(array_length(v_covered_services, 1), 0) + 1) <= COALESCE(v_plan.usage_limit, 0) THEN
                    v_covered_services := array_append(v_covered_services, v_service_id);
                ELSE
                    v_charged_services := array_append(v_charged_services, v_service_id);
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
        'reason', 'success'
    );
END;
$$;

GRANT EXECUTE ON FUNCTION public.check_subscription_benefit(uuid, uuid, uuid, uuid[], date, text) TO anon, authenticated;

INSERT INTO public.subscription_usage (
    company_id,
    subscription_id,
    appointment_id,
    service_id,
    usage_date
)
SELECT
    a.company_id,
    cs.id,
    a.id,
    aps.service_id,
    (a.start_time AT TIME ZONE 'America/Sao_Paulo')::date
FROM public.appointments a
JOIN public.appointment_services aps ON aps.appointment_id = a.id
JOIN public.client_subscriptions cs
  ON cs.company_id = a.company_id
 AND cs.client_id = a.client_id
 AND cs.professional_id = a.professional_id
JOIN public.subscription_plans sp ON sp.id = cs.plan_id
WHERE a.status IN ('pending', 'confirmed', 'completed')
  AND COALESCE(a.notes, '') ILIKE '%assinatura%'
  AND aps.service_id = ANY(COALESCE(sp.included_services, '{}'::uuid[]))
  AND NOT EXISTS (
    SELECT 1
    FROM public.subscription_usage su
    WHERE su.appointment_id = a.id
      AND su.service_id = aps.service_id
      AND su.subscription_id = cs.id
  );
