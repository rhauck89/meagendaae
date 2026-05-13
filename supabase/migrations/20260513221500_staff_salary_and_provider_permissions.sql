-- Persist team-member access rules and optional payroll expense settings.
ALTER TABLE public.collaborators
  ADD COLUMN IF NOT EXISTS is_service_provider boolean NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS permissions jsonb NOT NULL DEFAULT '{}'::jsonb,
  ADD COLUMN IF NOT EXISTS salary_amount numeric NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS salary_payment_day integer,
  ADD COLUMN IF NOT EXISTS salary_next_due_date date,
  ADD COLUMN IF NOT EXISTS salary_recurrence text NOT NULL DEFAULT 'monthly',
  ADD COLUMN IF NOT EXISTS salary_payment_method text,
  ADD COLUMN IF NOT EXISTS salary_auto_expense boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS salary_expense_category_id uuid REFERENCES public.company_expense_categories(id) ON DELETE SET NULL;

ALTER TABLE public.company_collaborators
  ADD COLUMN IF NOT EXISTS salary_amount numeric NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS salary_payment_day integer,
  ADD COLUMN IF NOT EXISTS salary_next_due_date date,
  ADD COLUMN IF NOT EXISTS salary_recurrence text NOT NULL DEFAULT 'monthly',
  ADD COLUMN IF NOT EXISTS salary_payment_method text,
  ADD COLUMN IF NOT EXISTS salary_auto_expense boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS salary_expense_category_id uuid REFERENCES public.company_expense_categories(id) ON DELETE SET NULL;

ALTER TABLE public.collaborators
  DROP CONSTRAINT IF EXISTS collaborators_salary_payment_day_check,
  ADD CONSTRAINT collaborators_salary_payment_day_check
    CHECK (salary_payment_day IS NULL OR (salary_payment_day BETWEEN 1 AND 31));

ALTER TABLE public.company_collaborators
  DROP CONSTRAINT IF EXISTS company_collaborators_salary_payment_day_check,
  ADD CONSTRAINT company_collaborators_salary_payment_day_check
    CHECK (salary_payment_day IS NULL OR (salary_payment_day BETWEEN 1 AND 31));

ALTER TABLE public.collaborators
  DROP CONSTRAINT IF EXISTS collaborators_salary_recurrence_check,
  ADD CONSTRAINT collaborators_salary_recurrence_check
    CHECK (salary_recurrence IN ('none', 'weekly', 'biweekly', 'monthly'));

ALTER TABLE public.company_collaborators
  DROP CONSTRAINT IF EXISTS company_collaborators_salary_recurrence_check,
  ADD CONSTRAINT company_collaborators_salary_recurrence_check
    CHECK (salary_recurrence IN ('none', 'weekly', 'biweekly', 'monthly'));

-- Existing collaborators are service providers unless the admin changes them.
UPDATE public.collaborators
SET is_service_provider = true
WHERE is_service_provider IS NULL;

UPDATE public.company_collaborators cc
SET
  is_service_provider = COALESCE(c.is_service_provider, cc.is_service_provider, true),
  permissions = COALESCE(NULLIF(c.permissions, '{}'::jsonb), cc.permissions, '{}'::jsonb)
FROM public.collaborators c
WHERE c.company_id = cc.company_id
  AND c.profile_id = cc.profile_id;

-- Keep a default "Salários" expense category available for every company.
INSERT INTO public.company_expense_categories (company_id, name, type, description)
SELECT c.id, 'Salários', 'expense', 'Despesas de salário e pagamentos fixos da equipe'
FROM public.companies c
WHERE NOT EXISTS (
  SELECT 1
  FROM public.company_expense_categories cat
  WHERE cat.company_id = c.id
    AND lower(cat.name) IN ('salário', 'salários', 'salarios')
);
