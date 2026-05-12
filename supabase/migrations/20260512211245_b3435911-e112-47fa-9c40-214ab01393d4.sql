-- Add is_subscription_covered to appointments
ALTER TABLE public.appointments 
ADD COLUMN IF NOT EXISTS is_subscription_covered BOOLEAN DEFAULT false;

-- Create professional_commissions table
CREATE TABLE IF NOT EXISTS public.professional_commissions (
    id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
    company_id UUID NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
    professional_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    client_id UUID REFERENCES public.clients(id) ON DELETE SET NULL,
    source_type TEXT NOT NULL CHECK (source_type IN ('service', 'subscription')),
    source_id UUID NOT NULL, -- appointment_id or subscription_charge_id
    description TEXT,
    gross_amount NUMERIC NOT NULL DEFAULT 0,
    commission_type TEXT NOT NULL, -- 'percentage', 'fixed', 'own_revenue', 'none'
    commission_rate NUMERIC NOT NULL DEFAULT 0,
    commission_amount NUMERIC NOT NULL DEFAULT 0,
    company_net_amount NUMERIC NOT NULL DEFAULT 0,
    paid_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
    status TEXT DEFAULT 'paid',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
    UNIQUE(source_id, source_type)
);

-- Enable RLS
ALTER TABLE public.professional_commissions ENABLE ROW LEVEL SECURITY;

-- Policies
CREATE POLICY "Users can view their own company's commissions" 
ON public.professional_commissions 
FOR SELECT 
USING (auth.uid() IN (
    SELECT profile_id FROM public.collaborators WHERE company_id = professional_commissions.company_id
) OR auth.uid() = professional_id);

CREATE POLICY "Admins can manage commissions" 
ON public.professional_commissions 
FOR ALL 
USING (EXISTS (
    SELECT 1 FROM public.profiles 
    WHERE id = auth.uid() AND (role = 'admin' OR role = 'owner')
));

-- Function to handle subscription payment commissions
CREATE OR REPLACE FUNCTION public.handle_subscription_commission()
RETURNS TRIGGER AS $$
DECLARE
    v_sub_info RECORD;
    v_prof_id UUID;
    v_prof_comm NUMERIC;
    v_comm_amount NUMERIC;
    v_company_net NUMERIC;
    v_client_id UUID;
    v_plan_name TEXT;
    v_prof_name TEXT;
BEGIN
    -- Only proceed if status changed to 'paid'
    IF (NEW.status = 'paid' AND (OLD.status IS NULL OR OLD.status != 'paid')) THEN
        -- Get subscription info
        SELECT cs.professional_id, cs.professional_commission, cs.client_id, sp.name as plan_name, p.full_name as prof_name
        INTO v_sub_info
        FROM public.client_subscriptions cs
        JOIN public.subscription_plans sp ON sp.id = cs.plan_id
        LEFT JOIN public.profiles p ON p.id = cs.professional_id
        WHERE cs.id = NEW.subscription_id;

        IF v_sub_info.professional_id IS NOT NULL THEN
            -- Calculate commission
            v_comm_amount := (NEW.amount * COALESCE(v_sub_info.professional_commission, 0)) / 100;
            v_company_net := NEW.amount - v_comm_amount;

            -- Insert commission record
            INSERT INTO public.professional_commissions (
                company_id,
                professional_id,
                client_id,
                source_type,
                source_id,
                description,
                gross_amount,
                commission_type,
                commission_rate,
                commission_amount,
                company_net_amount,
                paid_at,
                status
            ) VALUES (
                NEW.company_id,
                v_sub_info.professional_id,
                v_sub_info.client_id,
                'subscription',
                NEW.id,
                'Assinatura: ' || v_sub_info.plan_name,
                NEW.amount,
                'percentage',
                COALESCE(v_sub_info.professional_commission, 0),
                v_comm_amount,
                v_company_net,
                NEW.paid_at,
                'paid'
            ) ON CONFLICT (source_id, source_type) DO NOTHING;
        END IF;
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Trigger for subscription_charges
DROP TRIGGER IF EXISTS on_subscription_charge_paid ON public.subscription_charges;
CREATE TRIGGER on_subscription_charge_paid
AFTER UPDATE ON public.subscription_charges
FOR EACH ROW
EXECUTE FUNCTION public.handle_subscription_commission();
