DROP FUNCTION IF EXISTS public.get_company_by_slug(text);

CREATE FUNCTION public.get_company_by_slug(_slug text)
RETURNS TABLE(id uuid, name text, slug text, logo_url text, phone text, business_type business_type, address text, google_review_url text)
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $$
  SELECT c.id, c.name, c.slug, c.logo_url, c.phone, c.business_type, c.address, c.google_review_url FROM public.companies c WHERE c.slug = _slug LIMIT 1;
$$;

GRANT EXECUTE ON FUNCTION public.get_company_by_slug(text) TO anon, authenticated;