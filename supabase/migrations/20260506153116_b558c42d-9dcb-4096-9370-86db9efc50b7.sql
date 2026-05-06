ALTER TABLE public.company_revenues 
ADD COLUMN is_recurring BOOLEAN DEFAULT FALSE,
ADD COLUMN recurring_group_id UUID,
ADD COLUMN recurrence_frequency TEXT,
ADD COLUMN recurrence_interval INTEGER DEFAULT 1,
ADD COLUMN recurrence_count INTEGER,
ADD COLUMN recurrence_end_date DATE,
ADD COLUMN recurrence_parent_id UUID;

COMMENT ON COLUMN public.company_revenues.recurrence_frequency IS 'Frequência da recorrência: weekly, biweekly, monthly, bimonthly, quarterly, semiannual, annual';
