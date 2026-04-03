
CREATE OR REPLACE FUNCTION public.book_event_slot(
  p_slot_id uuid,
  p_client_name text,
  p_client_whatsapp text,
  p_client_email text DEFAULT '',
  p_client_cpf text DEFAULT '',
  p_service_ids uuid[] DEFAULT '{}',
  p_notes text DEFAULT NULL
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_slot RECORD;
  v_event RECORD;
  v_client_id uuid;
  v_appointment_id uuid;
  v_total_price numeric := 0;
  v_total_duration int := 0;
  v_start_ts timestamptz;
  v_end_ts timestamptz;
  v_sid uuid;
  v_svc RECORD;
  v_override_price numeric;
  v_existing_count int;
BEGIN
  -- Lock and get slot
  SELECT * INTO v_slot FROM public.event_slots WHERE id = p_slot_id FOR UPDATE;
  IF v_slot IS NULL THEN RAISE EXCEPTION 'Slot not found'; END IF;
  IF v_slot.current_bookings >= v_slot.max_bookings THEN RAISE EXCEPTION 'Slot is full'; END IF;

  -- Get event
  SELECT * INTO v_event FROM public.events WHERE id = v_slot.event_id;
  IF v_event.status <> 'published' THEN RAISE EXCEPTION 'Event is not available'; END IF;

  -- Validate inputs
  IF p_client_name IS NULL OR trim(p_client_name) = '' THEN RAISE EXCEPTION 'Name is required'; END IF;
  IF p_client_whatsapp IS NULL OR trim(p_client_whatsapp) = '' THEN RAISE EXCEPTION 'WhatsApp is required'; END IF;
  IF length(p_client_name) > 100 THEN p_client_name := substring(p_client_name FROM 1 FOR 100); END IF;
  IF length(p_client_whatsapp) > 20 THEN RAISE EXCEPTION 'Invalid WhatsApp'; END IF;

  -- Create/find client WITHOUT CPF
  v_client_id := public.create_client(
    v_event.company_id,
    trim(p_client_name),
    trim(p_client_whatsapp),
    NULLIF(trim(COALESCE(p_client_email, '')), '')
  );

  -- Enforce max_bookings_per_client if set (> 0)
  IF v_event.max_bookings_per_client > 0 THEN
    SELECT COUNT(*) INTO v_existing_count
    FROM public.appointments
    WHERE event_id = v_event.id
      AND client_id = v_client_id
      AND status NOT IN ('cancelled');

    IF v_existing_count >= v_event.max_bookings_per_client THEN
      RAISE EXCEPTION 'Você já atingiu o limite de agendamentos para este evento';
    END IF;
  END IF;

  -- Calculate prices with event overrides
  FOREACH v_sid IN ARRAY p_service_ids LOOP
    SELECT * INTO v_svc FROM public.services WHERE id = v_sid AND active = true;
    IF v_svc IS NULL THEN RAISE EXCEPTION 'Service % not found', v_sid; END IF;

    SELECT override_price INTO v_override_price
    FROM public.event_service_prices
    WHERE event_id = v_event.id AND service_id = v_sid;

    v_total_price := v_total_price + COALESCE(v_override_price, v_svc.price);
    v_total_duration := v_total_duration + v_svc.duration_minutes;
  END LOOP;

  -- Build timestamps
  v_start_ts := (v_slot.slot_date || ' ' || v_slot.start_time)::timestamptz;
  v_end_ts := v_start_ts + (v_total_duration || ' minutes')::interval;

  -- Create appointment
  INSERT INTO public.appointments (
    company_id, professional_id, client_id, client_name, client_whatsapp,
    start_time, end_time, total_price, status, event_id, notes
  ) VALUES (
    v_event.company_id, v_slot.professional_id, v_client_id,
    trim(p_client_name), trim(p_client_whatsapp),
    v_start_ts, v_end_ts, v_total_price, 'confirmed', v_event.id, p_notes
  ) RETURNING id INTO v_appointment_id;

  -- Insert appointment services
  FOREACH v_sid IN ARRAY p_service_ids LOOP
    SELECT * INTO v_svc FROM public.services WHERE id = v_sid;
    SELECT override_price INTO v_override_price
    FROM public.event_service_prices
    WHERE event_id = v_event.id AND service_id = v_sid;

    INSERT INTO public.appointment_services (appointment_id, service_id, price, duration_minutes)
    VALUES (v_appointment_id, v_sid, COALESCE(v_override_price, v_svc.price), v_svc.duration_minutes);
  END LOOP;

  -- Update slot count
  UPDATE public.event_slots
  SET current_bookings = current_bookings + 1
  WHERE id = p_slot_id;

  RETURN v_appointment_id;
END;
$$;
