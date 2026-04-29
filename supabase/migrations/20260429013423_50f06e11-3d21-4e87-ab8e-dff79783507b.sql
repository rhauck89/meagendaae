-- Drop the existing function first to ensure signature change compatibility
DROP FUNCTION IF EXISTS public.lookup_client_globally(uuid, text);
DROP FUNCTION IF EXISTS public.lookup_client_globally(text);

-- Create the new deterministic version
CREATE OR REPLACE FUNCTION public.lookup_client_globally(input_whatsapp text)
RETURNS TABLE (
  global_id uuid,
  global_name text,
  global_whatsapp text,
  local_client_id uuid
)
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    cg.id AS global_id,
    cg.name AS global_name,
    cg.whatsapp AS global_whatsapp,
    c.id AS local_client_id
  FROM public.clients_global AS cg
  LEFT JOIN public.clients AS c
    ON c.global_client_id = cg.id
  WHERE cg.whatsapp = input_whatsapp
  LIMIT 1;
$$;