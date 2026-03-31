
DROP FUNCTION IF EXISTS public.get_company_by_slug(text);

CREATE OR REPLACE FUNCTION public.get_company_by_slug(_slug text)
RETURNS TABLE (
  id uuid,
  name text,
  slug text,
  logo_url text,
  cover_url text,
  phone text,
  address text,
  google_review_url text,
  business_type public.business_type
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT c.id, c.name, c.slug, c.logo_url, c.cover_url, c.phone, c.address, c.google_review_url, c.business_type
  FROM public.companies c
  WHERE c.slug = _slug
  LIMIT 1;
$$;
