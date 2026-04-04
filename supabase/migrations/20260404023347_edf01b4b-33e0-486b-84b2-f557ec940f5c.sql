
ALTER TABLE public.companies 
ADD COLUMN IF NOT EXISTS marketplace_active boolean NOT NULL DEFAULT false,
ADD COLUMN IF NOT EXISTS activation_score integer NOT NULL DEFAULT 0,
ADD COLUMN IF NOT EXISTS activated_at timestamp with time zone;

-- Update public_company view to only show marketplace-active companies
DROP VIEW IF EXISTS public.public_company;
CREATE VIEW public.public_company WITH (security_barrier = true) AS
SELECT 
  c.id,
  c.name,
  c.slug,
  c.logo_url,
  c.cover_url,
  c.description,
  c.business_type,
  c.buffer_minutes,
  c.phone,
  c.address,
  c.address_number,
  c.district,
  c.city,
  c.state,
  c.postal_code,
  c.latitude,
  c.longitude,
  c.website,
  c.facebook,
  c.instagram,
  c.google_maps_url,
  c.google_review_url,
  CASE WHEN c.whatsapp IS NOT NULL THEN LEFT(c.whatsapp, 8) || '****' ELSE NULL END AS whatsapp,
  COALESCE(r.avg_rating, 0) AS average_rating,
  COALESCE(r.review_count, 0) AS review_count
FROM companies c
LEFT JOIN (
  SELECT company_id, ROUND(AVG(rating)::numeric, 1) AS avg_rating, COUNT(*)::int AS review_count
  FROM reviews
  GROUP BY company_id
) r ON r.company_id = c.id
WHERE c.marketplace_active = true;
