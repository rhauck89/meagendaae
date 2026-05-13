-- Drop the old functions to avoid ambiguity (the ones we identified)
DROP FUNCTION IF EXISTS public.create_appointment_v2(uuid,uuid,uuid,timestamp with time zone,timestamp with time zone,numeric,text,text,text,text,jsonb,uuid,uuid[],uuid,text,numeric,numeric,numeric,numeric);
DROP FUNCTION IF EXISTS public.create_appointment_v2(uuid,uuid,uuid,timestamp with time zone,timestamp with time zone,numeric,text,text,text,uuid,jsonb,uuid[],uuid,text,text,numeric,text,numeric,boolean);

-- Create updated version
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
    p_manual_discount numeric DEFAULT 0,
    p_is_subscription_covered boolean DEFAULT false
)
 RETURNS uuid
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
    v_appointment_id UUID;
    v_service RECORD;
    v_final_original_price NUMERIC := 0;
BEGIN
    -- Calculate actual original price if not provided
    IF p_original_price IS NULL OR p_original_price = 0 THEN
        FOR v_service IN SELECT * FROM jsonb_to_recordset(p_services) AS x(service_id uuid, price numeric)
        LOOP
            v_final_original_price := v_final_original_price + v_service.price;
        END LOOP;
    ELSE
        v_final_original_price := p_original_price;
    END IF;

    -- Insert appointment
    INSERT INTO public.appointments (
        company_id,
        professional_id,
        client_id,
        start_time,
        end_time,
        total_price,
        client_name,
        client_whatsapp,
        client_email,
        notes,
        promotion_id,
        user_id,
        booking_origin,
        original_price,
        promotion_discount,
        cashback_used,
        manual_discount,
        final_price,
        is_subscription_covered
    ) VALUES (
        p_company_id,
        p_professional_id,
        p_client_id,
        p_start_time,
        p_end_time,
        p_total_price,
        p_client_name,
        p_client_whatsapp,
        p_client_email,
        p_notes,
        p_promotion_id,
        p_user_id,
        p_booking_origin,
        v_final_original_price,
        p_promotion_discount,
        p_cashback_used,
        p_manual_discount,
        p_total_price,
        p_is_subscription_covered
    ) RETURNING id INTO v_appointment_id;

    -- Insert services
    INSERT INTO public.appointment_services (
        appointment_id,
        service_id,
        price,
        duration_minutes
    )
    SELECT 
        v_appointment_id,
        (s->>'service_id')::uuid,
        (s->>'price')::numeric,
        (s->>'duration_minutes')::integer
    FROM jsonb_array_elements(p_services) AS s;

    -- Handle cashback used (mark as used)
    IF array_length(p_cashback_ids, 1) > 0 THEN
        UPDATE public.client_cashback
        SET 
            status = 'used',
            used_at = now(),
            used_appointment_id = v_appointment_id
        WHERE id = ANY(p_cashback_ids);
    END IF;

    RETURN v_appointment_id;
END;
$function$;
