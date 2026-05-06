-- 1. Atualizar get_client_portal_summary para ser mais flexível com cashback previsto
CREATE OR REPLACE FUNCTION public.get_client_portal_summary()
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
    v_ids uuid[];
    v_whatsapps text[];
    v_emails text[];
    v_total_points INT := 0;
    v_cashback_active NUMERIC := 0;
    v_cashback_pending NUMERIC := 0;
    v_upcoming_count INT := 0;
    v_completed_count INT := 0;
BEGIN
    -- Obter identidade unificada do cliente
    SELECT client_ids, whatsapps, emails INTO v_ids, v_whatsapps, v_emails FROM public.get_client_identity_v2();

    -- Pontos
    WITH company_balances AS (
        SELECT 
            t.company_id,
            (
                SUM(points) - 
                COALESCE((
                    SELECT SUM(total_points) 
                    FROM public.loyalty_redemptions r 
                    WHERE r.company_id = t.company_id 
                      AND (r.user_id = auth.uid() OR r.client_id = ANY(v_ids)) 
                      AND r.status != 'cancelled'
                ), 0)
            ) as balance
        FROM public.loyalty_points_transactions t
        WHERE (t.user_id = auth.uid() OR t.client_id = ANY(v_ids))
        GROUP BY t.company_id
    )
    SELECT COALESCE(SUM(GREATEST(balance, 0)), 0) INTO v_total_points
    FROM company_balances;

    -- Cashback Ativo (Liberado)
    SELECT COALESCE(SUM(amount), 0) INTO v_cashback_active
    FROM public.client_cashback
    WHERE (user_id = auth.uid() OR client_id = ANY(v_ids)) 
      AND status = 'active' AND (expires_at > NOW() OR expires_at IS NULL);

    -- Cashback Pendente (Já registrado na tabela)
    SELECT COALESCE(SUM(amount), 0) INTO v_cashback_pending
    FROM public.client_cashback
    WHERE (user_id = auth.uid() OR client_id = ANY(v_ids)) AND status = 'pending';

    -- Cashback Previsto (De agendamentos futuros que se qualificam para cashback)
    -- Melhoria: Se promotion_id for nulo, buscamos a melhor promoção de cashback ativa da empresa
    v_cashback_pending := v_cashback_pending + COALESCE((
        SELECT SUM(
            COALESCE(a.final_price, a.total_price, 0) * 
            COALESCE(
                p.discount_value, 
                (SELECT discount_value FROM public.promotions p2 
                 WHERE p2.company_id = a.company_id 
                   AND p2.promotion_type = 'cashback' 
                   AND p2.status = 'active' 
                   AND p2.start_date <= (a.start_time AT TIME ZONE 'UTC')::date 
                   AND p2.end_date >= (a.start_time AT TIME ZONE 'UTC')::date
                 ORDER BY discount_value DESC LIMIT 1)
            ) / 100.0
        )
        FROM public.appointments a
        LEFT JOIN public.promotions p ON a.promotion_id = p.id
        WHERE (a.user_id = auth.uid() OR a.client_id = ANY(v_ids) OR public.normalize_whatsapp_v2(a.client_whatsapp) = ANY(v_whatsapps))
          AND a.status IN ('confirmed', 'pending')
          AND (p.promotion_type = 'cashback' OR (a.promotion_id IS NULL AND EXISTS (
              SELECT 1 FROM public.promotions p3 
              WHERE p3.company_id = a.company_id 
                AND p3.promotion_type = 'cashback' 
                AND p3.status = 'active'
                AND p3.start_date <= (a.start_time AT TIME ZONE 'UTC')::date 
                AND p3.end_date >= (a.start_time AT TIME ZONE 'UTC')::date
          )))
          AND NOT EXISTS (
              SELECT 1 FROM public.client_cashback cc 
              WHERE cc.appointment_id = a.id
          )
    ), 0);

    -- Agendamentos
    SELECT COUNT(*) INTO v_upcoming_count
    FROM public.appointments
    WHERE (user_id = auth.uid() OR client_id = ANY(v_ids) OR public.normalize_whatsapp_v2(client_whatsapp) = ANY(v_whatsapps))
      AND start_time > NOW() AND status NOT IN ('cancelled', 'no_show', 'rejected');

    SELECT COUNT(*) INTO v_completed_count
    FROM public.appointments
    WHERE (user_id = auth.uid() OR client_id = ANY(v_ids) OR public.normalize_whatsapp_v2(client_whatsapp) = ANY(v_whatsapps))
      AND status = 'completed';

    RETURN jsonb_build_object(
        'total_points', v_total_points,
        'cashback_active', v_cashback_active,
        'cashback_pending', v_cashback_pending,
        'upcoming_appointments', v_upcoming_count,
        'completed_appointments', v_completed_count
    );
