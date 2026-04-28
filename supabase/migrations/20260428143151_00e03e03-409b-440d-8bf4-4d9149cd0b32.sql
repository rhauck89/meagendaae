-- Function to normalize whatsapp number (remove non-digits and strip 55 prefix if present)
CREATE OR REPLACE FUNCTION public.normalize_whatsapp_v2(phone TEXT)
RETURNS TEXT
LANGUAGE plpgsql
AS $$
DECLARE
  digits TEXT;
BEGIN
  -- Keep only digits
  digits := REGEXP_REPLACE(phone, '\D', '', 'g');
  
  -- If it starts with 55 and has 12 or 13 digits, strip the 55
  IF digits LIKE '55%' AND (LENGTH(digits) = 12 OR LENGTH(digits) = 13) THEN
    digits := SUBSTRING(digits FROM 3);
  END IF;
  
  RETURN digits;
END;
$$;

-- Update the RPC function to use the new normalization
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
    AND public.normalize_whatsapp_v2(whatsapp) = public.normalize_whatsapp_v2(p_whatsapp)
  LIMIT 1;
$$;

-- Update the trigger function
CREATE OR REPLACE FUNCTION public.normalize_whatsapp_trigger()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.whatsapp IS NOT NULL THEN
    NEW.whatsapp := public.normalize_whatsapp_v2(NEW.whatsapp);
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Re-attach trigger
DROP TRIGGER IF EXISTS trg_normalize_whatsapp ON public.clients;
CREATE TRIGGER trg_normalize_whatsapp
BEFORE INSERT OR UPDATE ON public.clients
FOR EACH ROW
EXECUTE FUNCTION public.normalize_whatsapp_trigger();

-- Re-normalize existing data
UPDATE public.clients SET whatsapp = public.normalize_whatsapp_v2(whatsapp) WHERE whatsapp IS NOT NULL;
