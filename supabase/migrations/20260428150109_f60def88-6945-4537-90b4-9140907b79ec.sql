-- Function to lookup client globally and auto-link to company
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
  v_normalized_whatsapp TEXT;
BEGIN
  -- 1. Normalize input
  v_normalized_whatsapp := public.normalize_whatsapp_v2(p_whatsapp);
  
  -- 2. Search in global table
  SELECT id INTO v_client_id
  FROM public.clients_global
  WHERE whatsapp = v_normalized_whatsapp
  LIMIT 1;
  
  -- 3. If found, ensure link to company exists
  IF v_client_id IS NOT NULL THEN
    INSERT INTO public.client_companies (client_global_id, company_id)
    VALUES (v_client_id, p_company_id)
    ON CONFLICT (client_global_id, company_id) DO NOTHING;
    
    -- Also sync to legacy table for current compatibility
    -- This ensures the booking flow doesn't break
    INSERT INTO public.clients (company_id, name, whatsapp, email)
    SELECT p_company_id, name, whatsapp, email
    FROM public.clients_global
    WHERE id = v_client_id
    ON CONFLICT (company_id, whatsapp) DO NOTHING;
    
    RETURN QUERY
    SELECT id, name, whatsapp, email
    FROM public.clients_global
    WHERE id = v_client_id;
  ELSE
    -- 4. If not found in global, check legacy as a fallback (progressive migration)
    SELECT id INTO v_client_id
    FROM public.clients
    WHERE whatsapp = v_normalized_whatsapp
    LIMIT 1;
    
    IF v_client_id IS NOT NULL THEN
      -- Migrate this specific legacy client to global
      INSERT INTO public.clients_global (name, whatsapp, email)
      SELECT name, whatsapp, email
      FROM public.clients
      WHERE whatsapp = v_normalized_whatsapp
      ON CONFLICT (whatsapp) DO UPDATE 
      SET name = EXCLUDED.name, email = EXCLUDED.email
      RETURNING id INTO v_client_id;
      
      INSERT INTO public.client_companies (client_global_id, company_id)
      VALUES (v_client_id, p_company_id)
      ON CONFLICT (client_global_id, company_id) DO NOTHING;
      
      RETURN QUERY
      SELECT id, name, whatsapp, email
      FROM public.clients_global
      WHERE id = v_client_id;
    END IF;
  END IF;
END;
$$;

-- Grant permissions
GRANT EXECUTE ON FUNCTION public.lookup_client_globally TO anon;
GRANT EXECUTE ON FUNCTION public.lookup_client_globally TO authenticated;
