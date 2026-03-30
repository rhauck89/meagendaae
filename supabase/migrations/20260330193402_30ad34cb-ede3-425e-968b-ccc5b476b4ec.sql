
-- Add client_name and client_whatsapp to waitlist so entries work without auth
ALTER TABLE public.waitlist
  ADD COLUMN IF NOT EXISTS client_name text,
  ADD COLUMN IF NOT EXISTS client_whatsapp text,
  ADD COLUMN IF NOT EXISTS email text,
  ADD COLUMN IF NOT EXISTS professional_id uuid;

-- Make client_id nullable (it was NOT NULL referencing profiles)
ALTER TABLE public.waitlist ALTER COLUMN client_id DROP NOT NULL;

-- Create a public RPC for joining waitlist without auth
CREATE OR REPLACE FUNCTION public.join_public_waitlist(
  p_company_id uuid,
  p_client_name text,
  p_client_whatsapp text,
  p_email text,
  p_service_ids uuid[],
  p_desired_date date,
  p_professional_id uuid DEFAULT NULL
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_id uuid;
BEGIN
  -- Validate required fields
  IF p_client_name IS NULL OR trim(p_client_name) = '' THEN
    RAISE EXCEPTION 'Name is required';
  END IF;
  IF p_client_whatsapp IS NULL OR trim(p_client_whatsapp) = '' THEN
    RAISE EXCEPTION 'WhatsApp is required';
  END IF;
  IF p_company_id IS NULL THEN
    RAISE EXCEPTION 'Company is required';
  END IF;
  -- Validate name length
  IF length(p_client_name) > 100 THEN
    p_client_name := substring(p_client_name FROM 1 FOR 100);
  END IF;
  -- Validate whatsapp length
  IF length(p_client_whatsapp) > 20 THEN
    RAISE EXCEPTION 'Invalid WhatsApp number';
  END IF;

  INSERT INTO public.waitlist (
    company_id, client_name, client_whatsapp, email,
    service_ids, desired_date, professional_id
  )
  VALUES (
    p_company_id, trim(p_client_name), trim(p_client_whatsapp), 
    NULLIF(trim(COALESCE(p_email, '')), ''),
    p_service_ids, p_desired_date, p_professional_id
  )
  RETURNING id INTO v_id;

  RETURN v_id;
END;
$$;
