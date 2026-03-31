
-- Add time_from and time_to to waitlist table (public waitlist)
ALTER TABLE public.waitlist ADD COLUMN IF NOT EXISTS time_from time without time zone DEFAULT NULL;
ALTER TABLE public.waitlist ADD COLUMN IF NOT EXISTS time_to time without time zone DEFAULT NULL;
ALTER TABLE public.waitlist ADD COLUMN IF NOT EXISTS status text NOT NULL DEFAULT 'active';

-- Add time_from and time_to to waiting_list table (authenticated waitlist)
ALTER TABLE public.waiting_list ADD COLUMN IF NOT EXISTS time_from time without time zone DEFAULT NULL;
ALTER TABLE public.waiting_list ADD COLUMN IF NOT EXISTS time_to time without time zone DEFAULT NULL;

-- Create function to expire old waitlist entries (runs daily)
CREATE OR REPLACE FUNCTION public.expire_old_waitlist_entries()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  -- Expire waiting_list entries where desired_date < today
  UPDATE public.waiting_list
  SET status = 'expired'
  WHERE status = 'waiting'
    AND desired_date < CURRENT_DATE;

  -- Expire waitlist entries where desired_date < today
  UPDATE public.waitlist
  SET status = 'expired'
  WHERE status = 'active'
    AND desired_date < CURRENT_DATE;
END;
$$;

-- Update join_public_waitlist to accept time range
CREATE OR REPLACE FUNCTION public.join_public_waitlist(
  p_company_id uuid,
  p_client_name text,
  p_client_whatsapp text,
  p_email text,
  p_service_ids uuid[],
  p_desired_date date,
  p_professional_id uuid DEFAULT NULL,
  p_time_from time DEFAULT NULL,
  p_time_to time DEFAULT NULL
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_id uuid;
BEGIN
  IF p_client_name IS NULL OR trim(p_client_name) = '' THEN
    RAISE EXCEPTION 'Name is required';
  END IF;
  IF p_client_whatsapp IS NULL OR trim(p_client_whatsapp) = '' THEN
    RAISE EXCEPTION 'WhatsApp is required';
  END IF;
  IF p_company_id IS NULL THEN
    RAISE EXCEPTION 'Company is required';
  END IF;
  IF length(p_client_name) > 100 THEN
    p_client_name := substring(p_client_name FROM 1 FOR 100);
  END IF;
  IF length(p_client_whatsapp) > 20 THEN
    RAISE EXCEPTION 'Invalid WhatsApp number';
  END IF;

  INSERT INTO public.waitlist (
    company_id, client_name, client_whatsapp, email,
    service_ids, desired_date, professional_id, time_from, time_to, status
  )
  VALUES (
    p_company_id, trim(p_client_name), trim(p_client_whatsapp),
    NULLIF(trim(COALESCE(p_email, '')), ''),
    p_service_ids, p_desired_date, p_professional_id, p_time_from, p_time_to, 'active'
  )
  RETURNING id INTO v_id;

  RETURN v_id;
END;
$$;
