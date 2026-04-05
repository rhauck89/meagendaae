
-- Amenities catalog table
CREATE TABLE public.amenities (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  name text NOT NULL,
  icon text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.amenities ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Public can view amenities" ON public.amenities FOR SELECT TO public USING (true);
CREATE POLICY "Super admins can manage amenities" ON public.amenities FOR ALL TO authenticated USING (has_role(auth.uid(), 'super_admin'::app_role)) WITH CHECK (has_role(auth.uid(), 'super_admin'::app_role));

-- Company amenities junction table
CREATE TABLE public.company_amenities (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  company_id uuid NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  amenity_id uuid NOT NULL REFERENCES public.amenities(id) ON DELETE CASCADE,
  is_featured boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(company_id, amenity_id)
);

ALTER TABLE public.company_amenities ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Company members can manage amenities" ON public.company_amenities FOR ALL TO authenticated USING (company_id = get_my_company_id()) WITH CHECK (company_id = get_my_company_id());
CREATE POLICY "Public can view company amenities" ON public.company_amenities FOR SELECT TO public USING (true);

-- Seed amenities catalog
INSERT INTO public.amenities (name, icon) VALUES
  ('Poltrona', 'armchair'),
  ('TV', 'tv'),
  ('Wi-Fi', 'wifi'),
  ('Tomadas', 'plug'),
  ('Sinuca', 'target'),
  ('Vídeo game', 'gamepad-2'),
  ('Fliperama', 'joystick'),
  ('Café', 'coffee'),
  ('Geladeira de bebidas', 'beer'),
  ('Toalha quente', 'flame'),
  ('Massagem facial', 'hand'),
  ('Estacionamento', 'car'),
  ('Acessibilidade', 'accessibility'),
  ('Fraldário', 'baby'),
  ('Espaço kids', 'blocks'),
  ('Área externa', 'trees'),
  ('Bar interno', 'wine'),
  ('Garçom', 'concierge-bell'),
  ('Mesas lounge', 'sofa'),
  ('Plano de assinatura', 'credit-card'),
  ('Ambiente climatizado', 'snowflake');
