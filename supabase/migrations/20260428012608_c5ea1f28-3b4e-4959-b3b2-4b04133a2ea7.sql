CREATE OR REPLACE FUNCTION public.check_identification(p_email TEXT, p_whatsapp TEXT)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_email_exists BOOLEAN := FALSE;
    v_whatsapp_exists BOOLEAN := FALSE;
    v_same_user BOOLEAN := FALSE;
    v_email_user_id UUID;
    v_whatsapp_user_id UUID;
BEGIN
    -- Check email in auth.users
    SELECT id INTO v_email_user_id FROM auth.users WHERE email = p_email LIMIT 1;
    IF v_email_user_id IS NOT NULL THEN
        v_email_exists := TRUE;
    END IF;

    -- Check whatsapp in auth.users (via raw_user_meta_data)
    SELECT id INTO v_whatsapp_user_id FROM auth.users 
    WHERE raw_user_meta_data->>'whatsapp' = p_whatsapp 
    OR phone = p_whatsapp
    LIMIT 1;
    
    IF v_whatsapp_user_id IS NOT NULL THEN
        v_whatsapp_exists := TRUE;
    END IF;

    -- Check if they belong to the same account
    IF v_email_exists AND v_whatsapp_exists AND v_email_user_id = v_whatsapp_user_id THEN
        v_same_user := TRUE;
    END IF;

    RETURN jsonb_build_object(
        'email_exists', v_email_exists,
        'whatsapp_exists', v_whatsapp_exists,
        'same_user', v_same_user
    );
END;
$$;