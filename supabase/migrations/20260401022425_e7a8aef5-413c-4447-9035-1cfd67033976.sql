
-- Drop the public policy that exposes internal fields
DROP POLICY IF EXISTS "Public can view active promotions" ON public.promotions;

-- Create a safe public view
CREATE OR REPLACE VIEW public.public_promotions AS
SELECT
  id,
  company_id,
  title,
  description,
  start_date,
  end_date,
  start_time,
  end_time,
  max_slots,
  used_slots,
  status
FROM public.promotions
WHERE status = 'active' AND end_date >= CURRENT_DATE;

-- Grant SELECT on the view to anon and authenticated
GRANT SELECT ON public.public_promotions TO anon, authenticated;
