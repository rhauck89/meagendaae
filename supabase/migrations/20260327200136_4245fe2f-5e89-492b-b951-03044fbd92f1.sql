-- Allow public (unauthenticated) users to view active collaborators for booking
CREATE POLICY "Public can view active collaborators"
ON public.collaborators
FOR SELECT
TO public
USING (active = true);

-- Allow public users to view professional profiles (limited by join context)
CREATE POLICY "Public can view professional profiles"
ON public.profiles
FOR SELECT
TO public
USING (
  EXISTS (
    SELECT 1 FROM public.collaborators c
    WHERE c.profile_id = profiles.id AND c.active = true
  )
);