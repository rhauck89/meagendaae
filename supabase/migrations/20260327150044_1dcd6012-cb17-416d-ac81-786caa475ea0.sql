
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS opt_in_whatsapp boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS opt_in_date timestamptz DEFAULT NULL;
