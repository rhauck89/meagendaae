CREATE OR REPLACE FUNCTION public.get_client_cashback_balance(
  p_company_id UUID,
  p_client_id UUID DEFAULT NULL,
  p_user_id UUID DEFAULT NULL,
  p_email TEXT DEFAULT NULL,
  p_whatsapp TEXT DEFAULT NULL
)
RETURNS NUMERIC
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_balance NUMERIC := 0;
  v_normalized_whatsapp TEXT;
BEGIN
  -- Normalize WhatsApp if provided
  IF p_whatsapp IS NOT NULL THEN
    v_normalized_whatsapp := regexp_replace(p_whatsapp, '[^0-9]', '', 'g');
    -- Handle common Brazilian prefix if missing, but normalization usually happens in the app
  END IF;

  SELECT COALESCE(SUM(amount), 0)
  INTO v_balance
  FROM public.client_cashback
  WHERE company_id = p_company_id
    AND status = 'active'
    AND expires_at > now()
    AND (
      (p_user_id IS NOT NULL AND user_id = p_user_id)
      OR (p_client_id IS NOT NULL AND client_id = p_client_id)
      OR (
        client_id IN (
          SELECT id FROM public.clients 
          WHERE company_id = p_company_id 
          AND (
            (p_email IS NOT NULL AND email = p_email)
            OR (v_normalized_whatsapp IS NOT NULL AND whatsapp = v_normalized_whatsapp)
          )
        )
      )
    );

  RETURN v_balance;
END;
$$;