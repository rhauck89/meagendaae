-- Criar índice para performance de relatórios
CREATE INDEX IF NOT EXISTS idx_banner_events_stats 
ON public.marketplace_banner_events(banner_id, event_type, created_at);

-- Função para relatório consolidado de banners
CREATE OR REPLACE FUNCTION public.get_marketplace_banner_report(
  p_start_date timestamptz DEFAULT NULL,
  p_end_date timestamptz DEFAULT NULL,
  p_status text DEFAULT NULL,
  p_position text DEFAULT NULL,
  p_state text DEFAULT NULL,
  p_city text DEFAULT NULL,
  p_category text DEFAULT NULL,
  p_advertiser text DEFAULT NULL,
  p_banner_id uuid DEFAULT NULL
)
RETURNS TABLE (
  r_banner_id uuid,
  r_name text,
  r_client_name text,
  r_position text,
  r_status text,
  r_state text,
  r_city text,
  r_category text,
  r_start_date timestamptz,
  r_end_date timestamptz,
  r_sale_model text,
  r_limit_impressions integer,
  r_limit_clicks integer,
  r_impressions bigint,
  r_clicks bigint,
  r_ctr float
) 
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  -- Verificar se o usuário é super_admin
  IF NOT EXISTS (
    SELECT 1 FROM public.profiles
    WHERE id = auth.uid() AND role = 'super_admin'
  ) THEN
    RAISE EXCEPTION 'Acesso negado. Apenas super administradores podem acessar relatórios.';
  END IF;

  RETURN QUERY
  SELECT 
    b.id as r_banner_id,
    b.name as r_name,
    b.client_name as r_client_name,
    b.position as r_position,
    b.status as r_status,
    b.state as r_state,
    b.city as r_city,
    b.category as r_category,
    b.start_date as r_start_date,
    b.end_date as r_end_date,
    b.sale_model as r_sale_model,
    b.limit_impressions as r_limit_impressions,
    b.limit_clicks as r_limit_clicks,
    COALESCE(count(e.id) FILTER (WHERE e.event_type = 'impression'), 0)::bigint as r_impressions,
    COALESCE(count(e.id) FILTER (WHERE e.event_type = 'click'), 0)::bigint as r_clicks,
    CASE 
      WHEN count(e.id) FILTER (WHERE e.event_type = 'impression') > 0 
      THEN ROUND((count(e.id) FILTER (WHERE e.event_type = 'click')::float / count(e.id) FILTER (WHERE e.event_type = 'impression')::float * 100)::numeric, 2)::float
      ELSE 0
    END as r_ctr
  FROM public.marketplace_banners b
  LEFT JOIN public.marketplace_banner_events e ON b.id = e.banner_id
    AND (p_start_date IS NULL OR e.created_at >= p_start_date)
    AND (p_end_date IS NULL OR e.created_at <= p_end_date)
  WHERE b.deleted_at IS NULL
    AND (p_status IS NULL OR b.status = p_status)
    AND (p_position IS NULL OR b.position = p_position)
    AND (p_state IS NULL OR b.state = p_state)
    AND (p_city IS NULL OR b.city = p_city)
    AND (p_category IS NULL OR b.category = p_category)
    AND (p_advertiser IS NULL OR b.client_name ILIKE '%' || p_advertiser || '%')
    AND (p_banner_id IS NULL OR b.id = p_banner_id)
  GROUP BY b.id;
END;
$$;

-- Função para estatísticas diárias de um banner
CREATE OR REPLACE FUNCTION public.get_marketplace_banner_daily_stats(
  p_banner_id uuid,
  p_start_date timestamptz DEFAULT NULL,
  p_end_date timestamptz DEFAULT NULL
)
RETURNS TABLE (
  r_stat_date date,
  r_impressions bigint,
  r_clicks bigint,
  r_ctr float
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  -- Verificar se o usuário é super_admin
  IF NOT EXISTS (
    SELECT 1 FROM public.profiles
    WHERE id = auth.uid() AND role = 'super_admin'
  ) THEN
    RAISE EXCEPTION 'Acesso negado. Apenas super administradores podem acessar relatórios.';
  END IF;

  RETURN QUERY
  SELECT 
    e.created_at::date as r_stat_date,
    count(e.id) FILTER (WHERE e.event_type = 'impression')::bigint as r_impressions,
    count(e.id) FILTER (WHERE e.event_type = 'click')::bigint as r_clicks,
    CASE 
      WHEN count(e.id) FILTER (WHERE e.event_type = 'impression') > 0 
      THEN ROUND((count(e.id) FILTER (WHERE e.event_type = 'click')::float / count(e.id) FILTER (WHERE e.event_type = 'impression')::float * 100)::numeric, 2)::float
      ELSE 0
    END as r_ctr
  FROM public.marketplace_banner_events e
  WHERE e.banner_id = p_banner_id
    AND (p_start_date IS NULL OR e.created_at >= p_start_date)
    AND (p_end_date IS NULL OR e.created_at <= p_end_date)
  GROUP BY r_stat_date
  ORDER BY r_stat_date ASC;
END;
$$;
