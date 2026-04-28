-- Drop existing function if it exists to allow changing return type
DROP FUNCTION IF EXISTS public.lookup_client_by_whatsapp(UUID, TEXT);

-- Recreate function to lookup client by normalized WhatsApp number
CREATE OR REPLACE FUNCTION public.lookup_client_by_whatsapp(
  p_company_id UUID,
  p_whatsapp TEXT
)
RETURNS TABLE (
  id UUID,
  name TEXT,
  whatsapp TEXT,
  email TEXT
)
LANGUAGE sql
SECURITY DEFINER
AS $$
  SELECT id, name, whatsapp, email
  FROM public.clients
  WHERE company_id = p_company_id
    AND REGEXP_REPLACE(whatsapp, '\D', '', 'g') = REGEXP_REPLACE(p_whatsapp, '\D', '', 'g')
  LIMIT 1;
$$;

-- Grant permissions for the RPC function
GRANT EXECUTE ON FUNCTION public.lookup_client_by_whatsapp(UUID, TEXT) TO anon;
GRANT EXECUTE ON FUNCTION public.lookup_client_by_whatsapp(UUID, TEXT) TO authenticated;

-- Function to normalize whatsapp number (remove non-digits)
CREATE OR REPLACE FUNCTION public.normalize_whatsapp()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.whatsapp IS NOT NULL THEN
    NEW.whatsapp := REGEXP_REPLACE(NEW.whatsapp, '\D', '', 'g');
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger to automatically normalize whatsapp on insert or update
DROP TRIGGER IF EXISTS trg_normalize_whatsapp ON public.clients;
CREATE TRIGGER trg_normalize_whatsapp
BEFORE INSERT OR UPDATE ON public.clients
FOR EACH ROW
EXECUTE FUNCTION public.normalize_whatsapp();

-- One-time normalization of existing data
UPDATE public.clients SET whatsapp = REGEXP_REPLACE(whatsapp, '\D', '', 'g') WHERE whatsapp IS NOT NULL;
