
-- Add new columns to promotions
ALTER TABLE public.promotions
  ADD COLUMN IF NOT EXISTS slug text,
  ADD COLUMN IF NOT EXISTS service_id uuid REFERENCES public.services(id),
  ADD COLUMN IF NOT EXISTS promotion_price numeric,
  ADD COLUMN IF NOT EXISTS original_price numeric,
  ADD COLUMN IF NOT EXISTS created_by uuid;

-- Create promotion_clicks for metrics
CREATE TABLE IF NOT EXISTS public.promotion_clicks (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  promotion_id uuid NOT NULL REFERENCES public.promotions(id) ON DELETE CASCADE,
  client_id uuid REFERENCES public.clients(id),
  company_id uuid NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  created_at timestamp with time zone NOT NULL DEFAULT now()
);

ALTER TABLE public.promotion_clicks ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Company members can manage promotion clicks"
  ON public.promotion_clicks FOR ALL
  TO authenticated
  USING (company_id = get_my_company_id())
  WITH CHECK (company_id = get_my_company_id());

-- Allow public inserts for click tracking (anonymous)
CREATE POLICY "Public can track clicks"
  ON public.promotion_clicks FOR INSERT
  TO public
  WITH CHECK (true);

-- Update public_promotions view
DROP VIEW IF EXISTS public.public_promotions;

CREATE VIEW public.public_promotions
WITH (security_invoker = true) AS
SELECT
  p.id,
  p.company_id,
  p.title,
  p.description,
  p.slug,
  p.start_date,
  p.end_date,
  p.start_time,
  p.end_time,
  p.max_slots,
  p.used_slots,
  p.service_id,
  p.promotion_price,
  p.original_price,
  p.professional_filter,
  p.professional_ids,
  p.created_by,
  p.status,
  s.name as service_name,
  s.duration_minutes as service_duration
FROM public.promotions p
LEFT JOIN public.services s ON s.id = p.service_id
WHERE p.status = 'active' AND p.end_date >= CURRENT_DATE;

GRANT SELECT ON public.public_promotions TO anon, authenticated;

-- Add unique constraint for slug per company
CREATE UNIQUE INDEX IF NOT EXISTS promotions_company_slug_unique ON public.promotions (company_id, slug) WHERE slug IS NOT NULL;
