
-- Drop existing policies that may conflict
DROP POLICY IF EXISTS "Anyone can view active services" ON public.services;
DROP POLICY IF EXISTS "Professionals can manage services" ON public.services;
DROP POLICY IF EXISTS "Professionals can view all services" ON public.services;

-- SELECT: company members + public can see active services
CREATE POLICY "Company members can view services"
  ON public.services FOR SELECT
  TO authenticated
  USING (company_id = get_user_company_id(auth.uid()));

CREATE POLICY "Public can view active services"
  ON public.services FOR SELECT
  TO public
  USING (active = true);

-- INSERT: authenticated users can create services for their company
CREATE POLICY "Users can create services for their company"
  ON public.services FOR INSERT
  TO authenticated
  WITH CHECK (company_id = get_user_company_id(auth.uid()));

-- UPDATE: authenticated users can update their company's services
CREATE POLICY "Users can update their company services"
  ON public.services FOR UPDATE
  TO authenticated
  USING (company_id = get_user_company_id(auth.uid()));

-- DELETE: authenticated users can delete their company's services
CREATE POLICY "Users can delete their company services"
  ON public.services FOR DELETE
  TO authenticated
  USING (company_id = get_user_company_id(auth.uid()));
