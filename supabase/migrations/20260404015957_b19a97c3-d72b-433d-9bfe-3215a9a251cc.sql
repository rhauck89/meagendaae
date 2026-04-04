CREATE OR REPLACE FUNCTION public.switch_active_company(_company_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = auth.uid() AND company_id = _company_id
  ) THEN
    RAISE EXCEPTION 'User does not belong to this company';
  END IF;

  UPDATE public.profiles
  SET company_id = _company_id, updated_at = now()
  WHERE user_id = auth.uid();
END;
$$;

GRANT EXECUTE ON FUNCTION public.switch_active_company(uuid) TO authenticated;

CREATE OR REPLACE FUNCTION public.get_user_companies()
RETURNS TABLE(company_id uuid, company_name text, company_slug text, company_logo text, role app_role)
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT DISTINCT ur.company_id, c.name, c.slug, c.logo_url, ur.role
  FROM public.user_roles ur
  JOIN public.companies c ON c.id = ur.company_id
  WHERE ur.user_id = auth.uid()
  AND ur.company_id IS NOT NULL
  ORDER BY c.name;
$$;

GRANT EXECUTE ON FUNCTION public.get_user_companies() TO authenticated;