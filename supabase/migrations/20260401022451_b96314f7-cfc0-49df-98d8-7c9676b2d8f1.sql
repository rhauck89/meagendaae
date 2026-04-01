
DROP VIEW IF EXISTS public.public_promotions;

CREATE VIEW public.public_promotions
WITH (security_invoker = true) AS
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

GRANT SELECT ON public.public_promotions TO anon, authenticated;

-- Add a public SELECT policy on promotions for the view to work (restricted fields only via view)
CREATE POLICY "Public can view active promotions via view"
  ON public.promotions FOR SELECT
  TO public
  USING (status = 'active' AND end_date >= CURRENT_DATE);
