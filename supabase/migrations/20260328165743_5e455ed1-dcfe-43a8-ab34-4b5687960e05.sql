ALTER TABLE public.clients
DROP CONSTRAINT IF EXISTS clients_cpf_key;

ALTER TABLE public.clients
DROP CONSTRAINT IF EXISTS clients_whatsapp_key;

DROP INDEX IF EXISTS public.clients_whatsapp_key;

CREATE UNIQUE INDEX IF NOT EXISTS idx_clients_company_cpf
ON public.clients(company_id, cpf)
WHERE cpf IS NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS idx_clients_company_whatsapp
ON public.clients(company_id, whatsapp)
WHERE whatsapp IS NOT NULL;