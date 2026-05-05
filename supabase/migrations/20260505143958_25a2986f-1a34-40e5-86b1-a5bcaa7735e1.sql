CREATE OR REPLACE FUNCTION public.get_client_loyalty_balance(
    p_company_id uuid,
    p_client_id uuid default null,
    p_user_id uuid default null,
    p_email text default null,
    p_whatsapp text default null
)
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_total_points integer := 0;
    v_client_ids uuid[] := '{}';
    v_user_ids uuid[] := '{}';
    v_normalized_whatsapp text;
BEGIN
    -- Normalize WhatsApp if provided
    IF p_whatsapp IS NOT NULL AND p_whatsapp <> '' THEN
        v_normalized_whatsapp := regexp_replace(p_whatsapp, '[^0-9]', '', 'g');
    END IF;

    -- Collect all related client IDs and user IDs for this company
    SELECT 
        array_agg(DISTINCT id) FILTER (WHERE id IS NOT NULL),
        array_agg(DISTINCT user_id) FILTER (WHERE user_id IS NOT NULL)
    INTO v_client_ids, v_user_ids
    FROM public.clients
    WHERE company_id = p_company_id
      AND (
        (p_client_id IS NOT NULL AND id = p_client_id) OR
        (p_user_id IS NOT NULL AND user_id = p_user_id) OR
        (p_email IS NOT NULL AND p_email <> '' AND LOWER(email) = LOWER(p_email)) OR
        (v_normalized_whatsapp IS NOT NULL AND regexp_replace(whatsapp, '[^0-9]', '', 'g') = v_normalized_whatsapp)
      );

    -- Ensure we include the IDs passed as parameters
    IF p_client_id IS NOT NULL THEN
        v_client_ids := array_append(v_client_ids, p_client_id);
    END IF;
    IF p_user_id IS NOT NULL THEN
        v_user_ids := array_append(v_user_ids, p_user_id);
    END IF;

    -- Clean up arrays
    SELECT COALESCE(array_agg(DISTINCT x), '{}') INTO v_client_ids FROM unnest(v_client_ids) AS x WHERE x IS NOT NULL;
    SELECT COALESCE(array_agg(DISTINCT x), '{}') INTO v_user_ids FROM unnest(v_user_ids) AS x WHERE x IS NOT NULL;

    -- Sum points from transactions
    SELECT COALESCE(SUM(points), 0)
    INTO v_total_points
    FROM public.loyalty_points_transactions
    WHERE company_id = p_company_id
      AND (
        (client_id = ANY(v_client_ids)) OR
        (user_id = ANY(v_user_ids))
      );

    -- Subtract redemptions not yet in transactions
    -- Subtract loyalty_redemptions.total_points when status NOT IN ('cancelled', 'canceled', 'expired')
    -- AND there is no negative transaction with reference_id = redemption.id
    v_total_points := v_total_points - COALESCE((
        SELECT SUM(total_points)
        FROM public.loyalty_redemptions r
        WHERE r.company_id = p_company_id
          AND (
            (r.client_id = ANY(v_client_ids)) OR
            (r.user_id = ANY(v_user_ids))
          )
          AND r.status NOT IN ('cancelled', 'canceled', 'expired')
          AND NOT EXISTS (
            SELECT 1 FROM public.loyalty_points_transactions t
            WHERE t.reference_id = r.id
              AND t.points < 0
          )
    ), 0);

    RETURN GREATEST(v_total_points, 0);
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_client_loyalty_balance(uuid, uuid, uuid, text, text) TO anon, authenticated, service_role;