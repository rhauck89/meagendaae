CREATE OR REPLACE FUNCTION public.register_delay(p_appointment_id uuid, p_delay_minutes smallint)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_professional_id uuid;
  v_company_id uuid;
  v_end_time timestamptz;
  v_interval interval;
  v_affected jsonb := '[]'::jsonb;
  v_source jsonb;
  v_professional_name text;
  v_professional_slug text;
  v_company_slug text;
  v_caller uuid := auth.uid();
  v_old_start timestamptz;
  v_old_end timestamptz;
  v_new_start timestamptz;
  v_new_end timestamptz;
  rec RECORD;
BEGIN
  IF v_caller IS NULL THEN
    RAISE EXCEPTION 'Authentication required';
  END IF;

  IF p_delay_minutes < 1 OR p_delay_minutes > 120 THEN
    RAISE EXCEPTION 'Delay must be between 1 and 120 minutes';
  END IF;

  SELECT professional_id, company_id, end_time, start_time
  INTO v_professional_id, v_company_id, v_end_time, v_old_start
  FROM public.appointments
  WHERE id = p_appointment_id
    AND status NOT IN ('cancelled', 'no_show', 'completed')
  FOR UPDATE;

  IF v_professional_id IS NULL THEN
    RAISE EXCEPTION 'Appointment not found or already finished';
  END IF;

  IF NOT (
    public.is_company_admin(v_caller, v_company_id)
    OR EXISTS (
      SELECT 1 FROM public.profiles p
      WHERE p.user_id = v_caller AND p.id = v_professional_id
    )
  ) THEN
    RAISE EXCEPTION 'Not authorized to register delay for this appointment';
  END IF;

  v_interval := (p_delay_minutes || ' minutes')::interval;
  v_old_end := v_end_time;
  v_new_start := v_old_start + v_interval;
  v_new_end := v_old_end + v_interval;

  -- Lookup professional name (profiles) + slugs (collaborators + companies)
  SELECT pr.full_name, c.slug
  INTO v_professional_name, v_company_slug
  FROM public.profiles pr
  JOIN public.companies c ON c.id = v_company_id
  WHERE pr.id = v_professional_id;

  SELECT col.slug
  INTO v_professional_slug
  FROM public.collaborators col
  WHERE col.profile_id = v_professional_id
    AND col.company_id = v_company_id
  LIMIT 1;

  -- Update FUTURE appointments first, in DESCENDING order, to avoid
  -- temporary overlaps with the no_overlapping_appointments exclusion constraint.
  FOR rec IN
    SELECT a.id, a.client_id, a.client_name, a.client_whatsapp,
           a.start_time AS old_start, a.end_time AS old_end,
           a.start_time + v_interval AS new_start,
           a.end_time + v_interval AS new_end
    FROM public.appointments a
    WHERE a.professional_id = v_professional_id
      AND a.company_id = v_company_id
      AND a.status IN ('confirmed', 'pending')
      AND a.id <> p_appointment_id
      AND a.start_time >= v_end_time
      AND (a.start_time AT TIME ZONE 'America/Sao_Paulo')::date
          = (v_end_time AT TIME ZONE 'America/Sao_Paulo')::date
    ORDER BY a.start_time DESC
    FOR UPDATE
  LOOP
    UPDATE public.appointments
    SET start_time = rec.new_start,
        end_time = rec.new_end,
        delay_minutes = COALESCE(delay_minutes, 0) + p_delay_minutes,
        delay_source_appointment_id = p_appointment_id,
        delay_applied_at = now(),
        updated_at = now()
    WHERE id = rec.id;

    v_affected := v_affected || jsonb_build_object(
      'id', rec.id,
      'is_source', false,
      'client_id', rec.client_id,
      'client_name', rec.client_name,
      'client_whatsapp', rec.client_whatsapp,
      'old_time', to_char(rec.old_start AT TIME ZONE 'America/Sao_Paulo', 'HH24:MI'),
      'new_time', to_char(rec.new_start AT TIME ZONE 'America/Sao_Paulo', 'HH24:MI'),
      'old_start_iso', rec.old_start,
      'new_start_iso', rec.new_start,
      'professional_name', v_professional_name,
      'professional_slug', v_professional_slug,
      'company_slug', v_company_slug
    );
  END LOOP;

  -- Now update the source appointment last (its end_time grew, but all
  -- following slots have already shifted forward, so no overlap).
  UPDATE public.appointments
  SET start_time = v_new_start,
      end_time = v_new_end,
      delay_minutes = COALESCE(delay_minutes, 0) + p_delay_minutes,
      delay_source_appointment_id = p_appointment_id,
      delay_applied_at = now(),
      updated_at = now()
  WHERE id = p_appointment_id;

  v_source := jsonb_build_object(
    'id', p_appointment_id,
    'is_source', true,
    'old_time', to_char(v_old_start AT TIME ZONE 'America/Sao_Paulo', 'HH24:MI'),
    'new_time', to_char(v_new_start AT TIME ZONE 'America/Sao_Paulo', 'HH24:MI'),
    'professional_name', v_professional_name,
    'professional_slug', v_professional_slug,
    'company_slug', v_company_slug
  );

  RETURN jsonb_build_object(
    'source', v_source,
    'delay_minutes', p_delay_minutes,
    'affected', v_affected
  );
END;
$function$;