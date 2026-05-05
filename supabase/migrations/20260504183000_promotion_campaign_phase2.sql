-- Phase 2: promotional WhatsApp campaign processing
-- Promotional opt-out is isolated from transactional WhatsApp messages.

ALTER TABLE public.promotion_campaigns
  ADD COLUMN IF NOT EXISTS success_count integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS error_count integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS opt_out_count integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS skipped_count integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS started_at timestamptz,
  ADD COLUMN IF NOT EXISTS completed_at timestamptz,
  ADD COLUMN IF NOT EXISTS last_error text;

ALTER TABLE public.promotion_campaign_logs
  ADD COLUMN IF NOT EXISTS message_body text,
  ADD COLUMN IF NOT EXISTS processed_at timestamptz;

CREATE INDEX IF NOT EXISTS idx_promotion_campaign_logs_pending_batch
  ON public.promotion_campaign_logs (campaign_id, status, created_at);

CREATE INDEX IF NOT EXISTS idx_promotional_opt_outs_lookup
  ON public.promotional_opt_outs (company_id, whatsapp);

CREATE OR REPLACE FUNCTION public.register_promotional_opt_out(
  p_company_id uuid,
  p_whatsapp text
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_phone text;
  v_existing uuid;
BEGIN
  v_phone := regexp_replace(coalesce(p_whatsapp, ''), '\D', '', 'g');

  IF p_company_id IS NULL OR length(v_phone) < 10 THEN
    RAISE EXCEPTION 'Dados invalidos para descadastro promocional';
  END IF;

  SELECT id INTO v_existing
  FROM public.promotional_opt_outs
  WHERE company_id = p_company_id
    AND regexp_replace(coalesce(whatsapp, ''), '\D', '', 'g') = v_phone
  LIMIT 1;

  IF v_existing IS NULL THEN
    INSERT INTO public.promotional_opt_outs (company_id, whatsapp)
    VALUES (p_company_id, v_phone);
  END IF;
END;
$$;

GRANT EXECUTE ON FUNCTION public.register_promotional_opt_out(uuid, text) TO anon, authenticated;
