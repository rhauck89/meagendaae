-- Fix public booking cashback usage.
-- Some previous versions of create_appointment_v2 tried to consume credits from
-- promotions_cashback_credits, an old table that is not part of the current
-- cashback engine. The public booking page sends IDs from client_cashback.

CREATE OR REPLACE FUNCTION public.handle_cashback_transaction_sync()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
    IF (TG_OP = 'INSERT') THEN
        INSERT INTO public.cashback_transactions (
            company_id,
            client_id,
            user_id,
            amount,
            type,
            reference_id,
            description,
            created_at
        )
        VALUES (
            NEW.company_id,
            NEW.client_id,
            NEW.user_id,
            NEW.amount,
            'credit',
            NEW.appointment_id,
            'Cashback ganho',
            NEW.created_at
        );
    END IF;

    IF (TG_OP = 'UPDATE') THEN
        IF (OLD.used_at IS NULL AND NEW.used_at IS NOT NULL) THEN
            INSERT INTO public.cashback_transactions (
                company_id,
                client_id,
                user_id,
                amount,
                type,
                reference_id,
                description,
                created_at
            )
            VALUES (
                NEW.company_id,
                NEW.client_id,
                NEW.user_id,
                NEW.amount,
                'debit',
                NEW.used_appointment_id,
                'Cashback utilizado no agendamento',
                NEW.used_at
            );
        END IF;

        IF (OLD.status IS DISTINCT FROM 'expired' AND NEW.status = 'expired') THEN
            INSERT INTO public.cashback_transactions (
                company_id,
                client_id,
                user_id,
                amount,
                type,
                reference_id,
                description,
                created_at
            )
            VALUES (
                NEW.company_id,
                NEW.client_id,
                NEW.user_id,
                NEW.amount,
                'expiration',
                NEW.id,
                'Cashback expirado',
                now()
            );
        END IF;
    END IF;

    RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS on_cashback_change_sync_ledger ON public.client_cashback;
CREATE TRIGGER on_cashback_change_sync_ledger
AFTER INSERT OR UPDATE ON public.client_cashback
FOR EACH ROW EXECUTE FUNCTION public.handle_cashback_transaction_sync();

DROP FUNCTION IF EXISTS public.create_appointment_v2(
    uuid,
    uuid,
    uuid,
    timestamp with time zone,
    timestamp with time zone,
    numeric,
    text,
    text,
    text,
    uuid,
    jsonb,
    uuid[],
    uuid,
    text,
    text,
    numeric,
    text,
    numeric,
    boolean
);

