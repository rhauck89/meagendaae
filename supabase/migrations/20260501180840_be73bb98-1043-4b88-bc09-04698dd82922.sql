-- Add new columns for booking availability
ALTER TABLE public.promotions 
ADD COLUMN booking_opens_at TIMESTAMP WITH TIME ZONE,
ADD COLUMN booking_closes_at TIMESTAMP WITH TIME ZONE;

-- Backfill existing promotions
-- For active promotions, we set booking_opens_at to their creation date or now if they are active,
-- so they remain available for booking immediately.
UPDATE public.promotions
SET booking_opens_at = created_at
WHERE status = 'active' AND booking_opens_at IS NULL;

-- For scheduled promotions, we can set it to the start of the promotion period by default
-- if they haven't started yet.
UPDATE public.promotions
SET booking_opens_at = (start_date || ' ' || COALESCE(start_time, '00:00:00'))::timestamp AT TIME ZONE 'UTC'
WHERE status = 'active' AND booking_opens_at IS NULL;

-- Update the public view to include the new columns
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
    s.name AS service_name,
    s.duration_minutes AS service_duration
   FROM promotions p
     LEFT JOIN services s ON s.id = p.service_id
  WHERE p.status = 'active'::text AND p.end_date >= CURRENT_DATE;
