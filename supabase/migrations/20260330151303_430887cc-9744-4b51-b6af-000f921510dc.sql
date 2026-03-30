DROP FUNCTION IF EXISTS public.get_company_by_slug(text);

CREATE FUNCTION public.get_company_by_slug(_slug text)
 RETURNS TABLE(id uuid, name text, slug text, logo_url text, phone text, business_type business_type, address text)
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $$
  SELECT id, name, slug, logo_url, phone, business_type, address FROM public.companies WHERE slug = _slug LIMIT 1;
$$;

GRANT EXECUTE ON FUNCTION public.get_company_by_slug(text) TO anon, authenticated;