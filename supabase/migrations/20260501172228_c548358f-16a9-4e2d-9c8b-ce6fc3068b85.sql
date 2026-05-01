-- Drop the ambiguous functions to resolve overlapping signatures
DROP FUNCTION IF EXISTS public.book_event_slot(uuid, text, text, text, uuid[], text);
DROP FUNCTION IF EXISTS public.book_event_slot(uuid, text, text, text, text, uuid[], text);

-- Create the new, structured version of the booking function
CREATE OR REPLACE FUNCTION public.book_open_agenda_slot_v2(
  p_slot_id uuid,
  p_client_name text,
  p_client_whatsapp text,
  p_client_email text DEFAULT '',
  p_service_ids uuid[] DEFAULT '{}',
  p_notes text DEFAULT NULL
)
RETURNS TABLE (
  appointment_id uuid,
  success boolean,
  message text
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_slot RECORD;
  v_event RECORD;
  v_client_id uuid;
  v_appointment_id uuid;
  v_total_price numeric := 0;
  v_total_duration integer := 0;
  v_end_time timestamptz;
  v_company_id uuid;
  v_service RECORD;
  v_normalized_whatsapp text;
BEGIN
  -- 1. Normalização do WhatsApp (remover não-dígitos)
  v_normalized_whatsapp := regexp_replace(p_client_whatsapp, '\D', '', 'g');
  IF length(v_normalized_whatsapp) < 10 THEN
    RETURN QUERY SELECT NULL::uuid, false, 'WhatsApp inválido'::text;
    RETURN;
  END IF;

  -- 2. Lock do slot para evitar overbooking
  SELECT * INTO v_slot FROM public.event_slots WHERE id = p_slot_id FOR UPDATE;
  IF NOT FOUND THEN
    RETURN QUERY SELECT NULL::uuid, false, 'Horário não encontrado'::text;
    RETURN;
  END IF;

  IF v_slot.current_bookings >= v_slot.max_bookings THEN
    RETURN QUERY SELECT NULL::uuid, false, 'Este horário acabou de ser preenchido'::text;
    RETURN;
  END IF;

  -- 3. Obter dados do evento
  SELECT * INTO v_event FROM public.events WHERE id = v_slot.event_id;
  IF NOT FOUND THEN
    RETURN QUERY SELECT NULL::uuid, false, 'Evento não encontrado'::text;
    RETURN;
  END IF;
  v_company_id := v_event.company_id;

  -- 4. Criar ou reutilizar cliente dentro da empresa
  SELECT id INTO v_client_id FROM public.clients
    WHERE company_id = v_company_id AND whatsapp = v_normalized_whatsapp LIMIT 1;

  IF v_client_id IS NULL THEN
    INSERT INTO public.clients (company_id, name, whatsapp, email)
    VALUES (v_company_id, p_client_name, v_normalized_whatsapp, NULLIF(p_client_email, ''))
    RETURNING id INTO v_client_id;
  ELSE
    UPDATE public.clients SET
      email = COALESCE(NULLIF(p_client_email, ''), email),
      name = COALESCE(NULLIF(p_client_name, ''), name)
    WHERE id = v_client_id;
  END IF;

  -- 5. Validar serviços e calcular preço/duração
  -- Só aceita serviços que estejam vinculados ao evento em event_services ou event_service_prices
  IF array_length(p_service_ids, 1) > 0 THEN
    FOR v_service IN
      SELECT 
        s.id, 
        s.duration_minutes,
        COALESCE(es.event_price, esp.override_price, s.price) as final_price
      FROM public.services s
      LEFT JOIN public.event_services es ON es.service_id = s.id AND es.event_id = v_event.id
      LEFT JOIN public.event_service_prices esp ON esp.service_id = s.id AND esp.event_id = v_event.id
      WHERE s.id = ANY(p_service_ids)
      AND (es.id IS NOT NULL OR esp.id IS NOT NULL) -- Garantia de que pertence ao evento
    LOOP
      v_total_price := v_total_price + v_service.final_price;
      v_total_duration := v_total_duration + v_service.duration_minutes;
    END LOOP;
    
    -- Se nenhum serviço válido foi encontrado
    IF v_total_duration = 0 THEN
      RETURN QUERY SELECT NULL::uuid, false, 'Nenhum serviço selecionado é válido para este evento'::text;
      RETURN;
    END IF;
  ELSE
    RETURN QUERY SELECT NULL::uuid, false, 'Selecione pelo menos um serviço'::text;
    RETURN;
  END IF;

  -- 6. Calcular horário de término
  v_end_time := (v_slot.slot_date || ' ' || v_slot.start_time)::timestamptz + (v_total_duration || ' minutes')::interval;

  -- 7. Criar o agendamento
  INSERT INTO public.appointments (
    company_id, 
    professional_id, 
    client_id, 
    client_name, 
    client_whatsapp,
    start_time, 
    end_time, 
    total_price, 
    status, 
    event_id, 
    notes,
    source
  ) VALUES (
    v_company_id, 
    v_slot.professional_id, 
    v_client_id, 
    p_client_name, 
    v_normalized_whatsapp,
    (v_slot.slot_date || ' ' || v_slot.start_time)::timestamptz, 
    v_end_time,
    v_total_price, 
    'confirmed', 
    v_event.id, 
    p_notes,
    'open_agenda'
  ) RETURNING id INTO v_appointment_id;

  -- 8. Vincular serviços ao agendamento
  INSERT INTO public.appointment_services (appointment_id, service_id, price, duration_minutes)
  SELECT 
    v_appointment_id, 
    s.id, 
    COALESCE(es.event_price, esp.override_price, s.price), 
    s.duration_minutes
  FROM public.services s
  LEFT JOIN public.event_services es ON es.service_id = s.id AND es.event_id = v_event.id
  LEFT JOIN public.event_service_prices esp ON esp.service_id = s.id AND esp.event_id = v_event.id
  WHERE s.id = ANY(p_service_ids)
  AND (es.id IS NOT NULL OR esp.id IS NOT NULL);

  -- 9. Incrementar contador de bookings no slot
  UPDATE public.event_slots SET current_bookings = current_bookings + 1 WHERE id = p_slot_id;

  RETURN QUERY SELECT v_appointment_id, true, 'Agendamento confirmado com sucesso!'::text;
END;
$$;