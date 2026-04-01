
DROP POLICY IF EXISTS "Public can track clicks" ON public.promotion_clicks;

CREATE POLICY "Public can track promotion clicks"
  ON public.promotion_clicks FOR INSERT
  TO public
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.promotions p
      WHERE p.id = promotion_clicks.promotion_id
        AND p.status = 'active'
        AND p.end_date >= CURRENT_DATE
        AND p.company_id = promotion_clicks.company_id
    )
  );
