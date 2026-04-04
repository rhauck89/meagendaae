
-- Feature discovery flags table
CREATE TABLE public.feature_discovery (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  feature_key text NOT NULL,
  seen_at timestamp with time zone NOT NULL DEFAULT now(),
  UNIQUE(user_id, feature_key)
);

ALTER TABLE public.feature_discovery ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can manage own feature discovery"
ON public.feature_discovery
FOR ALL
TO authenticated
USING (user_id = auth.uid())
WITH CHECK (user_id = auth.uid());
