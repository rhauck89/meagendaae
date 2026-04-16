CREATE POLICY "Clients can view companies of own appointments"
  ON public.companies
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1
      FROM public.appointments a
      JOIN public.clients c ON c.id = a.client_id
      WHERE a.company_id = companies.id
        AND c.user_id = auth.uid()
    )
  );

CREATE POLICY "Clients can view professionals of own appointments"
  ON public.profiles
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1
      FROM public.appointments a
      JOIN public.clients c ON c.id = a.client_id
      WHERE a.professional_id = profiles.id
        AND c.user_id = auth.uid()
    )
  );