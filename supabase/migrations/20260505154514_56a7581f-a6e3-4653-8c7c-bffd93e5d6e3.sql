CREATE OR REPLACE FUNCTION public.get_client_identity_v2()
RETURNS TABLE (
    client_ids UUID[],
    whatsapps TEXT[],
    emails TEXT[]
) LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
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
    -- Aqui pegamos IDs, WhatsApps e Emails
    SELECT 
        array_cat(v_client_ids, array_agg(DISTINCT id) FILTER (WHERE id IS NOT NULL)),
        array_cat(v_whatsapps, array_agg(DISTINCT normalize_whatsapp_v2(whatsapp)) FILTER (WHERE whatsapp IS NOT NULL)),
        array_cat(v_emails, array_agg(DISTINCT lower(email)) FILTER (WHERE email IS NOT NULL))
    INTO v_client_ids, v_whatsapps, v_emails
    FROM public.clients
    WHERE user_id = v_user_id;

    -- 3. Coletar de registros globais (clients_global) vinculados ao user_id
    SELECT 
        array_cat(v_whatsapps, array_agg(DISTINCT normalize_whatsapp_v2(whatsapp)) FILTER (WHERE whatsapp IS NOT NULL)),
        array_cat(v_emails, array_agg(DISTINCT lower(email)) FILTER (WHERE email IS NOT NULL))
    INTO v_whatsapps, v_emails
    FROM public.clients_global
    WHERE user_id = v_user_id;

    -- 4. Expansão: Buscar outros registros de clientes que usem o mesmo WhatsApp/Email já encontrado
    -- Isso garante que se o cliente tem 2 registros (um com user_id e outro sem), ambos sejam vinculados
    IF array_length(v_whatsapps, 1) > 0 OR array_length(v_emails, 1) > 0 THEN
        SELECT 
            array_cat(v_client_ids, array_agg(DISTINCT id) FILTER (WHERE id IS NOT NULL)),
            array_cat(v_whatsapps, array_agg(DISTINCT normalize_whatsapp_v2(whatsapp)) FILTER (WHERE whatsapp IS NOT NULL)),
            array_cat(v_emails, array_agg(DISTINCT lower(email)) FILTER (WHERE email IS NOT NULL))
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
$$;
