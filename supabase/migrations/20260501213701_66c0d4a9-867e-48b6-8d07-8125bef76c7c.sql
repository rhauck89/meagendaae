CREATE OR REPLACE FUNCTION public.get_client_appointments_v2()
 RETURNS TABLE(id uuid, start_time timestamp with time zone, end_time timestamp with time zone, total_price numeric, status text, company_id uuid, promotion_id uuid, original_price numeric, promotion_discount numeric, cashback_used numeric, manual_discount numeric, final_price numeric, client_name text, client_whatsapp text, client_email text, user_id uuid, company jsonb, professional jsonb, appointment_services jsonb)
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
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

    -- 1. Obter WhatsApp do profile e email do auth
    SELECT whatsapp INTO v_user_whatsapp FROM public.profiles WHERE user_id = v_user_id LIMIT 1;
    SELECT email INTO v_user_email FROM auth.users WHERE id = v_user_id LIMIT 1;

    -- 2. Coletar todos os WhatsApps e Client IDs vinculados a esse user_id
    -- Do profile
    IF v_user_whatsapp IS NOT NULL AND v_user_whatsapp <> '' THEN
        v_linked_whatsapps := array_append(v_linked_whatsapps, normalize_whatsapp_v2(v_user_whatsapp));
    END IF;

    -- De clients
    SELECT 
        array_agg(DISTINCT normalize_whatsapp_v2(whatsapp)),
        array_agg(DISTINCT id)
    INTO v_linked_whatsapps, v_linked_client_ids
    FROM public.clients
    WHERE user_id = v_user_id;

    -- De clients_global
    v_linked_whatsapps := array_cat(v_linked_whatsapps, (
        SELECT array_agg(DISTINCT normalize_whatsapp_v2(whatsapp))
        FROM public.clients_global
        WHERE user_id = v_user_id AND whatsapp IS NOT NULL
    ));

    -- Limpar duplicatas e nulos
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
        OR a.client_id = ANY(v_linked_client_ids)
        OR normalize_whatsapp_v2(a.client_whatsapp) = ANY(v_linked_whatsapps)
        OR (v_user_email IS NOT NULL AND lower(a.client_email) = lower(v_user_email))
    ORDER BY a.start_time DESC;
END;
$function$;