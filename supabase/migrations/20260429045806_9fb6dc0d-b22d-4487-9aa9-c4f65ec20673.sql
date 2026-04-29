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
  p_services jsonb, -- [{service_id, price, duration_minutes}]
  p_cashback_ids uuid[] DEFAULT '{}',
  p_user_id uuid DEFAULT NULL
)
 RETURNS uuid
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_appointment_id uuid;
  v_client_blocked boolean;
  v_conflict_count integer;
  v_cashback_id uuid;
BEGIN
  -- 1. Validações Iniciais
  IF p_professional_id IS NULL THEN RAISE EXCEPTION 'Professional is required'; END IF;
  IF p_client_id IS NULL THEN RAISE EXCEPTION 'Client is required'; END IF;
  IF p_start_time IS NULL OR p_end_time IS NULL THEN RAISE EXCEPTION 'Start and end time are required'; END IF;
  IF p_end_time <= p_start_time THEN RAISE EXCEPTION 'End time must be after start time'; END IF;

  -- 2. Verificar bloqueio do cliente
  SELECT is_blocked INTO v_client_blocked FROM public.clients WHERE id = p_client_id LIMIT 1;
  IF v_client_blocked THEN RAISE EXCEPTION 'CLIENT_BLOCKED: Cliente bloqueado.'; END IF;

  -- 3. Verificação de Conflito (Double Booking Prevention)
  SELECT COUNT(*) INTO v_conflict_count
  FROM public.appointments a
  WHERE a.professional_id = p_professional_id
    AND a.company_id = p_company_id
    AND a.status NOT IN ('cancelled', 'no_show', 'rescheduled')
    AND p_start_time < a.end_time
    AND p_end_time   > a.start_time;

  IF v_conflict_count > 0 THEN
    RAISE EXCEPTION 'TIME_CONFLICT: Horário já ocupado.';
  END IF;

  -- 4. Criar Agendamento principal
  INSERT INTO public.appointments (
    company_id, client_id, professional_id, start_time, end_time,
    total_price, status, client_name, client_whatsapp, notes, promotion_id, user_id
  )
  VALUES (
    p_company_id, p_client_id, p_professional_id, p_start_time, p_end_time,
    COALESCE(p_total_price, 0), 'confirmed', p_client_name, p_client_whatsapp,
    NULLIF(trim(COALESCE(p_notes, '')), ''), p_promotion_id, p_user_id
  )
  RETURNING id INTO v_appointment_id;

  -- 5. Inserir Serviços do Agendamento
  INSERT INTO public.appointment_services (appointment_id, service_id, price, duration_minutes)
  SELECT 
    v_appointment_id,
    (s->>'service_id')::uuid,
    (s->>'price')::numeric,
    (s->>'duration_minutes')::int
  FROM jsonb_array_elements(p_services) AS s;

  -- 6. Processar Cashback utilizado (se houver)
  IF array_length(p_cashback_ids, 1) > 0 THEN
    FOREACH v_cashback_id IN ARRAY p_cashback_ids
    LOOP
      UPDATE public.client_cashback
      SET status = 'used',
          used_at = now(),
          used_appointment_id = v_appointment_id
      WHERE id = v_cashback_id AND status = 'available';
    END LOOP;
  END IF;

  -- 7. Atualizar Promotion used_slots (se houver)
  IF p_promotion_id IS NOT NULL THEN
    UPDATE public.promotions SET used_slots = used_slots + 1
    WHERE id = p_promotion_id;
    
    INSERT INTO public.promotion_bookings (promotion_id, company_id, client_id, appointment_id)
    VALUES (p_promotion_id, p_company_id, p_client_id, v_appointment_id);
  END IF;

  -- 8. Atualizar última visita do cliente
  UPDATE public.clients 
  SET updated_at = now(),
      name = COALESCE(NULLIF(trim(p_client_name), ''), name),
      whatsapp = COALESCE(NULLIF(trim(p_client_whatsapp), ''), whatsapp)
  WHERE id = p_client_id;

  RETURN v_appointment_id;
END;
$function$;