-- Drop existing unique constraint
ALTER TABLE public.professional_commissions 
DROP CONSTRAINT IF EXISTS professional_commissions_source_id_source_type_key;

-- Add new unique constraint including professional_id
ALTER TABLE public.professional_commissions 
ADD CONSTRAINT professional_commissions_source_id_source_type_prof_key 
UNIQUE (source_id, source_type, professional_id);

-- Update check constraint for source_type
ALTER TABLE public.professional_commissions 
DROP CONSTRAINT IF EXISTS professional_commissions_source_type_check;

ALTER TABLE public.professional_commissions 
ADD CONSTRAINT professional_commissions_source_type_check 
CHECK (source_type = ANY (ARRAY['service'::text, 'subscription'::text, 'subscription_charge'::text]));
