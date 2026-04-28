-- Update normalization logic to prepend 55 if missing
CREATE OR REPLACE FUNCTION public.normalize_whatsapp_v2(phone TEXT)
RETURNS TEXT
LANGUAGE plpgsql
AS $$
DECLARE
  digits TEXT;
BEGIN
  -- Keep only digits
  digits := REGEXP_REPLACE(phone, '\D', '', 'g');
  
  -- If empty or already has 55, return as is (but cleaned)
  IF digits = '' THEN
    RETURN '';
  END IF;

  -- Prepend 55 if it doesn't start with it
  IF LEFT(digits, 2) <> '55' THEN
    digits := '55' || digits;
  END IF;
  
  RETURN digits;
END;
$$;

-- Update the RPC function to use the international normalization
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
  IF NEW.whatsapp IS NOT NULL AND NEW.whatsapp <> '' THEN
    NEW.whatsapp := public.normalize_whatsapp_v2(NEW.whatsapp);
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- CRITICAL: Data migration for existing records
UPDATE public.clients
SET whatsapp = public.normalize_whatsapp_v2(whatsapp)
WHERE whatsapp IS NOT NULL AND whatsapp <> '';
