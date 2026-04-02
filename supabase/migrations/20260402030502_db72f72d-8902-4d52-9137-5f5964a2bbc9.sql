
-- Add due_date and status to company_expenses
ALTER TABLE public.company_expenses 
  ADD COLUMN IF NOT EXISTS due_date date DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS status text NOT NULL DEFAULT 'pending';

-- Add due_date and status to company_revenues
ALTER TABLE public.company_revenues 
  ADD COLUMN IF NOT EXISTS due_date date DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS status text NOT NULL DEFAULT 'received';

-- Add installment tracking to company_expenses
ALTER TABLE public.company_expenses
  ADD COLUMN IF NOT EXISTS installment_number integer DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS total_installments integer DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS parent_expense_id uuid REFERENCES public.company_expenses(id) DEFAULT NULL;
