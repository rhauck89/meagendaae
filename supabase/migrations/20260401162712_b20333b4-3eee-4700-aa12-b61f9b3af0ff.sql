
ALTER TABLE public.plans RENAME COLUMN price TO monthly_price;
ALTER TABLE public.plans
  ADD COLUMN IF NOT EXISTS yearly_price numeric NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS yearly_discount numeric NOT NULL DEFAULT 0;
