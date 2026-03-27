
-- Add SELECT policy so owners can always see their own company
-- (needed because during onboarding, profiles.company_id is not set yet,
--  so get_user_company_id returns NULL and the existing SELECT policy fails)
CREATE POLICY "Owner can view own company"
  ON public.companies FOR SELECT
  TO authenticated
  USING (owner_id = auth.uid());
