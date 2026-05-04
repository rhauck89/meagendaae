-- Update confirm_suggested_request to support both suggested and pending_client_confirmation statuses
CREATE OR REPLACE FUNCTION public.confirm_suggested_request(p_request_id uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_request RECORD;
  v_service RECORD;
  v_appointment_id UUID;
  v_start_timestamp TIMESTAMP WITH TIME ZONE;
  v_end_timestamp TIMESTAMP WITH TIME ZONE;
  v_conflict_count INTEGER;
BEGIN
  -- 1. Fetch the request and lock it
  SELECT * INTO v_request 
  FROM appointment_requests 
  WHERE id = p_request_id 
  FOR UPDATE;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'error', 'Solicitação não encontrada');
  END IF;

  -- 2. Validate status
  IF v_request.status = 'accepted' THEN
    RETURN jsonb_build_object('success', false, 'error', 'Esta solicitação já foi confirmada anteriormente', 'already_accepted', true);
  END IF;

  IF v_request.status NOT IN ('suggested', 'pending_client_confirmation') THEN
    RETURN jsonb_build_object('success', false, 'error', 'Esta solicitação não está mais aguardando confirmação');
  END IF;

  -- 3. Prepare timestamps
  v_start_timestamp := (v_request.suggested_date || ' ' || v_request.suggested_time)::TIMESTAMP WITH TIME ZONE;
  
  SELECT duration_minutes, price INTO v_service 
  FROM services 
  WHERE id = v_request.service_id;
  
  v_end_timestamp := v_start_timestamp + (COALESCE(v_service.duration_minutes, 30) || ' minutes')::INTERVAL;

  -- 4. Check for conflicts
  SELECT COUNT(*) INTO v_conflict_count
  FROM appointments
  WHERE professional_id = v_request.professional_id
    AND status NOT IN ('cancelled', 'no_show')
    AND (
      (start_time, end_time) OVERLAPS (v_start_timestamp, v_end_timestamp)
    );

  IF v_conflict_count > 0 THEN
    RETURN jsonb_build_object('success', false, 'error', 'Infelizmente este horário não está mais disponível. Por favor, solicite um novo horário ou escolha outro na agenda pública.');
  END IF;

  -- 5. Create the appointment
  DECLARE
    v_client_id UUID;
  BEGIN
    SELECT id INTO v_client_id 
    FROM clients 
    WHERE company_id = v_request.company_id 
      AND (whatsapp = v_request.client_whatsapp OR whatsapp = REPLACE(REPLACE(REPLACE(v_request.client_whatsapp, ' ', ''), '-', ''), '+', ''))
    LIMIT 1;

    INSERT INTO appointments (
      company_id,
      professional_id,
      client_id,
      client_name,
      client_whatsapp,
      start_time,
      end_time,
      total_price,
      status,
      notes,
      booking_origin
    ) VALUES (
      v_request.company_id,
      v_request.professional_id,
      v_client_id,
      v_request.client_name,
      v_request.client_whatsapp,
      v_start_timestamp,
      v_end_timestamp,
      COALESCE(v_service.price, 0),
      'confirmed',
      v_request.message,
      'request'
    ) RETURNING id INTO v_appointment_id;

    -- Link service to appointment
    IF v_request.service_id IS NOT NULL THEN
      INSERT INTO appointment_services (appointment_id, service_id, price, duration_minutes)
      VALUES (v_appointment_id, v_request.service_id, COALESCE(v_service.price, 0), COALESCE(v_service.duration_minutes, 30));
    END IF;
  END;

  -- 6. Update request status
  UPDATE appointment_requests 
  SET status = 'accepted', 
      updated_at = NOW() 
  WHERE id = p_request_id;

  RETURN jsonb_build_object(
    'success', true, 
    'appointment_id', v_appointment_id,
    'company_id', v_request.company_id
  );
END;
$function$;

-- Update reject_suggested_request to support both statuses
CREATE OR REPLACE FUNCTION public.reject_suggested_request(p_request_id uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_request_status TEXT;
BEGIN
  SELECT status INTO v_request_status FROM appointment_requests WHERE id = p_request_id;
  
  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'error', 'Solicitação não encontrada');
  END IF;

  IF v_request_status NOT IN ('suggested', 'pending_client_confirmation') THEN
    RETURN jsonb_build_object('success', false, 'error', 'Esta solicitação não pode mais ser recusada ou já foi processada');
  END IF;

  UPDATE appointment_requests 
  SET status = 'rejected',
      rejection_reason = 'Recusado pelo cliente',
      updated_at = NOW() 
  WHERE id = p_request_id;

  RETURN jsonb_build_object('success', true);
END;
$function$;
