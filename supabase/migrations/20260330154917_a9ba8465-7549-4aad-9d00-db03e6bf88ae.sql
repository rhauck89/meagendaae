
-- RPC for public cancellation with 1-hour rule
CREATE OR REPLACE FUNCTION public.cancel_appointment_public(
  p_appointment_id uuid
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_appointment RECORD;
  v_minutes_until numeric;
BEGIN
  SELECT id, company_id, professional_id, client_id, client_name, client_whatsapp,
         start_time, end_time, status
  INTO v_appointment
  FROM public.appointments
  WHERE id = p_appointment_id;

  IF v_appointment.id IS NULL THEN
    RAISE EXCEPTION 'Appointment not found';
  END IF;

  IF v_appointment.status IN ('cancelled', 'completed', 'no_show') THEN
    RAISE EXCEPTION 'Appointment cannot be cancelled in current status';
  END IF;

  v_minutes_until := EXTRACT(EPOCH FROM (v_appointment.start_time - now())) / 60.0;

  IF v_minutes_until < 60 THEN
    RETURN jsonb_build_object(
      'success', false,
      'reason', 'too_late',
      'minutes_until', ROUND(v_minutes_until)
    );
  END IF;

  UPDATE public.appointments
  SET status = 'cancelled', updated_at = now()
  WHERE id = p_appointment_id;

  RETURN jsonb_build_object(
    'success', true,
    'company_id', v_appointment.company_id,
    'professional_id', v_appointment.professional_id,
    'start_time', v_appointment.start_time,
    'end_time', v_appointment.end_time,
    'cancelled_date', (v_appointment.start_time AT TIME ZONE 'America/Sao_Paulo')::date
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.cancel_appointment_public(uuid) TO anon, authenticated;

-- RPC for public reschedule
CREATE OR REPLACE FUNCTION public.reschedule_appointment(
  p_appointment_id uuid,
  p_new_start timestamp with time zone,
  p_new_end timestamp with time zone
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_appointment RECORD;
BEGIN
  SELECT id, company_id, professional_id, client_id, status
  INTO v_appointment
  FROM public.appointments
  WHERE id = p_appointment_id;

  IF v_appointment.id IS NULL THEN
    RAISE EXCEPTION 'Appointment not found';
  END IF;

  IF v_appointment.status IN ('cancelled', 'completed', 'no_show') THEN
    RAISE EXCEPTION 'Appointment cannot be rescheduled';
  END IF;

  -- Check time conflicts
  IF EXISTS (
    SELECT 1 FROM public.appointments
    WHERE professional_id = v_appointment.professional_id
      AND id <> p_appointment_id
      AND status NOT IN ('cancelled','no_show')
      AND start_time < p_new_end
      AND end_time > p_new_start
  ) THEN
    RAISE EXCEPTION 'Time slot already booked';
  END IF;

  UPDATE public.appointments
  SET start_time = p_new_start,
      end_time = p_new_end,
      updated_at = now()
  WHERE id = p_appointment_id;

  RETURN jsonb_build_object('success', true);
END;
$$;

GRANT EXECUTE ON FUNCTION public.reschedule_appointment(uuid, timestamptz, timestamptz) TO anon, authenticated;
