ALTER TABLE public.collaborators 
  ADD COLUMN IF NOT EXISTS absence_start date,
  ADD COLUMN IF NOT EXISTS absence_end date,
  ADD COLUMN IF NOT EXISTS absence_type text;