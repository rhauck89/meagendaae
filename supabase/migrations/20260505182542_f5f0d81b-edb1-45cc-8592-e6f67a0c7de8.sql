-- Corrigindo get_client_portal_summary
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

    -- Appointments (CORREÇÃO: removido client_email)
    SELECT COUNT(*) INTO v_upcoming_count
    FROM public.appointments
    WHERE (user_id = auth.uid() OR client_id = ANY(v_ids) OR normalize_whatsapp_v2(client_whatsapp) = ANY(v_whatsapps))
      AND start_time > NOW() AND status NOT IN ('cancelled', 'rejected');

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
$$;

-- Corrigindo get_client_portal_appointments
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
        -- CORREÇÃO: removido client_email
    ORDER BY a.start_time DESC;
END;
$$;
