-- Fix the centralized auth context RPC to use the real profiles columns.
-- The previous version referenced profiles.name and profiles.login_mode, while
-- the schema uses profiles.full_name and profiles.last_login_mode. If the RPC
-- fails, the frontend can stay stuck while resolving auth state.

CREATE OR REPLACE FUNCTION public.get_current_user_context()
RETURNS TABLE (
  user_id uuid,
  profile_id uuid,
  full_name text,
  email text,
  company_id uuid,
  roles text[],
  is_company_owner boolean,
  is_collaborator boolean,
  login_mode text
)
LANGUAGE plpgsql
SECURITY DEFINER
STABLE
SET search_path = public
AS $$
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
    SELECT c.company_id
      INTO v_company_id
    FROM public.collaborators c
    WHERE c.profile_id = v_profile_id
      AND c.active = true
    ORDER BY c.created_at ASC NULLS LAST, c.company_id
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
      FROM public.collaborators c
      WHERE c.profile_id = v_profile_id
        AND c.active = true
    )
      INTO v_is_collaborator;
  END IF;

  IF v_profile_id IS NOT NULL AND v_company_id IS NOT NULL THEN
    UPDATE public.profiles p
    SET company_id = v_company_id,
        updated_at = now()
    WHERE p.id = v_profile_id
      AND p.company_id IS DISTINCT FROM v_company_id;
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
    v_login_mode;
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_current_user_context() TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_current_user_context() TO service_role;
