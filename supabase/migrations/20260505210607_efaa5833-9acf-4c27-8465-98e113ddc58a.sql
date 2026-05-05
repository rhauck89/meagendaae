-- Adicionar colunas solicitadas
ALTER TABLE public.marketplace_banners 
ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMP WITH TIME ZONE,
ADD COLUMN IF NOT EXISTS open_in_new_tab BOOLEAN DEFAULT true;

-- Garantir que RLS está habilitada
ALTER TABLE public.marketplace_banners ENABLE ROW LEVEL SECURITY;

-- Remover políticas existentes para evitar conflitos (se houver)
DROP POLICY IF EXISTS "Super admins can manage marketplace banners" ON public.marketplace_banners;
DROP POLICY IF EXISTS "Anyone can view active banners" ON public.marketplace_banners;

-- Criar políticas
CREATE POLICY "Super admins can manage marketplace banners"
ON public.marketplace_banners
FOR ALL
USING (
  EXISTS (
    SELECT 1 FROM public.profiles
    WHERE profiles.id = auth.uid()
    AND profiles.role = 'super_admin'
  )
);

CREATE POLICY "Anyone can view active banners"
ON public.marketplace_banners
FOR SELECT
USING (
  status = 'active' 
  AND deleted_at IS NULL
  AND start_date <= now()
  AND end_date >= now()
);

-- Garantir acesso ao storage para super admins
-- Nota: O bucket já deve existir da Fase 1, mas vamos garantir as políticas

DO $$
BEGIN
    INSERT INTO storage.buckets (id, name, public)
    VALUES ('marketplace-assets', 'marketplace-assets', true)
    ON CONFLICT (id) DO NOTHING;
END $$;

DROP POLICY IF EXISTS "Super admins can manage marketplace assets" ON storage.objects;
CREATE POLICY "Super admins can manage marketplace assets"
ON storage.objects
FOR ALL
USING (
  bucket_id = 'marketplace-assets' AND
  EXISTS (
    SELECT 1 FROM public.profiles
    WHERE profiles.id = auth.uid()
    AND profiles.role = 'super_admin'
  )
);

DROP POLICY IF EXISTS "Public can view marketplace assets" ON storage.objects;
CREATE POLICY "Public can view marketplace assets"
ON storage.objects
FOR SELECT
USING (bucket_id = 'marketplace-assets');
