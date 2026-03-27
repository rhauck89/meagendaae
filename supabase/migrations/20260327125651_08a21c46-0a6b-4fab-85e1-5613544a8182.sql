
-- Create commission type enum
CREATE TYPE public.commission_type AS ENUM ('percentage', 'fixed', 'none');

-- Add commission_type and commission_value to collaborators
ALTER TABLE public.collaborators 
  ADD COLUMN IF NOT EXISTS commission_type public.commission_type NOT NULL DEFAULT 'percentage',
  ADD COLUMN IF NOT EXISTS commission_value numeric NOT NULL DEFAULT 0;
