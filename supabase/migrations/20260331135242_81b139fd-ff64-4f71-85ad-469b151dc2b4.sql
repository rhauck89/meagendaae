
DROP VIEW IF EXISTS public.public_company CASCADE;

CREATE VIEW public.public_company WITH (security_barrier = true) AS
SELECT
  c.id,
  c.name,
  c.slug,
  c.business_type,
  c.logo_url,
  c.cover_url,
  c.address,
  c.address_number,
  c.district,
  c.city,
  c.state,
  c.postal_code,
  c.phone,
  c.whatsapp,
  c.description,
  c.google_maps_url,
  c.google_review_url,
  c.instagram,
  c.facebook,
  c.website,
  c.buffer_minutes,
  COALESCE(rs.avg_rating, 0) AS average_rating,
  COALESCE(rs.review_count, 0)::integer AS review_count
FROM public.companies c
LEFT JOIN (
  SELECT company_id, AVG(rating)::numeric AS avg_rating, COUNT(*)::integer AS review_count
  FROM public.reviews
  GROUP BY company_id
) rs ON rs.company_id = c.id;

GRANT SELECT ON public.public_company TO anon, authenticated;
