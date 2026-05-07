
-- Função para validar se o cliente tem direito a benefício de assinatura
CREATE OR REPLACE FUNCTION public.check_subscription_benefit(
    p_company_id UUID,
    p_client_id UUID,
    p_professional_id UUID,
    p_service_ids UUID[],
    p_date DATE DEFAULT CURRENT_DATE
)
RETURNS JSONB AS $$
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
BEGIN
    -- 1. Buscar assinatura ativa/pendente do cliente para esta empresa e profissional
    -- A regra crítica: profissional deve ser o mesmo
    SELECT * INTO v_sub 
    FROM public.client_subscriptions 
    WHERE company_id = p_company_id 
      AND client_id = p_client_id 
      AND professional_id = p_professional_id
      AND status IN ('active', 'past_due')
    LIMIT 1;

    IF v_sub.id IS NULL THEN
        -- Verificar se tem assinatura mas com outro profissional
        IF EXISTS (SELECT 1 FROM public.client_subscriptions WHERE client_id = p_client_id AND company_id = p_company_id AND status IN ('active', 'past_due')) THEN
            RETURN jsonb_build_object('applied', false, 'reason', 'wrong_professional');
        END IF;
        RETURN jsonb_build_object('applied', false, 'reason', 'no_subscription');
    END IF;

    -- 2. Verificar status financeiro e tolerância
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

    -- 3. Buscar detalhes do plano
    SELECT * INTO v_plan FROM public.subscription_plans WHERE id = v_sub.plan_id;

    -- 4. Verificar uso no ciclo atual (mês vigente)
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

    -- 5. Filtrar serviços cobertos
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
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Função para registrar uso (Idempotente por agendamento)
CREATE OR REPLACE FUNCTION public.register_subscription_usage_v1(
    p_company_id UUID,
    p_subscription_id UUID,
    p_appointment_id UUID,
    p_service_ids UUID[],
    p_usage_date DATE DEFAULT CURRENT_DATE
)
RETURNS VOID AS $$
DECLARE
    v_service_id UUID;
BEGIN
    -- Remover registros anteriores deste agendamento para evitar duplicidade em atualizações
    DELETE FROM public.subscription_usage WHERE appointment_id = p_appointment_id;

    -- Inserir novos usos
    FOREACH v_service_id IN ARRAY p_service_ids
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
        );
    END LOOP;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
