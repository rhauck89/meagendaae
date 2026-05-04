-- 1. Update confirm_reward_redemption to handle points safely
CREATE OR REPLACE FUNCTION public.confirm_reward_redemption(p_code text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
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

  -- Only deduct points if they weren't deducted at creation (legacy support)
  IF NOT EXISTS (
    SELECT 1 FROM public.loyalty_points_transactions 
    WHERE reference_id = v_redemption.id 
    AND reference_type = 'loyalty_redemptions'
  ) THEN
    SELECT COALESCE((
      SELECT balance_after FROM public.loyalty_points_transactions
      WHERE client_id = v_redemption.client_id AND company_id = v_redemption.company_id
      ORDER BY created_at DESC, id DESC LIMIT 1
    ), 0) INTO v_balance;

    -- Note: even if balance is insufficient here, we might want to allow confirmation 
    -- if it was a legacy redemption that skipped the check at creation.
    -- But for safety, we keep the check.
    IF v_balance >= v_redemption.total_points THEN
      INSERT INTO public.loyalty_points_transactions (
        company_id, client_id, points, transaction_type,
        reference_type, reference_id, description, balance_after
      ) VALUES (
        v_redemption.company_id, v_redemption.client_id,
        -v_redemption.total_points, 'reward_redemption',
        'loyalty_redemptions', v_redemption.id,
        'Resgate confirmado ' || v_redemption.redemption_code,
        v_balance - v_redemption.total_points
      );
    END IF;
  END IF;

  RETURN jsonb_build_object(
    'redemption_id', v_redemption.id,
    'status', 'confirmed',
    'total_points', v_redemption.total_points
  );
END;
$function$;

-- 2. Ensure redeem_reward is fully correct
CREATE OR REPLACE FUNCTION public.redeem_reward(p_client_id uuid, p_company_id uuid, p_reward_id uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_auth_uid uuid;
  v_client_user uuid;
  v_client_company uuid;
  v_reward record;
  v_balance int;
  v_code text;
  v_redemption_id uuid;
BEGIN
  v_auth_uid := auth.uid();
  IF v_auth_uid IS NULL THEN
    RAISE EXCEPTION 'AUTH_REQUIRED' USING ERRCODE = '28000';
  END IF;

  -- Verify client ownership and company match
  SELECT user_id, company_id INTO v_client_user, v_client_company
  FROM public.clients WHERE id = p_client_id;

  IF v_client_user IS NULL OR v_client_user <> v_auth_uid THEN
    RAISE EXCEPTION 'FORBIDDEN: client does not belong to current user';
  END IF;
  IF v_client_company <> p_company_id THEN
    RAISE EXCEPTION 'FORBIDDEN: client/company mismatch';
  END IF;

  -- Lock the reward row to prevent race conditions
  SELECT id, company_id, name, points_required, active,
         stock_total, COALESCE(stock_reserved, 0) AS stock_reserved
    INTO v_reward
  FROM public.loyalty_reward_items
  WHERE id = p_reward_id
  FOR UPDATE;

  IF v_reward.id IS NULL THEN
    RAISE EXCEPTION 'Recompensa não encontrada';
  END IF;
  IF v_reward.company_id <> p_company_id THEN
    RAISE EXCEPTION 'Recompensa não pertence a esta empresa';
  END IF;
  IF NOT v_reward.active THEN
    RAISE EXCEPTION 'Recompensa indisponível';
  END IF;

  -- Stock check (only when stock control is enabled)
  IF v_reward.stock_total IS NOT NULL
     AND (v_reward.stock_total - v_reward.stock_reserved) <= 0 THEN
    RAISE EXCEPTION 'Estoque indisponível para esta recompensa';
  END IF;

  -- Points balance check (latest balance from transactions)
  SELECT COALESCE((
    SELECT balance_after FROM public.loyalty_points_transactions
    WHERE client_id = p_client_id AND company_id = p_company_id
    ORDER BY created_at DESC, id DESC LIMIT 1
  ), 0) INTO v_balance;

  IF v_balance < v_reward.points_required THEN
    RAISE EXCEPTION 'Você ainda não tem pontos suficientes para este resgate.';
  END IF;

  -- Generate redemption code
  v_code := upper(substring(replace(gen_random_uuid()::text, '-', '') FROM 1 FOR 6));

  -- Insert the redemption
  INSERT INTO public.loyalty_redemptions (
    client_id, company_id, reward_id, redemption_code,
    total_points, status, items, user_id
  ) VALUES (
    p_client_id, p_company_id, p_reward_id, v_code,
    v_reward.points_required, 'pending',
    jsonb_build_array(jsonb_build_object(
      'reward_id', p_reward_id,
      'name', v_reward.name,
      'points', v_reward.points_required
    )),
    v_auth_uid
  )
  RETURNING id INTO v_redemption_id;

  -- Deduct points (insert ledger entry)
  INSERT INTO public.loyalty_points_transactions (
    company_id, client_id, points, transaction_type,
    reference_type, reference_id, description, balance_after,
    user_id
  ) VALUES (
    p_company_id, p_client_id, -v_reward.points_required, 'reward_redemption',
    'loyalty_redemptions', v_redemption_id,
    'Resgate de ' || v_reward.name, v_balance - v_reward.points_required,
    v_auth_uid
  );

  -- Safety net: ensure invariant stock_reserved <= stock_total
  IF EXISTS (
    SELECT 1 FROM public.loyalty_reward_items
    WHERE id = p_reward_id
      AND stock_total IS NOT NULL
      AND stock_reserved > stock_total
  ) THEN
    RAISE EXCEPTION 'Inconsistência de estoque detectada';
  END IF;

  RETURN jsonb_build_object(
    'id', v_redemption_id,
    'code', v_code,
    'points', v_reward.points_required,
    'new_balance', v_balance - v_reward.points_required
  );
END;
$function$;