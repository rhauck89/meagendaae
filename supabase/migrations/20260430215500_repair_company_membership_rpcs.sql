-- Make company resolution independent from partially missing user_roles rows.
-- A company owner must always be able to resolve and select their company
-- through the same RPCs used by the login/dashboard flow.

CREATE OR REPLACE FUNCTION public.get_user_companies()
RETURNS TABLE(company_id uuid, company_name text, company_slug text, company_logo text, role app_role)
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT DISTINCT ON (x.company_id)
         x.company_id, x.company_name, x.company_slug, x.company_logo, x.role
  FROM (
    SELECT c.id AS company_id,
           c.name AS company_name,
           c.slug AS company_slug,
           c.logo_url AS company_logo,
           'professional'::app_role AS role,
           0 AS priority
    FROM public.companies c
    WHERE c.user_id = auth.uid()

    UNION ALL

    SELECT ur.company_id,
           c.name AS company_name,
           c.slug AS company_slug,
           c.logo_url AS company_logo,
           ur.role,
           1 AS priority
    FROM public.user_roles ur
    JOIN public.companies c ON c.id = ur.company_id
    WHERE ur.user_id = auth.uid()
      AND ur.company_id IS NOT NULL
  ) x
  ORDER BY x.company_id, x.priority, x.company_name;
$$;

GRANT EXECUTE ON FUNCTION public.get_user_companies() TO authenticated;

CREATE OR REPLACE FUNCTION public.switch_active_company(_company_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM public.companies c
    WHERE c.id = _company_id
      AND c.user_id = auth.uid()
  )
  AND NOT EXISTS (
    SELECT 1
    FROM public.user_roles ur
    WHERE ur.user_id = auth.uid()
      AND ur.company_id = _company_id
  ) THEN
    RAISE EXCEPTION 'User does not belong to this company';
  END IF;

  UPDATE public.profiles
  SET company_id = _company_id,
      updated_at = now()
  WHERE user_id = auth.uid();
END;
$$;

GRANT EXECUTE ON FUNCTION public.switch_active_company(uuid) TO authenticated;

-- Backfill company_id for owner profiles, without touching users that already
-- have an active company selected.
UPDATE public.profiles p
SET company_id = c.id,
    updated_at = now()
FROM public.companies c
WHERE c.user_id = p.user_id
  AND p.company_id IS NULL;
