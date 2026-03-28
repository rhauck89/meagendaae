
-- Drop all existing signatures of create_appointment
DROP FUNCTION IF EXISTS public.create_appointment(uuid, uuid, uuid, timestamptz, timestamptz);
DROP FUNCTION IF EXISTS public.create_appointment(uuid, uuid, uuid, timestamptz, timestamptz, numeric, text, text, text, text);

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
  v_client_exists boolean;
BEGIN
  SELECT EXISTS(
    SELECT 1 FROM clients WHERE id = p_client_id
  ) INTO v_client_exists;

  IF NOT v_client_exists THEN
    RAISE EXCEPTION 'Client not found for id: %', p_client_id;
  END IF;

  INSERT INTO appointments (
    company_id, professional_id, client_id,
    start_time, end_time, total_price,
    client_name, client_whatsapp, notes, status
  ) VALUES (
    p_company_id, p_professional_id, p_client_id,
    p_start_time, p_end_time, p_total_price,
    p_client_name, p_client_whatsapp, p_notes, 'confirmed'
  )
  RETURNING id INTO v_appointment_id;

  RETURN v_appointment_id;
END;
$$;
