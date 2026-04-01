
ALTER TABLE public.expense_categories
ADD COLUMN type text NOT NULL DEFAULT 'expense'
CHECK (type IN ('expense', 'revenue', 'both'));
