-- RPC for clients to self-create their linked record after signup
-- Safely creates a clients row for the authenticated user under a public company,
-- after first attempting to link any pre-existing matching record.
CREATE OR REPLACE FUNCTION public.complete_client_signup(
  p_company_id uuid,
  p_name text,
  p_whatsapp text DEFAULT NULL,
  p_email text DEFAULT NULL,
  p_birth_date date DEFAULT NULL
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
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

  -- 1. Try to link any orphan client record (matching whatsapp or email under this company)
  PERFORM public.link_client_to_user(v_user_id, p_whatsapp, p_email);

  -- 2. Check if a record now exists for this user in this company
  SELECT id INTO v_client_id
  FROM public.clients
  WHERE user_id = v_user_id AND company_id = p_company_id
  LIMIT 1;

  IF v_client_id IS NOT NULL THEN
    -- Update with provided personal data (best-effort)
    UPDATE public.clients
    SET name = COALESCE(NULLIF(p_name, ''), name),
        whatsapp = COALESCE(NULLIF(p_whatsapp, ''), whatsapp),
        email = COALESCE(NULLIF(p_email, ''), email),
        birth_date = COALESCE(p_birth_date, birth_date),
        registration_complete = true
    WHERE id = v_client_id;
    RETURN v_client_id;
  END IF;

  -- 3. Create a new client record bound to this user
  INSERT INTO public.clients (
    company_id, user_id, name, whatsapp, email, birth_date, registration_complete
  ) VALUES (
    p_company_id, v_user_id, p_name, NULLIF(p_whatsapp, ''), NULLIF(p_email, ''), p_birth_date, true
  )
  RETURNING id INTO v_client_id;

  RETURN v_client_id;
END;
$$;

GRANT EXECUTE ON FUNCTION public.complete_client_signup(uuid, text, text, text, date) TO authenticated;