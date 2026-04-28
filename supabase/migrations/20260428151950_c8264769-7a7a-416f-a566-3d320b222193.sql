CREATE OR REPLACE FUNCTION public.check_client_existence(
  p_whatsapp TEXT,
  p_email TEXT
)
RETURNS TABLE (
  exists_globally BOOLEAN,
  whatsapp_found BOOLEAN,
  email_found BOOLEAN,
  client_name TEXT,
  client_email TEXT,
  client_whatsapp TEXT
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_normalized_whatsapp TEXT;
  v_found_name TEXT;
  v_found_email TEXT;
  v_found_whatsapp TEXT;
  v_whatsapp_exists BOOLEAN := FALSE;
  v_email_exists BOOLEAN := FALSE;
BEGIN
  v_normalized_whatsapp := public.normalize_whatsapp_v2(p_whatsapp);
  
  -- Check WhatsApp
  IF v_normalized_whatsapp IS NOT NULL AND v_normalized_whatsapp <> '' THEN
    SELECT name, email, whatsapp INTO v_found_name, v_found_email, v_found_whatsapp
    FROM public.clients_global
    WHERE whatsapp = v_normalized_whatsapp
    LIMIT 1;
    
    IF v_found_whatsapp IS NOT NULL THEN
      v_whatsapp_exists := TRUE;
    END IF;
  END IF;
  
  -- Check Email if not found by WhatsApp or to confirm if email is the same
  IF v_whatsapp_exists = FALSE AND p_email IS NOT NULL AND p_email <> '' THEN
    SELECT name, email, whatsapp INTO v_found_name, v_found_email, v_found_whatsapp
    FROM public.clients_global
    WHERE LOWER(email) = LOWER(p_email)
    LIMIT 1;
    
    IF v_found_email IS NOT NULL THEN
      v_email_exists := TRUE;
    END IF;
  ELSIF v_whatsapp_exists = TRUE AND p_email IS NOT NULL AND p_email <> '' THEN
    -- If WhatsApp found, check if email also matches (different record or same?)
    IF NOT EXISTS (
      SELECT 1 FROM public.clients_global 
      WHERE whatsapp = v_normalized_whatsapp AND LOWER(email) = LOWER(p_email)
    ) THEN
      -- Email might belong to ANOTHER record
      IF EXISTS (SELECT 1 FROM public.clients_global WHERE LOWER(email) = LOWER(p_email)) THEN
        v_email_exists := TRUE;
      END IF;
    ELSE
      v_email_exists := TRUE; -- Same record
    END IF;
  END IF;

  RETURN QUERY
  SELECT 
    (v_whatsapp_exists OR v_email_exists) as exists_globally,
    v_whatsapp_exists as whatsapp_found,
    v_email_exists as email_found,
    v_found_name as client_name,
    v_found_email as client_email,
    v_found_whatsapp as client_whatsapp;
END;
$$;

GRANT EXECUTE ON FUNCTION public.check_client_existence TO anon;
GRANT EXECUTE ON FUNCTION public.check_client_existence TO authenticated;