-- Drop existing function to change return signature
DROP FUNCTION IF EXISTS public.lookup_client_globally(uuid, text);

-- Re-create lookup_client_globally with the new signature
CREATE OR REPLACE FUNCTION public.lookup_client_globally(
  p_company_id UUID,
  p_whatsapp TEXT
)
RETURNS TABLE (
  client_global_id UUID,
  client_legacy_id UUID,
  name TEXT,
  whatsapp TEXT,
  email TEXT
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_client_global_id UUID;
  v_legacy_id UUID;
  v_normalized_whatsapp TEXT;
  v_client_name TEXT;
  v_client_email TEXT;
BEGIN
  -- 1. Normalize input
  v_normalized_whatsapp := public.normalize_whatsapp_v2(p_whatsapp);
  
  -- 2. Search in global table
  SELECT id, name, email INTO v_client_global_id, v_client_name, v_client_email
  FROM public.clients_global
  WHERE whatsapp = v_normalized_whatsapp
  LIMIT 1;
  
  -- 3. If found globally
  IF v_client_global_id IS NOT NULL THEN
    RAISE NOTICE 'SESSION_CLIENT_GLOBAL: %', v_client_global_id;

    -- Ensure link to company exists
    INSERT INTO public.client_companies (client_global_id, company_id)
    VALUES (v_client_global_id, p_company_id)
    ON CONFLICT (client_global_id, company_id) DO NOTHING;
    
    RAISE NOTICE 'SESSION_COMPANY: %', p_company_id;

    -- CHECK LEGACY TABLE to avoid duplicates
    SELECT id INTO v_legacy_id
    FROM public.clients
    WHERE company_id = p_company_id 
      AND (whatsapp = v_normalized_whatsapp OR public.normalize_whatsapp_v2(whatsapp) = v_normalized_whatsapp)
    LIMIT 1;

    IF v_legacy_id IS NOT NULL THEN
      RAISE NOTICE 'SESSION_CLIENT_LEGACY: % (REUSED)', v_legacy_id;
      UPDATE public.clients 
      SET name = COALESCE(name, v_client_name),
          email = COALESCE(email, v_client_email)
      WHERE id = v_legacy_id;
    ELSE
      INSERT INTO public.clients (company_id, name, whatsapp, email)
      VALUES (p_company_id, v_client_name, v_normalized_whatsapp, v_client_email)
      RETURNING id INTO v_legacy_id;
      RAISE NOTICE 'SESSION_CLIENT_LEGACY: % (CREATED)', v_legacy_id;
    END IF;
    
    RETURN QUERY
    SELECT v_client_global_id, v_legacy_id, v_client_name, v_normalized_whatsapp, v_client_email;

  ELSE
    -- 4. Check legacy fallback
    SELECT id, name, email INTO v_legacy_id, v_client_name, v_client_email
    FROM public.clients
    WHERE company_id = p_company_id 
      AND (whatsapp = v_normalized_whatsapp OR public.normalize_whatsapp_v2(whatsapp) = v_normalized_whatsapp)
    LIMIT 1;
    
    IF v_legacy_id IS NOT NULL THEN
      -- Migrate to global
      INSERT INTO public.clients_global (name, whatsapp, email)
      VALUES (v_client_name, v_normalized_whatsapp, v_client_email)
      ON CONFLICT (whatsapp) DO UPDATE 
      SET name = EXCLUDED.name, email = EXCLUDED.email
      RETURNING id INTO v_client_global_id;
      
      RAISE NOTICE 'SESSION_CLIENT_GLOBAL: % (MIGRATED)', v_client_global_id;
      RAISE NOTICE 'SESSION_CLIENT_LEGACY: %', v_legacy_id;
      RAISE NOTICE 'SESSION_COMPANY: %', p_company_id;

      INSERT INTO public.client_companies (client_global_id, company_id)
      VALUES (v_client_global_id, p_company_id)
      ON CONFLICT (client_global_id, company_id) DO NOTHING;
      
      RETURN QUERY
      SELECT v_client_global_id, v_legacy_id, v_client_name, v_normalized_whatsapp, v_client_email;
    END IF;
  END IF;
END;
$$;

-- Ensure permissions
GRANT EXECUTE ON FUNCTION public.lookup_client_globally TO anon;
GRANT EXECUTE ON FUNCTION public.lookup_client_globally TO authenticated;
