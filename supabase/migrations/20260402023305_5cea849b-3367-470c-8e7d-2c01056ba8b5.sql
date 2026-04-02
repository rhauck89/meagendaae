
-- Company expense categories
CREATE TABLE public.company_expense_categories (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  name text NOT NULL,
  type text NOT NULL DEFAULT 'expense',
  description text,
  created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.company_expense_categories ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Company members can manage categories" ON public.company_expense_categories FOR ALL TO authenticated
  USING (company_id = get_my_company_id()) WITH CHECK (company_id = get_my_company_id());

-- Company revenue categories
CREATE TABLE public.company_revenue_categories (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  name text NOT NULL,
  description text,
  created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.company_revenue_categories ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Company members can manage revenue categories" ON public.company_revenue_categories FOR ALL TO authenticated
  USING (company_id = get_my_company_id()) WITH CHECK (company_id = get_my_company_id());

-- Company expenses
CREATE TABLE public.company_expenses (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  description text NOT NULL,
  amount numeric NOT NULL DEFAULT 0,
  expense_date date NOT NULL DEFAULT CURRENT_DATE,
  category_id uuid REFERENCES public.company_expense_categories(id) ON DELETE SET NULL,
  is_recurring boolean NOT NULL DEFAULT false,
  recurrence_type text,
  recurrence_interval integer DEFAULT 1,
  notes text,
  created_by uuid REFERENCES auth.users(id),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.company_expenses ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Company members can manage expenses" ON public.company_expenses FOR ALL TO authenticated
  USING (company_id = get_my_company_id()) WITH CHECK (company_id = get_my_company_id());

-- Company revenues (manual entries)
CREATE TABLE public.company_revenues (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  description text NOT NULL,
  amount numeric NOT NULL DEFAULT 0,
  revenue_date date NOT NULL DEFAULT CURRENT_DATE,
  category_id uuid REFERENCES public.company_revenue_categories(id) ON DELETE SET NULL,
  appointment_id uuid REFERENCES public.appointments(id) ON DELETE SET NULL,
  professional_id uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  service_id uuid REFERENCES public.services(id) ON DELETE SET NULL,
  is_automatic boolean NOT NULL DEFAULT false,
  notes text,
  created_by uuid REFERENCES auth.users(id),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.company_revenues ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Company members can manage revenues" ON public.company_revenues FOR ALL TO authenticated
  USING (company_id = get_my_company_id()) WITH CHECK (company_id = get_my_company_id());

-- Indexes
CREATE INDEX idx_company_expenses_company ON public.company_expenses(company_id);
CREATE INDEX idx_company_expenses_date ON public.company_expenses(company_id, expense_date);
CREATE INDEX idx_company_revenues_company ON public.company_revenues(company_id);
CREATE INDEX idx_company_revenues_date ON public.company_revenues(company_id, revenue_date);
CREATE INDEX idx_company_revenues_appointment ON public.company_revenues(appointment_id);
CREATE INDEX idx_company_expense_categories_company ON public.company_expense_categories(company_id);
CREATE INDEX idx_company_revenue_categories_company ON public.company_revenue_categories(company_id);
