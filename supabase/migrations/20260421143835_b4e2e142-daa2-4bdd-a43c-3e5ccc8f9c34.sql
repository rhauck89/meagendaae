-- 1. New columns (all nullable / safe defaults so existing rows are not broken)
ALTER TABLE public.collaborators
  ADD COLUMN IF NOT EXISTS business_model text,
  ADD COLUMN IF NOT EXISTS rent_amount numeric NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS rent_cycle text,
  ADD COLUMN IF NOT EXISTS partner_equity_percent numeric NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS partner_revenue_mode text;

-- 2. Constraints (only valid values when set)
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'collaborators_business_model_check') THEN
    ALTER TABLE public.collaborators
      ADD CONSTRAINT collaborators_business_model_check
      CHECK (business_model IS NULL OR business_model IN (
        'employee','partner_commission','chair_rental','investor_partner','operating_partner','external'
      ));
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'collaborators_rent_cycle_check') THEN
    ALTER TABLE public.collaborators
      ADD CONSTRAINT collaborators_rent_cycle_check
      CHECK (rent_cycle IS NULL OR rent_cycle IN ('daily','weekly','monthly'));
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'collaborators_partner_revenue_mode_check') THEN
    ALTER TABLE public.collaborators
      ADD CONSTRAINT collaborators_partner_revenue_mode_check
      CHECK (partner_revenue_mode IS NULL OR partner_revenue_mode IN (
        'individual','shared','percent_to_company'
      ));
  END IF;
END$$;

-- 3. Migrate existing data into the new taxonomy
-- Comissionado com comissão (% ou fixo) -> partner_commission
UPDATE public.collaborators
SET business_model = 'partner_commission'
WHERE business_model IS NULL
  AND collaborator_type = 'commissioned'
  AND commission_type IN ('percentage','fixed');

-- Independente -> chair_rental (sem valor de aluguel ainda; admin preenche depois)
UPDATE public.collaborators
SET business_model = 'chair_rental',
    rent_cycle = COALESCE(rent_cycle, 'monthly')
WHERE business_model IS NULL
  AND collaborator_type = 'independent';

-- Sócio com own_revenue -> operating_partner / individual
UPDATE public.collaborators
SET business_model = 'operating_partner',
    partner_revenue_mode = 'individual'
WHERE business_model IS NULL
  AND collaborator_type = 'partner'
  AND commission_type = 'own_revenue';

-- Sócio com comissão -> operating_partner / percent_to_company
UPDATE public.collaborators
SET business_model = 'operating_partner',
    partner_revenue_mode = 'percent_to_company'
WHERE business_model IS NULL
  AND collaborator_type = 'partner'
  AND commission_type IN ('percentage','fixed');

-- Sócio sem comissão -> operating_partner / individual (assume produção própria)
UPDATE public.collaborators
SET business_model = 'operating_partner',
    partner_revenue_mode = 'individual'
WHERE business_model IS NULL
  AND collaborator_type = 'partner'
  AND commission_type = 'none';

-- Comissionado / Independente sem comissão -> employee
UPDATE public.collaborators
SET business_model = 'employee'
WHERE business_model IS NULL
  AND commission_type = 'none';

-- Catch-all (sem own_revenue restante) -> employee
UPDATE public.collaborators
SET business_model = 'employee'
WHERE business_model IS NULL;