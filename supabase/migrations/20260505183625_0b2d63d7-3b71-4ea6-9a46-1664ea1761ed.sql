-- 1. Tornar get_client_identity_v2 mais robusto
CREATE OR REPLACE FUNCTION public.get_client_identity_v2()
 RETURNS TABLE(client_ids uuid[], whatsapps text[], emails text[])
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
    v_user_id UUID := auth.uid();
    v_profile_whatsapp TEXT;
    v_profile_email TEXT;
    v_whatsapps TEXT[] := ARRAY[]::TEXT[];
    v_client_ids UUID[] := ARRAY[]::UUID[];
    v_emails TEXT[] := ARRAY[]::TEXT[];
BEGIN
    IF v_user_id IS NULL THEN
        RETURN QUERY SELECT ARRAY[]::UUID[], ARRAY[]::TEXT[], ARRAY[]::TEXT[];
        RETURN;
    END IF;

    -- 1. Dados básicos do Auth e Profile
    SELECT whatsapp INTO v_profile_whatsapp FROM public.profiles WHERE user_id = v_user_id LIMIT 1;
    SELECT email INTO v_profile_email FROM auth.users WHERE id = v_user_id LIMIT 1;

    IF v_profile_email IS NOT NULL THEN
        v_emails := array_append(v_emails, lower(v_profile_email));
    END IF;
    
    IF v_profile_whatsapp IS NOT NULL AND v_profile_whatsapp <> '' THEN
        v_whatsapps := array_append(v_whatsapps, normalize_whatsapp_v2(v_profile_whatsapp));
    END IF;

    -- 2. Coletar de registros locais (clients) vinculados ao user_id
    -- Usamos COALESCE e array_agg para evitar NULLs que quebram array_cat
    SELECT 
        array_cat(v_client_ids, COALESCE(array_agg(DISTINCT id) FILTER (WHERE id IS NOT NULL), ARRAY[]::UUID[])),
        array_cat(v_whatsapps, COALESCE(array_agg(DISTINCT normalize_whatsapp_v2(whatsapp)) FILTER (WHERE whatsapp IS NOT NULL), ARRAY[]::TEXT[])),
        array_cat(v_emails, COALESCE(array_agg(DISTINCT lower(email)) FILTER (WHERE email IS NOT NULL), ARRAY[]::TEXT[]))
    INTO v_client_ids, v_whatsapps, v_emails
    FROM public.clients
    WHERE user_id = v_user_id;

    -- 3. Coletar de registros globais (clients_global) vinculados ao user_id
    SELECT 
        array_cat(v_whatsapps, COALESCE(array_agg(DISTINCT normalize_whatsapp_v2(whatsapp)) FILTER (WHERE whatsapp IS NOT NULL), ARRAY[]::TEXT[])),
        array_cat(v_emails, COALESCE(array_agg(DISTINCT lower(email)) FILTER (WHERE email IS NOT NULL), ARRAY[]::TEXT[]))
    INTO v_whatsapps, v_emails
    FROM public.clients_global
    WHERE user_id = v_user_id;

    -- 4. Expansão: Buscar outros registros de clientes que usem o mesmo WhatsApp/Email já encontrado
    IF array_length(v_whatsapps, 1) > 0 OR array_length(v_emails, 1) > 0 THEN
        SELECT 
            array_cat(v_client_ids, COALESCE(array_agg(DISTINCT id) FILTER (WHERE id IS NOT NULL), ARRAY[]::UUID[])),
            array_cat(v_whatsapps, COALESCE(array_agg(DISTINCT normalize_whatsapp_v2(whatsapp)) FILTER (WHERE whatsapp IS NOT NULL), ARRAY[]::TEXT[])),
            array_cat(v_emails, COALESCE(array_agg(DISTINCT lower(email)) FILTER (WHERE email IS NOT NULL), ARRAY[]::TEXT[]))
        INTO v_client_ids, v_whatsapps, v_emails
        FROM public.clients
        WHERE normalize_whatsapp_v2(whatsapp) = ANY(v_whatsapps)
           OR lower(email) = ANY(v_emails);
    END IF;

    -- Limpeza final: remover nulos e duplicados
    v_whatsapps := (SELECT array_agg(DISTINCT x) FROM unnest(v_whatsapps) x WHERE x IS NOT NULL AND x <> '');
    v_client_ids := (SELECT array_agg(DISTINCT x) FROM unnest(v_client_ids) x WHERE x IS NOT NULL);
    v_emails := (SELECT array_agg(DISTINCT x) FROM unnest(v_emails) x WHERE x IS NOT NULL AND x <> '');

    RETURN QUERY SELECT 
        COALESCE(v_client_ids, ARRAY[]::UUID[]), 
        COALESCE(v_whatsapps, ARRAY[]::TEXT[]), 
        COALESCE(v_emails, ARRAY[]::TEXT[]);
END;
$function$;

-- 2. Corrigir get_client_portal_summary
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

    -- Cashback
    SELECT COALESCE(SUM(amount), 0) INTO v_cashback_active
    FROM public.client_cashback
    WHERE (user_id = auth.uid() OR client_id = ANY(v_ids)) 
      AND status = 'active' AND (expires_at > NOW() OR expires_at IS NULL);

    SELECT COALESCE(SUM(amount), 0) INTO v_cashback_pending
    FROM public.client_cashback
    WHERE (user_id = auth.uid() OR client_id = ANY(v_ids)) AND status = 'pending';

    -- Appointments: Corrigido o erro de enum 'rejected'
    SELECT COUNT(*) INTO v_upcoming_count
    FROM public.appointments
    WHERE (user_id = auth.uid() OR client_id = ANY(v_ids) OR normalize_whatsapp_v2(client_whatsapp) = ANY(v_whatsapps))
      AND start_time > NOW() AND status NOT IN ('cancelled');

    SELECT COUNT(*) INTO v_completed_count
    FROM public.appointments
    WHERE (user_id = auth.uid() OR client_id = ANY(v_ids) OR normalize_whatsapp_v2(client_whatsapp) = ANY(v_whatsapps))
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
