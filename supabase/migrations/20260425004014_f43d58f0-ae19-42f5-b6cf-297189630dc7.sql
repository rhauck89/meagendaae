-- Add unique constraint to prevent duplicate categories for the same company (if not already added)
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'company_revenue_categories_company_id_name_key') THEN
        ALTER TABLE public.company_revenue_categories ADD CONSTRAINT company_revenue_categories_company_id_name_key UNIQUE (company_id, name);
    END IF;
END $$;

-- Create/Update a function to ensure a category exists and return its ID
CREATE OR REPLACE FUNCTION public.get_or_create_revenue_category(p_company_id UUID, p_name TEXT)
RETURNS UUID AS $$
DECLARE
    v_category_id UUID;
BEGIN
    -- Try to get existing category
    SELECT id INTO v_category_id
    FROM public.company_revenue_categories
    WHERE company_id = p_company_id AND LOWER(name) = LOWER(p_name)
    LIMIT 1;

    -- If not found, create it
    IF v_category_id IS NULL THEN
        INSERT INTO public.company_revenue_categories (company_id, name)
        VALUES (p_company_id, p_name)
        ON CONFLICT (company_id, name) DO UPDATE SET name = EXCLUDED.name
        RETURNING id INTO v_category_id;
    END IF;

    RETURN v_category_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Backfill existing automatic revenues from appointments
DO $$
DECLARE
    r RECORD;
    v_cat_id UUID;
BEGIN
    FOR r IN SELECT DISTINCT company_id FROM public.company_revenues WHERE is_automatic = true AND category_id IS NULL LOOP
        v_cat_id := public.get_or_create_revenue_category(r.company_id, 'Serviços');
        
        UPDATE public.company_revenues
        SET category_id = v_cat_id
        WHERE company_id = r.company_id AND is_automatic = true AND category_id IS NULL;
    END LOOP;
END $$;

-- Seed default categories for all existing companies
DO $$
DECLARE
    comp RECORD;
    cat_name TEXT;
    default_categories TEXT[] := ARRAY['Serviços', 'Produtos', 'Cashback', 'Promoções', 'Taxa Extra', 'Assinaturas', 'Outros'];
BEGIN
    FOR comp IN SELECT id FROM public.companies LOOP
        FOREACH cat_name IN ARRAY default_categories LOOP
            PERFORM public.get_or_create_revenue_category(comp.id, cat_name);
        END LOOP;
    END LOOP;
END $$;
