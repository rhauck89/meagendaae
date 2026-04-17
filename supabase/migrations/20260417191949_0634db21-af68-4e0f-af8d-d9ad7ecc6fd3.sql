
-- 1) Stock fields on reward items
ALTER TABLE public.loyalty_reward_items
  ADD COLUMN IF NOT EXISTS stock_total integer,
  ADD COLUMN IF NOT EXISTS stock_reserved integer NOT NULL DEFAULT 0;

ALTER TABLE public.loyalty_reward_items
  ADD COLUMN IF NOT EXISTS stock_available integer
  GENERATED ALWAYS AS (
    CASE WHEN stock_total IS NULL THEN NULL
         ELSE GREATEST(stock_total - COALESCE(stock_reserved, 0), 0)
    END
  ) STORED;

-- 2) Link redemption to reward item
ALTER TABLE public.loyalty_redemptions
  ADD COLUMN IF NOT EXISTS reward_id uuid REFERENCES public.loyalty_reward_items(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_loyalty_redemptions_reward_id ON public.loyalty_redemptions(reward_id);

-- 3) Stock reservation trigger
CREATE OR REPLACE FUNCTION public.handle_reward_redemption_stock()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_total int;
  v_reserved int;
BEGIN
  IF TG_OP = 'INSERT' THEN
    IF NEW.reward_id IS NOT NULL AND NEW.status = 'pending' THEN
      SELECT stock_total, stock_reserved INTO v_total, v_reserved
        FROM public.loyalty_reward_items WHERE id = NEW.reward_id FOR UPDATE;
      IF v_total IS NOT NULL AND (v_total - COALESCE(v_reserved,0)) <= 0 THEN
        RAISE EXCEPTION 'Estoque indisponível para esta recompensa';
      END IF;
      UPDATE public.loyalty_reward_items
        SET stock_reserved = COALESCE(stock_reserved,0) + 1
        WHERE id = NEW.reward_id;
    END IF;
    RETURN NEW;
  END IF;

  IF TG_OP = 'UPDATE' AND NEW.reward_id IS NOT NULL AND OLD.status IS DISTINCT FROM NEW.status THEN
    IF OLD.status = 'pending' AND NEW.status = 'confirmed' THEN
      UPDATE public.loyalty_reward_items
        SET stock_reserved = GREATEST(COALESCE(stock_reserved,0) - 1, 0),
            stock_total = CASE WHEN stock_total IS NULL THEN NULL ELSE GREATEST(stock_total - 1, 0) END
        WHERE id = NEW.reward_id;
    ELSIF OLD.status = 'pending' AND NEW.status IN ('canceled','cancelled') THEN
      UPDATE public.loyalty_reward_items
        SET stock_reserved = GREATEST(COALESCE(stock_reserved,0) - 1, 0)
        WHERE id = NEW.reward_id;
    END IF;
    RETURN NEW;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_reward_redemption_stock ON public.loyalty_redemptions;
CREATE TRIGGER trg_reward_redemption_stock
  AFTER INSERT OR UPDATE ON public.loyalty_redemptions
  FOR EACH ROW EXECUTE FUNCTION public.handle_reward_redemption_stock();

-- 4) Allow client to cancel own pending redemption
DROP POLICY IF EXISTS "Clients can cancel own pending redemptions" ON public.loyalty_redemptions;
CREATE POLICY "Clients can cancel own pending redemptions"
  ON public.loyalty_redemptions FOR UPDATE
  TO authenticated
  USING (client_id IN (SELECT id FROM public.clients WHERE user_id = auth.uid()))
  WITH CHECK (client_id IN (SELECT id FROM public.clients WHERE user_id = auth.uid()) AND status IN ('canceled','cancelled'));
