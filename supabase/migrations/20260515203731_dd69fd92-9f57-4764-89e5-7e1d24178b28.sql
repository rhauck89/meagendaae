-- Configure the live Stripe catalog created for Me Agendae.
-- The Paddle columns are kept for history/backward compatibility, but new checkout uses Stripe IDs.

ALTER TABLE public.plans
  ADD COLUMN IF NOT EXISTS stripe_product_id text,
  ADD COLUMN IF NOT EXISTS stripe_monthly_price_id text,
  ADD COLUMN IF NOT EXISTS stripe_yearly_price_id text;

ALTER TABLE public.plan_modules
  ADD COLUMN IF NOT EXISTS stripe_product_id text,
  ADD COLUMN IF NOT EXISTS stripe_monthly_price_id text,
  ADD COLUMN IF NOT EXISTS stripe_yearly_price_id text;

ALTER TABLE public.subscription_events
  ADD COLUMN IF NOT EXISTS stripe_event_id text,
  ADD COLUMN IF NOT EXISTS stripe_subscription_id text,
  ADD COLUMN IF NOT EXISTS stripe_customer_id text;

CREATE UNIQUE INDEX IF NOT EXISTS idx_subscription_events_stripe_event
  ON public.subscription_events(stripe_event_id)
  WHERE stripe_event_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_subscription_events_stripe_sub
  ON public.subscription_events(stripe_subscription_id);

CREATE INDEX IF NOT EXISTS idx_companies_stripe_subscription
  ON public.companies(stripe_subscription_id);

CREATE INDEX IF NOT EXISTS idx_companies_stripe_customer
  ON public.companies(stripe_customer_id);

UPDATE public.plans
SET stripe_product_id = 'prod_UWUrZ77ikpuNhz',
    stripe_monthly_price_id = 'price_1TXRrL0AAFnrUpPVNolUe8Lt',
    stripe_yearly_price_id = 'price_1TXRrM0AAFnrUpPVxukCbwuE'
WHERE slug = 'solo';

UPDATE public.plans
SET stripe_product_id = 'prod_UWUrX8Lp7sJJop',
    stripe_monthly_price_id = 'price_1TXRsd0AAFnrUpPVgdiPN9ih',
    stripe_yearly_price_id = 'price_1TXRsd0AAFnrUpPVb1HQescf'
WHERE slug = 'studio';

UPDATE public.plans
SET stripe_product_id = 'prod_UWUsQBEvfy0PoP',
    stripe_monthly_price_id = 'price_1TXRse0AAFnrUpPV2v8loVLA',
    stripe_yearly_price_id = 'price_1TXRsf0AAFnrUpPVDAnFTZOJ'
WHERE slug = 'elite';

UPDATE public.plans
SET stripe_product_id = 'prod_UWUsVjMU2H0oRx',
    stripe_monthly_price_id = 'price_1TXRsf0AAFnrUpPVn4V7wl08',
    stripe_yearly_price_id = 'price_1TXRsg0AAFnrUpPV8nyzC7OM'
WHERE slug = 'black';

UPDATE public.plan_modules
SET stripe_product_id = 'prod_UWV5kCpLxRsi2L',
    stripe_monthly_price_id = 'price_1TXS540AAFnrUpPV4fsIHn6c',
    stripe_yearly_price_id = NULL,
    price_monthly = 10,
    price_yearly = 120
WHERE slug = 'marketplace-featured-medium';

UPDATE public.plan_modules
SET stripe_product_id = 'prod_UWV5KicgK5AEKr',
    stripe_monthly_price_id = 'price_1TXS560AAFnrUpPVQH0nMXae',
    stripe_yearly_price_id = NULL,
    price_monthly = 18,
    price_yearly = 216
WHERE slug = 'marketplace-featured-max';