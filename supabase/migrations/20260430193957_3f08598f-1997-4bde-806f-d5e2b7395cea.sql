-- 1. Sync profiles.company_id from companies
UPDATE public.profiles p
SET company_id = c.id, updated_at = now()
FROM public.companies c
WHERE c.user_id = p.user_id
AND p.company_id IS NULL;

-- 2. Sync profiles.company_id from user_roles
UPDATE public.profiles p
SET company_id = ur.company_id, updated_at = now()
FROM public.user_roles ur
WHERE ur.user_id = p.user_id
AND ur.company_id IS NOT NULL
AND p.company_id IS NULL;

-- 3. Drop existing function to handle return type changes
DROP FUNCTION IF EXISTS public.get_current_user_context();

-- 4. Create public.get_current_user_context() as strictly read-only
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

  -- 1. Get basic profile info
  SELECT p.id, p.full_name, p.company_id, p.last_login_mode
    INTO v_profile_id, v_full_name, v_company_id, v_login_mode
  FROM public.profiles p
  WHERE p.user_id = v_user_id
  LIMIT 1;

  -- 2. Get email from auth.users
  SELECT u.email
    INTO v_email
  FROM auth.users u
  WHERE u.id = v_user_id;

  -- 3. Priority Order for company_id if not in profile
  IF v_company_id IS NULL THEN
    -- Check ownership
    SELECT c.id
      INTO v_company_id
    FROM public.companies c
    WHERE c.user_id = v_user_id
    ORDER BY c.created_at ASC NULLS LAST, c.id
    LIMIT 1;
  END IF;

  IF v_company_id IS NULL THEN
    -- Check roles
    SELECT ur.company_id
      INTO v_company_id
    FROM public.user_roles ur
    WHERE ur.user_id = v_user_id
      AND ur.company_id IS NOT NULL
    ORDER BY ur.company_id
    LIMIT 1;
  END IF;

  IF v_company_id IS NULL AND v_profile_id IS NOT NULL THEN
    -- Check active collaborator
    SELECT col.company_id
      INTO v_company_id
    FROM public.collaborators col
    WHERE col.profile_id = v_profile_id
      AND col.active = true
    ORDER BY col.created_at ASC NULLS LAST, col.company_id
    LIMIT 1;
  END IF;

  -- 4. Get roles
  SELECT COALESCE(array_agg(DISTINCT ur.role::text), ARRAY[]::text[])
    INTO v_roles
  FROM public.user_roles ur
  WHERE ur.user_id = v_user_id;

  -- 5. Set flags
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