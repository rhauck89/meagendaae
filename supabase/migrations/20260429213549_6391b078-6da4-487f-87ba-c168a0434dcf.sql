-- Criar bucket se não existir
INSERT INTO storage.buckets (id, name, public) 
VALUES ('email-assets', 'email-assets', true)
ON CONFLICT (id) DO NOTHING;

-- Política de leitura pública
CREATE POLICY "Email assets are public" 
ON storage.objects FOR SELECT 
USING (bucket_id = 'email-assets');

-- Política de upload para admins
CREATE POLICY "Admins can upload email assets" 
ON storage.objects FOR INSERT 
WITH CHECK (
    bucket_id = 'email-assets' 
    AND EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin')
);