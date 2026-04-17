-- 1) Ensure the stock trigger releases reserved stock when status moves to 'expired'
--    (mirrors the 'canceled' behavior). We update the function in place; the existing
--    trigger on loyalty_redemptions keeps pointing to it.
CREATE OR REPLACE FUNCTION public.handle_reward_redemption_stock()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- INSERT (pending): reserve stock if controlled
  IF TG_OP = 'INSERT' THEN
    IF NEW.reward_id IS NOT NULL AND NEW.status = 'pending' THEN
      UPDATE public.loyalty_reward_items
         SET stock_reserved = COALESCE(stock_reserved, 0) + 1
       WHERE id = NEW.reward_id
         AND stock_total IS NOT NULL;
    END IF;
    RETURN NEW;
  END IF;

  -- UPDATE: handle status transitions out of 'pending'
  IF TG_OP = 'UPDATE' THEN
    IF OLD.status = 'pending' AND NEW.status = 'confirmed' THEN
      UPDATE public.loyalty_reward_items
         SET stock_reserved = GREATEST(COALESCE(stock_reserved, 0) - 1, 0),
             stock_total    = GREATEST(COALESCE(stock_total, 0) - 1, 0)
       WHERE id = NEW.reward_id
         AND stock_total IS NOT NULL;
    ELSIF OLD.status = 'pending'
       AND NEW.status IN ('canceled', 'cancelled', 'expired') THEN
      UPDATE public.loyalty_reward_items
         SET stock_reserved = GREATEST(COALESCE(stock_reserved, 0) - 1, 0)
       WHERE id = NEW.reward_id
         AND stock_total IS NOT NULL;
    END IF;
    RETURN NEW;
  END IF;

  RETURN NEW;
END;
$$;

-- 2) Transactional expiration routine: marks pending redemptions older than
--    p_minutes as 'expired'. The trigger above releases the reserved stock.
CREATE OR REPLACE FUNCTION public.expire_pending_redemptions(p_minutes integer DEFAULT 15)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_expired_count int := 0;
  v_cutoff timestamptz := now() - make_interval(mins => GREATEST(p_minutes, 1));
BEGIN
  WITH to_expire AS (
    SELECT id
      FROM public.loyalty_redemptions
     WHERE status = 'pending'
       AND created_at < v_cutoff
     FOR UPDATE SKIP LOCKED
  ),
  updated AS (
    UPDATE public.loyalty_redemptions r
       SET status = 'expired'
      FROM to_expire t
     WHERE r.id = t.id
    RETURNING r.id
  )
  SELECT count(*) INTO v_expired_count FROM updated;

  RETURN jsonb_build_object(
    'expired', v_expired_count,
    'cutoff',  v_cutoff
  );
END;
$$;

-- Lock down execution: cron runs as postgres (superuser); no client should call this.
REVOKE ALL ON FUNCTION public.expire_pending_redemptions(integer) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.expire_pending_redemptions(integer) FROM anon, authenticated;

-- 3) Schedule it: run every minute via pg_cron (extension already in use by project).
CREATE EXTENSION IF NOT EXISTS pg_cron;

-- Remove any previous schedule with the same name to keep this idempotent.
DO $$
BEGIN
  PERFORM cron.unschedule('expire-pending-redemptions');
EXCEPTION WHEN OTHERS THEN
  -- ignore if it doesn't exist yet
  NULL;
END $$;

SELECT cron.schedule(
  'expire-pending-redemptions',
  '* * * * *',
  $cron$ SELECT public.expire_pending_redemptions(15); $cron$
);