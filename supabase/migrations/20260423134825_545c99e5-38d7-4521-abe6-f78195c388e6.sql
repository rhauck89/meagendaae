-- Make create_client a true get-or-create: lookup by whatsapp or email before inserting,
-- and gracefully recover from any unique constraint violation by returning the existing row.
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
  v_whatsapp text;
  v_email text;
BEGIN
  v_auth_uid := auth.uid();
  v_whatsapp := NULLIF(trim(COALESCE(p_whatsapp, '')), '');
  v_email := NULLIF(lower(trim(COALESCE(p_email, ''))), '');

  -- 1) Authenticated user: prefer their own row in this company.
  IF v_auth_uid IS NOT NULL THEN
    SELECT id INTO v_client_id
    FROM clients
    WHERE user_id = v_auth_uid AND company_id = p_company_id
    LIMIT 1;
  END IF;

  -- 2) Lookup by WhatsApp inside this company (recurring clients - main key).
  IF v_client_id IS NULL AND v_whatsapp IS NOT NULL THEN
    SELECT id INTO v_client_id
    FROM clients
    WHERE company_id = p_company_id
      AND whatsapp = v_whatsapp
    ORDER BY (user_id IS NULL) ASC, created_at ASC
    LIMIT 1;
  END IF;

  -- 3) Fallback: lookup by email inside this company.
  IF v_client_id IS NULL AND v_email IS NOT NULL THEN
    SELECT id INTO v_client_id
    FROM clients
    WHERE company_id = p_company_id
      AND lower(email) = v_email
    ORDER BY (user_id IS NULL) ASC, created_at ASC
    LIMIT 1;
  END IF;

  -- Found: refresh missing fields and (if applicable) link to current auth user.
  IF v_client_id IS NOT NULL THEN
    UPDATE clients
    SET email = COALESCE(NULLIF(email, ''), v_email),
        whatsapp = COALESCE(NULLIF(whatsapp, ''), v_whatsapp),
        birth_date = COALESCE(birth_date, p_birth_date),
        name = COALESCE(NULLIF(name, ''), NULLIF(trim(p_name), '')),
        user_id = COALESCE(user_id, v_auth_uid)
    WHERE id = v_client_id;
    RETURN v_client_id;
  END IF;

  -- 4) Insert new; on any unique violation, try to recover the existing row.
  BEGIN
    INSERT INTO clients (company_id, user_id, name, whatsapp, email, birth_date)
    VALUES (p_company_id, v_auth_uid, p_name, v_whatsapp, v_email, p_birth_date)
    RETURNING id INTO v_client_id;
  EXCEPTION WHEN unique_violation THEN
    IF v_auth_uid IS NOT NULL THEN
      SELECT id INTO v_client_id FROM clients
      WHERE user_id = v_auth_uid AND company_id = p_company_id LIMIT 1;
    END IF;
    IF v_client_id IS NULL AND v_whatsapp IS NOT NULL THEN
      SELECT id INTO v_client_id FROM clients
      WHERE company_id = p_company_id AND whatsapp = v_whatsapp LIMIT 1;
    END IF;
    IF v_client_id IS NULL AND v_email IS NOT NULL THEN
      SELECT id INTO v_client_id FROM clients
      WHERE company_id = p_company_id AND lower(email) = v_email LIMIT 1;
    END IF;
    IF v_client_id IS NULL THEN
      RAISE;
    END IF;
  END;

  RETURN v_client_id;
END;
$function$;