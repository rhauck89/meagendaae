ALTER TABLE public.clients
ADD CONSTRAINT clients_company_user_unique
UNIQUE (company_id, user_id);