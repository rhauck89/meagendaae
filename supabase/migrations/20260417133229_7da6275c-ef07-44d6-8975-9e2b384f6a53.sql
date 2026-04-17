
-- 1. Tornar bucket support-attachments privado
UPDATE storage.buckets SET public = false WHERE id = 'support-attachments';

-- 2. Backfill: extrair apenas o path em file_url (remover prefixo public URL)
UPDATE public.support_attachments
SET file_url = regexp_replace(
  file_url,
  '^https?://[^/]+/storage/v1/object/(public|sign)/support-attachments/',
  ''
)
WHERE file_url ~ '^https?://';

-- Também remover query params de signed URLs antigas, se houver
UPDATE public.support_attachments
SET file_url = split_part(file_url, '?', 1)
WHERE file_url LIKE '%?%';

-- 3. Recriar policies do bucket support-attachments para garantir acesso correto
DROP POLICY IF EXISTS "Support attachments are publicly accessible" ON storage.objects;
DROP POLICY IF EXISTS "Users can read own support attachments" ON storage.objects;
DROP POLICY IF EXISTS "Admins can read all support attachments" ON storage.objects;
DROP POLICY IF EXISTS "Users can upload support attachments" ON storage.objects;
DROP POLICY IF EXISTS "Users can delete own support attachments" ON storage.objects;

-- Usuários autenticados podem ler seus próprios anexos (pasta = user_id)
CREATE POLICY "Users can read own support attachments"
ON storage.objects
FOR SELECT
TO authenticated
USING (
  bucket_id = 'support-attachments'
  AND auth.uid()::text = (storage.foldername(name))[1]
);

-- Super admins podem ler todos os anexos
CREATE POLICY "Admins can read all support attachments"
ON storage.objects
FOR SELECT
TO authenticated
USING (
  bucket_id = 'support-attachments'
  AND public.has_role(auth.uid(), 'super_admin'::public.app_role)
);

-- Usuários autenticados podem fazer upload na própria pasta
CREATE POLICY "Users can upload support attachments"
ON storage.objects
FOR INSERT
TO authenticated
WITH CHECK (
  bucket_id = 'support-attachments'
  AND auth.uid()::text = (storage.foldername(name))[1]
);

-- Usuários podem deletar seus próprios anexos
CREATE POLICY "Users can delete own support attachments"
ON storage.objects
FOR DELETE
TO authenticated
USING (
  bucket_id = 'support-attachments'
  AND auth.uid()::text = (storage.foldername(name))[1]
);
