-- RPC to link a new auth user to a global client record
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
  v_normalized_phone TEXT;
BEGIN
  v_normalized_phone := public.normalize_whatsapp_v2(p_phone);

  -- 1. Ensure global record exists and has user_id
  INSERT INTO public.clients_global (user_id, name, whatsapp, email)
  VALUES (p_user_id, p_name, v_normalized_phone, lower(trim(p_email)))
  ON CONFLICT (whatsapp) DO UPDATE 
  SET user_id = p_user_id, 
      name = COALESCE(p_name, clients_global.name),
      email = COALESCE(lower(trim(p_email)), clients_global.email)
  RETURNING id INTO v_client_id;

  -- 2. Link to company
  INSERT INTO public.client_companies (client_global_id, company_id)
  VALUES (v_client_id, p_company_id)
  ON CONFLICT (client_global_id, company_id) DO NOTHING;

  -- 3. SYNC TO LEGACY (Progressive Migration Fallback)
  -- This keeps the current booking flow working since it expects records in the 'clients' table
  INSERT INTO public.clients (company_id, user_id, name, whatsapp, email)
  VALUES (p_company_id, p_user_id, p_name, v_normalized_phone, lower(trim(p_email)))
  ON CONFLICT (company_id, whatsapp) DO UPDATE
  SET user_id = p_user_id,
      name = COALESCE(p_name, clients.name),
      email = COALESCE(lower(trim(p_email)), clients.email);
END;
$$;

-- Grant permissions
GRANT EXECUTE ON FUNCTION public.link_client_globally TO authenticated;
GRANT EXECUTE ON FUNCTION public.link_client_globally TO anon;
