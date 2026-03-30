-- Remove overly permissive INSERT policy, reviews are created through submit_review RPC
DROP POLICY IF EXISTS "Authenticated can insert reviews" ON public.reviews;