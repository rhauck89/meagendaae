ALTER TABLE public.expenses
  ADD COLUMN is_recurring boolean NOT NULL DEFAULT false,
  ADD COLUMN recurrence_type text DEFAULT NULL,
  ADD COLUMN recurrence_interval integer DEFAULT 1,
  ADD COLUMN recurrence_count integer DEFAULT NULL,
  ADD COLUMN recurrence_end_date date DEFAULT NULL,
  ADD COLUMN parent_recurring_id uuid DEFAULT NULL REFERENCES public.expenses(id) ON DELETE SET NULL;

ALTER TABLE public.manual_revenues
  ADD COLUMN is_recurring boolean NOT NULL DEFAULT false,
  ADD COLUMN recurrence_type text DEFAULT NULL,
  ADD COLUMN recurrence_interval integer DEFAULT 1,
  ADD COLUMN recurrence_count integer DEFAULT NULL,
  ADD COLUMN recurrence_end_date date DEFAULT NULL,
  ADD COLUMN parent_recurring_id uuid DEFAULT NULL REFERENCES public.manual_revenues(id) ON DELETE SET NULL;