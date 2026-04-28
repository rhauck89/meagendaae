CREATE OR REPLACE FUNCTION public.check_identification(p_email text, p_whatsapp text, p_company_id uuid DEFAULT NULL)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
    v_email_exists BOOLEAN := FALSE;
    v_whatsapp_exists BOOLEAN := FALSE;
    v_same_user BOOLEAN := FALSE;
    v_email_user_id UUID;
    v_whatsapp_user_id UUID;
    v_identified_email TEXT;
    v_identified_name TEXT;
    v_client_email TEXT;
    v_client_name TEXT;
BEGIN
    -- 1. Check by Email in auth.users
    IF p_email IS NOT NULL AND p_email ~* '^[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}$' THEN
        SELECT id, email INTO v_email_user_id, v_identified_email FROM auth.users WHERE email = LOWER(p_email) LIMIT 1;
        IF v_email_user_id IS NOT NULL THEN
            v_email_exists := TRUE;
            
            -- Try to get name from profiles or clients for this company
            IF p_company_id IS NOT NULL THEN
                SELECT full_name INTO v_identified_name FROM public.profiles 
                WHERE user_id = v_email_user_id AND (company_id = p_company_id OR role = 'super_admin') LIMIT 1;
                
                IF v_identified_name IS NULL THEN
                    SELECT full_name INTO v_identified_name FROM public.clients 
                    WHERE email = v_identified_email AND company_id = p_company_id LIMIT 1;
                END IF;
            END IF;
        END IF;
    END IF;

    -- 2. Check by WhatsApp in clients/profiles
    IF p_whatsapp IS NOT NULL AND p_whatsapp <> '' THEN
        -- Check clients table first as it's more common for booking
        IF p_company_id IS NOT NULL THEN
            SELECT email, full_name INTO v_client_email, v_client_name 
            FROM public.clients 
            WHERE phone = p_whatsapp AND company_id = p_company_id 
            LIMIT 1;
        END IF;

        -- If not found in clients for this company, check auth.users globally (legacy/other companies)
        SELECT id, email INTO v_whatsapp_user_id, v_client_email FROM auth.users 
        WHERE raw_user_meta_data->>'whatsapp' = p_whatsapp 
        OR phone = p_whatsapp
        LIMIT 1;

        IF v_whatsapp_user_id IS NOT NULL OR v_client_name IS NOT NULL THEN
            v_whatsapp_exists := TRUE;
            
            -- Prioritize data found for this company
            IF v_client_email IS NOT NULL AND v_identified_email IS NULL THEN
                v_identified_email := v_client_email;
            END IF;
            IF v_client_name IS NOT NULL AND v_identified_name IS NULL THEN
                v_identified_name := v_client_name;
            END IF;

            -- If we found a user_id, check if it's the same as the email one
            IF v_email_user_id IS NOT NULL AND v_whatsapp_user_id IS NOT NULL AND v_email_user_id = v_whatsapp_user_id THEN
                v_same_user := TRUE;
            END IF;
        END IF;
    END IF;

    RETURN jsonb_build_object(
        'email_exists', v_email_exists,
        'whatsapp_exists', v_whatsapp_exists,
        'same_user', v_same_user,
        'email', v_identified_email,
        'name', v_identified_name
    );
END;
$function$;