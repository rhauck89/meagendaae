-- 1. Fix subscription_plans
ALTER TABLE public.subscription_plans 
ADD COLUMN IF NOT EXISTS limit_period text DEFAULT 'monthly',
ADD COLUMN IF NOT EXISTS commission_timing text NOT NULL DEFAULT 'none',
ADD COLUMN IF NOT EXISTS plan_commission_type text NOT NULL DEFAULT 'none',
ADD COLUMN IF NOT EXISTS plan_commission_value numeric NOT NULL DEFAULT 0,
ADD COLUMN IF NOT EXISTS quantity_available integer;

-- Add constraints if they don't exist
DO $$ 
BEGIN 
    IF NOT EXISTS (SELECT 1 FROM information_schema.constraint_column_usage WHERE constraint_name = 'subscription_plans_limit_period_check') THEN
        ALTER TABLE public.subscription_plans ADD CONSTRAINT subscription_plans_limit_period_check CHECK (limit_period IS NULL OR limit_period IN ('weekly', 'monthly'));
    END IF;
    
    IF NOT EXISTS (SELECT 1 FROM information_schema.constraint_column_usage WHERE constraint_name = 'subscription_plans_commission_timing_check') THEN
        ALTER TABLE public.subscription_plans ADD CONSTRAINT subscription_plans_commission_timing_check CHECK (commission_timing IN ('none', 'appointment_completion', 'plan_billing'));
    END IF;

    IF NOT EXISTS (SELECT 1 FROM information_schema.constraint_column_usage WHERE constraint_name = 'subscription_plans_plan_commission_type_check') THEN
        ALTER TABLE public.subscription_plans ADD CONSTRAINT subscription_plans_plan_commission_type_check CHECK (plan_commission_type IN ('none', 'percentage', 'fixed'));
    END IF;

    IF NOT EXISTS (SELECT 1 FROM information_schema.constraint_column_usage WHERE constraint_name = 'subscription_plans_quantity_available_check') THEN
        ALTER TABLE public.subscription_plans ADD CONSTRAINT subscription_plans_quantity_available_check CHECK (quantity_available IS NULL OR quantity_available >= 0);
    END IF;
END $$;

-- 2. Add payment columns to companies
ALTER TABLE public.companies
ADD COLUMN IF NOT EXISTS payment_pix_key text,
ADD COLUMN IF NOT EXISTS payment_bank_name text,
ADD COLUMN IF NOT EXISTS payment_bank_agency text,
ADD COLUMN IF NOT EXISTS payment_bank_account text,
ADD COLUMN IF NOT EXISTS payment_holder_name text,
ADD COLUMN IF NOT EXISTS payment_document text,
ADD COLUMN IF NOT EXISTS subscription_payment_notes text;

-- 3. Add reminder columns to subscription_charges
ALTER TABLE public.subscription_charges
ADD COLUMN IF NOT EXISTS whatsapp_reminder_2d_sent boolean DEFAULT false,
ADD COLUMN IF NOT EXISTS whatsapp_reminder_2d_sent_at timestamptz;

-- Refresh schema cache
SELECT pg_notify('pgrst', 'reload schema');
