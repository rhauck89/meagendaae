-- Refined Global Lookup with strict legacy reuse and logging
CREATE OR REPLACE FUNCTION public.lookup_client_globally(
  p_company_id UUID,
  p_whatsapp TEXT
)
RETURNS TABLE (
  id UUID,
  name TEXT,
  whatsapp TEXT,
  email TEXT
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_client_id UUID;
  v_legacy_id UUID;
  v_normalized_whatsapp TEXT;
BEGIN
  -- 1. Normalize input
  v_normalized_whatsapp := public.normalize_whatsapp_v2(p_whatsapp);
  
  -- 2. Search in global table
  SELECT id INTO v_client_id
  FROM public.clients_global
  WHERE whatsapp = v_normalized_whatsapp
  LIMIT 1;
  
  -- 3. If found globally
  IF v_client_id IS NOT NULL THEN
    RAISE NOTICE 'CLIENT_GLOBAL_FOUND: %', v_client_id;

    -- Ensure link to company exists in global structure
    INSERT INTO public.client_companies (client_global_id, company_id)
    VALUES (v_client_id, p_company_id)
    ON CONFLICT (client_global_id, company_id) DO NOTHING;
    
    RAISE NOTICE 'CLIENT_LINKED_TO_COMPANY: % to %', v_client_id, p_company_id;

    -- CHECK LEGACY TABLE to avoid duplicates
    SELECT id INTO v_legacy_id
    FROM public.clients
    WHERE company_id = p_company_id 
      AND (whatsapp = v_normalized_whatsapp OR public.normalize_whatsapp_v2(whatsapp) = v_normalized_whatsapp)
    LIMIT 1;

    IF v_legacy_id IS NOT NULL THEN
      RAISE NOTICE 'CLIENT_LEGACY_REUSED: %', v_legacy_id;
      -- Update existing legacy record if needed
      UPDATE public.clients 
      SET name = COALESCE(name, (SELECT name FROM public.clients_global WHERE id = v_client_id)),
          email = COALESCE(email, (SELECT email FROM public.clients_global WHERE id = v_client_id))
      WHERE id = v_legacy_id;
    ELSE
      -- Create legacy record only if missing
      INSERT INTO public.clients (company_id, name, whatsapp, email)
      SELECT p_company_id, name, whatsapp, email
      FROM public.clients_global
      WHERE id = v_client_id;
      RAISE NOTICE 'CLIENT_LEGACY_CREATED for global: %', v_client_id;
    END IF;
    
    RETURN QUERY
    SELECT cg.id, cg.name, cg.whatsapp, cg.email
    FROM public.clients_global cg
    WHERE cg.id = v_client_id;

  ELSE
    -- 4. If not found in global, check legacy as fallback
    SELECT id, name, email INTO v_legacy_id, name, email
    FROM public.clients
    WHERE company_id = p_company_id 
      AND (whatsapp = v_normalized_whatsapp OR public.normalize_whatsapp_v2(whatsapp) = v_normalized_whatsapp)
    LIMIT 1;
    
    IF v_legacy_id IS NOT NULL THEN
      -- Migrate this legacy client to global
      INSERT INTO public.clients_global (name, whatsapp, email)
      VALUES (name, v_normalized_whatsapp, email)
      ON CONFLICT (whatsapp) DO UPDATE 
      SET name = EXCLUDED.name, email = EXCLUDED.email
      RETURNING public.clients_global.id INTO v_client_id;
      
      RAISE NOTICE 'CLIENT_MIGRATED_FROM_LEGACY: % to global %', v_legacy_id, v_client_id;

      INSERT INTO public.client_companies (client_global_id, company_id)
      VALUES (v_client_id, p_company_id)
      ON CONFLICT (client_global_id, company_id) DO NOTHING;
      
      RETURN QUERY
      SELECT cg.id, cg.name, cg.whatsapp, cg.email
      FROM public.clients_global cg
      WHERE cg.id = v_client_id;
    END IF;
  END IF;
END;
$$;

-- Refined Global Linking (Registration)
CREATE OR REPLACE FUNCTION public.link_client_globally(
  p_user_id UUID,
  p_phone TEXT,
  p_email TEXT,
  p_company_id UUID,
  p_name TEXT DEFAULT NULL
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_client_id UUID;
  v_legacy_id UUID;
  v_normalized_phone TEXT;
BEGIN
  v_normalized_phone := public.normalize_whatsapp_v2(p_phone);

  -- 1. Ensure global record exists
  INSERT INTO public.clients_global (user_id, name, whatsapp, email)
  VALUES (p_user_id, p_name, v_normalized_phone, lower(trim(p_email)))
  ON CONFLICT (whatsapp) DO UPDATE 
  SET user_id = p_user_id, 
      name = COALESCE(p_name, clients_global.name),
      email = COALESCE(lower(trim(p_email)), clients_global.email)
  RETURNING id INTO v_client_id;

  -- 2. Link to company in global table
  INSERT INTO public.client_companies (client_global_id, company_id)
  VALUES (v_client_id, p_company_id)
  ON CONFLICT (client_global_id, company_id) DO NOTHING;

  -- 3. SYNC TO LEGACY (Progressive Migration Fallback)
  -- Check for existing legacy record first
  SELECT id INTO v_legacy_id
  FROM public.clients
  WHERE company_id = p_company_id 
    AND (whatsapp = v_normalized_phone OR public.normalize_whatsapp_v2(whatsapp) = v_normalized_phone)
  LIMIT 1;

  IF v_legacy_id IS NOT NULL THEN
    RAISE NOTICE 'CLIENT_LEGACY_REUSED during link: %', v_legacy_id;
    UPDATE public.clients
    SET user_id = p_user_id,
        name = COALESCE(p_name, clients.name),
        email = COALESCE(lower(trim(p_email)), clients.email)
    WHERE id = v_legacy_id;
  ELSE
    RAISE NOTICE 'CLIENT_LEGACY_CREATED during link';
    INSERT INTO public.clients (company_id, user_id, name, whatsapp, email)
    VALUES (p_company_id, p_user_id, p_name, v_normalized_phone, lower(trim(p_email)));
  END IF;
END;
$$;
