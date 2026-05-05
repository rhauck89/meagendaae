-- Helper to get client identity
CREATE OR REPLACE FUNCTION public.get_client_identity_v2()
RETURNS TABLE(client_ids uuid[], whatsapps text[], emails text[])
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_user_id UUID := auth.uid();
    v_user_whatsapp TEXT;
    v_user_email TEXT;
    v_whatsapps TEXT[] := ARRAY[]::TEXT[];
    v_client_ids UUID[] := ARRAY[]::UUID[];
    v_emails TEXT[] := ARRAY[]::TEXT[];
BEGIN
    IF v_user_id IS NULL THEN
        RETURN QUERY SELECT ARRAY[]::UUID[], ARRAY[]::TEXT[], ARRAY[]::TEXT[];
        RETURN;
    END IF;

    -- 1. Get user profile data
    SELECT whatsapp INTO v_user_whatsapp FROM public.profiles WHERE user_id = v_user_id LIMIT 1;
    SELECT email INTO v_user_email FROM auth.users WHERE id = v_user_id LIMIT 1;

    IF v_user_email IS NOT NULL THEN
        v_emails := array_append(v_emails, lower(v_user_email));
    END IF;

    -- 2. Collect from clients table
    SELECT 
        array_agg(DISTINCT id) FILTER (WHERE id IS NOT NULL),
        array_agg(DISTINCT normalize_whatsapp_v2(whatsapp)) FILTER (WHERE whatsapp IS NOT NULL),
        array_agg(DISTINCT lower(email)) FILTER (WHERE email IS NOT NULL)
    INTO v_client_ids, v_whatsapps, v_emails
    FROM public.clients
    WHERE user_id = v_user_id;

    -- 3. Collect from global clients
    SELECT 
        array_cat(COALESCE(v_whatsapps, ARRAY[]::TEXT[]), array_agg(DISTINCT normalize_whatsapp_v2(whatsapp)) FILTER (WHERE whatsapp IS NOT NULL)),
        array_cat(COALESCE(v_emails, ARRAY[]::TEXT[]), array_agg(DISTINCT lower(email)) FILTER (WHERE email IS NOT NULL))
    INTO v_whatsapps, v_emails
    FROM public.clients_global
    WHERE user_id = v_user_id;

    -- 4. Add profile whatsapp
    IF v_user_whatsapp IS NOT NULL AND v_user_whatsapp <> '' THEN
        v_whatsapps := array_append(v_whatsapps, normalize_whatsapp_v2(v_user_whatsapp));
    END IF;

    -- Clean up and unique
    v_whatsapps := (SELECT array_agg(DISTINCT x) FROM unnest(v_whatsapps) x WHERE x IS NOT NULL);
    v_client_ids := (SELECT array_agg(DISTINCT x) FROM unnest(v_client_ids) x WHERE x IS NOT NULL);
    v_emails := (SELECT array_agg(DISTINCT x) FROM unnest(v_emails) x WHERE x IS NOT NULL);

    RETURN QUERY SELECT 
        COALESCE(v_client_ids, ARRAY[]::UUID[]), 
        COALESCE(v_whatsapps, ARRAY[]::TEXT[]), 
        COALESCE(v_emails, ARRAY[]::TEXT[]);
END;
$$;

-- RPC for Portal Summary
CREATE OR REPLACE FUNCTION public.get_client_portal_summary()
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
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

    -- Points
    -- Earned points
    SELECT COALESCE(SUM(points), 0) INTO v_total_points
    FROM public.loyalty_points_transactions
    WHERE (user_id = auth.uid() OR client_id = ANY(v_ids)) AND points > 0;

    -- Subtract Redemptions (not yet in transactions)
    v_total_points := v_total_points - COALESCE((
        SELECT SUM(total_points)
        FROM public.loyalty_redemptions
        WHERE (user_id = auth.uid() OR client_id = ANY(v_ids)) AND status != 'cancelled'
    ), 0);
    
    -- Subtract negative transactions
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

    -- Appointments
    SELECT COUNT(*) INTO v_upcoming_count
    FROM public.appointments
    WHERE (user_id = auth.uid() OR client_id = ANY(v_ids) OR normalize_whatsapp_v2(client_whatsapp) = ANY(v_whatsapps) OR lower(client_email) = ANY(v_emails))
      AND start_time > NOW() AND status NOT IN ('cancelled', 'rejected');

    SELECT COUNT(*) INTO v_completed_count
    FROM public.appointments
    WHERE (user_id = auth.uid() OR client_id = ANY(v_ids) OR normalize_whatsapp_v2(client_whatsapp) = ANY(v_whatsapps) OR lower(client_email) = ANY(v_emails))
      AND status = 'completed';

    RETURN jsonb_build_object(
        'total_points', v_total_points,
        'cashback_active', v_cashback_active,
        'cashback_pending', v_cashback_pending,
        'upcoming_appointments', v_upcoming_count,
        'completed_appointments', v_completed_count
    );
END;
$$;

-- RPC for Portal Appointments
CREATE OR REPLACE FUNCTION public.get_client_portal_appointments()
RETURNS SETOF JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_ids uuid[];
    v_whatsapps text[];
    v_emails text[];
