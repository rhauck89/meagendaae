
DROP VIEW IF EXISTS public.public_promotions;

CREATE VIEW public.public_promotions WITH (security_barrier = true) AS
SELECT 
  p.id,
  p.company_id,
  p.service_id,
  p.service_ids,
  p.title,
  p.description,
  p.promotion_price,
  p.original_price,
  p.discount_type,
  p.discount_value,
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
  p.promotion_type,
  p.cashback_validity_days,
  p.cashback_rules_text,
  s.name AS service_name,
  s.duration_minutes AS service_duration
FROM promotions p
LEFT JOIN services s ON s.id = p.service_id
WHERE p.status = 'active' AND p.end_date >= CURRENT_DATE;

GRANT SELECT ON public.public_promotions TO anon, authenticated;