END;
$function$;

-- 2. Atualizar get_client_portal_cashback para refletir a mesma lógica
CREATE OR REPLACE FUNCTION public.get_client_portal_cashback()
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
    v_ids uuid[];
    v_whatsapps text[];
    v_emails text[];
    v_result JSONB;
BEGIN
    SELECT client_ids, whatsapps, emails INTO v_ids, v_whatsapps, v_emails FROM public.get_client_identity_v2();

    WITH active_cashback AS (
        SELECT 
            company_id,
            SUM(amount) as available
        FROM public.client_cashback
        WHERE (user_id = auth.uid() OR client_id = ANY(v_ids))
          AND status = 'active' AND (expires_at > NOW() OR expires_at IS NULL)
        GROUP BY company_id
    ),
    pending_cashback_table AS (
        SELECT 
            company_id,
            SUM(amount) as pending
        FROM public.client_cashback
        WHERE (user_id = auth.uid() OR client_id = ANY(v_ids)) AND status = 'pending'
        GROUP BY company_id
    ),
    pending_cashback_forecast AS (
        SELECT 
            a.company_id,
            SUM(
                COALESCE(a.final_price, a.total_price, 0) * 
                COALESCE(
                    p.discount_value, 
                    (SELECT discount_value FROM public.promotions p2 
                     WHERE p2.company_id = a.company_id 
                       AND p2.promotion_type = 'cashback' 
                       AND p2.status = 'active' 
                       AND p2.start_date <= (a.start_time AT TIME ZONE 'UTC')::date 
                       AND p2.end_date >= (a.start_time AT TIME ZONE 'UTC')::date
                     ORDER BY discount_value DESC LIMIT 1)
                ) / 100.0
            ) as pending
        FROM public.appointments a
        LEFT JOIN public.promotions p ON a.promotion_id = p.id
        WHERE (a.user_id = auth.uid() OR a.client_id = ANY(v_ids) OR public.normalize_whatsapp_v2(a.client_whatsapp) = ANY(v_whatsapps))
          AND a.status IN ('confirmed', 'pending')
          AND (p.promotion_type = 'cashback' OR (a.promotion_id IS NULL AND EXISTS (
              SELECT 1 FROM public.promotions p3 
              WHERE p3.company_id = a.company_id 
                AND p3.promotion_type = 'cashback' 
                AND p3.status = 'active'
                AND p3.start_date <= (a.start_time AT TIME ZONE 'UTC')::date 
                AND p3.end_date >= (a.start_time AT TIME ZONE 'UTC')::date
          )))
          AND NOT EXISTS (
              SELECT 1 FROM public.client_cashback cc 
              WHERE cc.appointment_id = a.id
          )
        GROUP BY a.company_id
    ),
    all_companies AS (
        SELECT DISTINCT company_id FROM public.client_cashback WHERE (user_id = auth.uid() OR client_id = ANY(v_ids))
        UNION
        SELECT DISTINCT company_id FROM public.appointments a 
        LEFT JOIN public.promotions p ON a.promotion_id = p.id
        WHERE (a.user_id = auth.uid() OR a.client_id = ANY(v_ids) OR public.normalize_whatsapp_v2(a.client_whatsapp) = ANY(v_whatsapps))
          AND (p.promotion_type = 'cashback' OR (a.promotion_id IS NULL AND EXISTS (
              SELECT 1 FROM public.promotions p3 
              WHERE p3.company_id = a.company_id 
                AND p3.promotion_type = 'cashback' 
                AND p3.status = 'active'
                AND p3.start_date <= (a.start_time AT TIME ZONE 'UTC')::date 
                AND p3.end_date >= (a.start_time AT TIME ZONE 'UTC')::date
          )))
    ),
    company_summary AS (
        SELECT 
            ac.company_id,
            COALESCE(active.available, 0) as available,
            COALESCE(pt.pending, 0) + COALESCE(pf.pending, 0) as pending
        FROM all_companies ac
        LEFT JOIN active_cashback active ON active.company_id = ac.company_id
        LEFT JOIN pending_cashback_table pt ON pt.company_id = ac.company_id
        LEFT JOIN pending_cashback_forecast pf ON pf.company_id = ac.company_id
    ),
    history AS (
        SELECT 
            t.id, t.company_id, t.amount, t.type, t.description, t.created_at
        FROM public.cashback_transactions t
        WHERE (t.user_id = auth.uid() OR t.client_id = ANY(v_ids))
        ORDER BY t.created_at DESC
        LIMIT 100
    ),
    forecast_list AS (
        SELECT 
            a.id, a.company_id, 
            (
                COALESCE(a.final_price, a.total_price, 0) * 
                COALESCE(
                    p.discount_value, 
                    (SELECT discount_value FROM public.promotions p2 
                     WHERE p2.company_id = a.company_id 
                       AND p2.promotion_type = 'cashback' 
                       AND p2.status = 'active' 
                       AND p2.start_date <= (a.start_time AT TIME ZONE 'UTC')::date 
                       AND p2.end_date >= (a.start_time AT TIME ZONE 'UTC')::date
                     ORDER BY discount_value DESC LIMIT 1)
                ) / 100.0
            ) as amount,
            'pending'::text as type,
            'Cashback previsto (agendamento em ' || to_char(a.start_time, 'DD/MM') || ')' as description,
            a.start_time as created_at
        FROM public.appointments a
        LEFT JOIN public.promotions p ON a.promotion_id = p.id
        WHERE (a.user_id = auth.uid() OR a.client_id = ANY(v_ids) OR public.normalize_whatsapp_v2(a.client_whatsapp) = ANY(v_whatsapps))
          AND a.status IN ('confirmed', 'pending')
          AND (p.promotion_type = 'cashback' OR (a.promotion_id IS NULL AND EXISTS (
              SELECT 1 FROM public.promotions p3 
              WHERE p3.company_id = a.company_id 
                AND p3.promotion_type = 'cashback' 
                AND p3.status = 'active'
                AND p3.start_date <= (a.start_time AT TIME ZONE 'UTC')::date 
                AND p3.end_date >= (a.start_time AT TIME ZONE 'UTC')::date
          )))
          AND NOT EXISTS (
              SELECT 1 FROM public.client_cashback cc 
              WHERE cc.appointment_id = a.id
          )
    )
    SELECT 
        jsonb_build_object(
            'balances', COALESCE((SELECT jsonb_object_agg(company_id, jsonb_build_object('available', available, 'pending', pending)) FROM company_summary), '{}'::jsonb),
            'history', COALESCE((SELECT jsonb_agg(h) FROM (SELECT id, company_id, amount, type, description, created_at FROM history UNION ALL SELECT id, company_id, amount, type, description, created_at FROM forecast_list ORDER BY created_at DESC) h), '[]'::jsonb)
        ) INTO v_result;

    RETURN v_result;
END;
$function$;
