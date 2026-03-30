-- Align FK with booking model: appointments should reference clients
ALTER TABLE public.appointments
DROP CONSTRAINT IF EXISTS appointments_client_id_fkey;

ALTER TABLE public.appointments
ADD CONSTRAINT appointments_client_id_fkey
FOREIGN KEY (client_id)
REFERENCES public.clients(id)
ON DELETE CASCADE;

-- Remove existing create_appointment overloads
DROP FUNCTION IF EXISTS public.create_appointment(uuid, uuid, timestamp with time zone, timestamp with time zone, numeric);
DROP FUNCTION IF EXISTS public.create_appointment(uuid, uuid, timestamp with time zone, timestamp with time zone, numeric, text, text, text);

-- Core function (requested flow): ensure client -> check conflicts -> insert appointment
CREATE OR REPLACE FUNCTION public.create_appointment(
  p_client_id uuid,
  p_professional_id uuid,
  p_start_time timestamp with time zone,
  p_end_time timestamp with time zone,
  p_total_price numeric
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_appointment_id uuid;
  v_company_id uuid;
  v_client_company_id uuid;
  v_client_name text;
  v_client_whatsapp text;
BEGIN
  -- Resolve company by professional
  SELECT p.company_id INTO v_company_id
  FROM public.profiles p
  WHERE p.id = p_professional_id
  LIMIT 1;

  IF v_company_id IS NULL THEN
    SELECT c.company_id INTO v_company_id
    FROM public.collaborators c
    WHERE c.profile_id = p_professional_id
    LIMIT 1;
  END IF;

  IF v_company_id IS NULL THEN
    RAISE EXCEPTION 'Cannot determine company for this professional';
  END IF;

  -- Ensure client exists (adapted to current schema: company_id/name are required)
  INSERT INTO public.clients (id, company_id, name)
  VALUES (p_client_id, v_company_id, 'Cliente')
  ON CONFLICT (id) DO NOTHING;

  -- Enforce tenant consistency
  SELECT company_id, name, whatsapp
  INTO v_client_company_id, v_client_name, v_client_whatsapp
  FROM public.clients
  WHERE id = p_client_id
  LIMIT 1;

  IF v_client_company_id IS NULL THEN
    RAISE EXCEPTION 'Client not found';
  END IF;

  IF v_client_company_id <> v_company_id THEN
    RAISE EXCEPTION 'Client belongs to a different company';
  END IF;

  -- Check time conflicts
  IF EXISTS (
    SELECT 1
    FROM public.appointments
    WHERE professional_id = p_professional_id
      AND status NOT IN ('cancelled','no_show')
      AND start_time < p_end_time
      AND end_time > p_start_time
  ) THEN
    RAISE EXCEPTION 'Time slot already booked';
  END IF;

  -- Create appointment
  INSERT INTO public.appointments (
    company_id,
    client_id,
    professional_id,
    start_time,
    end_time,
    total_price,
    status,
    created_at,
    client_name,
    client_whatsapp
  )
  VALUES (
    v_company_id,
    p_client_id,
    p_professional_id,
    p_start_time,
    p_end_time,
    p_total_price,
    'confirmed',
    now(),
    v_client_name,
    v_client_whatsapp
  )
  RETURNING id INTO v_appointment_id;

  RETURN v_appointment_id;
END;
$$;

-- Backward-compatible overload used by current frontend payload
CREATE OR REPLACE FUNCTION public.create_appointment(
  p_professional_id uuid,
  p_client_id uuid,
  p_start_time timestamp with time zone,
  p_end_time timestamp with time zone,
  p_total_price numeric,
  p_client_name text,
  p_client_whatsapp text,
  p_notes text
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_appointment_id uuid;
BEGIN
  -- Upsert richer client details when provided
  UPDATE public.clients
  SET name = COALESCE(NULLIF(trim(p_client_name), ''), name),
      whatsapp = COALESCE(NULLIF(trim(p_client_whatsapp), ''), whatsapp)
  WHERE id = p_client_id;

  v_appointment_id := public.create_appointment(
    p_client_id,
    p_professional_id,
    p_start_time,
    p_end_time,
    p_total_price
  );

  IF p_notes IS NOT NULL THEN
    UPDATE public.appointments
    SET notes = p_notes
    WHERE id = v_appointment_id;
  END IF;

  RETURN v_appointment_id;
END;
$$;

ALTER FUNCTION public.create_appointment(uuid, uuid, timestamp with time zone, timestamp with time zone, numeric) OWNER TO postgres;
ALTER FUNCTION public.create_appointment(uuid, uuid, timestamp with time zone, timestamp with time zone, numeric, text, text, text) OWNER TO postgres;