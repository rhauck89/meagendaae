-- Harden client linkage to prevent idx_clients_user_company duplicate key violations.
-- Root cause: link_client_to_user could promote an orphan row to (user_id=X, company=C)
-- when another row already had (user_id=X, company=C), violating the unique index.
-- Also, complete_client_signup's final INSERT could race with concurrent linkage.

CREATE OR REPLACE FUNCTION public.link_client_to_user(
  p_user_id uuid,
  p_phone text DEFAULT NULL::text,
  p_email text DEFAULT NULL::text
)
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_user_email text;
  v_count integer := 0;
  v_orphan record;
  v_existing_id uuid;
BEGIN
  IF p_email IS NULL OR p_email = '' THEN
    SELECT email INTO v_user_email FROM auth.users WHERE id = p_user_id;
  ELSE
    v_user_email := lower(trim(p_email));
  END IF;

  -- Iterate orphan candidates one by one, per company, so we never violate
  -- the unique (user_id, company_id) index.
  FOR v_orphan IN
    SELECT id, company_id
    FROM public.clients
    WHERE user_id IS NULL
      AND (
        (p_phone IS NOT NULL AND p_phone <> '' AND whatsapp = p_phone)
        OR (v_user_email IS NOT NULL AND v_user_email <> '' AND lower(email) = v_user_email)
      )
  LOOP
    -- Skip if this user already has a client in that company
    SELECT id INTO v_existing_id
    FROM public.clients
    WHERE user_id = p_user_id AND company_id = v_orphan.company_id
    LIMIT 1;

    IF v_existing_id IS NULL THEN
      UPDATE public.clients
      SET user_id = p_user_id
      WHERE id = v_orphan.id
        AND user_id IS NULL;
      v_count := v_count + 1;
    END IF;
  END LOOP;

  RETURN v_count;
END;
$function$;

-- Make complete_client_signup race-safe by handling unique violations.
CREATE OR REPLACE FUNCTION public.complete_client_signup(
  p_company_id uuid,
  p_name text,
  p_whatsapp text DEFAULT NULL::text,
  p_email text DEFAULT NULL::text,
  p_birth_date date DEFAULT NULL::date
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_user_id uuid;
  v_client_id uuid;
BEGIN
  v_user_id := auth.uid();
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;
  IF p_company_id IS NULL THEN
    RAISE EXCEPTION 'Company is required';
  END IF;

  -- 1. Try to link any orphan client (whatsapp/email match), skipping conflicts.
  PERFORM public.link_client_to_user(v_user_id, p_whatsapp, p_email);

  -- 2. Reuse existing record for this user in this company, if any.
  SELECT id INTO v_client_id
  FROM public.clients
  WHERE user_id = v_user_id AND company_id = p_company_id
  LIMIT 1;

  IF v_client_id IS NOT NULL THEN
    UPDATE public.clients
    SET name = COALESCE(NULLIF(p_name, ''), name),
        whatsapp = COALESCE(NULLIF(p_whatsapp, ''), whatsapp),
        email = COALESCE(NULLIF(p_email, ''), email),
        birth_date = COALESCE(p_birth_date, birth_date),
        registration_complete = true
    WHERE id = v_client_id;
    RETURN v_client_id;
  END IF;

  -- 3. Insert new — wrap in EXCEPTION to recover from the race where a parallel
  --    linkage just claimed (user_id, company_id).
  BEGIN
    INSERT INTO public.clients (
      company_id, user_id, name, whatsapp, email, birth_date, registration_complete
    ) VALUES (
      p_company_id, v_user_id, p_name, NULLIF(p_whatsapp, ''), NULLIF(p_email, ''), p_birth_date, true
    )
    RETURNING id INTO v_client_id;
  EXCEPTION WHEN unique_violation THEN
    SELECT id INTO v_client_id
    FROM public.clients
    WHERE user_id = v_user_id AND company_id = p_company_id
    LIMIT 1;
    IF v_client_id IS NULL THEN
      RAISE;
    END IF;
    UPDATE public.clients
    SET name = COALESCE(NULLIF(p_name, ''), name),
        whatsapp = COALESCE(NULLIF(p_whatsapp, ''), whatsapp),
        email = COALESCE(NULLIF(p_email, ''), email),
        birth_date = COALESCE(p_birth_date, birth_date),
        registration_complete = true
    WHERE id = v_client_id;
  END;

  RETURN v_client_id;
END;
$function$;

-- Make create_client (used by anonymous bookings) also resilient.
-- It looks up by whatsapp+company; if the matched row already has a different user_id,
-- we should NOT reuse it for a different authenticated user. We must scope by user_id
-- when one is available (auth.uid()), otherwise fall back to anonymous-only rows.
CREATE OR REPLACE FUNCTION public.create_client(
  p_company_id uuid,
  p_name text,
  p_whatsapp text,
  p_email text DEFAULT NULL::text,
  p_birth_date date DEFAULT NULL::date
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_client_id uuid;
  v_auth_uid uuid;
BEGIN
  v_auth_uid := auth.uid();

  -- Authenticated user: prefer their own row in this company.
  IF v_auth_uid IS NOT NULL THEN
    SELECT id INTO v_client_id
    FROM clients
    WHERE user_id = v_auth_uid AND company_id = p_company_id
    LIMIT 1;

    IF v_client_id IS NOT NULL THEN
      UPDATE clients
      SET email = COALESCE(NULLIF(p_email, ''), email),
          whatsapp = COALESCE(NULLIF(p_whatsapp, ''), whatsapp),
          birth_date = COALESCE(p_birth_date, birth_date),
          name = COALESCE(NULLIF(p_name, ''), name)
      WHERE id = v_client_id;
      RETURN v_client_id;
    END IF;
  END IF;

  -- Otherwise, try to reuse an orphan (no user_id) by whatsapp.
  IF p_whatsapp IS NOT NULL AND p_whatsapp <> '' THEN
    SELECT id INTO v_client_id
    FROM clients
    WHERE whatsapp = p_whatsapp
      AND company_id = p_company_id
      AND user_id IS NULL
    LIMIT 1;
  END IF;

  IF v_client_id IS NOT NULL THEN
    UPDATE clients
    SET email = COALESCE(email, NULLIF(p_email, '')),
        birth_date = COALESCE(birth_date, p_birth_date),
        name = COALESCE(NULLIF(p_name, ''), name)
    WHERE id = v_client_id;
    RETURN v_client_id;
  END IF;

  -- Insert; recover from the race on (user_id, company_id).
  BEGIN
    INSERT INTO clients (company_id, user_id, name, whatsapp, email, birth_date)
    VALUES (p_company_id, v_auth_uid, p_name, NULLIF(p_whatsapp, ''), NULLIF(p_email, ''), p_birth_date)
    RETURNING id INTO v_client_id;
  EXCEPTION WHEN unique_violation THEN
    IF v_auth_uid IS NOT NULL THEN
      SELECT id INTO v_client_id
      FROM clients
      WHERE user_id = v_auth_uid AND company_id = p_company_id
      LIMIT 1;
    END IF;
    IF v_client_id IS NULL THEN
      RAISE;
    END IF;
  END;

  RETURN v_client_id;
END;
$function$;