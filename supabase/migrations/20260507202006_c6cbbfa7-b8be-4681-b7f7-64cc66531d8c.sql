-- Create subscription_plans table
CREATE TABLE public.subscription_plans (
    id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
    company_id UUID NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    description TEXT,
    price_monthly NUMERIC(10, 2) NOT NULL DEFAULT 0.00,
    price_yearly NUMERIC(10, 2),
    type TEXT NOT NULL CHECK (type IN ('limited', 'unlimited')),
    usage_limit INTEGER, -- NULL for unlimited if type is unlimited, but rule says even unlimited respects included services
    included_services UUID[] DEFAULT '{}', -- Array of service IDs
    observations TEXT,
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create client_subscriptions table
CREATE TABLE public.client_subscriptions (
    id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
    company_id UUID NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
    client_id UUID NOT NULL REFERENCES public.clients(id) ON DELETE CASCADE,
    plan_id UUID NOT NULL REFERENCES public.subscription_plans(id) ON DELETE RESTRICT,
    professional_id UUID REFERENCES public.profiles(id) ON DELETE SET NULL, -- Responsible professional
    professional_commission NUMERIC(5, 2) DEFAULT 0.00, -- Commission %
    billing_cycle TEXT NOT NULL CHECK (billing_cycle IN ('monthly', 'yearly')),
    start_date DATE NOT NULL DEFAULT CURRENT_DATE,
    end_date DATE,
    billing_day INTEGER NOT NULL CHECK (billing_day >= 1 AND billing_day <= 31),
    grace_period_days INTEGER DEFAULT 0,
    status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'suspended', 'cancelled', 'expired', 'past_due')),
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create subscription_charges table
CREATE TABLE public.subscription_charges (
    id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
    company_id UUID NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
    subscription_id UUID NOT NULL REFERENCES public.client_subscriptions(id) ON DELETE CASCADE,
    charge_number TEXT, -- Optional human-readable number
    due_date DATE NOT NULL,
    amount NUMERIC(10, 2) NOT NULL,
    status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'paid', 'overdue', 'cancelled')),
    paid_at TIMESTAMP WITH TIME ZONE,
    payment_method TEXT,
    revenue_id UUID, -- Reference to the finance/revenues table when paid
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create subscription_usage table
CREATE TABLE public.subscription_usage (
    id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
    company_id UUID NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
    subscription_id UUID NOT NULL REFERENCES public.client_subscriptions(id) ON DELETE CASCADE,
    appointment_id UUID NOT NULL REFERENCES public.appointments(id) ON DELETE CASCADE,
    service_id UUID NOT NULL REFERENCES public.services(id) ON DELETE CASCADE,
    usage_date DATE NOT NULL DEFAULT CURRENT_DATE,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.subscription_plans ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.client_subscriptions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.subscription_charges ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.subscription_usage ENABLE ROW LEVEL SECURITY;

-- Policies for subscription_plans
CREATE POLICY "Users can view their company's subscription plans"
ON public.subscription_plans FOR SELECT
USING (company_id IN (SELECT company_id FROM public.profiles WHERE id = auth.uid()));

CREATE POLICY "Users can manage their company's subscription plans"
ON public.subscription_plans FOR ALL
USING (company_id IN (SELECT company_id FROM public.profiles WHERE id = auth.uid()));

-- Policies for client_subscriptions
CREATE POLICY "Users can view their company's client subscriptions"
ON public.client_subscriptions FOR SELECT
USING (company_id IN (SELECT company_id FROM public.profiles WHERE id = auth.uid()));

CREATE POLICY "Users can manage their company's client subscriptions"
ON public.client_subscriptions FOR ALL
USING (company_id IN (SELECT company_id FROM public.profiles WHERE id = auth.uid()));

-- Policies for subscription_charges
CREATE POLICY "Users can view their company's subscription charges"
ON public.subscription_charges FOR SELECT
USING (company_id IN (SELECT company_id FROM public.profiles WHERE id = auth.uid()));

CREATE POLICY "Users can manage their company's subscription charges"
ON public.subscription_charges FOR ALL
USING (company_id IN (SELECT company_id FROM public.profiles WHERE id = auth.uid()));

-- Policies for subscription_usage
CREATE POLICY "Users can view their company's subscription usage"
ON public.subscription_usage FOR SELECT
USING (company_id IN (SELECT company_id FROM public.profiles WHERE id = auth.uid()));

CREATE POLICY "Users can manage their company's subscription usage"
ON public.subscription_usage FOR ALL
USING (company_id IN (SELECT company_id FROM public.profiles WHERE id = auth.uid()));

-- Trigger for updated_at
CREATE OR REPLACE FUNCTION public.handle_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = now();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_subscription_plans_updated_at
BEFORE UPDATE ON public.subscription_plans
FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

CREATE TRIGGER update_client_subscriptions_updated_at
BEFORE UPDATE ON public.client_subscriptions
FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

CREATE TRIGGER update_subscription_charges_updated_at
BEFORE UPDATE ON public.subscription_charges
FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

-- Indexes for performance
CREATE INDEX idx_sub_plans_company ON public.subscription_plans(company_id);
CREATE INDEX idx_client_subs_company ON public.client_subscriptions(company_id);
CREATE INDEX idx_client_subs_client ON public.client_subscriptions(client_id);
CREATE INDEX idx_sub_charges_subscription ON public.subscription_charges(subscription_id);
CREATE INDEX idx_sub_usage_subscription ON public.subscription_usage(subscription_id);
CREATE INDEX idx_sub_usage_appointment ON public.subscription_usage(appointment_id);
