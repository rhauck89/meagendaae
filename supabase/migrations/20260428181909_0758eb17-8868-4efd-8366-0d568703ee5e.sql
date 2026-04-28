-- 1. Create service_categories_global
CREATE TABLE IF NOT EXISTS public.service_categories_global (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL,
    slug TEXT NOT NULL UNIQUE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.service_categories_global ENABLE ROW LEVEL SECURITY;

-- Everyone can read global categories
DO $$ BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Global categories are viewable by everyone') THEN
        CREATE POLICY "Global categories are viewable by everyone" 
        ON public.service_categories_global FOR SELECT USING (true);
    END IF;
END $$;

-- 2. Add global_category_id to service_categories (Local)
DO $$ BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='service_categories' AND column_name='global_category_id') THEN
        ALTER TABLE public.service_categories 
        ADD COLUMN global_category_id UUID REFERENCES public.service_categories_global(id);
    END IF;
END $$;

-- 3. Add global_category_id to services
DO $$ BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='services' AND column_name='global_category_id') THEN
        ALTER TABLE public.services 
        ADD COLUMN global_category_id UUID REFERENCES public.service_categories_global(id);
    END IF;
END $$;

-- 4. Create service_templates
CREATE TABLE IF NOT EXISTS public.service_templates (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    business_category_id UUID REFERENCES public.categories(id),
    global_category_id UUID REFERENCES public.service_categories_global(id),
    name TEXT NOT NULL,
    duration_minutes INTEGER NOT NULL,
    suggested_price NUMERIC(10,2) NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.service_templates ENABLE ROW LEVEL SECURITY;

-- Everyone can read templates
DO $$ BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Templates are viewable by everyone') THEN
        CREATE POLICY "Templates are viewable by everyone" 
        ON public.service_templates FOR SELECT USING (true);
    END IF;
END $$;

-- 5. Insert Initial Global Categories
INSERT INTO public.service_categories_global (name, slug) 
VALUES
('Corte', 'corte'),
('Barba', 'barba'),
('Unhas', 'unhas'),
('Sobrancelha', 'sobrancelha'),
('Pele', 'pele'),
('Massagem', 'massagem'),
('Depilação', 'depilacao'),
('Combo', 'combo'),
('Outros', 'outros')
ON CONFLICT (slug) DO NOTHING;

-- 6. Insert Templates linked to Business Categories
DO $$
DECLARE
    barber_id UUID;
    esthetic_id UUID;
    cat_corte UUID;
    cat_barba UUID;
    cat_unhas UUID;
    cat_sobrancelha UUID;
    cat_pele UUID;
    cat_combo UUID;
BEGIN
    SELECT id INTO barber_id FROM public.categories WHERE name = 'Barbearia' LIMIT 1;
    SELECT id INTO esthetic_id FROM public.categories WHERE name = 'Estética' LIMIT 1;
    
    SELECT id INTO cat_corte FROM public.service_categories_global WHERE slug = 'corte';
    SELECT id INTO cat_barba FROM public.service_categories_global WHERE slug = 'barba';
    SELECT id INTO cat_unhas FROM public.service_categories_global WHERE slug = 'unhas';
    SELECT id INTO cat_sobrancelha FROM public.service_categories_global WHERE slug = 'sobrancelha';
    SELECT id INTO cat_pele FROM public.service_categories_global WHERE slug = 'pele';
    SELECT id INTO cat_combo FROM public.service_categories_global WHERE slug = 'combo';

    -- Barbearia Templates
    IF barber_id IS NOT NULL THEN
        INSERT INTO public.service_templates (business_category_id, global_category_id, name, duration_minutes, suggested_price) 
        VALUES
        (barber_id, cat_corte, 'Corte Tradicional', 30, 40.00),
        (barber_id, cat_corte, 'Corte Degradê', 40, 50.00),
        (barber_id, cat_barba, 'Barba Simples', 20, 25.00),
        (barber_id, cat_barba, 'Barba Completa', 30, 35.00),
        (barber_id, cat_combo, 'Corte + Barba', 60, 75.00)
        ON CONFLICT DO NOTHING;
    END IF;

    -- Estética Templates
    IF esthetic_id IS NOT NULL THEN
        INSERT INTO public.service_templates (business_category_id, global_category_id, name, duration_minutes, suggested_price) 
        VALUES
        (esthetic_id, cat_unhas, 'Manicure', 30, 30.00),
        (esthetic_id, cat_unhas, 'Pedicure', 40, 35.00),
        (esthetic_id, cat_sobrancelha, 'Design de Sobrancelha', 30, 40.00),
        (esthetic_id, cat_pele, 'Limpeza de Pele', 60, 120.00)
        ON CONFLICT DO NOTHING;
    END IF;
END $$;

-- 7. Backfill existing services and categories
DO $$
DECLARE
    cat_corte UUID;
    cat_barba UUID;
    cat_unhas UUID;
    cat_sobrancelha UUID;
    cat_pele UUID;
    cat_combo UUID;
    cat_outros UUID;
BEGIN
    SELECT id INTO cat_corte FROM public.service_categories_global WHERE slug = 'corte';
    SELECT id INTO cat_barba FROM public.service_categories_global WHERE slug = 'barba';
    SELECT id INTO cat_unhas FROM public.service_categories_global WHERE slug = 'unhas';
    SELECT id INTO cat_sobrancelha FROM public.service_categories_global WHERE slug = 'sobrancelha';
    SELECT id INTO cat_pele FROM public.service_categories_global WHERE slug = 'pele';
    SELECT id INTO cat_combo FROM public.service_categories_global WHERE slug = 'combo';
    SELECT id INTO cat_outros FROM public.service_categories_global WHERE slug = 'outros';

    -- Update service_categories (local) based on their names
    UPDATE public.service_categories SET global_category_id = cat_corte WHERE name ILIKE '%corte%' OR name ILIKE '%cabelo%';
    UPDATE public.service_categories SET global_category_id = cat_barba WHERE name ILIKE '%barba%';
    UPDATE public.service_categories SET global_category_id = cat_unhas WHERE name ILIKE '%unha%' OR name ILIKE '%manicure%' OR name ILIKE '%pedicure%';
    UPDATE public.service_categories SET global_category_id = cat_sobrancelha WHERE name ILIKE '%sobrancelha%';
    UPDATE public.service_categories SET global_category_id = cat_pele WHERE name ILIKE '%pele%' OR name ILIKE '%facial%';
    UPDATE public.service_categories SET global_category_id = cat_combo WHERE name ILIKE '%combo%';

    -- Update services directly
    UPDATE public.services SET global_category_id = cat_corte WHERE name ILIKE '%corte%' OR name ILIKE '%cabelo%';
    UPDATE public.services SET global_category_id = cat_barba WHERE name ILIKE '%barba%';
    UPDATE public.services SET global_category_id = cat_unhas WHERE name ILIKE '%unha%' OR name ILIKE '%manicure%' OR name ILIKE '%pedicure%';
    UPDATE public.services SET global_category_id = cat_sobrancelha WHERE name ILIKE '%sobrancelha%';
    UPDATE public.services SET global_category_id = cat_pele WHERE name ILIKE '%pele%' OR name ILIKE '%facial%';
    UPDATE public.services SET global_category_id = cat_combo WHERE name ILIKE '%combo%';
    
    -- Fallback for remaining services
    UPDATE public.services SET global_category_id = cat_outros WHERE global_category_id IS NULL;
END $$;

-- 8. Final constraints and indexes
ALTER TABLE public.services ALTER COLUMN global_category_id SET NOT NULL;

CREATE INDEX IF NOT EXISTS idx_services_global_category_id ON public.services(global_category_id);
CREATE INDEX IF NOT EXISTS idx_service_categories_global_slug ON public.service_categories_global(slug);
