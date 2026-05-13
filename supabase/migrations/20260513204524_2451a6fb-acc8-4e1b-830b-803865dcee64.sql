-- Drop function to change return type
DROP FUNCTION IF EXISTS public.get_current_user_context();

-- Update get_current_user_context to include permissions
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
  permissions jsonb
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
    -- Check active collaborator in original table (backwards compatibility)
    SELECT EXISTS (
      SELECT 1
      FROM public.collaborators col
      WHERE col.profile_id = v_profile_id
        AND col.active = true
    )
      INTO v_is_collaborator;
      
    -- Get permissions from new table if exists
    SELECT cc.permissions
      INTO v_permissions
    FROM public.company_collaborators cc
    WHERE cc.profile_id = v_profile_id 
      AND (cc.company_id = v_company_id OR v_company_id IS NULL)
      AND cc.active = true
    LIMIT 1;
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
    COALESCE(v_permissions, '{}'::jsonb);
END;
$$ LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public;
