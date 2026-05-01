CREATE OR REPLACE FUNCTION public.get_client_appointments_v2()
RETURNS TABLE (
    id UUID,
    start_time TIMESTAMPTZ,
    end_time TIMESTAMPTZ,
    total_price NUMERIC,
    status TEXT,
    company_id UUID,
    promotion_id UUID,
    original_price NUMERIC,
    promotion_discount NUMERIC,
    cashback_used NUMERIC,
    manual_discount NUMERIC,
    final_price NUMERIC,
    client_name TEXT,
    client_whatsapp TEXT,
    client_email TEXT,
    user_id UUID,
    company JSONB,
    professional JSONB,
    appointment_services JSONB
) LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
    v_user_id UUID := auth.uid();
    v_user_whatsapp TEXT;
    v_user_email TEXT;
    v_linked_whatsapps TEXT[] := ARRAY[]::TEXT[];
    v_linked_client_ids UUID[] := ARRAY[]::UUID[];
BEGIN
    IF v_user_id IS NULL THEN
        RETURN;
    END IF;

    -- 1. Get user profile data
    SELECT whatsapp INTO v_user_whatsapp FROM public.profiles WHERE user_id = v_user_id LIMIT 1;
    SELECT email INTO v_user_email FROM auth.users WHERE id = v_user_id LIMIT 1;

    -- 2. Collect WhatsApps
    IF v_user_whatsapp IS NOT NULL AND v_user_whatsapp <> '' THEN
        v_linked_whatsapps := array_append(v_linked_whatsapps, normalize_whatsapp_v2(v_user_whatsapp));
    END IF;

    -- 3. Collect linked whatsapps and client IDs from local clients
    SELECT 
        array_agg(DISTINCT normalize_whatsapp_v2(whatsapp)) FILTER (WHERE whatsapp IS NOT NULL),
        array_agg(DISTINCT id) FILTER (WHERE id IS NOT NULL)
    INTO v_linked_whatsapps, v_linked_client_ids
    FROM public.clients
    WHERE user_id = v_user_id;

    -- 4. Collect from global clients
    v_linked_whatsapps := array_cat(v_linked_whatsapps, (
        SELECT array_agg(DISTINCT normalize_whatsapp_v2(whatsapp))
        FROM public.clients_global
        WHERE user_id = v_user_id AND whatsapp IS NOT NULL
    ));

    -- Clean up arrays
    v_linked_whatsapps := (SELECT array_agg(DISTINCT x) FROM unnest(v_linked_whatsapps) x WHERE x IS NOT NULL);
    v_linked_client_ids := (SELECT array_agg(DISTINCT x) FROM unnest(v_linked_client_ids) x WHERE x IS NOT NULL);

    RETURN QUERY
    SELECT 
        a.id,
        a.start_time,
        a.end_time,
        a.total_price,
        a.status::TEXT,
        a.company_id,
        a.promotion_id,
        a.original_price,
        a.promotion_discount,
        a.cashback_used,
        a.manual_discount,
        a.final_price,
        a.client_name,
        a.client_whatsapp,
        a.client_email,
        a.user_id,
        jsonb_build_object(
            'id', c.id,
            'name', c.name,
            'logo_url', c.logo_url,
            'slug', c.slug
        ) as company,
        jsonb_build_object(
            'id', p.id,
            'full_name', p.full_name,
            'avatar_url', p.avatar_url
        ) as professional,
        COALESCE(
            (SELECT jsonb_agg(jsonb_build_object(
                'price', aserv.price,
                'service', jsonb_build_object(
                    'id', s.id,
                    'name', s.name
                )
            ))
            FROM public.appointment_services aserv
            JOIN public.services s ON s.id = aserv.service_id
            WHERE aserv.appointment_id = a.id),
            '[]'::jsonb
        ) as appointment_services
    FROM public.appointments a
    LEFT JOIN public.companies c ON c.id = a.company_id
    LEFT JOIN public.profiles p ON p.id = a.professional_id
    WHERE 
        a.user_id = v_user_id
        OR a.client_id = ANY(COALESCE(v_linked_client_ids, ARRAY[]::UUID[]))
        OR normalize_whatsapp_v2(a.client_whatsapp) = ANY(COALESCE(v_linked_whatsapps, ARRAY[]::TEXT[]))
        OR (v_user_email IS NOT NULL AND lower(a.client_email) = lower(v_user_email))
    ORDER BY a.start_time DESC;
END;
$$;