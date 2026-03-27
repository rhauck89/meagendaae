
-- Allow professionals to see ALL services (including inactive) in their company
CREATE POLICY "Professionals can view all services"
ON public.services
FOR SELECT
TO authenticated
USING (has_company_role(auth.uid(), company_id, 'professional'::app_role));

-- Allow professionals to update profiles in their company (needed for setting company_id on collaborators)
CREATE POLICY "Professionals can update company profiles"
ON public.profiles
FOR UPDATE
TO authenticated
USING (
  company_id = get_user_company_id(auth.uid())
  AND has_company_role(auth.uid(), get_user_company_id(auth.uid()), 'professional'::app_role)
);
