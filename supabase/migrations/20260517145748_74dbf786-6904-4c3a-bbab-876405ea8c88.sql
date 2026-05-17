CREATE OR REPLACE FUNCTION public.get_current_user_context()
 RETURNS TABLE(user_id uuid, profile_id uuid, full_name text, email text, company_id uuid, roles text[], is_owner boolean, is_collaborator boolean, login_mode text, permissions jsonb, is_service_provider boolean, system_role text)
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
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
  v_system_role text;
  v_preset_permissions jsonb;
BEGIN
  v_user_id := auth.uid();
  IF v_user_id IS NULL THEN RETURN; END IF;

  -- Basic profile info
  SELECT p.id, p.full_name, p.company_id, p.last_login_mode
    INTO v_profile_id, v_full_name, v_company_id, v_login_mode
  FROM public.profiles p
  WHERE p.user_id = v_user_id LIMIT 1;

  -- Auth email
  SELECT u.email INTO v_email FROM auth.users u WHERE u.id = v_user_id;

  -- Company recovery if profile doesn't have it
  IF v_company_id IS NULL THEN
    SELECT c.id INTO v_company_id FROM public.companies c WHERE c.user_id = v_user_id ORDER BY c.created_at ASC NULLS LAST LIMIT 1;
  END IF;

  -- System-level roles (super_admin, etc)
  SELECT COALESCE(array_agg(DISTINCT ur.role::text), ARRAY[]::text[]) INTO v_roles FROM public.user_roles ur WHERE ur.user_id = v_user_id;

  -- Check if owner
  SELECT EXISTS (SELECT 1 FROM public.companies c WHERE c.user_id = v_user_id) INTO v_is_owner;

  IF v_profile_id IS NOT NULL THEN
    -- Check if collaborator in any company (active or not)
    SELECT EXISTS (SELECT 1 FROM public.collaborators col WHERE col.profile_id = v_profile_id AND col.active = true) INTO v_is_collaborator;

    -- Fetch permissions and system role from collaborators or company_collaborators
    -- Priority: collaborator.permissions > company_collaborators.permissions
    SELECT
      COALESCE(NULLIF(c.permissions, '{}'::jsonb), cc.permissions, '{}'::jsonb),
      COALESCE(c.is_service_provider, cc.is_service_provider, true),
      COALESCE(c.system_role, cc.system_role, 'collaborator')
      INTO v_permissions, v_is_service_provider, v_system_role
    FROM public.collaborators c
    LEFT JOIN public.company_collaborators cc ON cc.company_id = c.company_id AND cc.profile_id = c.profile_id AND cc.active = true
    WHERE c.profile_id = v_profile_id AND (c.company_id = v_company_id OR v_company_id IS NULL) AND c.active = true LIMIT 1;

    -- Force login mode for staff
    IF v_is_service_provider = false THEN 
      v_login_mode := 'admin'; 
    END IF;

    -- Apply presets if permissions are empty OR if user is owner/super_admin/admin_principal
    IF v_is_owner OR v_system_role = 'admin_principal' OR 'super_admin' = ANY(v_roles) THEN
      v_permissions := '{
        "agenda": true,
        "services": true,
        "team": true,
        "clients": true,
        "whatsapp": true,
        "subscriptions": true,
        "events": true,
        "promotions": true,
        "loyalty": true,
        "requests": true,
        "finance": true,
        "settings": true,
        "reports": true
      }'::jsonb;
    ELSIF v_permissions IS NULL OR v_permissions = '{}'::jsonb THEN
      IF v_system_role IN ('receptionist', 'attendant', 'atendente') THEN
        v_preset_permissions := '{
          "agenda": {"view": true, "create": true, "edit": true, "delete": false},
          "services": {"view": true},
          "team": {"view": true},
          "clients": {"view": true, "create": true, "edit": true},
          "whatsapp": {"view": true},
          "events": {"view": true, "create": true, "edit": true},
          "requests": {"view": true, "create": true, "edit": true},
          "promotions": {"view": true},
          "loyalty": {"view": true}
        }'::jsonb;
      ELSIF v_system_role = 'manager' THEN
        v_preset_permissions := '{
          "agenda": {"view": true, "create": true, "edit": true, "delete": true},
          "services": {"view": true, "create": true, "edit": true},
          "team": {"view": true, "create": true, "edit": true},
          "clients": {"view": true, "create": true, "edit": true, "delete": true},
          "whatsapp": {"view": true},
          "subscriptions": {"view": true, "create": true, "edit": true},
          "events": {"view": true, "create": true, "edit": true},
          "promotions": {"view": true, "create": true, "edit": true},
          "loyalty": {"view": true, "create": true, "edit": true},
          "requests": {"view": true, "create": true, "edit": true},
          "finance": {"view": true, "view_values": true},
          "settings": {"view": true},
          "reports": {"view": true}
        }'::jsonb;
      ELSIF v_system_role IN ('administrative', 'admin', 'admin_financeiro') THEN
        v_preset_permissions := '{
          "agenda": {"view": true, "create": true, "edit": true, "delete": true},
          "services": {"view": true, "create": true, "edit": true},
          "team": {"view": true, "create": true, "edit": true},
          "clients": {"view": true, "create": true, "edit": true, "delete": true},
          "whatsapp": {"view": true},
          "subscriptions": {"view": true, "create": true, "edit": true},
          "events": {"view": true, "create": true, "edit": true},
          "promotions": {"view": true, "create": true, "edit": true},
          "loyalty": {"view": true, "create": true, "edit": true},
          "requests": {"view": true, "create": true, "edit": true},
          "finance": {"view": true, "create": true, "edit": true, "view_values": true},
          "settings": {"view": true, "edit": true},
          "reports": {"view": true}
        }'::jsonb;
      ELSIF v_is_service_provider = true THEN
        v_preset_permissions := '{
          "agenda": {"view": true},
          "clients": {"view": true},
          "requests": {"view": true}
        }'::jsonb;
      END IF;
      
      IF v_preset_permissions IS NOT NULL THEN
        v_permissions := v_preset_permissions;
      END IF;
    END IF;
  END IF;

  RETURN QUERY SELECT
    v_user_id, v_profile_id, v_full_name, v_email, v_company_id,
    COALESCE(v_roles, ARRAY[]::text[]), 
    COALESCE(v_is_owner, false), 
    COALESCE(v_is_collaborator, false),
    v_login_mode, 
    COALESCE(v_permissions, '{}'::jsonb), 
    COALESCE(v_is_service_provider, true),
    v_system_role;
END;
$function$;