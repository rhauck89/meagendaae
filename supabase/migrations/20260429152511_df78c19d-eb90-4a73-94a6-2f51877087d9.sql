-- Drop the existing partial index that is blocking the constraint creation
DROP INDEX IF EXISTS public.clients_company_whatsapp_unique;
DROP INDEX IF EXISTS public.unique_client_company_whatsapp;

-- Add the unique constraint required by the ON CONFLICT clause
ALTER TABLE public.clients
ADD CONSTRAINT clients_company_whatsapp_unique UNIQUE (company_id, whatsapp);