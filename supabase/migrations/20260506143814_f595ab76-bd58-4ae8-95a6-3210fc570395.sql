CREATE OR REPLACE FUNCTION public.debug_client_portal_data(p_user_id UUID)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
    v_ids uuid[];
    v_whatsapps text[];
    v_emails text[];
    v_active NUMERIC;
    v_pending NUMERIC;
    v_history JSONB;
BEGIN
    -- Mimic get_client_identity_v2 but for a specific user_id
    -- (Actually we can just call the real logic but replacing auth.uid())
    
    -- Step 1: Basic identity
    SELECT ARRAY_AGG(DISTINCT id), 
           ARRAY_AGG(DISTINCT normalize_whatsapp_v2(whatsapp)) FILTER (WHERE whatsapp IS NOT NULL),
           ARRAY_AGG(DISTINCT lower(email)) FILTER (WHERE email IS NOT NULL)
    INTO v_ids, v_whatsapps, v_emails
    FROM public.clients
    WHERE user_id = p_user_id;

    -- Expansion
    IF array_length(v_whatsapps, 1) > 0 OR array_length(v_emails, 1) > 0 THEN
        SELECT
            array_cat(v_ids, COALESCE(array_agg(DISTINCT id) FILTER (WHERE id IS NOT NULL), ARRAY[]::UUID[])),
            array_cat(v_whatsapps, COALESCE(array_agg(DISTINCT normalize_whatsapp_v2(whatsapp)) FILTER (WHERE whatsapp IS NOT NULL), ARRAY[]::TEXT[])),
            array_cat(v_emails, COALESCE(array_agg(DISTINCT lower(email)) FILTER (WHERE email IS NOT NULL), ARRAY[]::TEXT[]))
        INTO v_ids, v_whatsapps, v_emails
        FROM public.clients
        WHERE normalize_whatsapp_v2(whatsapp) = ANY(v_whatsapps)
           OR lower(email) = ANY(v_emails);
    END IF;

    -- Cleanup
    v_ids := (SELECT array_agg(DISTINCT x) FROM unnest(v_ids) x WHERE x IS NOT NULL);
    v_whatsapps := (SELECT array_agg(DISTINCT x) FROM unnest(v_whatsapps) x WHERE x IS NOT NULL);
    v_emails := (SELECT array_agg(DISTINCT x) FROM unnest(v_emails) x WHERE x IS NOT NULL);

    -- Calculate active balance
    SELECT COALESCE(SUM(amount), 0) INTO v_active
    FROM public.client_cashback
    WHERE (user_id = p_user_id OR client_id = ANY(v_ids))
      AND status = 'active' AND (expires_at > now() OR expires_at IS NULL);

    -- Calculate pending balance
    SELECT COALESCE(SUM(amount), 0) INTO v_pending
    FROM public.client_cashback
    WHERE (user_id = p_user_id OR client_id = ANY(v_ids)) AND status = 'pending';

    -- Get history
    SELECT jsonb_agg(h) INTO v_history
    FROM (
        SELECT id, amount, type, description, created_at
        FROM public.cashback_transactions
        WHERE (user_id = p_user_id OR client_id = ANY(v_ids))
        ORDER BY created_at DESC
    ) h;

    RETURN jsonb_build_object(
        'v_ids', v_ids,
        'v_whatsapps', v_whatsapps,
        'v_emails', v_emails,
        'active_balance', v_active,
        'pending_balance', v_pending,
        'history', COALESCE(v_history, '[]'::jsonb)
    );
END;
$$;
