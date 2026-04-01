
-- Brazilian states
CREATE TABLE public.brazilian_states (
  id serial PRIMARY KEY,
  name text NOT NULL,
  uf char(2) NOT NULL UNIQUE
);

ALTER TABLE public.brazilian_states ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Public can view states"
ON public.brazilian_states FOR SELECT
TO public USING (true);

CREATE POLICY "Super admins can manage states"
ON public.brazilian_states FOR ALL
TO authenticated
USING (has_role(auth.uid(), 'super_admin'::app_role))
WITH CHECK (has_role(auth.uid(), 'super_admin'::app_role));

-- Brazilian cities
CREATE TABLE public.brazilian_cities (
  id serial PRIMARY KEY,
  name text NOT NULL,
  state_id integer NOT NULL REFERENCES public.brazilian_states(id)
);

CREATE INDEX idx_cities_state_id ON public.brazilian_cities(state_id);

ALTER TABLE public.brazilian_cities ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Public can view cities"
ON public.brazilian_cities FOR SELECT
TO public USING (true);

CREATE POLICY "Super admins can manage cities"
ON public.brazilian_cities FOR ALL
TO authenticated
USING (has_role(auth.uid(), 'super_admin'::app_role))
WITH CHECK (has_role(auth.uid(), 'super_admin'::app_role));
