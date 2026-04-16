
ALTER TABLE public.companies
  ADD COLUMN IF NOT EXISTS prof_perm_booking_mode boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS prof_perm_grid_interval boolean NOT NULL DEFAULT false;
