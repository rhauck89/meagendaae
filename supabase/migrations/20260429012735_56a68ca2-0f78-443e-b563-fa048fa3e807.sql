CREATE OR REPLACE FUNCTION public.lookup_client_globally(p_company_id uuid, p_whatsapp text)
 RETURNS TABLE(client_global_id uuid, client_legacy_id uuid, name text, whatsapp text, email text)
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_normalized_whatsapp TEXT;
BEGIN
  -- 1. Normalize input using existing utility
  v_normalized_whatsapp := public.normalize_whatsapp_v2(p_whatsapp);
  
  -- 2. Ensure the link between the global client and company exists (if the client exists)
  -- This is a required side-effect to maintain system integrity during lookup
  INSERT INTO public.client_companies (client_global_id, company_id)
  SELECT cg.id, p_company_id
  FROM public.clients_global cg
  WHERE cg.whatsapp = v_normalized_whatsapp
  ON CONFLICT (client_global_id, company_id) DO NOTHING;

  -- 3. Return combined data with explicit aliases to avoid ambiguity
  RETURN QUERY
  SELECT 
    cg.id AS client_global_id,
    c.id AS client_legacy_id,
    cg.name AS name,
    cg.whatsapp AS whatsapp,
    cg.email AS email
  FROM public.clients_global cg
  LEFT JOIN public.clients c ON (
    c.company_id = p_company_id AND 
    (c.whatsapp = cg.whatsapp OR public.normalize_whatsapp_v2(c.whatsapp) = cg.whatsapp)
  )
  WHERE cg.whatsapp = v_normalized_whatsapp
  LIMIT 1;
END;
$function$;