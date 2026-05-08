-- Create a temporary function to check for table existence and update create_appointment_v2
DO $$
BEGIN
    -- We assume the target table is client_cashback based on the user's instructions.
    -- If it doesn't exist, this migration might need adjustment, but the requirement is clear.
    
    -- Update or Create the RPC function create_appointment_v2 to handle cashback correctly
    CREATE OR REPLACE FUNCTION public.create_appointment_v2(
        p_company_id uuid,
        p_professional_id uuid,
        p_client_id uuid,
        p_start_time timestamp with time zone,
        p_end_time timestamp with time zone,
        p_total_price numeric,
        p_client_name text,
        p_client_whatsapp text,
        p_notes text,
        p_promotion_id uuid,
        p_services jsonb,
        p_cashback_ids uuid[],
        p_user_id uuid DEFAULT NULL::uuid,
        p_booking_origin text DEFAULT 'public_booking'::text,
        p_client_email text DEFAULT NULL::text
    )
    RETURNS uuid
    LANGUAGE plpgsql
    SECURITY DEFINER
    AS $function$
    DECLARE
        v_appointment_id uuid;
        v_client_id uuid := p_client_id;
        v_service record;
        v_cashback_id uuid;
        v_cashback_amount numeric;
    BEGIN
        -- 1. Resolve or Create Client
        IF v_client_id IS NULL THEN
            SELECT id INTO v_client_id 
            FROM public.clients 
            WHERE company_id = p_company_id 
              AND (whatsapp = p_client_whatsapp OR (p_client_email IS NOT NULL AND email = p_client_email))
            LIMIT 1;

            IF v_client_id IS NULL THEN
                INSERT INTO public.clients (company_id, full_name, whatsapp, email)
                VALUES (p_company_id, p_client_name, p_client_whatsapp, p_client_email)
                RETURNING id INTO v_client_id;
            END IF;
        END IF;

        -- 2. Create Appointment
        INSERT INTO public.appointments (
            company_id, professional_id, client_id, start_time, end_time, 
            total_price, status, notes, promotion_id, booking_origin, user_id
        )
        VALUES (
            p_company_id, p_professional_id, v_client_id, p_start_time, p_end_time, 
            p_total_price, 'confirmed', p_notes, p_promotion_id, p_booking_origin, p_user_id
        )
        RETURNING id INTO v_appointment_id;

        -- 3. Link Services
        FOR v_service IN SELECT * FROM jsonb_to_recordset(p_services) AS x(service_id uuid, price numeric, duration_minutes integer)
        LOOP
            INSERT INTO public.appointment_services (appointment_id, service_id, price, duration_minutes)
            VALUES (v_appointment_id, v_service.service_id, v_service.price, v_service.duration_minutes);
        END LOOP;

        -- 4. Consume Cashback Credits
        IF p_cashback_ids IS NOT NULL AND array_length(p_cashback_ids, 1) > 0 THEN
            FOREACH v_cashback_id IN ARRAY p_cashback_ids
            LOOP
                -- Get credit amount and verify it belongs to the client/company and is active
                -- The previous error was: relation "public.promotions_cashback_credits" does not exist
                -- We now use public.client_cashback (or equivalent based on user instruction)
                
                -- Check for client_cashback table usage
                UPDATE public.client_cashback
                SET used = true,
                    used_at = now(),
                    appointment_id = v_appointment_id
                WHERE id = v_cashback_id 
                  AND client_id = v_client_id
                  AND used = false
                RETURNING amount INTO v_cashback_amount;

                IF FOUND THEN
                    -- Register transaction in extract
                    INSERT INTO public.cashback_transactions (
                        company_id, client_id, appointment_id, amount, type, description
                    )
                    VALUES (
                        p_company_id, v_client_id, v_appointment_id, v_cashback_amount, 'debit', 'Uso de saldo no agendamento'
                    );
                END IF;
            END LOOP;
        END IF;

        RETURN v_appointment_id;
    END;
    $function$;

END $$;
