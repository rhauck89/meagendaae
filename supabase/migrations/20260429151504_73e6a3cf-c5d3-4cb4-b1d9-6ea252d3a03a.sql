DROP FUNCTION IF EXISTS public.lookup_client_globally(uuid, text);

CREATE OR REPLACE FUNCTION public.lookup_client_globally(
  p_company_id uuid,
  input_whatsapp text
)
RETURNS TABLE (
  global_id uuid,
  global_name text,
  global_whatsapp text,
  global_email text,
  local_client_id uuid
)
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    cg.id AS global_id,
    cg.name AS global_name,
    cg.whatsapp AS global_whatsapp,
    cg.email AS global_email,
    c.id AS local_client_id
  FROM public.clients_global AS cg
  LEFT JOIN public.clients AS c
    ON c.global_client_id = cg.id
   AND c.company_id = p_company_id
  WHERE cg.whatsapp = public.normalize_whatsapp_v2(input_whatsapp)
  LIMIT 1;
$$;

GRANT EXECUTE ON FUNCTION public.lookup_client_globally(uuid, text) TO anon;
GRANT EXECUTE ON FUNCTION public.lookup_client_globally(uuid, text) TO authenticated;

CREATE OR REPLACE FUNCTION public.create_appointment_v2(
  p_company_id uuid,
  p_professional_id uuid,
  p_client_id uuid,
  p_start_time timestamp with time zone,
  p_end_time timestamp with time zone,
  p_total_price numeric,
  p_client_name text,
  p_client_whatsapp text,
  p_notes text,
  p_promotion_id uuid,
  p_services jsonb,
  p_cashback_ids uuid[] DEFAULT '{}'::uuid[],
  p_user_id uuid DEFAULT NULL::uuid
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_appointment_id uuid;
  v_client_id uuid := p_client_id;
  v_client_blocked boolean := false;
  v_conflict_count integer;
  v_cashback_id uuid;
  v_global_client_id uuid;
  v_normalized_whatsapp text;
BEGIN
  IF p_company_id IS NULL THEN RAISE EXCEPTION 'Company is required'; END IF;
  IF p_professional_id IS NULL THEN RAISE EXCEPTION 'Professional is required'; END IF;
  IF p_start_time IS NULL OR p_end_time IS NULL THEN RAISE EXCEPTION 'Start and end time are required'; END IF;
  IF p_end_time <= p_start_time THEN RAISE EXCEPTION 'End time must be after start time'; END IF;

  v_normalized_whatsapp := public.normalize_whatsapp_v2(p_client_whatsapp);

  IF v_client_id IS NULL THEN
    IF v_normalized_whatsapp IS NULL OR v_normalized_whatsapp = '' THEN
      RAISE EXCEPTION 'CLIENT_REQUIRED: WhatsApp do cliente e obrigatorio para agendamento sem ID.';
    END IF;

    INSERT INTO public.clients_global (whatsapp, name, user_id)
    VALUES (v_normalized_whatsapp, COALESCE(NULLIF(trim(p_client_name), ''), 'Cliente'), p_user_id)
    ON CONFLICT (whatsapp) DO UPDATE SET
      name = COALESCE(NULLIF(trim(EXCLUDED.name), ''), clients_global.name),
      user_id = COALESCE(clients_global.user_id, EXCLUDED.user_id)
    RETURNING id INTO v_global_client_id;

    INSERT INTO public.client_companies (client_global_id, company_id)
    VALUES (v_global_client_id, p_company_id)
    ON CONFLICT (client_global_id, company_id) DO NOTHING;

    INSERT INTO public.clients (company_id, global_client_id, name, whatsapp, user_id)
    VALUES (p_company_id, v_global_client_id, COALESCE(NULLIF(trim(p_client_name), ''), 'Cliente'), v_normalized_whatsapp, p_user_id)
    ON CONFLICT (company_id, whatsapp) DO UPDATE SET
      global_client_id = COALESCE(clients.global_client_id, EXCLUDED.global_client_id),
      name = COALESCE(NULLIF(trim(EXCLUDED.name), ''), clients.name),
      user_id = COALESCE(clients.user_id, EXCLUDED.user_id)
    RETURNING id INTO v_client_id;
  ELSE
    SELECT global_client_id INTO v_global_client_id
    FROM public.clients
    WHERE id = v_client_id
    LIMIT 1;

    IF v_global_client_id IS NOT NULL THEN
      INSERT INTO public.client_companies (client_global_id, company_id)
      VALUES (v_global_client_id, p_company_id)
      ON CONFLICT (client_global_id, company_id) DO NOTHING;
    END IF;
  END IF;

  SELECT is_blocked INTO v_client_blocked FROM public.clients WHERE id = v_client_id LIMIT 1;
  IF v_client_blocked THEN RAISE EXCEPTION 'CLIENT_BLOCKED: Cliente bloqueado.'; END IF;

  SELECT COUNT(*) INTO v_conflict_count
  FROM public.appointments a
  WHERE a.professional_id = p_professional_id
    AND a.company_id = p_company_id
    AND a.status NOT IN ('cancelled', 'no_show', 'rescheduled')
    AND p_start_time < a.end_time
    AND p_end_time > a.start_time;

  IF v_conflict_count > 0 THEN
    RAISE EXCEPTION 'TIME_CONFLICT: Horario ja ocupado.';
  END IF;

  INSERT INTO public.appointments (
    company_id, client_id, professional_id, start_time, end_time,
    total_price, status, client_name, client_whatsapp, notes, promotion_id, user_id
  )
  VALUES (
    p_company_id, v_client_id, p_professional_id, p_start_time, p_end_time,
    COALESCE(p_total_price, 0), 'confirmed',
    COALESCE(NULLIF(trim(p_client_name), ''), 'Cliente'),
    v_normalized_whatsapp,
    NULLIF(trim(COALESCE(p_notes, '')), ''), p_promotion_id, p_user_id
  )
  RETURNING id INTO v_appointment_id;

  INSERT INTO public.appointment_services (appointment_id, service_id, price, duration_minutes)
  SELECT
    v_appointment_id,
    (s->>'service_id')::uuid,
    (s->>'price')::numeric,
    (s->>'duration_minutes')::int
  FROM jsonb_array_elements(COALESCE(p_services, '[]'::jsonb)) AS s;

  IF array_length(p_cashback_ids, 1) > 0 THEN
    FOREACH v_cashback_id IN ARRAY p_cashback_ids LOOP
      UPDATE public.client_cashback
      SET status = 'used',
          used_at = now(),
          used_appointment_id = v_appointment_id
      WHERE id = v_cashback_id AND status = 'active';
    END LOOP;
  END IF;

  IF p_promotion_id IS NOT NULL THEN
    UPDATE public.promotions SET used_slots = used_slots + 1
    WHERE id = p_promotion_id AND company_id = p_company_id;

    INSERT INTO public.promotion_bookings (promotion_id, company_id, client_id, appointment_id)
    VALUES (p_promotion_id, p_company_id, v_client_id, v_appointment_id);
  END IF;

  UPDATE public.clients
  SET updated_at = now(),
      name = COALESCE(NULLIF(trim(p_client_name), ''), name),
      whatsapp = COALESCE(v_normalized_whatsapp, whatsapp)
  WHERE id = v_client_id;

  RETURN v_appointment_id;
END;
$function$;

GRANT EXECUTE ON FUNCTION public.create_appointment_v2(uuid, uuid, uuid, timestamp with time zone, timestamp with time zone, numeric, text, text, text, uuid, jsonb, uuid[], uuid) TO anon;
GRANT EXECUTE ON FUNCTION public.create_appointment_v2(uuid, uuid, uuid, timestamp with time zone, timestamp with time zone, numeric, text, text, text, uuid, jsonb, uuid[], uuid) TO authenticated;