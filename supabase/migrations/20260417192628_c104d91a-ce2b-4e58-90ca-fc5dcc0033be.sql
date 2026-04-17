-- Transactional reward redemption RPC.
-- Locks the reward row (FOR UPDATE), validates stock_available > 0,
-- checks client points balance, and creates the redemption atomically.
-- The existing handle_reward_redemption_stock trigger then increments stock_reserved,
-- but we also pre-validate here to avoid race conditions and surface clean errors.

CREATE OR REPLACE FUNCTION public.redeem_reward(
  p_client_id uuid,
  p_company_id uuid,
  p_reward_id uuid
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
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
    ORDER BY created_at DESC LIMIT 1
  ), 0) INTO v_balance;

  IF v_balance < v_reward.points_required THEN
    RAISE EXCEPTION 'Pontos insuficientes para resgate';
  END IF;

  -- Generate redemption code
  v_code := upper(substring(replace(gen_random_uuid()::text, '-', '') FROM 1 FOR 6));

  -- Insert the redemption (trigger handle_reward_redemption_stock
  -- will increment stock_reserved within this same transaction).
  INSERT INTO public.loyalty_redemptions (
    client_id, company_id, reward_id, redemption_code,
    total_points, status, items
  ) VALUES (
    p_client_id, p_company_id, p_reward_id, v_code,
    v_reward.points_required, 'pending',
    jsonb_build_array(jsonb_build_object(
      'reward_id', p_reward_id,
      'name', v_reward.name,
      'points', v_reward.points_required
    ))
  )
  RETURNING id INTO v_redemption_id;

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
    'points', v_reward.points_required
  );
END;
$$;

REVOKE ALL ON FUNCTION public.redeem_reward(uuid, uuid, uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.redeem_reward(uuid, uuid, uuid) TO authenticated;

-- Defense-in-depth invariant: prevent stock_reserved from ever exceeding stock_total
ALTER TABLE public.loyalty_reward_items
  DROP CONSTRAINT IF EXISTS loyalty_reward_items_stock_reserved_check;
ALTER TABLE public.loyalty_reward_items
  ADD CONSTRAINT loyalty_reward_items_stock_reserved_check
  CHECK (stock_reserved >= 0 AND (stock_total IS NULL OR stock_reserved <= stock_total));