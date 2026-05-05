-- Função para sincronizar status dos banners do marketplace
CREATE OR REPLACE FUNCTION public.sync_marketplace_banner_statuses()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_updated_count integer := 0;
    v_expired_count integer := 0;
    v_limit_reached_count integer := 0;
    v_result jsonb;
BEGIN
    -- 1. Atualizar contadores de impressões e cliques para banners ativos/programados
    -- (Otimização: apenas para banners que não estão encerrados ou deletados)
    UPDATE public.marketplace_banners b
    SET 
        current_impressions = (
            SELECT count(*) 
            FROM public.marketplace_banner_events e 
            WHERE e.banner_id = b.id AND e.event_type = 'impression'
        ),
        current_clicks = (
            SELECT count(*) 
            FROM public.marketplace_banner_events e 
            WHERE e.banner_id = b.id AND e.event_type = 'click'
        ),
        updated_at = now()
    WHERE b.status IN ('active', 'scheduled', 'paused')
      AND b.deleted_at IS NULL;

    -- 2. Encerrar banners por data de validade (Expiração)
    WITH expired AS (
        UPDATE public.marketplace_banners
        SET 
            status = 'ended',
            updated_at = now()
        WHERE status IN ('active', 'scheduled', 'paused')
          AND end_date < now()
          AND deleted_at IS NULL
        RETURNING id
    )
    SELECT count(*) INTO v_expired_count FROM expired;

    -- 3. Encerrar banners por limite de impressões ou cliques
    WITH limit_reached AS (
        UPDATE public.marketplace_banners
        SET 
            status = 'ended',
            updated_at = now()
        WHERE status IN ('active', 'scheduled', 'paused')
          AND deleted_at IS NULL
          AND (
            (sale_model = 'impressions' AND limit_impressions IS NOT NULL AND current_impressions >= limit_impressions) OR
            (sale_model = 'clicks' AND limit_clicks IS NOT NULL AND current_clicks >= limit_clicks)
          )
        RETURNING id
    )
    SELECT count(*) INTO v_limit_reached_count FROM limit_reached;

    v_updated_count := v_expired_count + v_limit_reached_count;

    v_result := jsonb_build_object(
        'updated_total', v_updated_count,
        'expired', v_expired_count,
        'limit_reached', v_limit_reached_count,
        'timestamp', now()
    );

    RETURN v_result;
END;
$$;

-- Garantir que a função pode ser chamada
GRANT EXECUTE ON FUNCTION public.sync_marketplace_banner_statuses() TO anon, authenticated;
