
-- Validate a reward redemption code (read-only): used by company staff to preview redemption details
CREATE OR REPLACE FUNCTION public.validate_reward_redemption(p_code text)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_auth_uid uuid;
  v_company_id uuid;
  v_redemption record;
  v_client_name text;
  v_reward_name text;
  v_minutes_old numeric;
BEGIN
  v_auth_uid := auth.uid();
  IF v_auth_uid IS NULL THEN
    RAISE EXCEPTION 'AUTH_REQUIRED' USING ERRCODE = '28000';
  END IF;

  -- Resolve company of the calling staff member
  SELECT company_id INTO v_company_id
  FROM public.profiles WHERE user_id = v_auth_uid;

  IF v_company_id IS NULL THEN
    RAISE EXCEPTION 'NO_COMPANY';
  END IF;

  -- Lookup redemption (case-insensitive on code)
  SELECT id, client_id, reward_id, company_id, status, total_points,
         redemption_code, created_at
    INTO v_redemption
  FROM public.loyalty_redemptions
  WHERE upper(redemption_code) = upper(trim(p_code))
  LIMIT 1;

  IF v_redemption.id IS NULL THEN
    RAISE EXCEPTION 'NOT_FOUND' USING MESSAGE = 'Código inválido';
  END IF;

  IF v_redemption.company_id <> v_company_id THEN
    RAISE EXCEPTION 'FORBIDDEN' USING MESSAGE = 'Resgate não pertence a esta empresa';
  END IF;

  IF v_redemption.status = 'confirmed' THEN
    RAISE EXCEPTION 'ALREADY_USED' USING MESSAGE = 'Este resgate já foi utilizado';
  END IF;

  IF v_redemption.status IN ('canceled', 'cancelled') THEN
    RAISE EXCEPTION 'CANCELED' USING MESSAGE = 'Este resgate foi cancelado';
  END IF;

  IF v_redemption.status = 'expired' THEN
    RAISE EXCEPTION 'EXPIRED' USING MESSAGE = 'Código expirado';
  END IF;

  v_minutes_old := EXTRACT(EPOCH FROM (now() - v_redemption.created_at)) / 60;
  IF v_redemption.status = 'pending' AND v_minutes_old > 15 THEN
    RAISE EXCEPTION 'EXPIRED' USING MESSAGE = 'Código expirado';
  END IF;

  SELECT name INTO v_client_name FROM public.clients WHERE id = v_redemption.client_id;
  SELECT name INTO v_reward_name FROM public.loyalty_reward_items WHERE id = v_redemption.reward_id;

  RETURN jsonb_build_object(
    'redemption_id', v_redemption.id,
    'redemption_code', v_redemption.redemption_code,
    'client_id', v_redemption.client_id,
    'client_name', COALESCE(v_client_name, 'Cliente'),
    'reward_id', v_redemption.reward_id,
    'reward_name', COALESCE(v_reward_name, 'Recompensa'),
    'total_points', v_redemption.total_points,
    'created_at', v_redemption.created_at,
    'status', v_redemption.status
  );
END;
$$;

REVOKE ALL ON FUNCTION public.validate_reward_redemption(text) FROM anon;
GRANT EXECUTE ON FUNCTION public.validate_reward_redemption(text) TO authenticated;

-- Confirm a reward redemption: status -> confirmed, deduct client points
CREATE OR REPLACE FUNCTION public.confirm_reward_redemption(p_code text)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_auth_uid uuid;
  v_company_id uuid;
  v_redemption record;
  v_minutes_old numeric;
  v_balance int;
BEGIN
  v_auth_uid := auth.uid();
  IF v_auth_uid IS NULL THEN
    RAISE EXCEPTION 'AUTH_REQUIRED' USING ERRCODE = '28000';
  END IF;

  SELECT company_id INTO v_company_id
  FROM public.profiles WHERE user_id = v_auth_uid;

  IF v_company_id IS NULL THEN
    RAISE EXCEPTION 'NO_COMPANY';
  END IF;

  -- Lock the redemption row to prevent double confirmation
  SELECT id, client_id, reward_id, company_id, status, total_points,
         redemption_code, created_at
    INTO v_redemption
  FROM public.loyalty_redemptions
  WHERE upper(redemption_code) = upper(trim(p_code))
  FOR UPDATE;

  IF v_redemption.id IS NULL THEN
    RAISE EXCEPTION 'NOT_FOUND' USING MESSAGE = 'Código inválido';
  END IF;

  IF v_redemption.company_id <> v_company_id THEN
    RAISE EXCEPTION 'FORBIDDEN' USING MESSAGE = 'Resgate não pertence a esta empresa';
  END IF;

  IF v_redemption.status = 'confirmed' THEN
    RAISE EXCEPTION 'ALREADY_USED' USING MESSAGE = 'Este resgate já foi utilizado';
  END IF;

  IF v_redemption.status IN ('canceled', 'cancelled') THEN
    RAISE EXCEPTION 'CANCELED' USING MESSAGE = 'Este resgate foi cancelado';
  END IF;

  IF v_redemption.status = 'expired' THEN
    RAISE EXCEPTION 'EXPIRED' USING MESSAGE = 'Código expirado';
  END IF;

  v_minutes_old := EXTRACT(EPOCH FROM (now() - v_redemption.created_at)) / 60;
  IF v_minutes_old > 15 THEN
    RAISE EXCEPTION 'EXPIRED' USING MESSAGE = 'Código expirado';
  END IF;

  -- Update status: trigger handles stock_total -= 1, stock_reserved -= 1
  UPDATE public.loyalty_redemptions
     SET status = 'confirmed',
         confirmed_at = now(),
         confirmed_by = v_auth_uid
   WHERE id = v_redemption.id;

  -- Deduct points from client
  SELECT COALESCE((
    SELECT balance_after FROM public.loyalty_points_transactions
    WHERE client_id = v_redemption.client_id AND company_id = v_redemption.company_id
    ORDER BY created_at DESC LIMIT 1
  ), 0) INTO v_balance;

  IF v_balance < v_redemption.total_points THEN
    RAISE EXCEPTION 'INSUFFICIENT_POINTS' USING MESSAGE = 'Saldo de pontos insuficiente';
  END IF;

  INSERT INTO public.loyalty_points_transactions (
    company_id, client_id, points, transaction_type,
    reference_type, reference_id, description, balance_after
  ) VALUES (
    v_redemption.company_id, v_redemption.client_id,
    -v_redemption.total_points, 'redeem',
    'redemption_confirm', v_redemption.id,
    'Resgate confirmado ' || v_redemption.redemption_code,
    v_balance - v_redemption.total_points
  );

  RETURN jsonb_build_object(
    'redemption_id', v_redemption.id,
    'status', 'confirmed',
    'total_points', v_redemption.total_points
  );
END;
$$;

REVOKE ALL ON FUNCTION public.confirm_reward_redemption(text) FROM anon;
GRANT EXECUTE ON FUNCTION public.confirm_reward_redemption(text) TO authenticated;
