-- Expose promotion incentive metadata to the public booking flow.
-- The booking page must be able to distinguish ordinary discounts from
-- double cashback / double points promotions for the exact same slot.

DROP VIEW IF EXISTS public.public_promotions;

CREATE VIEW public.public_promotions AS
 SELECT p.id,
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
    p.booking_opens_at,
    p.booking_closes_at,
    p.message_template,
    p.promotion_mode,
    p.source_insight,
    p.metadata,
    s.name AS service_name,
    s.duration_minutes AS service_duration
   FROM public.promotions p
     LEFT JOIN public.services s ON s.id = p.service_id
  WHERE p.status = 'active'::text
    AND p.end_date >= CURRENT_DATE;

GRANT SELECT ON public.public_promotions TO anon, authenticated;