
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
  v_company_id uuid;
  v_appointment_id uuid;
BEGIN
  -- Ensure client exists; if not, create a minimal record
  IF NOT EXISTS (SELECT 1 FROM clients WHERE id = p_client_id) THEN
    -- Derive company_id from the professional
    SELECT company_id INTO v_company_id
    FROM collaborators
    WHERE profile_id = p_professional_id
    LIMIT 1;

    IF v_company_id IS NULL THEN
      SELECT company_id INTO v_company_id
      FROM profiles
      WHERE id = p_professional_id
      LIMIT 1;
    END IF;

    IF v_company_id IS NULL THEN
      RAISE EXCEPTION 'Cannot determine company for this professional';
    END IF;

    INSERT INTO clients (id, company_id, name, whatsapp)
    VALUES (p_client_id, v_company_id, COALESCE(p_client_name, 'Cliente'), p_client_whatsapp);
  END IF;

  -- Derive company_id from the client record
  SELECT company_id INTO v_company_id
  FROM clients
  WHERE id = p_client_id;

  IF v_company_id IS NULL THEN
    RAISE EXCEPTION 'Client not found';
  END IF;

  INSERT INTO appointments (
    company_id,
    professional_id,
    client_id,
    start_time,
    end_time,
    total_price,
    status,
    client_name,
    client_whatsapp,
    notes,
    created_at
  )
  VALUES (
    v_company_id,
    p_professional_id,
    p_client_id,
    p_start_time,
    p_end_time,
    p_total_price,
    'confirmed',
    p_client_name,
    p_client_whatsapp,
    p_notes,
    now()
  )
  RETURNING id INTO v_appointment_id;

  RETURN v_appointment_id;
END;
$$;

ALTER FUNCTION public.create_appointment OWNER TO postgres;
