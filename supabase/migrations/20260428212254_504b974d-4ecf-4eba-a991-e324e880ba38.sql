-- Normalize existing data to ensure digits-only format
UPDATE public.clients_global
SET whatsapp = regexp_replace(whatsapp, '\D', '', 'g')
WHERE whatsapp IS NOT NULL;

-- Add unique constraint to whatsapp column
ALTER TABLE public.clients_global
ADD CONSTRAINT unique_clients_global_whatsapp UNIQUE (whatsapp);