
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
  v_new_id uuid;
BEGIN
  SELECT id, company_id, professional_id, client_id, status, total_price, client_name, client_whatsapp, notes
  INTO v_appointment
  FROM public.appointments
  WHERE id = p_appointment_id;

  IF v_appointment.id IS NULL THEN
    RAISE EXCEPTION 'Appointment not found';
  END IF;

  IF v_appointment.status IN ('cancelled', 'completed', 'no_show', 'rescheduled') THEN
    RAISE EXCEPTION 'Appointment cannot be rescheduled';
  END IF;

  -- Check time conflicts
  IF EXISTS (
    SELECT 1 FROM public.appointments
    WHERE professional_id = v_appointment.professional_id
      AND id <> p_appointment_id
      AND status NOT IN ('cancelled','no_show','rescheduled')
      AND start_time < p_new_end
      AND end_time > p_new_start
  ) THEN
    RAISE EXCEPTION 'Time slot already booked';
  END IF;

  -- Mark original as rescheduled
  UPDATE public.appointments
  SET status = 'rescheduled',
      updated_at = now()
  WHERE id = p_appointment_id;

  -- Create new appointment
  INSERT INTO public.appointments (
    company_id, professional_id, client_id, client_name, client_whatsapp,
    start_time, end_time, total_price, notes, status, rescheduled_from_id
  )
  VALUES (
    v_appointment.company_id, v_appointment.professional_id, v_appointment.client_id,
    v_appointment.client_name, v_appointment.client_whatsapp,
    p_new_start, p_new_end, v_appointment.total_price, v_appointment.notes,
    'confirmed', p_appointment_id
  )
  RETURNING id INTO v_new_id;

  -- Copy services
  INSERT INTO public.appointment_services (appointment_id, service_id, price, duration_minutes)
  SELECT v_new_id, service_id, price, duration_minutes
  FROM public.appointment_services
  WHERE appointment_id = p_appointment_id;

  RETURN jsonb_build_object('success', true, 'new_appointment_id', v_new_id);
END;
$$;

GRANT EXECUTE ON FUNCTION public.reschedule_appointment(uuid, timestamptz, timestamptz) TO anon, authenticated;
