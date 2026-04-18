DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_enum WHERE enumlabel = 'past_due' AND enumtypid = 'public.subscription_status'::regtype) THEN
    ALTER TYPE public.subscription_status ADD VALUE 'past_due';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_enum WHERE enumlabel = 'expired_trial' AND enumtypid = 'public.subscription_status'::regtype) THEN
    ALTER TYPE public.subscription_status ADD VALUE 'expired_trial';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_enum WHERE enumlabel = 'unpaid' AND enumtypid = 'public.subscription_status'::regtype) THEN
    ALTER TYPE public.subscription_status ADD VALUE 'unpaid';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_enum WHERE enumlabel = 'trialing' AND enumtypid = 'public.subscription_status'::regtype) THEN
    ALTER TYPE public.subscription_status ADD VALUE 'trialing';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_enum WHERE enumlabel = 'canceled' AND enumtypid = 'public.subscription_status'::regtype) THEN
    ALTER TYPE public.subscription_status ADD VALUE 'canceled';
  END IF;
END $$;