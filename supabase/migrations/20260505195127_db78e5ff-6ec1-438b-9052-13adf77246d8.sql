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
    SELECT client_ids, whatsapps, emails INTO v_ids, v_whatsapps, v_emails FROM public.get_client_identity_v2();

    -- Points: Considera user_id ou client_ids
    SELECT COALESCE(SUM(points), 0) INTO v_total_points
    FROM public.loyalty_points_transactions
    WHERE (user_id = auth.uid() OR client_id = ANY(v_ids)) AND points > 0;

    v_total_points := v_total_points - COALESCE((
        SELECT SUM(total_points)
        FROM public.loyalty_redemptions
        WHERE (user_id = auth.uid() OR client_id = ANY(v_ids)) AND status != 'cancelled'
    ), 0);
    
    v_total_points := v_total_points + COALESCE((
        SELECT SUM(points)
        FROM public.loyalty_points_transactions
        WHERE (user_id = auth.uid() OR client_id = ANY(v_ids)) AND points < 0
    ), 0);

    IF v_total_points < 0 THEN v_total_points := 0; END IF;

    -- Cashback Ativo (Liberado)
    SELECT COALESCE(SUM(amount), 0) INTO v_cashback_active
    FROM public.client_cashback
    WHERE (user_id = auth.uid() OR client_id = ANY(v_ids)) 
      AND status = 'active' AND (expires_at > NOW() OR expires_at IS NULL);

    -- Cashback Pendente (Já registrado na tabela)
    SELECT COALESCE(SUM(amount), 0) INTO v_cashback_pending
    FROM public.client_cashback
    WHERE (user_id = auth.uid() OR client_id = ANY(v_ids)) AND status = 'pending';

    -- Cashback Previsto (De agendamentos futuros com promoção de cashback)
    v_cashback_pending := v_cashback_pending + COALESCE((
        SELECT SUM(COALESCE(a.final_price, a.total_price, 0) * (p.discount_value / 100.0))
        FROM public.appointments a
        JOIN public.promotions p ON a.promotion_id = p.id
        WHERE (a.user_id = auth.uid() OR a.client_id = ANY(v_ids) OR public.normalize_whatsapp_v2(a.client_whatsapp) = ANY(v_whatsapps))
          AND a.status IN ('confirmed', 'pending')
          AND p.promotion_type = 'cashback'
          AND NOT EXISTS (
              SELECT 1 FROM public.client_cashback cc 
              WHERE cc.appointment_id = a.id
          )
    ), 0);

    -- Appointments
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
            SUM(COALESCE(a.final_price, a.total_price, 0) * (p.discount_value / 100.0)) as pending
        FROM public.appointments a
        JOIN public.promotions p ON a.promotion_id = p.id
        WHERE (a.user_id = auth.uid() OR a.client_id = ANY(v_ids) OR public.normalize_whatsapp_v2(a.client_whatsapp) = ANY(v_whatsapps))
          AND a.status IN ('confirmed', 'pending')
          AND p.promotion_type = 'cashback'
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
        JOIN public.promotions p ON a.promotion_id = p.id
        WHERE (a.user_id = auth.uid() OR a.client_id = ANY(v_ids) OR public.normalize_whatsapp_v2(a.client_whatsapp) = ANY(v_whatsapps))
          AND p.promotion_type = 'cashback'
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
            (COALESCE(a.final_price, a.total_price, 0) * (p.discount_value / 100.0)) as amount,
            'pending' as type,
            'Cashback previsto (agendamento em ' || to_char(a.start_time, 'DD/MM') || ')' as description,
            a.start_time as created_at
        FROM public.appointments a
        JOIN public.promotions p ON a.promotion_id = p.id
        WHERE (a.user_id = auth.uid() OR a.client_id = ANY(v_ids) OR public.normalize_whatsapp_v2(a.client_whatsapp) = ANY(v_whatsapps))
          AND a.status IN ('confirmed', 'pending')
          AND p.promotion_type = 'cashback'
          AND NOT EXISTS (
              SELECT 1 FROM public.client_cashback cc 
              WHERE cc.appointment_id = a.id
          )
    )
    SELECT 
        jsonb_build_object(
            'balances', (SELECT jsonb_object_agg(company_id, jsonb_build_object('available', available, 'pending', pending)) FROM company_summary),
            'history', (SELECT jsonb_agg(h) FROM (SELECT * FROM history UNION ALL SELECT * FROM forecast_list ORDER BY created_at DESC) h)
        ) INTO v_result;

    RETURN v_result;
END;
$function$;