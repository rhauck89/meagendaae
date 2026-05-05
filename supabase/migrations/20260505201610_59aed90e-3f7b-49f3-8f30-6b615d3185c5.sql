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

    -- Pontos: Cálculo por empresa para garantir que o total seja a soma dos saldos positivos (mesma lógica da aba Pontos)
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

    -- Cashback Pendente (Já registrado na tabela ou previsto de agendamentos futuros)
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