
-- Create parameterless helper that uses auth.uid() directly
CREATE OR REPLACE FUNCTION public.get_my_company_id()
RETURNS uuid
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT company_id FROM public.profiles WHERE user_id = auth.uid() LIMIT 1;
$$;

-- =====================================================
-- SERVICES (already refactored, skip)
-- =====================================================

-- =====================================================
-- BUSINESS_HOURS
-- =====================================================
DROP POLICY IF EXISTS "Anyone can view business hours" ON public.business_hours;
DROP POLICY IF EXISTS "Professionals can manage hours" ON public.business_hours;

CREATE POLICY "Public can view business hours"
  ON public.business_hours FOR SELECT TO public USING (true);

CREATE POLICY "Company members can manage hours"
  ON public.business_hours FOR ALL TO authenticated
  USING (company_id = get_my_company_id())
  WITH CHECK (company_id = get_my_company_id());

-- =====================================================
-- BUSINESS_EXCEPTIONS
-- =====================================================
DROP POLICY IF EXISTS "Anyone can view exceptions" ON public.business_exceptions;
DROP POLICY IF EXISTS "Professionals can manage exceptions" ON public.business_exceptions;

CREATE POLICY "Public can view exceptions"
  ON public.business_exceptions FOR SELECT TO public USING (true);

CREATE POLICY "Company members can manage exceptions"
  ON public.business_exceptions FOR ALL TO authenticated
  USING (company_id = get_my_company_id())
  WITH CHECK (company_id = get_my_company_id());

-- =====================================================
-- COLLABORATORS
-- =====================================================
DROP POLICY IF EXISTS "Professionals can manage collaborators" ON public.collaborators;
DROP POLICY IF EXISTS "Professionals can view all collaborators" ON public.collaborators;
DROP POLICY IF EXISTS "Collaborators can view own record" ON public.collaborators;

CREATE POLICY "Company members can view collaborators"
  ON public.collaborators FOR SELECT TO authenticated
  USING (company_id = get_my_company_id());

CREATE POLICY "Company members can manage collaborators"
  ON public.collaborators FOR ALL TO authenticated
  USING (company_id = get_my_company_id())
  WITH CHECK (company_id = get_my_company_id());

-- =====================================================
-- PROFESSIONAL_WORKING_HOURS
-- =====================================================
DROP POLICY IF EXISTS "Anyone can view professional hours" ON public.professional_working_hours;
DROP POLICY IF EXISTS "Professionals can manage own hours" ON public.professional_working_hours;

CREATE POLICY "Public can view professional hours"
  ON public.professional_working_hours FOR SELECT TO public USING (true);

CREATE POLICY "Company members can manage professional hours"
  ON public.professional_working_hours FOR ALL TO authenticated
  USING (company_id = get_my_company_id())
  WITH CHECK (company_id = get_my_company_id());

-- =====================================================
-- SERVICE_PROFESSIONALS
-- =====================================================
DROP POLICY IF EXISTS "Anyone can view service professionals" ON public.service_professionals;
DROP POLICY IF EXISTS "Professionals can manage service_professionals" ON public.service_professionals;

CREATE POLICY "Public can view service professionals"
  ON public.service_professionals FOR SELECT TO public USING (true);

CREATE POLICY "Company members can manage service professionals"
  ON public.service_professionals FOR ALL TO authenticated
  USING (company_id = get_my_company_id())
  WITH CHECK (company_id = get_my_company_id());

-- =====================================================
-- WEBHOOK_CONFIGS
-- =====================================================
DROP POLICY IF EXISTS "Professionals can manage webhooks" ON public.webhook_configs;

CREATE POLICY "Company members can manage webhooks"
  ON public.webhook_configs FOR ALL TO authenticated
  USING (company_id = get_my_company_id())
  WITH CHECK (company_id = get_my_company_id());

-- =====================================================
-- WAITING_LIST - keep client self-service policies, simplify company view
-- =====================================================
DROP POLICY IF EXISTS "Company can view waitlist" ON public.waiting_list;

CREATE POLICY "Company can view waiting list"
  ON public.waiting_list FOR SELECT TO authenticated
  USING (company_id = get_my_company_id());

-- =====================================================
-- APPOINTMENTS - simplify company view policy
-- =====================================================
DROP POLICY IF EXISTS "Company members can view appointments" ON public.appointments;

CREATE POLICY "Company members can view appointments"
  ON public.appointments FOR SELECT TO authenticated
  USING (company_id = get_my_company_id());
