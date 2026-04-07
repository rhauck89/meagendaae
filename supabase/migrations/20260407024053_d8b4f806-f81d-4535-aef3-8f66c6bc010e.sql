
-- Add own_revenue to commission_type enum
ALTER TYPE public.commission_type ADD VALUE IF NOT EXISTS 'own_revenue';

-- Add has_system_access and use_company_banner columns to collaborators
ALTER TABLE public.collaborators 
  ADD COLUMN IF NOT EXISTS has_system_access boolean NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS use_company_banner boolean NOT NULL DEFAULT true;
