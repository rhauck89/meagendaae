CREATE OR REPLACE FUNCTION public.swap_appointments(p_appointment_a uuid, p_appointment_b uuid, p_reason text DEFAULT NULL::text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_caller UUID := auth.uid();
  v_caller_profile_id UUID;
  v_caller_company UUID;
  v_is_admin BOOLEAN := false;

  v_a RECORD;
  v_b RECORD;

  v_new_start_a TIMESTAMPTZ;
  v_new_end_a TIMESTAMPTZ;
  v_new_start_b TIMESTAMPTZ;
  v_new_end_b TIMESTAMPTZ;
  v_new_prof_a UUID;
  v_new_prof_b UUID;

  v_dur_a INTERVAL;
  v_dur_b INTERVAL;

  v_conflict_count INT;
  v_block_count INT;

  v_temp_start_a TIMESTAMPTZ;
  v_temp_end_a TIMESTAMPTZ;

  v_log_id UUID;
BEGIN
  IF v_caller IS NULL THEN
    RAISE EXCEPTION 'Não autenticado' USING ERRCODE = '42501';
  END IF;

  IF p_appointment_a = p_appointment_b THEN
    RAISE EXCEPTION 'Não é possível trocar um agendamento com ele mesmo' USING ERRCODE = '22023';
  END IF;

  -- Lock both rows (deterministic order to avoid deadlocks)
  IF p_appointment_a < p_appointment_b THEN
    SELECT * INTO v_a FROM appointments WHERE id = p_appointment_a FOR UPDATE;
    IF NOT FOUND THEN RAISE EXCEPTION 'Agendamento A não encontrado' USING ERRCODE = 'P0002'; END IF;
    SELECT * INTO v_b FROM appointments WHERE id = p_appointment_b FOR UPDATE;
    IF NOT FOUND THEN RAISE EXCEPTION 'Agendamento B não encontrado' USING ERRCODE = 'P0002'; END IF;
  ELSE
    SELECT * INTO v_b FROM appointments WHERE id = p_appointment_b FOR UPDATE;
    IF NOT FOUND THEN RAISE EXCEPTION 'Agendamento B não encontrado' USING ERRCODE = 'P0002'; END IF;
    SELECT * INTO v_a FROM appointments WHERE id = p_appointment_a FOR UPDATE;
    IF NOT FOUND THEN RAISE EXCEPTION 'Agendamento A não encontrado' USING ERRCODE = 'P0002'; END IF;
  END IF;

  IF v_a.company_id <> v_b.company_id THEN
    RAISE EXCEPTION 'Os agendamentos pertencem a empresas diferentes' USING ERRCODE = '42501';
  END IF;

  v_caller_company := v_a.company_id;

  -- Permission
  IF has_role(v_caller, 'super_admin'::app_role) THEN
    v_is_admin := true;
  ELSIF has_company_role(v_caller, v_caller_company, 'professional'::app_role) THEN
    v_is_admin := true;
  ELSIF has_company_role(v_caller, v_caller_company, 'collaborator'::app_role) THEN
    v_is_admin := false;
  ELSE
    RAISE EXCEPTION 'Você não tem permissão para trocar agendamentos desta empresa' USING ERRCODE = '42501';
  END IF;

  IF NOT v_is_admin THEN
    SELECT id INTO v_caller_profile_id FROM profiles WHERE user_id = v_caller LIMIT 1;
    IF v_caller_profile_id IS NULL
       OR (v_a.professional_id <> v_caller_profile_id AND v_b.professional_id <> v_caller_profile_id) THEN
      RAISE EXCEPTION 'Você só pode trocar agendamentos onde você é o profissional' USING ERRCODE = '42501';
    END IF;
    IF v_a.professional_id <> v_caller_profile_id OR v_b.professional_id <> v_caller_profile_id THEN
      RAISE EXCEPTION 'Você só pode trocar entre seus próprios agendamentos' USING ERRCODE = '42501';
    END IF;
  END IF;

  -- Status must be pending or confirmed (real enum values only)
  IF v_a.status NOT IN ('pending'::appointment_status,'confirmed'::appointment_status)
     OR v_b.status NOT IN ('pending'::appointment_status,'confirmed'::appointment_status) THEN
    RAISE EXCEPTION 'Apenas agendamentos pendentes ou confirmados podem ser trocados' USING ERRCODE = '22023';
  END IF;

  -- Promotion-locked appointments cannot be swapped
  IF v_a.promotion_id IS NOT NULL OR v_b.promotion_id IS NOT NULL THEN
    RAISE EXCEPTION 'Agendamentos vinculados a promoções não podem ser trocados' USING ERRCODE = '22023';
  END IF;

  -- Compute new times: each appointment goes to the other's start, keeping its own duration
  v_dur_a := v_a.end_time - v_a.start_time;
  v_dur_b := v_b.end_time - v_b.start_time;

  v_new_start_a := v_b.start_time;
  v_new_end_a   := v_b.start_time + v_dur_a;
  v_new_prof_a  := v_b.professional_id;

  v_new_start_b := v_a.start_time;
  v_new_end_b   := v_a.start_time + v_dur_b;
  v_new_prof_b  := v_a.professional_id;

  -- Conflict check: any OTHER appointment overlapping the new windows on the destination professional
  -- Only real enum values: pending, confirmed
  SELECT count(*) INTO v_conflict_count
  FROM appointments x
  WHERE x.id NOT IN (v_a.id, v_b.id)
    AND x.status IN ('pending'::appointment_status,'confirmed'::appointment_status)
    AND (
      (x.professional_id = v_new_prof_a AND x.start_time < v_new_end_a AND x.end_time > v_new_start_a)
      OR
      (x.professional_id = v_new_prof_b AND x.start_time < v_new_end_b AND x.end_time > v_new_start_b)
    );

  IF v_conflict_count > 0 THEN
    RAISE EXCEPTION 'A troca causaria conflito com outro agendamento existente' USING ERRCODE = '23P01';
  END IF;

  -- Blocked times check (date + time-of-day overlap on destination professional)
  SELECT count(*) INTO v_block_count
  FROM blocked_times bt
  WHERE bt.company_id = v_caller_company
    AND (
      (bt.professional_id = v_new_prof_a
        AND bt.block_date = (v_new_start_a AT TIME ZONE 'UTC')::date
        AND bt.start_time < (v_new_end_a AT TIME ZONE 'UTC')::time
        AND bt.end_time   > (v_new_start_a AT TIME ZONE 'UTC')::time)
      OR
      (bt.professional_id = v_new_prof_b
        AND bt.block_date = (v_new_start_b AT TIME ZONE 'UTC')::date
        AND bt.start_time < (v_new_end_b AT TIME ZONE 'UTC')::time
        AND bt.end_time   > (v_new_start_b AT TIME ZONE 'UTC')::time)
    );

  IF v_block_count > 0 THEN
    RAISE EXCEPTION 'A troca conflita com um período bloqueado da agenda' USING ERRCODE = '23P01';
  END IF;

  -- Three-phase update to avoid unique_professional_time constraint:
  -- 1) Park A at a far-future timestamp, 2) Move B to A's slot, 3) Move A to B's slot
  v_temp_start_a := TIMESTAMPTZ '2999-12-31 00:00:00+00' + (v_a.id::text::uuid_send::bigint % 86400) * INTERVAL '1 second';
  v_temp_end_a := v_temp_start_a + v_dur_a;

  -- Phase 1: park A
  UPDATE appointments
     SET start_time = TIMESTAMPTZ '2999-12-31 00:00:00+00',
         end_time   = TIMESTAMPTZ '2999-12-31 00:00:00+00' + v_dur_a,
         updated_at = now()
   WHERE id = v_a.id;

  -- Phase 2: move B into A's old slot
  UPDATE appointments
     SET start_time = v_new_start_b,
         end_time   = v_new_end_b,
         professional_id = v_new_prof_b,
         updated_at = now()
   WHERE id = v_b.id;

  -- Phase 3: move A into B's old slot
  UPDATE appointments
     SET start_time = v_new_start_a,
         end_time   = v_new_end_a,
         professional_id = v_new_prof_a,
         updated_at = now()
   WHERE id = v_a.id;

  -- Audit log
  INSERT INTO appointments_swap_logs (
    company_id, swapped_by, appointment_a_id, appointment_b_id,
    old_start_a, old_end_a, old_professional_a,
    old_start_b, old_end_b, old_professional_b,
    new_start_a, new_end_a, new_professional_a,
    new_start_b, new_end_b, new_professional_b,
    client_a_name, client_b_name, reason
  ) VALUES (
    v_caller_company, v_caller, v_a.id, v_b.id,
    v_a.start_time, v_a.end_time, v_a.professional_id,
    v_b.start_time, v_b.end_time, v_b.professional_id,
    v_new_start_a, v_new_end_a, v_new_prof_a,
    v_new_start_b, v_new_end_b, v_new_prof_b,
    v_a.client_name, v_b.client_name, p_reason
  ) RETURNING id INTO v_log_id;

  RETURN jsonb_build_object(
    'success', true,
    'log_id', v_log_id,
    'appointment_a', jsonb_build_object('id', v_a.id, 'new_start', v_new_start_a, 'new_end', v_new_end_a, 'new_professional_id', v_new_prof_a),
    'appointment_b', jsonb_build_object('id', v_b.id, 'new_start', v_new_start_b, 'new_end', v_new_end_b, 'new_professional_id', v_new_prof_b)
  );
END;
$function$;