CREATE OR REPLACE FUNCTION public.create_appointment_v2(
    p_company_id uuid,
    p_professional_id uuid,
    p_client_id uuid,
    p_start_time timestamp with time zone,
    p_end_time timestamp with time zone,
    p_total_price numeric,
    p_client_name text,
    p_client_whatsapp text,
    p_notes text DEFAULT NULL,
    p_promotion_id uuid DEFAULT NULL,
    p_services jsonb DEFAULT '[]'::jsonb,
    p_cashback_ids uuid[] DEFAULT '{}'::uuid[],
    p_user_id uuid DEFAULT NULL,
    p_booking_origin text DEFAULT 'public_booking',
    p_client_email text DEFAULT NULL,
    p_extra_fee numeric DEFAULT 0,
    p_extra_fee_type text DEFAULT NULL,
    p_extra_fee_value numeric DEFAULT 0,
    p_special_schedule boolean DEFAULT false
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $function$
DECLARE
  v_appointment_id uuid;
  v_client_id uuid := p_client_id;
  v_global_client_id uuid;
  v_normalized_whatsapp text;
  v_effective_user_id uuid;
  v_conflict_count integer;
  v_event_conflict_count integer;
BEGIN
  IF p_company_id IS NULL THEN RAISE EXCEPTION 'Company is required'; END IF;
  IF p_professional_id IS NULL THEN RAISE EXCEPTION 'Professional is required'; END IF;
  IF p_start_time IS NULL OR p_end_time IS NULL THEN RAISE EXCEPTION 'Start and end time are required'; END IF;
  IF p_end_time <= p_start_time THEN RAISE EXCEPTION 'End time must be after start time'; END IF;

  v_normalized_whatsapp := public.normalize_whatsapp_v2(p_client_whatsapp);
  v_effective_user_id := COALESCE(p_user_id, auth.uid());

  IF v_client_id IS NULL THEN
    IF v_normalized_whatsapp IS NULL OR v_normalized_whatsapp = '' THEN
      RAISE EXCEPTION 'CLIENT_REQUIRED: WhatsApp do cliente e obrigatorio.';
    END IF;

    SELECT id INTO v_client_id
    FROM public.clients
    WHERE company_id = p_company_id
      AND (
        whatsapp = v_normalized_whatsapp
        OR public.normalize_whatsapp_v2(whatsapp) = v_normalized_whatsapp
        OR (v_effective_user_id IS NOT NULL AND user_id = v_effective_user_id)
      )
    ORDER BY created_at ASC
    LIMIT 1;

    IF v_client_id IS NULL THEN
      INSERT INTO public.clients_global (whatsapp, name, user_id, email)
      VALUES (
        v_normalized_whatsapp,
        COALESCE(NULLIF(trim(p_client_name), ''), 'Cliente'),
        v_effective_user_id,
        p_client_email
      )
      ON CONFLICT (whatsapp) DO UPDATE
      SET name = COALESCE(NULLIF(trim(EXCLUDED.name), ''), clients_global.name),
          email = COALESCE(EXCLUDED.email, clients_global.email),
          user_id = COALESCE(EXCLUDED.user_id, clients_global.user_id)
      RETURNING id INTO v_global_client_id;

      INSERT INTO public.clients (company_id, global_client_id, name, whatsapp, user_id, email)
      VALUES (
        p_company_id,
        v_global_client_id,
        COALESCE(NULLIF(trim(p_client_name), ''), 'Cliente'),
        v_normalized_whatsapp,
        v_effective_user_id,
        p_client_email
      )
      RETURNING id INTO v_client_id;
    ELSE
      UPDATE public.clients
      SET name = COALESCE(NULLIF(trim(p_client_name), ''), name),
          email = COALESCE(NULLIF(trim(p_client_email), ''), email),
          user_id = COALESCE(user_id, v_effective_user_id),
          whatsapp = COALESCE(NULLIF(v_normalized_whatsapp, ''), whatsapp)
      WHERE id = v_client_id;
    END IF;
  END IF;

  SELECT COUNT(*) INTO v_conflict_count
  FROM public.appointments a
  WHERE a.professional_id = p_professional_id
    AND a.company_id = p_company_id
    AND a.status NOT IN ('cancelled', 'no_show', 'rescheduled')
    AND p_start_time < a.end_time
    AND p_end_time > a.start_time;

  IF v_conflict_count > 0 THEN
    RAISE EXCEPTION 'TIME_CONFLICT: Horario ja ocupado na agenda principal.';
  END IF;

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
    RAISE EXCEPTION 'EVENT_CONFLICT: Este horario esta reservado para um evento de Agenda Aberta.';
  END IF;

  INSERT INTO public.appointments (
    company_id,
    client_id,
    professional_id,
    start_time,
    end_time,
    total_price,
    status,
    client_name,
    client_whatsapp,
    notes,
    promotion_id,
    user_id,
    booking_origin,
    extra_fee,
    extra_fee_type,
    extra_fee_value,
    special_schedule,
    final_price,
    original_price
  )
  VALUES (
    p_company_id,
    v_client_id,
    p_professional_id,
    p_start_time,
    p_end_time,
    COALESCE(p_total_price, 0),
    'confirmed',
    COALESCE(NULLIF(trim(p_client_name), ''), 'Cliente'),
    v_normalized_whatsapp,
    NULLIF(trim(COALESCE(p_notes, '')), ''),
    p_promotion_id,
    v_effective_user_id,
    COALESCE(p_booking_origin, 'public_booking'),
    COALESCE(p_extra_fee, 0),
    p_extra_fee_type,
    COALESCE(p_extra_fee_value, 0),
    COALESCE(p_special_schedule, false),
    COALESCE(p_total_price, 0),
    COALESCE(p_total_price, 0)
  )
  RETURNING id INTO v_appointment_id;

  IF p_services IS NOT NULL AND jsonb_array_length(p_services) > 0 THEN
    INSERT INTO public.appointment_services (appointment_id, service_id, price, duration_minutes)
    SELECT
      v_appointment_id,
      (s->>'service_id')::uuid,
      COALESCE((s->>'price')::numeric, 0),
      COALESCE((s->>'duration_minutes')::int, 0)
    FROM jsonb_array_elements(p_services) AS s;
  END IF;

  IF p_cashback_ids IS NOT NULL AND array_length(p_cashback_ids, 1) > 0 THEN
    UPDATE public.client_cashback
    SET status = 'used',
        used_at = now(),
        used_appointment_id = v_appointment_id,
        user_id = COALESCE(user_id, v_effective_user_id)
    WHERE id = ANY(p_cashback_ids)
      AND company_id = p_company_id
      AND (
        client_id = v_client_id
        OR (v_effective_user_id IS NOT NULL AND user_id = v_effective_user_id)
      )
      AND status = 'active'
      AND used_at IS NULL;
  END IF;

  IF p_promotion_id IS NOT NULL THEN
    UPDATE public.promotions
    SET used_slots = COALESCE(used_slots, 0) + 1
    WHERE id = p_promotion_id
      AND company_id = p_company_id;

    INSERT INTO public.promotion_bookings (promotion_id, company_id, client_id, appointment_id)
    VALUES (p_promotion_id, p_company_id, v_client_id, v_appointment_id)
    ON CONFLICT DO NOTHING;
  END IF;

  RETURN v_appointment_id;
END;
$function$;
