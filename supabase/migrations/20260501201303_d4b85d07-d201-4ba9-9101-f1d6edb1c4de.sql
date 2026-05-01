-- Remove ambiguous RPC
DROP FUNCTION IF EXISTS public.create_appointment(uuid, uuid, timestamp with time zone, timestamp with time zone, numeric, text, text, text, uuid);

-- Fix link_client_globally to ensure global_client_id is synced to legacy
CREATE OR REPLACE FUNCTION public.link_client_globally(
  p_user_id uuid,
  p_phone text,
  p_email text,
  p_company_id uuid,
  p_name text DEFAULT NULL::text
)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
AS $function$
DECLARE
  v_client_id UUID;
  v_legacy_id UUID;
  v_normalized_phone TEXT;
BEGIN
  v_normalized_phone := public.normalize_whatsapp_v2(p_phone);

  -- 1. Ensure global record exists
  INSERT INTO public.clients_global (user_id, name, whatsapp, email)
  VALUES (p_user_id, p_name, v_normalized_phone, lower(trim(p_email)))
  ON CONFLICT (whatsapp) DO UPDATE
  SET user_id = p_user_id,
      name = COALESCE(p_name, clients_global.name),
      email = COALESCE(lower(trim(p_email)), clients_global.email)
  RETURNING id INTO v_client_id;

  -- 2. Link to company in global table
  INSERT INTO public.client_companies (client_global_id, company_id)
  VALUES (v_client_id, p_company_id)
  ON CONFLICT (client_global_id, company_id) DO NOTHING;

  -- 3. SYNC TO LEGACY
  SELECT id INTO v_legacy_id
  FROM public.clients
  WHERE company_id = p_company_id
    AND (whatsapp = v_normalized_phone OR public.normalize_whatsapp_v2(whatsapp) = v_normalized_phone)
  LIMIT 1;

  IF v_legacy_id IS NOT NULL THEN
    UPDATE public.clients
    SET user_id = p_user_id,
        name = COALESCE(p_name, clients.name),
        email = COALESCE(lower(trim(p_email)), clients.email),
        global_client_id = v_client_id,
        updated_at = now()
    WHERE id = v_legacy_id;
  ELSE
    INSERT INTO public.clients (company_id, user_id, global_client_id, name, whatsapp, email)
    VALUES (p_company_id, p_user_id, v_client_id, p_name, v_normalized_phone, lower(trim(p_email)));
  END IF;
END;
$function$;

-- Update create_appointment_v2 to handle more fields and be more robust
-- We use a new name or drop/recreate to change parameters
DROP FUNCTION IF EXISTS public.create_appointment_v2(uuid, uuid, uuid, timestamp with time zone, timestamp with time zone, numeric, text, text, text, uuid, jsonb, uuid[], uuid, text, text);

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
AS $function$
DECLARE
  v_appointment_id uuid;
  v_client_id uuid := p_client_id;
  v_global_client_id uuid;
  v_normalized_whatsapp text;
  v_effective_user_id uuid;
BEGIN
  IF p_company_id IS NULL THEN RAISE EXCEPTION 'Company is required'; END IF;
  IF p_professional_id IS NULL THEN RAISE EXCEPTION 'Professional is required'; END IF;
  IF p_start_time IS NULL OR p_end_time IS NULL THEN RAISE EXCEPTION 'Start and end time are required'; END IF;
  
  v_normalized_whatsapp := public.normalize_whatsapp_v2(p_client_whatsapp);
  v_effective_user_id := COALESCE(p_user_id, auth.uid());

  -- Client Logic
  IF v_client_id IS NULL THEN
    IF v_normalized_whatsapp IS NULL OR v_normalized_whatsapp = '' THEN
      RAISE EXCEPTION 'CLIENT_REQUIRED: WhatsApp do cliente e obrigatorio.';
    END IF;

    -- Find existing client
    SELECT id INTO v_client_id FROM public.clients
    WHERE company_id = p_company_id AND whatsapp = v_normalized_whatsapp
    LIMIT 1;

    IF v_client_id IS NULL THEN
        -- Create or update global
        INSERT INTO public.clients_global (whatsapp, name, user_id, email)
        VALUES (v_normalized_whatsapp, COALESCE(NULLIF(trim(p_client_name), ''), 'Cliente'), v_effective_user_id, p_client_email)
        ON CONFLICT (whatsapp) DO UPDATE SET
            name = COALESCE(NULLIF(trim(EXCLUDED.name), ''), clients_global.name),
            email = COALESCE(EXCLUDED.email, clients_global.email)
        RETURNING id INTO v_global_client_id;

        -- Create company-specific client
        INSERT INTO public.clients (company_id, global_client_id, name, whatsapp, user_id, email)
        VALUES (p_company_id, v_global_client_id, COALESCE(NULLIF(trim(p_client_name), ''), 'Cliente'), v_normalized_whatsapp, v_effective_user_id, p_client_email)
        RETURNING id INTO v_client_id;
    END IF;
  END IF;

  -- Insert Appointment
  INSERT INTO public.appointments (
    company_id, client_id, professional_id, start_time, end_time,
    total_price, status, client_name, client_whatsapp, notes, promotion_id, 
    user_id, booking_origin, extra_fee, extra_fee_type, extra_fee_value, 
    special_schedule, final_price, original_price
  )
  VALUES (
    p_company_id, v_client_id, p_professional_id, p_start_time, p_end_time,
    COALESCE(p_total_price, 0), 'confirmed',
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
    COALESCE(p_total_price, 0), -- final_price starts as total_price
    COALESCE(p_total_price, 0)  -- original_price starts as total_price
  )
  RETURNING id INTO v_appointment_id;

  -- Insert Services
  IF p_services IS NOT NULL AND jsonb_array_length(p_services) > 0 THEN
    INSERT INTO public.appointment_services (appointment_id, service_id, price, duration_minutes)
    SELECT
      v_appointment_id,
      (s->>'service_id')::uuid,
      COALESCE((s->>'price')::numeric, 0),
      COALESCE((s->>'duration_minutes')::int, 0)
    FROM jsonb_array_elements(p_services) AS s;
  END IF;

  -- Link cashbacks if any
  IF p_cashback_ids IS NOT NULL AND array_length(p_cashback_ids, 1) > 0 THEN
    UPDATE public.promotions_cashback_credits 
    SET used_at = now(), used_in_appointment_id = v_appointment_id
    WHERE id = ANY(p_cashback_ids) AND used_at IS NULL;
  END IF;

  RETURN v_appointment_id;
END;
$function$;