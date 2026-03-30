
-- Add delay_minutes column to appointments
ALTER TABLE public.appointments ADD COLUMN IF NOT EXISTS delay_minutes smallint DEFAULT 0;

-- Create RPC to register delay and shift subsequent appointments
CREATE OR REPLACE FUNCTION public.register_delay(
  p_appointment_id uuid,
  p_delay_minutes smallint
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_professional_id uuid;
  v_company_id uuid;
  v_end_time timestamptz;
  v_interval interval;
  v_affected jsonb := '[]'::jsonb;
  rec RECORD;
BEGIN
  IF p_delay_minutes < 1 OR p_delay_minutes > 120 THEN
    RAISE EXCEPTION 'Delay must be between 1 and 120 minutes';
  END IF;

  -- Get appointment info
  SELECT professional_id, company_id, end_time
  INTO v_professional_id, v_company_id, v_end_time
  FROM public.appointments
  WHERE id = p_appointment_id
    AND status NOT IN ('cancelled', 'no_show', 'completed');

  IF v_professional_id IS NULL THEN
    RAISE EXCEPTION 'Appointment not found or already finished';
  END IF;

  v_interval := (p_delay_minutes || ' minutes')::interval;

  -- Update the delayed appointment itself
  UPDATE public.appointments
  SET start_time = start_time + v_interval,
      end_time = end_time + v_interval,
      delay_minutes = COALESCE(delay_minutes, 0) + p_delay_minutes,
      updated_at = now()
  WHERE id = p_appointment_id;

  -- Shift all subsequent appointments for the same professional on the same day
  FOR rec IN
    SELECT id, client_id, client_name, client_whatsapp, start_time + v_interval AS new_start, end_time + v_interval AS new_end
    FROM public.appointments
    WHERE professional_id = v_professional_id
      AND company_id = v_company_id
      AND status NOT IN ('cancelled', 'no_show', 'completed')
      AND id <> p_appointment_id
      AND start_time >= v_end_time
      AND (start_time AT TIME ZONE 'America/Sao_Paulo')::date = (v_end_time AT TIME ZONE 'America/Sao_Paulo')::date
    ORDER BY start_time
  LOOP
    UPDATE public.appointments
    SET start_time = rec.new_start,
        end_time = rec.new_end,
        delay_minutes = COALESCE(delay_minutes, 0) + p_delay_minutes,
        updated_at = now()
    WHERE id = rec.id;

    v_affected := v_affected || jsonb_build_object(
      'id', rec.id,
      'client_name', rec.client_name,
      'client_whatsapp', rec.client_whatsapp,
      'new_start', to_char(rec.new_start AT TIME ZONE 'America/Sao_Paulo', 'HH24:MI'),
      'new_end', to_char(rec.new_end AT TIME ZONE 'America/Sao_Paulo', 'HH24:MI')
    );
  END LOOP;

  RETURN v_affected;
END;
$$;

GRANT EXECUTE ON FUNCTION public.register_delay(uuid, smallint) TO authenticated;
