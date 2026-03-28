
DROP FUNCTION IF EXISTS public.create_appointment(uuid, uuid, uuid, timestamptz, timestamptz, numeric, text, text, text);

CREATE OR REPLACE FUNCTION public.create_appointment(
  p_company_id uuid,
  p_professional_id uuid,
  p_client_id uuid,
  p_start_time timestamptz,
  p_end_time timestamptz,
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
  v_client_id uuid;
BEGIN
  -- Ensure client exists
  SELECT id INTO v_client_id
  FROM clients
  WHERE id = p_client_id
  LIMIT 1;

  -- If client does not exist create it automatically
  IF v_client_id IS NULL THEN
    INSERT INTO clients (id, company_id, name, whatsapp)
    VALUES (p_client_id, p_company_id, p_client_name, p_client_whatsapp)
    RETURNING id INTO v_client_id;
  END IF;

  -- Create appointment
  INSERT INTO appointments (
    company_id, professional_id, client_id,
    start_time, end_time, total_price,
    client_name, client_whatsapp, notes, status
  ) VALUES (
    p_company_id, p_professional_id, v_client_id,
    p_start_time, p_end_time, p_total_price,
    p_client_name, p_client_whatsapp, p_notes, 'confirmed'
  )
  RETURNING id INTO v_appointment_id;

  RETURN v_appointment_id;
END;
$$;
