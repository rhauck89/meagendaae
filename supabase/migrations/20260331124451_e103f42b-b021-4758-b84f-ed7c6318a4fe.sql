-- 1) Fix company UPDATE policy: change from public to authenticated
DROP POLICY IF EXISTS "Owner can update company" ON public.companies;
CREATE POLICY "Owner can update company"
  ON public.companies
  FOR UPDATE
  TO authenticated
  USING (owner_id = auth.uid());

-- 2) Remove the public SELECT policy on collaborators that exposes financial data
DROP POLICY IF EXISTS "Public can view active collaborators" ON public.collaborators;

-- 3) Create a safe public_company view with only non-sensitive fields
CREATE OR REPLACE VIEW public.public_company WITH (security_invoker = false, security_barrier = true) AS
SELECT
  c.id,
  c.slug,
  c.name,
  c.logo_url,
  c.cover_url,
  c.phone,
  c.address,
  c.business_type,
  c.buffer_minutes,
  c.google_review_url,
  COALESCE(r.avg_rating, 0) AS average_rating,
  COALESCE(r.review_count, 0) AS review_count
FROM public.companies c
LEFT JOIN LATERAL (
  SELECT
    ROUND(AVG(rev.rating)::numeric, 1) AS avg_rating,
    COUNT(*)::int AS review_count
  FROM public.reviews rev
  WHERE rev.company_id = c.id
) r ON true;

-- Grant access to the public_company view
GRANT SELECT ON public.public_company TO anon, authenticated;
