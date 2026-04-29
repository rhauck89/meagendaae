CREATE OR REPLACE FUNCTION public.create_appointment(
  p_professional_id uuid,
  p_client_id uuid,
  p_start_time timestamp with time zone,
  p_end_time timestamp with time zone,
  p_total_price numeric DEFAULT 0,
  p_client_name text DEFAULT NULL::text,
  p_client_whatsapp text DEFAULT NULL::text,
  p_notes text DEFAULT NULL::text,
  p_promotion_id uuid DEFAULT NULL::uuid
)
 RETURNS uuid
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_appointment_id uuid;
  v_company_id uuid;
  v_client_id uuid := p_client_id;
  v_client_company_id uuid;
  v_client_name text;
  v_client_whatsapp text;
  v_client_user_id uuid;
  v_client_blocked boolean;
  v_auth_uid uuid;
  v_auth_role text;
  v_conflict_count integer;
  v_global_client_id uuid;
BEGIN
  v_auth_uid := auth.uid();
  
  -- Obter o papel do usuário autenticado (se houver)
  IF v_auth_uid IS NOT NULL THEN
    SELECT role INTO v_auth_role FROM public.profiles WHERE user_id = v_auth_uid LIMIT 1;
  ELSE
    v_auth_role := 'anonymous';
  END IF;

  IF p_professional_id IS NULL THEN RAISE EXCEPTION 'Professional is required'; END IF;
  IF p_start_time IS NULL OR p_end_time IS NULL THEN RAISE EXCEPTION 'Start and end time are required'; END IF;
  IF p_end_time <= p_start_time THEN RAISE EXCEPTION 'End time must be after start time'; END IF;

  -- Determinar Empresa
  SELECT pr.company_id INTO v_company_id FROM public.profiles pr WHERE pr.id = p_professional_id LIMIT 1;
  IF v_company_id IS NULL THEN
    SELECT c.company_id INTO v_company_id FROM public.collaborators c WHERE c.profile_id = p_professional_id LIMIT 1;
  END IF;
  IF v_company_id IS NULL THEN RAISE EXCEPTION 'Cannot determine company for this professional'; END IF;

  -- Garantir Client ID
  IF v_client_id IS NULL THEN
    IF p_client_whatsapp IS NULL OR p_client_whatsapp = '' THEN
      RAISE EXCEPTION 'CLIENT_REQUIRED: WhatsApp é obrigatório para agendamento direto.';
    END IF;

    -- Upsert Global
    INSERT INTO public.clients_global (whatsapp, name, user_id)
    VALUES (p_client_whatsapp, COALESCE(p_client_name, 'Cliente'), CASE WHEN v_auth_role = 'client' THEN v_auth_uid ELSE NULL END)
    ON CONFLICT (whatsapp) DO UPDATE SET
      name = EXCLUDED.name,
      user_id = COALESCE(clients_global.user_id, EXCLUDED.user_id)
    RETURNING id INTO v_global_client_id;

    -- Upsert Local
    INSERT INTO public.clients (company_id, global_client_id, name, whatsapp, user_id)
    VALUES (v_company_id, v_global_client_id, COALESCE(p_client_name, 'Cliente'), p_client_whatsapp, CASE WHEN v_auth_role = 'client' THEN v_auth_uid ELSE NULL END)
    ON CONFLICT (company_id, whatsapp) DO UPDATE SET
      name = EXCLUDED.name,
      user_id = COALESCE(clients.user_id, EXCLUDED.user_id)
    RETURNING id INTO v_client_id;
  END IF;

  SELECT company_id, name, whatsapp, user_id, is_blocked
  INTO v_client_company_id, v_client_name, v_client_whatsapp, v_client_user_id, v_client_blocked
  FROM public.clients WHERE id = v_client_id LIMIT 1;

  IF v_client_company_id IS NULL THEN RAISE EXCEPTION 'Client not found'; END IF;
  IF v_client_company_id <> v_company_id THEN RAISE EXCEPTION 'Client belongs to a different company'; END IF;
  IF v_client_blocked THEN RAISE EXCEPTION 'Este cliente está bloqueado.'; END IF;

  -- Verificação de Conflito
  SELECT COUNT(*) INTO v_conflict_count
  FROM public.appointments a
  WHERE a.professional_id = p_professional_id
    AND a.company_id = v_company_id
    AND a.status NOT IN ('cancelled', 'no_show', 'rescheduled')
    AND p_start_time < a.end_time
    AND p_end_time   > a.start_time;

  IF v_conflict_count > 0 THEN
    RAISE EXCEPTION 'Time slot already booked';
  END IF;

  INSERT INTO public.appointments (
    company_id, client_id, professional_id, start_time, end_time,
    total_price, status, client_name, client_whatsapp, notes, promotion_id, user_id
  )
  VALUES (
    v_company_id, v_client_id, p_professional_id, p_start_time, p_end_time,
    COALESCE(p_total_price, 0), 'confirmed', COALESCE(p_client_name, v_client_name), COALESCE(p_client_whatsapp, v_client_whatsapp),
    NULLIF(trim(COALESCE(p_notes, '')), ''), p_promotion_id, 
    CASE WHEN v_auth_role = 'client' THEN v_auth_uid ELSE NULL END
  )
  RETURNING id INTO v_appointment_id;

  IF p_promotion_id IS NOT NULL THEN
    UPDATE public.promotions SET used_slots = used_slots + 1
    WHERE id = p_promotion_id AND company_id = v_company_id;
    INSERT INTO public.promotion_bookings (promotion_id, company_id, client_id, appointment_id)
    VALUES (p_promotion_id, v_company_id, v_client_id, v_appointment_id);
  END IF;

  RETURN v_appointment_id;
END;
$function$
