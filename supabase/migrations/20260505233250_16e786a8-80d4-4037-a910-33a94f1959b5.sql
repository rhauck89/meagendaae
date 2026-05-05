-- Atualizar a tabela marketplace_featured_items para o novo modelo de gestão manual
ALTER TABLE public.marketplace_featured_items 
ADD COLUMN IF NOT EXISTS highlight_type TEXT DEFAULT 'featured_large', -- featured_large, featured_medium, featured_logo
ADD COLUMN IF NOT EXISTS professional_id UUID REFERENCES public.profiles(id),
ADD COLUMN IF NOT EXISTS start_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
ADD COLUMN IF NOT EXISTS end_at TIMESTAMP WITH TIME ZONE,
ADD COLUMN IF NOT EXISTS priority INTEGER DEFAULT 100,
ADD COLUMN IF NOT EXISTS rotation_weight INTEGER DEFAULT 1,
ADD COLUMN IF NOT EXISTS country TEXT DEFAULT 'Brasil',
ADD COLUMN IF NOT EXISTS state TEXT,
ADD COLUMN IF NOT EXISTS city TEXT,
ADD COLUMN IF NOT EXISTS neighborhood TEXT,
ADD COLUMN IF NOT EXISTS internal_notes TEXT;

-- Ajustar a coluna position caso exista (renomear ou manter como legado, mas usaremos highlight_type)
DO $$ 
BEGIN 
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='marketplace_featured_items' AND column_name='position') THEN
    UPDATE public.marketplace_featured_items SET highlight_type = 'featured_large' WHERE position = 'main';
    UPDATE public.marketplace_featured_items SET highlight_type = 'featured_medium' WHERE position = 'secondary';
  END IF;
END $$;

-- Criar RPC para sincronizar status de destaques baseados na data
CREATE OR REPLACE FUNCTION public.sync_marketplace_featured_statuses()
RETURNS void AS $$
BEGIN
  -- Marcar como encerrado se passou da data fim
  UPDATE public.marketplace_featured_items
  SET status = 'ended'
  WHERE status IN ('active', 'scheduled')
    AND end_at IS NOT NULL
    AND end_at < now();

  -- Marcar como ativo se chegou na data início e estava programado
  UPDATE public.marketplace_featured_items
  SET status = 'active'
  WHERE status = 'scheduled'
    AND start_at <= now()
    AND (end_at IS NULL OR end_at > now());
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Criar RPC para buscar destaques unificados (manuais + automáticos) com deduplicação
-- Esta função retorna os itens para as seções do marketplace
CREATE OR REPLACE FUNCTION public.get_marketplace_featured_items(
  p_highlight_type TEXT,
  p_city TEXT DEFAULT NULL,
  p_limit INTEGER DEFAULT 12
)
RETURNS TABLE (
  id UUID,
  item_type TEXT, -- 'company' ou 'professional'
  item_id UUID,
  name TEXT,
  slug TEXT,
  logo_url TEXT,
  cover_url TEXT,
  city TEXT,
  state TEXT,
  average_rating NUMERIC,
  review_count INTEGER,
  business_type TEXT,
  latitude NUMERIC,
  longitude NUMERIC,
  is_manual BOOLEAN,
  priority INTEGER
) AS $$
BEGIN
  RETURN QUERY
  WITH manual_highlights AS (
    -- Destaques Manuais Ativos
    SELECT 
      mfi.id as highlight_id,
      mfi.company_id,
      mfi.professional_id,
      mfi.priority,
      TRUE as is_manual
    FROM public.marketplace_featured_items mfi
    WHERE mfi.status = 'active'
      AND mfi.highlight_type = p_highlight_type
      AND mfi.start_at <= now()
      AND (mfi.end_at IS NULL OR mfi.end_at > now())
      AND (p_city IS NULL OR mfi.city IS NULL OR mfi.city ILIKE '%' || p_city || '%')
  ),
  automatic_highlights AS (
    -- Simulação de destaques automáticos (ex: empresas com avaliação alta e review_count > 0)
    SELECT 
      c.id as company_id,
      NULL::UUID as professional_id,
      0 as priority,
      FALSE as is_manual
    FROM public.public_company c
    WHERE c.average_rating >= 4.5 
      AND c.review_count >= 1
      AND (p_city IS NULL OR c.city ILIKE '%' || p_city || '%')
      AND p_highlight_type IN ('featured_large', 'featured_medium') -- Automáticos não aparecem na faixa de logos por padrão
  ),
  merged_items AS (
    -- Unir manuais primeiro para garantir prioridade na deduplicação
    SELECT * FROM manual_highlights
    UNION ALL
    SELECT 
      gen_random_uuid() as highlight_id,
      ah.company_id,
      ah.professional_id,
      ah.priority,
      ah.is_manual
    FROM automatic_highlights ah
    WHERE ah.company_id NOT IN (SELECT company_id FROM manual_highlights WHERE company_id IS NOT NULL)
  )
  SELECT 
    mi.highlight_id as id,
    CASE WHEN mi.company_id IS NOT NULL THEN 'company' ELSE 'professional' END as item_type,
    COALESCE(mi.company_id, mi.professional_id) as item_id,
    c.name,
    c.slug,
    c.logo_url,
    c.cover_url,
    c.city,
    c.state,
    c.average_rating::NUMERIC,
    c.review_count,
    c.business_type,
    c.latitude,
    c.longitude,
    mi.is_manual,
    mi.priority
  FROM merged_items mi
  JOIN public.public_company c ON c.id = mi.company_id -- Simplificado: tratando apenas empresas para este exemplo de Marketplace
  ORDER BY mi.is_manual DESC, mi.priority DESC, c.average_rating DESC
  LIMIT p_limit;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
