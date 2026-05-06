-- Create states table
CREATE TABLE public.states (
    id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
    name TEXT NOT NULL UNIQUE,
    uf CHAR(2) NOT NULL UNIQUE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Create cities table
CREATE TABLE public.cities (
    id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
    name TEXT NOT NULL,
    state_id UUID NOT NULL REFERENCES public.states(id) ON DELETE CASCADE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
    UNIQUE(name, state_id)
);

-- Enable RLS
ALTER TABLE public.states ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.cities ENABLE ROW LEVEL SECURITY;

-- Public read access
CREATE POLICY "States are viewable by everyone" ON public.states FOR SELECT USING (true);
CREATE POLICY "Cities are viewable by everyone" ON public.cities FOR SELECT USING (true);

-- Super Admin management
CREATE POLICY "Super admin can manage states" ON public.states 
USING (EXISTS (SELECT 1 FROM user_roles ur WHERE ur.user_id = auth.uid() AND ur.role = 'super_admin'));

CREATE POLICY "Super admin can manage cities" ON public.cities 
USING (EXISTS (SELECT 1 FROM user_roles ur WHERE ur.user_id = auth.uid() AND ur.role = 'super_admin'));

-- Populate States
INSERT INTO public.states (name, uf) VALUES
('Acre', 'AC'), ('Alagoas', 'AL'), ('Amapá', 'AP'), ('Amazonas', 'AM'), ('Bahia', 'BA'),
('Ceará', 'CE'), ('Distrito Federal', 'DF'), ('Espírito Santo', 'ES'), ('Goiás', 'GO'),
('Maranhão', 'MA'), ('Mato Grosso', 'MT'), ('Mato Grosso do Sul', 'MS'), ('Minas Gerais', 'MG'),
('Pará', 'PA'), ('Paraíba', 'PB'), ('Paraná', 'PR'), ('Pernambuco', 'PE'), ('Piauí', 'PI'),
('Rio de Janeiro', 'RJ'), ('Rio Grande do Norte', 'RN'), ('Rio Grande do Sul', 'RS'),
('Rondônia', 'RO'), ('Roraima', 'RR'), ('Santa Catarina', 'SC'), ('São Paulo', 'SP'),
('Sergipe', 'SE'), ('Tocantins', 'TO');

-- Populate Initial Cities (Capitals + Currently used)
DO $$
DECLARE
    mg_id UUID;
    sp_id UUID;
    rj_id UUID;
BEGIN
    SELECT id INTO mg_id FROM public.states WHERE uf = 'MG';
    SELECT id INTO sp_id FROM public.states WHERE uf = 'SP';
    SELECT id INTO rj_id FROM public.states WHERE uf = 'RJ';

    INSERT INTO public.cities (name, state_id) VALUES 
    ('Belo Horizonte', mg_id), ('Juiz de Fora', mg_id), ('Santos Dumont', mg_id),
    ('São Paulo', sp_id), ('Campinas', sp_id),
    ('Rio de Janeiro', rj_id);
END $$;

-- Update marketplace_featured_items table
ALTER TABLE public.marketplace_featured_items 
ADD COLUMN state_id UUID REFERENCES public.states(id),
ADD COLUMN city_id UUID REFERENCES public.cities(id),
ADD COLUMN latitude DOUBLE PRECISION,
ADD COLUMN longitude DOUBLE PRECISION,
ADD COLUMN radius_km DOUBLE PRECISION;

-- Migration to link existing text states/cities to new IDs where possible
DO $$
DECLARE
    r RECORD;
    s_id UUID;
    c_id UUID;
BEGIN
    FOR r IN SELECT id, state, city FROM public.marketplace_featured_items WHERE state IS NOT NULL LOOP
        SELECT id INTO s_id FROM public.states WHERE uf = r.state OR name = r.state;
        IF s_id IS NOT NULL THEN
            UPDATE public.marketplace_featured_items SET state_id = s_id WHERE id = r.id;
            
            IF r.city IS NOT NULL THEN
                SELECT id INTO c_id FROM public.cities WHERE name = r.city AND state_id = s_id;
                IF c_id IS NOT NULL THEN
                    UPDATE public.marketplace_featured_items SET city_id = c_id WHERE id = r.id;
                END IF;
            END IF;
        END IF;
    END LOOP;
END $$;

-- Create or replace relevance RPC
CREATE OR REPLACE FUNCTION get_marketplace_featured_items(
    p_highlight_type TEXT,
    p_category TEXT DEFAULT NULL,
    p_state_id UUID DEFAULT NULL,
    p_city_id UUID DEFAULT NULL,
    p_user_lat DOUBLE PRECISION DEFAULT NULL,
    p_user_lon DOUBLE PRECISION DEFAULT NULL
)
RETURNS TABLE (
    id UUID,
    item_type TEXT,
    company_id UUID,
    professional_id UUID,
    highlight_type TEXT,
    relevance_score DOUBLE PRECISION,
    item_details JSONB
) LANGUAGE plpgsql AS $$
BEGIN
    RETURN QUERY
    WITH items_with_scores AS (
        SELECT 
            mfi.id,
            mfi.item_type,
            mfi.company_id,
            mfi.professional_id,
            mfi.highlight_type,
            -- Calculate score
            (
                (CASE WHEN mfi.priority IS NOT NULL THEN mfi.priority ELSE 0 END * 10.0) +
                (CASE WHEN mfi.state_id = p_state_id THEN 20.0 ELSE 0.0 END) +
                (CASE WHEN mfi.city_id = p_city_id THEN 30.0 ELSE 0.0 END) +
                (CASE WHEN p_category IS NOT NULL AND mfi.category = p_category THEN 15.0 ELSE 0.0 END) -
                -- Geographical proximity penalty (if enabled)
                (CASE 
                    WHEN p_user_lat IS NOT NULL AND p_user_lon IS NOT NULL AND mfi.latitude IS NOT NULL AND mfi.longitude IS NOT NULL
                    THEN LEAST(point(p_user_lon, p_user_lat) <-> point(mfi.longitude, mfi.latitude) * 1.11, 50.0)
                    ELSE 0.0 
                END)
            ) as score,
            -- Subquery to get details (company or professional)
            CASE 
                WHEN mfi.item_type = 'company' THEN (
                    SELECT jsonb_build_object(
                        'name', c.name,
                        'logo_url', c.logo_url,
                        'rating', c.rating,
                        'city', mfi.city -- Fallback to text city if id not used
                    ) FROM companies c WHERE c.id = mfi.company_id
                )
                WHEN mfi.item_type = 'professional' THEN (
                    SELECT jsonb_build_object(
                        'name', p.full_name,
                        'avatar_url', p.avatar_url,
                        'company_name', c.name,
                        'rating', 0, -- Default for professionals
                        'city', mfi.city
                    ) FROM profiles p 
                    LEFT JOIN companies c ON c.id = mfi.company_id
                    WHERE p.id = mfi.professional_id
                )
            END as details
        FROM public.marketplace_featured_items mfi
        WHERE mfi.status = 'active'
          AND mfi.highlight_type = p_highlight_type
          AND (mfi.start_at IS NULL OR mfi.start_at <= now())
          AND (mfi.end_at IS NULL OR mfi.end_at >= now())
          -- Regional filtering: if item has a state/city set, it must match the filter (if filter provided)
          -- If no filter provided, item is shown nationally (if no state_id is set) or filtered by its own limits
          AND (
              (mfi.state_id IS NULL AND mfi.city_id IS NULL) OR -- National
              (p_state_id IS NULL AND p_city_id IS NULL) OR -- Global search
              (mfi.state_id = p_state_id AND (mfi.city_id IS NULL OR mfi.city_id = p_city_id))
          )
          -- Radius check
          AND (
              mfi.radius_km IS NULL OR 
              p_user_lat IS NULL OR 
              (point(p_user_lon, p_user_lat) <-> point(mfi.longitude, mfi.latitude)) * 111.0 <= mfi.radius_km
          )
    )
    SELECT 
        i.id, i.item_type, i.company_id, i.professional_id, i.highlight_type, i.score, i.details
    FROM items_with_scores i
    ORDER BY i.score DESC;
END;
$$;