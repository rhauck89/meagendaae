
ALTER TABLE public.companies
ADD COLUMN IF NOT EXISTS prof_perm_clients boolean NOT NULL DEFAULT true,
ADD COLUMN IF NOT EXISTS prof_perm_promotions boolean NOT NULL DEFAULT true,
ADD COLUMN IF NOT EXISTS prof_perm_events boolean NOT NULL DEFAULT true,
ADD COLUMN IF NOT EXISTS prof_perm_requests boolean NOT NULL DEFAULT true,
ADD COLUMN IF NOT EXISTS prof_perm_finance boolean NOT NULL DEFAULT true;
