
DECLARE
  v_appointment_id uuid;
  v_client_id uuid := p_client_id;
  v_client_blocked boolean := false;
  v_conflict_count integer;
  v_event_conflict_count integer;
  v_cashback_id uuid;
  v_global_client_id uuid;
  v_normalized_whatsapp text;
  v_effective_user_id uuid;
BEGIN
  IF p_company_id IS NULL THEN RAISE EXCEPTION 'Company is required'; END IF;
  IF p_professional_id IS NULL THEN RAISE EXCEPTION 'Professional is required'; END IF;
  IF p_start_time IS NULL OR p_end_time IS NULL THEN RAISE EXCEPTION 'Start and end time are required'; END IF;
  IF p_end_time <= p_start_time THEN RAISE EXCEPTION 'End time must be after start time'; END IF;

  v_normalized_whatsapp := public.normalize_whatsapp_v2(p_client_whatsapp);
  v_effective_user_id := COALESCE(p_user_id, auth.uid());
  
  -- Client Logic
  IF v_client_id IS NULL THEN
    IF v_normalized_whatsapp IS NULL OR v_normalized_whatsapp = '' THEN
      RAISE EXCEPTION 'CLIENT_REQUIRED: WhatsApp do cliente e obrigatorio.';
    END IF;

    -- Find existing client by whatsapp in this company
    SELECT id INTO v_client_id FROM public.clients
    WHERE company_id = p_company_id AND whatsapp = v_normalized_whatsapp
    LIMIT 1;

    IF v_client_id IS NULL THEN
        -- Create or update global client
        INSERT INTO public.clients_global (whatsapp, name, user_id, email)
        VALUES (v_normalized_whatsapp, COALESCE(NULLIF(trim(p_client_name), ''), 'Cliente'), v_effective_user_id, p_client_email)
        ON CONFLICT (whatsapp) DO UPDATE SET 
            name = EXCLUDED.name,
            email = COALESCE(EXCLUDED.email, clients_global.email)
        RETURNING id INTO v_global_client_id;

        -- Create company-specific client
        INSERT INTO public.clients (company_id, global_client_id, name, whatsapp, user_id, email)
        VALUES (p_company_id, v_global_client_id, COALESCE(NULLIF(trim(p_client_name), ''), 'Cliente'), v_normalized_whatsapp, v_effective_user_id, p_client_email)
        RETURNING id INTO v_client_id;
    ELSE
        -- Update existing client email if provided
        IF p_client_email IS NOT NULL AND p_client_email <> '' THEN
            UPDATE public.clients SET email = p_client_email WHERE id = v_client_id AND email IS NULL;
            UPDATE public.clients_global SET email = p_client_email WHERE whatsapp = v_normalized_whatsapp AND email IS NULL;
        END IF;
    END IF;
  END IF;

  -- 1. Check for conflicts in main agenda
  SELECT COUNT(*) INTO v_conflict_count
  FROM public.appointments a
  WHERE a.professional_id = p_professional_id
    AND a.company_id = p_company_id
    AND a.status NOT IN ('cancelled', 'no_show', 'rescheduled')
    AND p_start_time < a.end_time
    AND p_end_time > a.start_time;

  IF v_conflict_count > 0 THEN
    RAISE EXCEPTION 'TIME_CONFLICT: Horário já ocupado na agenda principal.';
  END IF;

  -- 2. Check for conflicts with Open Agenda (if blocked)
  SELECT COUNT(*) INTO v_event_conflict_count
  FROM public.event_slots es
  JOIN public.events e ON e.id = es.event_id
  WHERE es.professional_id = p_professional_id
    AND e.company_id = p_company_id
    AND e.status = 'published'
    AND e.block_main_schedule = true
    AND (es.slot_date + es.start_time) < p_end_time
    AND (es.slot_date + es.end_time) > p_start_time;

  IF v_event_conflict_count > 0 THEN
    RAISE EXCEPTION 'EVENT_CONFLICT: Este horário está reservado para um evento de Agenda Aberta.';
  END IF;

  -- Insert Appointment
  INSERT INTO public.appointments (
    company_id, client_id, professional_id, start_time, end_time,
    total_price, status, client_name, client_whatsapp, notes, promotion_id, user_id, booking_origin
  )
  VALUES (
    p_company_id, v_client_id, p_professional_id, p_start_time, p_end_time,
    COALESCE(p_total_price, 0), 'confirmed',
    COALESCE(NULLIF(trim(p_client_name), ''), 'Cliente'),
    v_normalized_whatsapp,
    NULLIF(trim(COALESCE(p_notes, '')), ''), 
    p_promotion_id, 
    v_effective_user_id, 
    COALESCE(p_booking_origin, 'public_booking')
  )
  RETURNING id INTO v_appointment_id;

  -- Insert Services
  INSERT INTO public.appointment_services (appointment_id, service_id, price, duration_minutes)
  SELECT
    v_appointment_id,
    (s->>'service_id')::uuid,
    (s->>'price')::numeric,
    (s->>'duration_minutes')::int
  FROM jsonb_array_elements(COALESCE(p_services, '[]'::jsonb)) AS s;

  -- Link cashbacks if any
  IF p_cashback_ids IS NOT NULL AND array_length(p_cashback_ids, 1) > 0 THEN
    UPDATE public.promotions_cashback_credits 
    SET used_at = now(), used_in_appointment_id = v_appointment_id
    WHERE id = ANY(p_cashback_ids) AND used_at IS NULL;
  END IF;

  RETURN v_appointment_id;
END;

