-- Keep administrative staff out of public booking/profile surfaces and make permissions authoritative.

ALTER TABLE public.collaborators
  ADD COLUMN IF NOT EXISTS is_service_provider boolean NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS permissions jsonb NOT NULL DEFAULT '{}'::jsonb,
  ADD COLUMN IF NOT EXISTS system_role text NOT NULL DEFAULT 'collaborator';

ALTER TABLE public.company_collaborators
  ADD COLUMN IF NOT EXISTS is_service_provider boolean NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS permissions jsonb NOT NULL DEFAULT '{}'::jsonb;

-- Receptionists, attendants/administrative users and managers are panel members, not service providers.
UPDATE public.collaborators c
SET
  is_service_provider = false,
  commission_type = 'none',
  commission_value = 0,
  commission_percent = 0,
  updated_at = now()
WHERE c.system_role IN ('receptionist', 'manager', 'administrative', 'admin', 'admin_financeiro');

UPDATE public.collaborators c
SET
  is_service_provider = false,
  commission_type = 'none',
  commission_value = 0,
  commission_percent = 0,
  updated_at = now()
FROM public.company_collaborators cc
WHERE cc.company_id = c.company_id
  AND cc.profile_id = c.profile_id
  AND cc.role IN ('receptionist', 'manager', 'administrative')
  AND c.system_role <> 'admin_principal';

UPDATE public.company_collaborators cc
SET is_service_provider = false
WHERE cc.role IN ('receptionist', 'manager', 'administrative');

-- Remove service links from people who should not appear as bookable professionals.
DELETE FROM public.service_professionals sp
USING public.collaborators c
WHERE sp.professional_id = c.profile_id
  AND c.is_service_provider = false;

-- Force panel mode for non-provider staff that may have been saved as "professional".
UPDATE public.profiles p
SET last_login_mode = 'admin'
FROM public.collaborators c
WHERE c.profile_id = p.id
  AND c.is_service_provider = false
  AND p.last_login_mode = 'professional';

DROP VIEW IF EXISTS public.public_professionals;
CREATE VIEW public.public_professionals AS
SELECT
  p.id,
  p.full_name AS name,
  p.avatar_url,
  p.banner_url,
  p.bio,
  p.social_links,
  p.whatsapp,
  c.company_id,
  c.slug,
  c.active,
  c.booking_mode,
  c.grid_interval,
  c.break_time,
  c.is_service_provider
FROM public.profiles p
JOIN public.collaborators c ON c.profile_id = p.id
WHERE c.active = true
  AND c.is_service_provider = true;

ALTER VIEW public.public_professionals SET (security_invoker = off);
GRANT SELECT ON public.public_professionals TO anon, authenticated;

DROP FUNCTION IF EXISTS public.get_current_user_context();
CREATE OR REPLACE FUNCTION public.get_current_user_context()
RETURNS TABLE (
  user_id uuid,
  profile_id uuid,
  full_name text,
  email text,
  company_id uuid,
  roles text[],
  is_owner boolean,
  is_collaborator boolean,
  login_mode text,
  permissions jsonb,
  is_service_provider boolean
) AS $$
DECLARE
  v_user_id uuid;
  v_profile_id uuid;
  v_full_name text;
  v_email text;
  v_company_id uuid;
  v_roles text[];
  v_is_owner boolean := false;
  v_is_collaborator boolean := false;
  v_login_mode text;
  v_permissions jsonb := '{}'::jsonb;
  v_is_service_provider boolean := true;
BEGIN
  v_user_id := auth.uid();

  IF v_user_id IS NULL THEN
    RETURN;
  END IF;

  SELECT p.id, p.full_name, p.company_id, p.last_login_mode
    INTO v_profile_id, v_full_name, v_company_id, v_login_mode
  FROM public.profiles p
  WHERE p.user_id = v_user_id
  LIMIT 1;

  SELECT u.email
    INTO v_email
  FROM auth.users u
  WHERE u.id = v_user_id;

  IF v_company_id IS NULL THEN
    SELECT c.id
      INTO v_company_id
    FROM public.companies c
    WHERE c.user_id = v_user_id
    ORDER BY c.created_at ASC NULLS LAST, c.id
    LIMIT 1;
  END IF;

  IF v_company_id IS NULL THEN
    SELECT ur.company_id
      INTO v_company_id
    FROM public.user_roles ur
    WHERE ur.user_id = v_user_id
      AND ur.company_id IS NOT NULL
    ORDER BY ur.company_id
    LIMIT 1;
  END IF;

  IF v_company_id IS NULL AND v_profile_id IS NOT NULL THEN
    SELECT col.company_id
      INTO v_company_id
    FROM public.collaborators col
    WHERE col.profile_id = v_profile_id
      AND col.active = true
    ORDER BY col.created_at ASC NULLS LAST, col.company_id
    LIMIT 1;
  END IF;

  SELECT COALESCE(array_agg(DISTINCT ur.role::text), ARRAY[]::text[])
    INTO v_roles
  FROM public.user_roles ur
  WHERE ur.user_id = v_user_id;

  SELECT EXISTS (
    SELECT 1 FROM public.companies c WHERE c.user_id = v_user_id
  )
    INTO v_is_owner;

  IF v_profile_id IS NOT NULL THEN
    SELECT EXISTS (
      SELECT 1
      FROM public.collaborators col
      WHERE col.profile_id = v_profile_id
        AND col.active = true
    )
      INTO v_is_collaborator;

    SELECT
      COALESCE(NULLIF(c.permissions, '{}'::jsonb), cc.permissions, '{}'::jsonb),
      COALESCE(c.is_service_provider, cc.is_service_provider, true)
      INTO v_permissions, v_is_service_provider
    FROM public.collaborators c
    LEFT JOIN public.company_collaborators cc
      ON cc.company_id = c.company_id
     AND cc.profile_id = c.profile_id
     AND cc.active = true
    WHERE c.profile_id = v_profile_id
      AND (c.company_id = v_company_id OR v_company_id IS NULL)
      AND c.active = true
    LIMIT 1;

    IF v_is_service_provider = false THEN
      v_login_mode := 'admin';
    END IF;
  END IF;

  RETURN QUERY SELECT
    v_user_id,
    v_profile_id,
    v_full_name,
    v_email,
    v_company_id,
    COALESCE(v_roles, ARRAY[]::text[]),
    v_is_owner,
    v_is_collaborator,
    v_login_mode,
    COALESCE(v_permissions, '{}'::jsonb),
    COALESCE(v_is_service_provider, true);
END;
$$ LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public;

GRANT EXECUTE ON FUNCTION public.get_current_user_context() TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_current_user_context() TO service_role;
