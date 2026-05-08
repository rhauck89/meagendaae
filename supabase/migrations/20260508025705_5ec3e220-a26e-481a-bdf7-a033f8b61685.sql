-- Drop old versions of the function
DROP FUNCTION IF EXISTS public.check_subscription_benefit(uuid, uuid, uuid, uuid[], date);
DROP FUNCTION IF EXISTS public.check_subscription_benefit(uuid, uuid, uuid, uuid[], date, text);

-- Recreate with updated logic
CREATE OR REPLACE FUNCTION public.check_subscription_benefit(
    p_company_id uuid,
    p_client_id uuid default null,
    p_professional_id uuid default null,
    p_service_ids uuid[] default '{}',
    p_date date default current_date,
    p_whatsapp text default null
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
DECLARE
    v_sub RECORD;
    v_plan RECORD;
    v_usage_count INTEGER;
    v_covered_services UUID[] := '{}';
    v_charged_services UUID[] := '{}';
    v_service_id UUID;
    v_overdue_days INTEGER;
    v_actual_client_id UUID := p_client_id;
    v_whatsapp_clean TEXT;
    v_result JSONB;
BEGIN
    -- 1. Identify client by WhatsApp if ID is not provided
    IF v_actual_client_id IS NULL AND p_whatsapp IS NOT NULL AND p_whatsapp <> '' THEN
        v_whatsapp_clean := regexp_replace(p_whatsapp, '\D', '', 'g');
        
        -- Priority: Find client with active/past_due subscription for this professional/company
        SELECT c.id INTO v_actual_client_id 
        FROM public.clients c
        LEFT JOIN public.client_subscriptions cs ON c.id = cs.client_id 
            AND cs.company_id = p_company_id 
            AND cs.status IN ('active', 'past_due')
            AND (cs.professional_id = p_professional_id OR cs.professional_id IS NULL)
        WHERE c.company_id = p_company_id 
          AND (
            c.whatsapp = p_whatsapp 
            OR c.whatsapp = v_whatsapp_clean 
            OR regexp_replace(c.whatsapp, '\D', '', 'g') = v_whatsapp_clean
          )
        ORDER BY (cs.id IS NOT NULL) DESC, cs.created_at DESC
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

    -- 2. Fetch subscription
    SELECT * INTO v_sub 
    FROM public.client_subscriptions 
    WHERE company_id = p_company_id 
      AND client_id = v_actual_client_id 
      AND (professional_id = p_professional_id OR professional_id IS NULL)
      AND status IN ('active', 'past_due')
    ORDER BY (professional_id = p_professional_id) DESC, created_at DESC
    LIMIT 1;

    IF v_sub.id IS NULL THEN
        RETURN jsonb_build_object(
            'benefit_applied', false, 
            'reason', 'no_subscription',
            'usage_limit', 0,
            'usage_used', 0,
            'usage_remaining', 0
        );
    END IF;

    -- 3. Fetch plan
    SELECT * INTO v_plan FROM public.subscription_plans WHERE id = v_sub.plan_id;

    -- 4. Calculate current usage
    SELECT COUNT(*)::INTEGER INTO v_usage_count
    FROM public.subscription_usage
    WHERE subscription_id = v_sub.id
      AND usage_date >= date_trunc('month', p_date::timestamp)::date
      AND usage_date <= (date_trunc('month', p_date::timestamp) + interval '1 month' - interval '1 day')::date;

    -- 5. Prepare base response object
    v_result := jsonb_build_object(
        'subscription_id', v_sub.id,
        'plan_id', v_plan.id,
        'plan_name', v_plan.name,
        'usage_limit', COALESCE(v_plan.usage_limit, 0),
        'usage_used', v_usage_count,
        'usage_remaining', GREATEST(0, COALESCE(v_plan.usage_limit, 0) - v_usage_count)
    );

    -- 6. Check payments
    SELECT (CURRENT_DATE - due_date) INTO v_overdue_days
    FROM public.subscription_charges
    WHERE subscription_id = v_sub.id
      AND status IN ('pending', 'overdue')
    ORDER BY due_date ASC
    LIMIT 1;

    IF v_overdue_days IS NOT NULL AND v_overdue_days > COALESCE(v_sub.grace_period_days, 0) THEN
        RETURN v_result || jsonb_build_object(
            'benefit_applied', false, 
            'reason', 'payment_overdue', 
            'overdue_days', v_overdue_days
        );
    END IF;

    -- 7. Logic for "choose_service"
    IF p_service_ids IS NULL OR array_length(p_service_ids, 1) IS NULL THEN
        RETURN v_result || jsonb_build_object(
            'benefit_applied', false,
            'reason', 'choose_service',
            'covered_service_ids', '[]'::jsonb,
            'charged_service_ids', '[]'::jsonb
        );
    END IF;

    -- 8. Filter covered services
    FOREACH v_service_id IN ARRAY p_service_ids
    LOOP
        IF v_service_id = ANY(v_plan.included_services) THEN
            IF v_plan.type = 'unlimited' THEN
                v_covered_services := array_append(v_covered_services, v_service_id);
            ELSE
                -- Limited plan: Check if usage allows more
                IF (v_usage_count + COALESCE(array_length(v_covered_services, 1), 0)) < v_plan.usage_limit THEN
                    v_covered_services := array_append(v_covered_services, v_service_id);
                ELSE
                    v_charged_services := array_append(v_charged_services, v_service_id);
                END IF;
            END IF;
        ELSE
            v_charged_services := array_append(v_charged_services, v_service_id);
        END IF;
    END LOOP;

    -- 9. Final result
    IF COALESCE(array_length(v_covered_services, 1), 0) > 0 THEN
        RETURN v_result || jsonb_build_object(
            'benefit_applied', true,
            'covered_service_ids', to_jsonb(v_covered_services),
            'charged_service_ids', to_jsonb(v_charged_services)
        );
    ELSE
        RETURN v_result || jsonb_build_object(
            'benefit_applied', false,
            'reason', 'services_not_included',
            'covered_service_ids', '[]'::jsonb,
            'charged_service_ids', to_jsonb(v_charged_services)
        );
    END IF;
END;
$$;

GRANT EXECUTE ON FUNCTION public.check_subscription_benefit(uuid, uuid, uuid, uuid[], date, text) TO anon, authenticated;
