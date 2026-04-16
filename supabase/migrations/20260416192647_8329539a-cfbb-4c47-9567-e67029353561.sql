CREATE OR REPLACE FUNCTION public.create_appointment(p_professional_id uuid, p_client_id uuid, p_start_time timestamp with time zone, p_end_time timestamp with time zone, p_total_price numeric DEFAULT 0, p_client_name text DEFAULT NULL::text, p_client_whatsapp text DEFAULT NULL::text, p_notes text DEFAULT NULL::text, p_promotion_id uuid DEFAULT NULL::uuid)
 RETURNS uuid
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_appointment_id uuid;
  v_company_id uuid;
  v_client_company_id uuid;
  v_client_name text;
  v_client_whatsapp text;
  v_client_email text;
  v_client_user_id uuid;
  v_client_blocked boolean;
  v_booking_mode text;
  v_slot_interval integer;
  v_open_time time;
  v_start_minutes integer;
  v_open_minutes integer;
  v_auth_uid uuid;
  v_conflict_count integer;
BEGIN
  v_auth_uid := auth.uid();

  IF v_auth_uid IS NULL THEN
    RAISE EXCEPTION 'AUTH_REQUIRED: É necessário estar autenticado para criar um agendamento.'
      USING ERRCODE = '28000';
  END IF;

  IF p_professional_id IS NULL THEN RAISE EXCEPTION 'Professional is required'; END IF;
  IF p_client_id IS NULL THEN RAISE EXCEPTION 'Client is required'; END IF;
  IF p_start_time IS NULL OR p_end_time IS NULL THEN RAISE EXCEPTION 'Start and end time are required'; END IF;
  IF p_end_time <= p_start_time THEN RAISE EXCEPTION 'End time must be after start time'; END IF;

  SELECT pr.company_id INTO v_company_id FROM public.profiles pr WHERE pr.id = p_professional_id LIMIT 1;
  IF v_company_id IS NULL THEN
    SELECT c.company_id INTO v_company_id FROM public.collaborators c WHERE c.profile_id = p_professional_id LIMIT 1;
  END IF;
  IF v_company_id IS NULL THEN RAISE EXCEPTION 'Cannot determine company for this professional'; END IF;

  SELECT co.booking_mode, co.fixed_slot_interval
  INTO v_booking_mode, v_slot_interval
  FROM public.companies co WHERE co.id = v_company_id;

  DECLARE
    v_prof_booking_mode text;
    v_prof_grid_interval integer;
  BEGIN
    SELECT c.booking_mode, c.grid_interval
    INTO v_prof_booking_mode, v_prof_grid_interval
    FROM public.collaborators c
    WHERE c.profile_id = p_professional_id AND c.company_id = v_company_id LIMIT 1;
    IF v_prof_booking_mode IS NOT NULL AND v_prof_booking_mode <> '' THEN
      v_booking_mode := v_prof_booking_mode;
      v_slot_interval := COALESCE(v_prof_grid_interval, v_slot_interval);
    END IF;
  END;

  IF v_booking_mode = 'fixed_grid' AND v_slot_interval > 0 THEN
    SELECT bh.open_time INTO v_open_time
    FROM public.business_hours bh
    WHERE bh.company_id = v_company_id
      AND bh.day_of_week = EXTRACT(DOW FROM p_start_time AT TIME ZONE (
        SELECT COALESCE(co2.timezone, 'America/Sao_Paulo') FROM public.companies co2 WHERE co2.id = v_company_id
      ))::integer
      AND bh.is_closed = false
    LIMIT 1;
    IF v_open_time IS NOT NULL THEN
      v_start_minutes := EXTRACT(HOUR FROM (p_start_time AT TIME ZONE (
        SELECT COALESCE(co2.timezone, 'America/Sao_Paulo') FROM public.companies co2 WHERE co2.id = v_company_id
      ))::time)::integer * 60
        + EXTRACT(MINUTE FROM (p_start_time AT TIME ZONE (
        SELECT COALESCE(co2.timezone, 'America/Sao_Paulo') FROM public.companies co2 WHERE co2.id = v_company_id
      ))::time)::integer;
      v_open_minutes := EXTRACT(HOUR FROM v_open_time)::integer * 60 + EXTRACT(MINUTE FROM v_open_time)::integer;
      IF (v_start_minutes - v_open_minutes) % v_slot_interval <> 0 THEN
        RAISE EXCEPTION 'INVALID_TIME_SLOT: Time does not align with the fixed grid interval of % minutes', v_slot_interval;
      END IF;
    END IF;
  END IF;

  SELECT company_id, name, whatsapp, email, user_id, is_blocked
  INTO v_client_company_id, v_client_name, v_client_whatsapp, v_client_email, v_client_user_id, v_client_blocked
  FROM public.clients WHERE id = p_client_id LIMIT 1;

  IF v_client_company_id IS NULL THEN RAISE EXCEPTION 'Client not found'; END IF;
  IF v_client_company_id <> v_company_id THEN RAISE EXCEPTION 'Client belongs to a different company'; END IF;
  IF v_client_blocked THEN RAISE EXCEPTION 'Este cliente está bloqueado para realizar agendamentos. Entre em contato com o estabelecimento.'; END IF;

  IF v_client_user_id IS NULL THEN
    UPDATE public.clients SET user_id = v_auth_uid WHERE id = p_client_id AND user_id IS NULL;
  END IF;

  UPDATE public.clients
  SET name = COALESCE(NULLIF(trim(COALESCE(p_client_name, '')), ''), name),
      whatsapp = COALESCE(NULLIF(trim(COALESCE(p_client_whatsapp, '')), ''), whatsapp)
  WHERE id = p_client_id AND company_id = v_company_id;

  SELECT name, whatsapp INTO v_client_name, v_client_whatsapp
  FROM public.clients WHERE id = p_client_id LIMIT 1;

  -- ── Conflict check: strict overlap, exclude inactive statuses ──
  SELECT COUNT(*) INTO v_conflict_count
  FROM public.appointments a
  WHERE a.professional_id = p_professional_id
    AND a.company_id = v_company_id
    AND a.status NOT IN ('cancelled', 'no_show', 'rescheduled')
    AND p_start_time < a.end_time
    AND p_end_time   > a.start_time;

  RAISE LOG '[create_appointment] prof=% start=% end=% conflicts=%',
    p_professional_id, p_start_time, p_end_time, v_conflict_count;

  IF v_conflict_count > 0 THEN
    RAISE EXCEPTION 'Time slot already booked';
  END IF;

  IF p_promotion_id IS NOT NULL AND NOT EXISTS (
    SELECT 1 FROM public.promotions WHERE id = p_promotion_id AND company_id = v_company_id
  ) THEN
    RAISE EXCEPTION 'Promotion not found';
  END IF;

  INSERT INTO public.appointments (
    company_id, client_id, professional_id, start_time, end_time,
    total_price, status, client_name, client_whatsapp, notes, promotion_id
  )
  VALUES (
    v_company_id, p_client_id, p_professional_id, p_start_time, p_end_time,
    COALESCE(p_total_price, 0), 'confirmed', v_client_name, v_client_whatsapp,
    NULLIF(trim(COALESCE(p_notes, '')), ''), p_promotion_id
  )
  RETURNING id INTO v_appointment_id;

  IF p_promotion_id IS NOT NULL THEN
    UPDATE public.promotions SET used_slots = used_slots + 1
    WHERE id = p_promotion_id AND company_id = v_company_id;
    INSERT INTO public.promotion_bookings (promotion_id, company_id, client_id, appointment_id)
    VALUES (p_promotion_id, v_company_id, p_client_id, v_appointment_id);
  END IF;

  RETURN v_appointment_id;
END;
$function$;