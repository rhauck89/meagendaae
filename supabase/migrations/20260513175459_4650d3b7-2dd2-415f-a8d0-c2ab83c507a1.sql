CREATE OR REPLACE FUNCTION public.create_appointment_v2(
    p_company_id uuid,
    p_professional_id uuid,
    p_client_id uuid,
    p_start_time timestamp with time zone,
    p_end_time timestamp with time zone,
    p_total_price numeric,
    p_client_name text DEFAULT NULL::text,
    p_client_whatsapp text DEFAULT NULL::text,
    p_client_email text DEFAULT NULL::text,
    p_notes text DEFAULT NULL::text,
    p_services jsonb DEFAULT '[]'::jsonb,
    p_promotion_id uuid DEFAULT NULL::uuid,
    p_cashback_ids uuid[] DEFAULT ARRAY[]::uuid[],
    p_user_id uuid DEFAULT NULL::uuid,
    p_booking_origin text DEFAULT 'public_booking'::text,
    p_original_price numeric DEFAULT NULL::numeric,
    p_promotion_discount numeric DEFAULT 0,
    p_cashback_used numeric DEFAULT 0,
    p_manual_discount numeric DEFAULT 0
)
 RETURNS uuid
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
    v_appointment_id UUID;
    v_service RECORD;
    v_cashback_sum NUMERIC := 0;
    v_final_original_price NUMERIC := 0;
    v_final_cashback_used NUMERIC := p_cashback_used;
BEGIN
    -- 1. Insert Appointment
    INSERT INTO public.appointments (
        company_id,
        professional_id,
        client_id,
        start_time,
        end_time,
        total_price,
        original_price,
        final_price,
        promotion_id,
        promotion_discount,
        cashback_used,
        manual_discount,
        notes,
        status,
        booking_origin,
        user_id,
        client_name,
        client_whatsapp,
        client_email
    ) VALUES (
        p_company_id,
        p_professional_id,
        p_client_id,
        p_start_time,
        p_end_time,
        p_total_price, -- total_price still holds the final value for compatibility, but we use final_price too
        COALESCE(p_original_price, p_total_price),
        p_total_price,
        p_promotion_id,
        p_promotion_discount,
        p_cashback_used,
        p_manual_discount,
        p_notes,
        'confirmed',
        p_booking_origin,
        p_user_id,
        p_client_name,
        p_client_whatsapp,
        p_client_email
    ) RETURNING id INTO v_appointment_id;

    -- 2. Handle Services
    FOR v_service IN SELECT * FROM jsonb_to_recordset(p_services) AS x(service_id UUID, price NUMERIC, duration_minutes INTEGER) LOOP
        INSERT INTO public.appointment_services (
            appointment_id,
            service_id,
            price,
            duration_minutes
        ) VALUES (
            v_appointment_id,
            v_service.service_id,
            v_service.price,
            v_service.duration_minutes
        );
        v_final_original_price := v_final_original_price + v_service.price;
    END LOOP;

    -- 3. Update original_price if not provided
    IF p_original_price IS NULL THEN
        UPDATE public.appointments 
        SET original_price = v_final_original_price
        WHERE id = v_appointment_id;
    END IF;

    -- 4. Handle Cashback Credits (legacy flow or if p_cashback_used is 0)
    IF array_length(p_cashback_ids, 1) > 0 THEN
        -- Mark as used and calculate sum
        UPDATE public.client_cashback
        SET status = 'used',
            used_appointment_id = v_appointment_id,
            updated_at = now()
        WHERE id = ANY(p_cashback_ids)
        AND client_id = p_client_id
        RETURNING amount;

        -- If p_cashback_used was not provided, we sum from the credits
        IF p_cashback_used = 0 THEN
             SELECT SUM(amount) INTO v_final_cashback_used
             FROM public.client_cashback
             WHERE used_appointment_id = v_appointment_id;
             
             UPDATE public.appointments 
             SET cashback_used = COALESCE(v_final_cashback_used, 0)
             WHERE id = v_appointment_id;
        END IF;
    END IF;

    RETURN v_appointment_id;
END;
$function$;