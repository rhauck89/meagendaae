ALTER TABLE public.company_revenues 
ADD COLUMN recurrence_due_day INTEGER;

COMMENT ON COLUMN public.company_revenues.recurrence_due_day IS 'Dia do mês preferencial para as ocorrências da recorrência (1-31)';