BEGIN
    SELECT client_ids, whatsapps, emails INTO v_ids, v_whatsapps, v_emails FROM public.get_client_identity_v2();

    RETURN QUERY
    SELECT 
        jsonb_build_object(
            'id', a.id,
            'start_time', a.start_time,
            'end_time', a.end_time,
            'total_price', a.total_price,
            'status', a.status,
            'company_id', a.company_id,
            'company', jsonb_build_object(
                'id', c.id,
                'name', c.name,
                'logo_url', c.logo_url,
                'slug', c.slug
            ),
            'professional', jsonb_build_object(
                'id', p.id,
                'full_name', p.full_name,
                'avatar_url', p.avatar_url
            ),
            'appointment_services', COALESCE(
                (SELECT jsonb_agg(jsonb_build_object(
                    'price', aserv.price,
                    'service', jsonb_build_object(
                        'name', s.name
                    )
                ))
                FROM public.appointment_services aserv
                JOIN public.services s ON s.id = aserv.service_id
                WHERE aserv.appointment_id = a.id),
                '[]'::jsonb
            )
        )
    FROM public.appointments a
    LEFT JOIN public.companies c ON c.id = a.company_id
    LEFT JOIN public.profiles p ON p.id = a.professional_id
    WHERE 
        a.user_id = auth.uid()
        OR a.client_id = ANY(v_ids)
        OR normalize_whatsapp_v2(a.client_whatsapp) = ANY(v_whatsapps)
        OR lower(a.client_email) = ANY(v_emails)
    ORDER BY a.start_time DESC;
END;
$$;

-- RPC for Portal Points
CREATE OR REPLACE FUNCTION public.get_client_portal_points()
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_ids uuid[];
    v_whatsapps text[];
    v_emails text[];
    v_result JSONB;
BEGIN
    SELECT client_ids, whatsapps, emails INTO v_ids, v_whatsapps, v_emails FROM public.get_client_identity_v2();

    WITH company_points AS (
        -- Sum credits per company
        SELECT 
            company_id, 
            SUM(points) FILTER (WHERE points > 0) as total_earned,
            SUM(points) FILTER (WHERE points < 0) as total_debited
        FROM public.loyalty_points_transactions
        WHERE (user_id = auth.uid() OR client_id = ANY(v_ids))
        GROUP BY company_id
    ),
    company_redemptions AS (
        SELECT 
            company_id,
            SUM(total_points) as total_redeemed
        FROM public.loyalty_redemptions
        WHERE (user_id = auth.uid() OR client_id = ANY(v_ids)) AND status != 'cancelled'
        GROUP BY company_id
    ),
    company_balances AS (
        SELECT 
            coalesce(cp.company_id, cr.company_id) as company_id,
            (COALESCE(cp.total_earned, 0) + COALESCE(cp.total_debited, 0) - COALESCE(cr.total_redeemed, 0)) as balance
        FROM company_points cp
        FULL OUTER JOIN company_redemptions cr ON cr.company_id = cp.company_id
    ),
    transactions AS (
        SELECT 
            t.id, t.company_id, t.points, t.transaction_type, t.description, t.created_at,
            'transaction' as type
        FROM public.loyalty_points_transactions t
        WHERE (t.user_id = auth.uid() OR t.client_id = ANY(v_ids))
        UNION ALL
        SELECT 
            r.id, r.company_id, -r.total_points as points, 'redemption' as transaction_type, 'Resgate de recompensa' as description, r.created_at,
            'redemption' as type
        FROM public.loyalty_redemptions r
        WHERE (r.user_id = auth.uid() OR r.client_id = ANY(v_ids)) AND r.status != 'cancelled'
    )
    SELECT 
        jsonb_build_object(
            'balances', (SELECT jsonb_object_agg(company_id, GREATEST(balance, 0)) FROM company_balances),
            'history', (SELECT jsonb_agg(t ORDER BY created_at DESC) FROM (SELECT * FROM transactions LIMIT 100) t)
        ) INTO v_result;

    RETURN v_result;
END;
$$;

-- RPC for Portal Cashback
CREATE OR REPLACE FUNCTION public.get_client_portal_cashback()
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
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
    pending_cashback AS (
        SELECT 
            company_id,
            SUM(amount) as pending
        FROM public.client_cashback
        WHERE (user_id = auth.uid() OR client_id = ANY(v_ids)) AND status = 'pending'
        GROUP BY company_id
    ),
    all_companies AS (
        SELECT DISTINCT company_id FROM public.client_cashback WHERE (user_id = auth.uid() OR client_id = ANY(v_ids))
    ),
    company_summary AS (
        SELECT 
            ac.company_id,
            COALESCE(ac.available, 0) as available,
            COALESCE(pc.pending, 0) as pending
        FROM all_companies ac
        LEFT JOIN active_cashback ac ON ac.company_id = ac.company_id
        LEFT JOIN pending_cashback pc ON pc.company_id = ac.company_id
    ),
    history AS (
        SELECT 
            t.id, t.company_id, t.amount, t.type, t.description, t.created_at
        FROM public.cashback_transactions t
        WHERE (t.user_id = auth.uid() OR t.client_id = ANY(v_ids))
        ORDER BY t.created_at DESC
        LIMIT 100
    )
    SELECT 
        jsonb_build_object(
            'balances', (SELECT jsonb_object_agg(company_id, jsonb_build_object('available', available, 'pending', pending)) FROM company_summary),
            'history', (SELECT jsonb_agg(h) FROM history h)
        ) INTO v_result;

    RETURN v_result;
END;
$$;
