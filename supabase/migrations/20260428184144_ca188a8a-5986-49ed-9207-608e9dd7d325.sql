-- 1. Auditoria Avançada de Migração
CREATE TABLE IF NOT EXISTS public.migration_audit_log (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    entity_type TEXT NOT NULL,
    entity_id UUID NOT NULL,
    action TEXT NOT NULL,
    status TEXT NOT NULL,
    confidence_level TEXT,
    match_type TEXT,
    message TEXT,
    created_at TIMESTAMPTZ DEFAULT now()
);

-- 2. Categoria Global "Outros"
INSERT INTO public.service_categories_global (name, slug)
VALUES ('Outros', 'outros')
ON CONFLICT (slug) DO NOTHING;

-- 3. Padronização is_active
DO $$ BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='companies' AND column_name='is_active') THEN
        ALTER TABLE public.companies ADD COLUMN is_active BOOLEAN DEFAULT true;
    END IF;
END $$;

-- 4. Ajustes em Service Templates
ALTER TABLE public.service_templates 
ADD COLUMN IF NOT EXISTS is_active BOOLEAN DEFAULT true,
ADD COLUMN IF NOT EXISTS version INTEGER DEFAULT 1;

-- 5. Índices de Performance
CREATE INDEX IF NOT EXISTS idx_service_templates_business_category ON public.service_templates(business_category_id);
CREATE INDEX IF NOT EXISTS idx_services_company_global_cat ON public.services(company_id, global_category_id);
CREATE INDEX IF NOT EXISTS idx_services_active ON public.services(active);
CREATE INDEX IF NOT EXISTS idx_companies_is_active ON public.companies(is_active);

-- 6. Normalização de Slugs
CREATE OR REPLACE FUNCTION public.normalize_slug(input_text TEXT)
RETURNS TEXT AS $$
BEGIN
    RETURN lower(
        regexp_replace(
            regexp_replace(
                unaccent(input_text),
                '[^a-zA-Z0-9\s-]', '', 'g'
            ),
            '\s+', '-', 'g'
        )
    );
END;
$$ LANGUAGE plpgsql IMMUTABLE;

CREATE OR REPLACE FUNCTION public.trigger_normalize_global_category_slug()
RETURNS TRIGGER AS $$
BEGIN
    IF NEW.name IS NOT NULL THEN
        NEW.slug := public.normalize_slug(NEW.name);
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_normalize_service_cat_global_slug ON public.service_categories_global;
CREATE TRIGGER trg_normalize_service_cat_global_slug
BEFORE INSERT OR UPDATE ON public.service_categories_global
FOR EACH ROW EXECUTE FUNCTION public.trigger_normalize_global_category_slug();

-- 7. Trigger de Auto-Correção
CREATE OR REPLACE FUNCTION public.handle_service_global_consistency()
RETURNS TRIGGER AS $$
DECLARE
    v_local_global_id UUID;
    v_fallback_id UUID;
BEGIN
    SELECT global_category_id INTO v_local_global_id 
    FROM public.service_categories 
    WHERE id = NEW.category_id;

    IF NEW.global_category_id IS NULL AND v_local_global_id IS NOT NULL THEN
        NEW.global_category_id := v_local_global_id;
    END IF;

    IF NEW.global_category_id IS NULL THEN
        SELECT id INTO v_fallback_id FROM public.service_categories_global WHERE slug = 'outros' LIMIT 1;
        NEW.global_category_id := v_fallback_id;
    END IF;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_service_global_consistency ON public.services;
CREATE TRIGGER trg_service_global_consistency
BEFORE INSERT OR UPDATE ON public.services
FOR EACH ROW EXECUTE FUNCTION public.handle_service_global_consistency();

-- 8. View do Marketplace
CREATE OR REPLACE VIEW public.marketplace_active_services AS
SELECT 
    s.id as service_id,
    s.name as service_name,
    s.price,
    s.duration_minutes as duration,
    s.global_category_id,
    scg.name as global_category_name,
    scg.slug as global_category_slug,
    c.id as company_id,
    c.name as company_name,
    c.slug as company_slug
FROM public.services s
JOIN public.service_categories_global scg ON s.global_category_id = scg.id
JOIN public.companies c ON s.company_id = c.id
WHERE s.active = true 
  AND c.is_active = true
  AND s.global_category_id IS NOT NULL;

-- 9. Backfill
DO $$
DECLARE
    r RECORD;
    v_global_id UUID;
    v_fallback_id UUID;
    v_match_type TEXT;
    v_confidence TEXT;
BEGIN
    SELECT id INTO v_fallback_id FROM public.service_categories_global WHERE slug = 'outros' LIMIT 1;

    FOR r IN SELECT id, name FROM public.services WHERE global_category_id IS NULL LOOP
        v_global_id := NULL;
        v_match_type := 'auto';
        v_confidence := 'high';

        SELECT id INTO v_global_id 
        FROM public.service_categories_global 
        WHERE slug = public.normalize_slug(r.name)
        LIMIT 1;

        IF v_global_id IS NULL THEN
            SELECT id INTO v_global_id 
            FROM public.service_categories_global 
            WHERE r.name ILIKE '%' || name || '%'
              AND slug != 'outros'
            ORDER BY length(name) DESC LIMIT 1;
            
            v_confidence := 'medium';
        END IF;

        IF v_global_id IS NULL THEN
            v_global_id := v_fallback_id;
            v_match_type := 'fallback';
            v_confidence := 'low';
        END IF;

        UPDATE public.services SET global_category_id = v_global_id WHERE id = r.id;

        INSERT INTO public.migration_audit_log (entity_type, entity_id, action, status, confidence_level, match_type, message)
        VALUES ('service', r.id, 'backfill_mapping', 'success', v_confidence, v_match_type, 'Mapped service: ' || r.name);
    END LOOP;
END $$;
