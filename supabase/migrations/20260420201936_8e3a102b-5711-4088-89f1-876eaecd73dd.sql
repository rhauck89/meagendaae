
-- Defense-in-depth: restrict appointment visibility server-side
-- Non-admin members (regular professionals/collaborators) can only see/modify
-- appointments where they are the assigned professional.

-- 1) Helper: is the user an admin of this company?
-- Admin = company owner OR super_admin
CREATE OR REPLACE FUNCTION public.is_company_admin(_user_id uuid, _company_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.companies
    WHERE id = _company_id AND owner_id = _user_id
  ) OR public.has_role(_user_id, 'super_admin'::app_role);
$$;

-- 2) Helper: get caller's profile.id (the one used as professional_id)
CREATE OR REPLACE FUNCTION public.get_my_profile_id()
RETURNS uuid
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT id FROM public.profiles WHERE user_id = auth.uid() LIMIT 1;
$$;

-- 3) Restrictive policy on appointments:
-- For non-admin members, restrict SELECT/UPDATE to appointments they own.
-- Admins (owner/super_admin) and clients viewing their own appointments are unaffected
-- because RESTRICTIVE policies only apply when the row matches the company filter.
DROP POLICY IF EXISTS "Members see only own appointments" ON public.appointments;
CREATE POLICY "Members see only own appointments"
ON public.appointments
AS RESTRICTIVE
FOR SELECT
TO authenticated
USING (
  -- Allow if user is company admin
  public.is_company_admin(auth.uid(), company_id)
  -- OR if user is the assigned professional
  OR professional_id = public.get_my_profile_id()
  -- OR if user is the client of this appointment
  OR client_id IN (SELECT id FROM public.clients WHERE user_id = auth.uid())
);

DROP POLICY IF EXISTS "Members update only own appointments" ON public.appointments;
CREATE POLICY "Members update only own appointments"
ON public.appointments
AS RESTRICTIVE
FOR UPDATE
TO authenticated
USING (
  public.is_company_admin(auth.uid(), company_id)
  OR professional_id = public.get_my_profile_id()
  OR client_id IN (SELECT id FROM public.clients WHERE user_id = auth.uid())
);

-- 4) Same restriction for appointment_requests
DROP POLICY IF EXISTS "Members see only own requests" ON public.appointment_requests;
CREATE POLICY "Members see only own requests"
ON public.appointment_requests
AS RESTRICTIVE
FOR SELECT
TO authenticated
USING (
  public.is_company_admin(auth.uid(), company_id)
  OR professional_id IS NULL
  OR professional_id = public.get_my_profile_id()
);

DROP POLICY IF EXISTS "Members modify only own requests" ON public.appointment_requests;
CREATE POLICY "Members modify only own requests"
ON public.appointment_requests
AS RESTRICTIVE
FOR UPDATE
TO authenticated
USING (
  public.is_company_admin(auth.uid(), company_id)
  OR professional_id = public.get_my_profile_id()
);

-- 5) Restrict blocked_times the same way
DROP POLICY IF EXISTS "Members see only own blocks" ON public.blocked_times;
CREATE POLICY "Members see only own blocks"
ON public.blocked_times
AS RESTRICTIVE
FOR SELECT
TO authenticated
USING (
  public.is_company_admin(auth.uid(), company_id)
  OR professional_id = public.get_my_profile_id()
);
