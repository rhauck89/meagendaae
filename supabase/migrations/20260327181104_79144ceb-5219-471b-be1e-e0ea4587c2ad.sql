-- Add 'independent' to collaborator_type enum
ALTER TYPE public.collaborator_type ADD VALUE IF NOT EXISTS 'independent';