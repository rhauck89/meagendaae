-- 1. Fix privilege escalation: Restrict which roles professionals can assign
DROP POLICY IF EXISTS "Professionals can manage company roles" ON public.user_roles;

CREATE POLICY "Professionals can assign limited roles"
ON public.user_roles
FOR INSERT
TO authenticated
WITH CHECK (
  has_company_role(auth.uid(), company_id, 'professional'::app_role)
  AND role IN ('collaborator'::app_role, 'client'::app_role)
);

-- 2. Fix PII exposure: Restrict professional profiles to authenticated users
DROP POLICY IF EXISTS "Public can view professional profiles" ON public.profiles;

CREATE POLICY "Authenticated can view professional profiles"
ON public.profiles
FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM user_roles ur
    WHERE ur.user_id = profiles.user_id
    AND ur.role = ANY (ARRAY['professional'::app_role, 'collaborator'::app_role])
  )
);

-- 3. Fix Stripe data exposure: Replace public companies policy with restricted one
DROP POLICY IF EXISTS "Public can view companies" ON public.companies;

-- Anon users can only see non-sensitive columns via a security definer function
CREATE OR REPLACE FUNCTION public.get_company_by_slug(_slug text)
RETURNS TABLE(id uuid, name text, slug text, logo_url text, phone text)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT id, name, slug, logo_url, phone FROM public.companies WHERE slug = _slug LIMIT 1;
$$;

-- Authenticated users can view companies
CREATE POLICY "Authenticated can view companies"
ON public.companies
FOR SELECT
TO authenticated
USING (true);

-- 4. Allow super admins to update any company
CREATE POLICY "Super admins can update companies"
ON public.companies
FOR UPDATE
TO authenticated
USING (has_role(auth.uid(), 'super_admin'::app_role));
