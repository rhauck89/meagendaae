
CREATE OR REPLACE FUNCTION public.create_appointment(
  p_professional_id uuid,
  p_client_id uuid,
  p_start_time timestamptz,
  p_end_time timestamptz,
  p_total_price numeric,
  p_client_name text,
  p_client_whatsapp text,
  p_notes text,
  p_promotion_id uuid DEFAULT NULL
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_appointment_id uuid;
BEGIN
  -- Upsert richer client details when provided
  UPDATE public.clients
  SET name = COALESCE(NULLIF(trim(p_client_name), ''), name),
      whatsapp = COALESCE(NULLIF(trim(p_client_whatsapp), ''), whatsapp)
  WHERE id = p_client_id;

  v_appointment_id := public.create_appointment(
    p_client_id,
    p_professional_id,
    p_start_time,
    p_end_time,
    p_total_price
  );

  IF p_notes IS NOT NULL THEN
    UPDATE public.appointments
    SET notes = p_notes
    WHERE id = v_appointment_id;
  END IF;

  -- Link promotion if provided
  IF p_promotion_id IS NOT NULL THEN
    UPDATE public.appointments
    SET promotion_id = p_promotion_id
    WHERE id = v_appointment_id;

    -- Increment used_slots
    UPDATE public.promotions
    SET used_slots = used_slots + 1
    WHERE id = p_promotion_id;

    -- Create promotion_booking record
    INSERT INTO public.promotion_bookings (promotion_id, company_id, client_id, appointment_id)
    SELECT p_promotion_id, a.company_id, p_client_id, v_appointment_id
    FROM public.appointments a WHERE a.id = v_appointment_id;
  END IF;

  RETURN v_appointment_id;
END;
$function$;
