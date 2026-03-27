-- Allow company owners to assign themselves the professional role during onboarding
CREATE POLICY "Company owners can assign own professional role"
ON public.user_roles
FOR INSERT
TO authenticated
WITH CHECK (
  user_id = auth.uid()
  AND role = 'professional'::app_role
  AND company_id IS NOT NULL
  AND EXISTS (
    SELECT 1 FROM public.companies
    WHERE id = user_roles.company_id
    AND owner_id = auth.uid()
  )
);