DROP FUNCTION IF EXISTS public.get_marketplace_featured_items(text, text, uuid, uuid, double precision, double precision, integer);
DROP FUNCTION IF EXISTS public.get_marketplace_featured_items(text, text, uuid, uuid, double precision, double precision, text, integer);

CREATE OR REPLACE FUNCTION public.get_marketplace_featured_items(
    p_highlight_type text,
    p_category text DEFAULT NULL,
    p_state_id uuid DEFAULT NULL,
    p_city_id uuid DEFAULT NULL,
    p_user_lat double precision DEFAULT NULL,
    p_user_lon double precision DEFAULT NULL,
    p_location_text text DEFAULT NULL,
    p_limit integer DEFAULT 12
)
RETURNS TABLE (
    id uuid,
    item_type text,
    company_id uuid,
    professional_id uuid,
    name text,
    slug text,
    logo_url text,
    cover_url text,
    city text,
    state text,
    average_rating numeric,
    review_count integer,
    business_type text,
    latitude numeric,
    longitude numeric,
    priority integer,
    is_manual boolean
) 
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
#variable_conflict use_column
BEGIN
    RETURN QUERY
    WITH manual_highlights AS (
        SELECT 
            mfi.id as h_id,
            mfi.item_type as h_item_type,
            mfi.company_id as h_company_id,
            mfi.professional_id as h_professional_id,
            mfi.priority as h_priority,
            TRUE as h_is_manual,
            CASE 
                WHEN mfi.item_type = 'company' THEN c.name
                ELSE p.full_name
            END as h_name,
            CASE 
                WHEN mfi.item_type = 'company' THEN c.slug
                ELSE comp_p.slug
            END as h_slug,
            CASE 
                WHEN mfi.item_type = 'company' THEN c.logo_url
                ELSE p.avatar_url
            END as h_logo_url,
            CASE 
                WHEN mfi.item_type = 'company' THEN c.cover_url
                ELSE comp_p.cover_url
            END as h_cover_url,
            CASE 
                WHEN mfi.item_type = 'company' THEN c.city
                ELSE comp_p.city
            END as h_city,
            CASE 
                WHEN mfi.item_type = 'company' THEN c.state
                ELSE comp_p.state
            END as h_state,
            CASE 
                WHEN mfi.item_type = 'company' THEN COALESCE(c.average_rating, 0)
                ELSE 0
            END as h_average_rating,
            CASE 
                WHEN mfi.item_type = 'company' THEN COALESCE(c.review_count, 0)
                ELSE 0
            END as h_review_count,
            CASE 
                WHEN mfi.item_type = 'company' THEN c.business_type::text
                ELSE comp_p.business_type::text
            END as h_business_type,
            CASE 
                WHEN mfi.item_type = 'company' THEN c.latitude
                ELSE comp_p.latitude
            END as h_latitude,
            CASE 
                WHEN mfi.item_type = 'company' THEN c.longitude
                ELSE comp_p.longitude
            END as h_longitude
        FROM public.marketplace_featured_items mfi
        LEFT JOIN public.public_company c ON c.id = mfi.company_id AND mfi.item_type = 'company'
        LEFT JOIN public.profiles p ON p.id = mfi.professional_id AND mfi.item_type = 'professional'
        LEFT JOIN public.public_company comp_p ON comp_p.id = mfi.company_id AND mfi.item_type = 'professional'
        WHERE mfi.status = 'active'
          AND mfi.highlight_type = p_highlight_type
          AND (mfi.start_at IS NULL OR mfi.start_at <= now())
          AND (mfi.end_at IS NULL OR mfi.end_at >= now())
          AND (p_category IS NULL OR (
              CASE 
                  WHEN mfi.item_type = 'company' THEN c.business_type::text = p_category
                  ELSE comp_p.business_type::text = p_category
              END
          ))
          AND (
              -- Regra 1: Geral / BR aparece sempre
              (mfi.state_id IS NULL AND mfi.city_id IS NULL AND mfi.city IS NULL AND mfi.state IS NULL)
              OR
              -- Regra 2: Segmentação Regional Estrita
              (
                  -- Se tem raio, verifica distância (opcional)
                  (mfi.radius_km IS NULL OR p_user_lat IS NULL OR (point(p_user_lon, p_user_lat) <-> point(mfi.longitude, mfi.latitude)) * 111.0 <= mfi.radius_km)
                  AND
                  (
                      -- Se não houve busca/localização informada, mostra tudo (fallback permissivo para quando não há filtro)
                      (p_state_id IS NULL AND p_city_id IS NULL AND (p_location_text IS NULL OR p_location_text = ''))
                      OR
                      -- Casamento por ID ou Texto
                      CASE 
                          -- Prioridade 1: Cidade Específica
                          WHEN mfi.city_id IS NOT NULL THEN (
                              p_city_id = mfi.city_id OR 
                              (p_location_text IS NOT NULL AND EXISTS (SELECT 1 FROM cities ci WHERE ci.id = mfi.city_id AND (ci.name ILIKE p_location_text OR ci.name ILIKE '%' || p_location_text || '%')))
                          )
                          WHEN mfi.city IS NOT NULL THEN (
                              p_location_text IS NOT NULL AND (mfi.city ILIKE p_location_text OR mfi.city ILIKE '%' || p_location_text || '%')
                          )
                          -- Prioridade 2: Estado Específico (sem cidade)
                          WHEN mfi.state_id IS NOT NULL THEN (
                              p_state_id = mfi.state_id OR 
                              (p_location_text IS NOT NULL AND EXISTS (SELECT 1 FROM states st WHERE st.id = mfi.state_id AND (st.name ILIKE p_location_text OR st.uf ILIKE p_location_text OR st.name ILIKE '%' || p_location_text || '%')))
                          )
                          WHEN mfi.state IS NOT NULL THEN (
                              p_location_text IS NOT NULL AND (mfi.state ILIKE p_location_text OR mfi.state ILIKE '%' || p_location_text || '%')
                          )
                          ELSE TRUE
                      END
                  )
              )
          )
    ),
    automatic_highlights AS (
        SELECT 
            gen_random_uuid() as h_id,
            'company'::text as h_item_type,
            c.id as h_company_id,
            NULL::uuid as h_professional_id,
            0 as h_priority,
            FALSE as h_is_manual,
            c.name as h_name,
            c.slug as h_slug,
            c.logo_url as h_logo_url,
            c.cover_url as h_cover_url,
            c.city as h_city,
            c.state as h_state,
            COALESCE(c.average_rating, 0) as h_average_rating,
            COALESCE(c.review_count, 0) as h_review_count,
            c.business_type::text as h_business_type,
            c.latitude as h_latitude,
            c.longitude as h_longitude
        FROM public.public_company c
        WHERE c.average_rating >= 4.5 
          AND c.review_count >= 1
          AND p_highlight_type IN ('featured_large', 'featured_medium')
          AND (p_category IS NULL OR c.business_type::text = p_category)
          AND (
              (p_city_id IS NULL AND p_state_id IS NULL AND (p_location_text IS NULL OR p_location_text = ''))
              OR (p_city_id IS NOT NULL AND EXISTS (SELECT 1 FROM public.marketplace_featured_items mfi WHERE mfi.company_id = c.id AND mfi.city_id = p_city_id))
              OR (p_location_text IS NOT NULL AND (c.city ILIKE '%' || p_location_text || '%' OR c.state ILIKE '%' || p_location_text || '%'))
          )
    ),
    merged_results AS (
        SELECT * FROM manual_highlights
        UNION ALL
        SELECT * FROM automatic_highlights
        WHERE h_company_id NOT IN (SELECT m.h_company_id FROM manual_highlights m WHERE m.h_company_id IS NOT NULL)
    )
    SELECT 
        mr.h_id,
        mr.h_item_type,
        mr.h_company_id,
        mr.h_professional_id,
        mr.h_name,
        mr.h_slug,
        mr.h_logo_url,
        mr.h_cover_url,
        mr.h_city,
        mr.h_state,
        mr.h_average_rating::numeric,
        mr.h_review_count,
        mr.h_business_type,
        mr.h_latitude::numeric,
        mr.h_longitude::numeric,
        mr.h_priority,
        mr.h_is_manual
    FROM merged_results mr
    ORDER BY mr.h_is_manual DESC, mr.h_priority DESC, mr.h_average_rating DESC
    LIMIT p_limit;
END;
$$;