
-- 1. Create public_company_settings view (security barrier)
CREATE OR REPLACE VIEW public.public_company_settings WITH (security_barrier = true) AS
SELECT
  cs.company_id,
  cs.primary_color,
  cs.secondary_color,
  cs.background_color,
  cs.logo_url,
  cs.timezone,
  cs.booking_buffer_minutes
FROM public.company_settings cs;

-- Grant access to the view
GRANT SELECT ON public.public_company_settings TO anon, authenticated;

-- Remove public SELECT on company_settings base table
DROP POLICY IF EXISTS "Public can view company settings" ON public.company_settings;

-- 2. Replace public_promotions view to hide internal fields
DROP VIEW IF EXISTS public.public_promotions;

CREATE OR REPLACE VIEW public.public_promotions WITH (security_barrier = true) AS
SELECT
  p.id,
  p.company_id,
  p.service_id,
  p.title,
  p.description,
  p.promotion_price,
  p.original_price,
  p.start_date,
  p.end_date,
  p.start_time,
  p.end_time,
  p.max_slots,
  p.used_slots,
  p.slug,
  p.status,
  p.professional_filter,
  p.professional_ids,
  p.created_by,
  s.name AS service_name,
  s.duration_minutes AS service_duration
FROM public.promotions p
LEFT JOIN public.services s ON s.id = p.service_id
WHERE p.status = 'active' AND p.end_date >= CURRENT_DATE;

GRANT SELECT ON public.public_promotions TO anon, authenticated;

-- 3. Create public_blocked_times view (hides reason)
CREATE OR REPLACE VIEW public.public_blocked_times WITH (security_barrier = true) AS
SELECT
  bt.id,
  bt.company_id,
  bt.professional_id,
  bt.block_date,
  bt.start_time,
  bt.end_time
FROM public.blocked_times bt;

GRANT SELECT ON public.public_blocked_times TO anon, authenticated;

-- Remove broad public SELECT on blocked_times base table
DROP POLICY IF EXISTS "Public can view blocked times" ON public.blocked_times;
