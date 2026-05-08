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
AS $function$
DECLARE
    v_sub RECORD;
    v_plan RECORD;
    v_usage_count INTEGER;
    v_covered_services UUID[] := '{}';
    v_charged_services UUID[] := '{}';
    v_reason TEXT := 'no_subscription';
    v_is_valid BOOLEAN := FALSE;
    v_service_id UUID;
    v_overdue_days INTEGER;
    v_has_pending_charge BOOLEAN;
    v_actual_client_id UUID := p_client_id;
BEGIN
    -- 1. Se client_id for nulo mas whatsapp foi fornecido, tentar encontrar o cliente
    IF v_actual_client_id IS NULL AND p_whatsapp IS NOT NULL AND p_whatsapp <> '' THEN
        SELECT id INTO v_actual_client_id 
        FROM public.clients 
        WHERE company_id = p_company_id 
          AND whatsapp = p_whatsapp
        LIMIT 1;
    END IF;

    IF v_actual_client_id IS NULL THEN
        RETURN jsonb_build_object('applied', false, 'reason', 'no_client_found');
    END IF;

    -- 2. Buscar assinatura ativa/pendente do cliente para esta empresa e profissional
    -- A regra crítica: profissional deve ser o mesmo
    SELECT * INTO v_sub 
    FROM public.client_subscriptions 
    WHERE company_id = p_company_id 
      AND client_id = v_actual_client_id 
      AND professional_id = p_professional_id
      AND status IN ('active', 'past_due')
    LIMIT 1;

    IF v_sub.id IS NULL THEN
        -- Verificar se tem assinatura mas com outro profissional
        IF EXISTS (SELECT 1 FROM public.client_subscriptions WHERE client_id = v_actual_client_id AND company_id = p_company_id AND status IN ('active', 'past_due')) THEN
            RETURN jsonb_build_object('applied', false, 'reason', 'wrong_professional');
        END IF;
        RETURN jsonb_build_object('applied', false, 'reason', 'no_subscription');
    END IF;

    -- 3. Verificar status financeiro e tolerância
    -- Buscar cobrança mais antiga não paga
    SELECT (CURRENT_DATE - due_date) INTO v_overdue_days
    FROM public.subscription_charges
    WHERE subscription_id = v_sub.id
      AND status IN ('pending', 'overdue')
    ORDER BY due_date ASC
    LIMIT 1;

    IF v_overdue_days IS NOT NULL AND v_overdue_days > COALESCE(v_sub.grace_period_days, 0) THEN
        RETURN jsonb_build_object('applied', false, 'reason', 'payment_overdue', 'overdue_days', v_overdue_days);
    END IF;

    -- 4. Buscar detalhes do plano
    SELECT * INTO v_plan FROM public.subscription_plans WHERE id = v_sub.plan_id;

    -- 5. Verificar uso no ciclo atual (mês vigente)
    IF v_plan.type = 'limited' THEN
        SELECT COUNT(*)::INTEGER INTO v_usage_count
        FROM public.subscription_usage
        WHERE subscription_id = v_sub.id
          AND usage_date >= date_trunc('month', p_date::timestamp)::date
          AND usage_date <= (date_trunc('month', p_date::timestamp) + interval '1 month' - interval '1 day')::date;
        
        IF v_usage_count >= v_plan.usage_limit THEN
            RETURN jsonb_build_object('applied', false, 'reason', 'limit_reached', 'limit', v_plan.usage_limit, 'used', v_usage_count);
        END IF;
    END IF;

    -- 6. Filtrar serviços cobertos
    FOREACH v_service_id IN ARRAY p_service_ids
    LOOP
        IF v_service_id = ANY(v_plan.included_services) THEN
            -- Se for limitado, cada serviço conta como um uso. Validar se ainda há saldo para este serviço específico
            IF v_plan.type = 'limited' THEN
                IF (v_usage_count + array_length(v_covered_services, 1) + 1) <= v_plan.usage_limit THEN
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

    IF array_length(v_covered_services, 1) IS NULL THEN
        RETURN jsonb_build_object('applied', false, 'reason', 'services_not_included');
    END IF;

    RETURN jsonb_build_object(
        'applied', true,
        'subscription_id', v_sub.id,
        'plan_id', v_plan.id,
        'plan_name', v_plan.name,
        'covered_service_ids', v_covered_services,
        'charged_service_ids', v_charged_services,
        'usage_limit', v_plan.usage_limit,
        'usage_used', COALESCE(v_usage_count, 0),
        'usage_remaining', CASE WHEN v_plan.type = 'unlimited' THEN 999 ELSE v_plan.usage_limit - COALESCE(v_usage_count, 0) END
    );
END;
$function$;