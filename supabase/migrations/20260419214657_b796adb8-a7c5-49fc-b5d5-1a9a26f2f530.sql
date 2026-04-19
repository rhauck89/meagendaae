-- =====================================================
-- 1. CREATE SWAP LOGS TABLE
-- =====================================================
CREATE TABLE IF NOT EXISTS public.appointments_swap_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL,
  appointment_a_id UUID NOT NULL,
  appointment_b_id UUID NOT NULL,
  -- Snapshot before swap
  old_professional_a UUID NOT NULL,
  old_start_a TIMESTAMPTZ NOT NULL,
  old_end_a TIMESTAMPTZ NOT NULL,
  old_professional_b UUID NOT NULL,
  old_start_b TIMESTAMPTZ NOT NULL,
  old_end_b TIMESTAMPTZ NOT NULL,
  -- Snapshot after swap
  new_professional_a UUID NOT NULL,
  new_start_a TIMESTAMPTZ NOT NULL,
  new_end_a TIMESTAMPTZ NOT NULL,
  new_professional_b UUID NOT NULL,
  new_start_b TIMESTAMPTZ NOT NULL,
  new_end_b TIMESTAMPTZ NOT NULL,
  -- Snapshot of client info for history readability
  client_a_name TEXT,
  client_b_name TEXT,
  reason TEXT,
  swapped_by UUID NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_swap_logs_company ON public.appointments_swap_logs(company_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_swap_logs_appt_a ON public.appointments_swap_logs(appointment_a_id);
CREATE INDEX IF NOT EXISTS idx_swap_logs_appt_b ON public.appointments_swap_logs(appointment_b_id);

ALTER TABLE public.appointments_swap_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Company members can view swap logs"
ON public.appointments_swap_logs
FOR SELECT
TO authenticated
USING (company_id = get_my_company_id());

CREATE POLICY "Super admins can view all swap logs"
ON public.appointments_swap_logs
FOR SELECT
TO authenticated
USING (has_role(auth.uid(), 'super_admin'::app_role));

-- =====================================================
-- 2. SWAP APPOINTMENTS RPC (SECURITY DEFINER, TRANSACTIONAL)
-- =====================================================
CREATE OR REPLACE FUNCTION public.swap_appointments(
  p_appointment_a UUID,
  p_appointment_b UUID,
  p_reason TEXT DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
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

  v_log_id UUID;
BEGIN
  IF v_caller IS NULL THEN
    RAISE EXCEPTION 'Não autenticado' USING ERRCODE = '42501';
  END IF;

  IF p_appointment_a = p_appointment_b THEN
    RAISE EXCEPTION 'Não é possível trocar um agendamento com ele mesmo' USING ERRCODE = '22023';
  END IF;

  -- Lock both rows to prevent concurrent modifications
  SELECT * INTO v_a FROM appointments WHERE id = p_appointment_a FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Agendamento A não encontrado' USING ERRCODE = 'P0002';
  END IF;

  SELECT * INTO v_b FROM appointments WHERE id = p_appointment_b FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Agendamento B não encontrado' USING ERRCODE = 'P0002';
  END IF;

  -- Both must be in the same company
  IF v_a.company_id <> v_b.company_id THEN
    RAISE EXCEPTION 'Os agendamentos pertencem a empresas diferentes' USING ERRCODE = '42501';
  END IF;

  v_caller_company := v_a.company_id;

  -- Permission check: super_admin OR professional/collaborator of the company
  IF has_role(v_caller, 'super_admin'::app_role) THEN
    v_is_admin := true;
  ELSIF has_company_role(v_caller, v_caller_company, 'professional'::app_role) THEN
    v_is_admin := true;
  ELSIF has_company_role(v_caller, v_caller_company, 'collaborator'::app_role) THEN
    v_is_admin := false;
  ELSE
    RAISE EXCEPTION 'Você não tem permissão para trocar agendamentos desta empresa' USING ERRCODE = '42501';
  END IF;

  -- If not admin, the caller must own at least one of the appointments (be the professional)
  IF NOT v_is_admin THEN
    SELECT id INTO v_caller_profile_id FROM profiles WHERE user_id = v_caller LIMIT 1;
    IF v_caller_profile_id IS NULL
       OR (v_a.professional_id <> v_caller_profile_id AND v_b.professional_id <> v_caller_profile_id) THEN
      RAISE EXCEPTION 'Você só pode trocar agendamentos onde você é o profissional' USING ERRCODE = '42501';
    END IF;
    -- Both must belong to caller (collaborator scope = own appointments only)
    IF v_a.professional_id <> v_caller_profile_id OR v_b.professional_id <> v_caller_profile_id THEN
      RAISE EXCEPTION 'Você só pode trocar entre seus próprios agendamentos' USING ERRCODE = '42501';
    END IF;
  END IF;

  -- Status check: only pending or confirmed
  IF v_a.status NOT IN ('pending'::appointment_status, 'confirmed'::appointment_status) THEN
    RAISE EXCEPTION 'O agendamento A não pode ser trocado (status: %)', v_a.status USING ERRCODE = '22023';
  END IF;
  IF v_b.status NOT IN ('pending'::appointment_status, 'confirmed'::appointment_status) THEN
    RAISE EXCEPTION 'O agendamento B não pode ser trocado (status: %)', v_b.status USING ERRCODE = '22023';
  END IF;

  -- Compute new times: keep duration, swap professional + start anchor
  v_dur_a := v_a.end_time - v_a.start_time;
  v_dur_b := v_b.end_time - v_b.start_time;

  v_new_prof_a   := v_b.professional_id;
  v_new_start_a  := v_b.start_time;
  v_new_end_a    := v_b.start_time + v_dur_a;

  v_new_prof_b   := v_a.professional_id;
  v_new_start_b  := v_a.start_time;
  v_new_end_b    := v_a.start_time + v_dur_b;

  -- Validate no conflicts with OTHER appointments (excluding A and B themselves)
  SELECT COUNT(*) INTO v_conflict_count
  FROM appointments x
  WHERE x.id NOT IN (v_a.id, v_b.id)
    AND x.status IN ('pending'::appointment_status, 'confirmed'::appointment_status)
    AND x.professional_id = v_new_prof_a
    AND x.start_time < v_new_end_a
    AND x.end_time > v_new_start_a;
  IF v_conflict_count > 0 THEN
    RAISE EXCEPTION 'Conflito: o novo horário do agendamento A choca com outro agendamento' USING ERRCODE = '23P01';
  END IF;

  SELECT COUNT(*) INTO v_conflict_count
  FROM appointments x
  WHERE x.id NOT IN (v_a.id, v_b.id)
    AND x.status IN ('pending'::appointment_status, 'confirmed'::appointment_status)
    AND x.professional_id = v_new_prof_b
    AND x.start_time < v_new_end_b
    AND x.end_time > v_new_start_b;
  IF v_conflict_count > 0 THEN
    RAISE EXCEPTION 'Conflito: o novo horário do agendamento B choca com outro agendamento' USING ERRCODE = '23P01';
  END IF;

  -- Validate no conflicts with blocked_times
  SELECT COUNT(*) INTO v_block_count
  FROM blocked_times bt
  WHERE bt.company_id = v_caller_company
    AND bt.professional_id = v_new_prof_a
    AND bt.block_date = (v_new_start_a AT TIME ZONE 'UTC')::date
    AND (
      ((v_new_start_a AT TIME ZONE 'UTC')::time < bt.end_time)
      AND ((v_new_end_a AT TIME ZONE 'UTC')::time > bt.start_time)
    );
  IF v_block_count > 0 THEN
    RAISE EXCEPTION 'Conflito: o novo horário do agendamento A está bloqueado' USING ERRCODE = '23P01';
  END IF;

  SELECT COUNT(*) INTO v_block_count
  FROM blocked_times bt
  WHERE bt.company_id = v_caller_company
    AND bt.professional_id = v_new_prof_b
    AND bt.block_date = (v_new_start_b AT TIME ZONE 'UTC')::date
    AND (
      ((v_new_start_b AT TIME ZONE 'UTC')::time < bt.end_time)
      AND ((v_new_end_b AT TIME ZONE 'UTC')::time > bt.start_time)
    );
  IF v_block_count > 0 THEN
    RAISE EXCEPTION 'Conflito: o novo horário do agendamento B está bloqueado' USING ERRCODE = '23P01';
  END IF;

  -- Perform the swap (atomic via transaction)
  UPDATE appointments
  SET professional_id = v_new_prof_a,
      start_time = v_new_start_a,
      end_time = v_new_end_a,
      updated_at = now()
  WHERE id = v_a.id;

  UPDATE appointments
  SET professional_id = v_new_prof_b,
      start_time = v_new_start_b,
      end_time = v_new_end_b,
      updated_at = now()
  WHERE id = v_b.id;

  -- Log the swap
  INSERT INTO appointments_swap_logs (
    company_id, appointment_a_id, appointment_b_id,
    old_professional_a, old_start_a, old_end_a,
    old_professional_b, old_start_b, old_end_b,
    new_professional_a, new_start_a, new_end_a,
    new_professional_b, new_start_b, new_end_b,
    client_a_name, client_b_name,
    reason, swapped_by
  ) VALUES (
    v_caller_company, v_a.id, v_b.id,
    v_a.professional_id, v_a.start_time, v_a.end_time,
    v_b.professional_id, v_b.start_time, v_b.end_time,
    v_new_prof_a, v_new_start_a, v_new_end_a,
    v_new_prof_b, v_new_start_b, v_new_end_b,
    v_a.client_name, v_b.client_name,
    p_reason, v_caller
  ) RETURNING id INTO v_log_id;

  RETURN jsonb_build_object(
    'success', true,
    'log_id', v_log_id,
    'appointment_a', jsonb_build_object(
      'id', v_a.id,
      'professional_id', v_new_prof_a,
      'start_time', v_new_start_a,
      'end_time', v_new_end_a
    ),
    'appointment_b', jsonb_build_object(
      'id', v_b.id,
      'professional_id', v_new_prof_b,
      'start_time', v_new_start_b,
      'end_time', v_new_end_b
    )
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.swap_appointments(UUID, UUID, TEXT) TO authenticated;