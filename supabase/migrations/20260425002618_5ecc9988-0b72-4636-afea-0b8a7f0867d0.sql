-- Create cashback_transactions table
CREATE TABLE IF NOT EXISTS public.cashback_transactions (
    id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
    company_id UUID NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
    client_id UUID NOT NULL REFERENCES public.clients(id) ON DELETE CASCADE,
    amount NUMERIC NOT NULL,
    type TEXT NOT NULL CHECK (type IN ('credit', 'debit', 'expiration')),
    reference_id UUID, -- appointment_id or other reference
    description TEXT,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.cashback_transactions ENABLE ROW LEVEL SECURITY;

-- RLS Policies
CREATE POLICY "Clients can view their own cashback transactions"
ON public.cashback_transactions
FOR SELECT
USING (
    EXISTS (
        SELECT 1 FROM public.clients c
        WHERE c.id = cashback_transactions.client_id
        AND c.user_id = auth.uid()
    )
);

CREATE POLICY "Admins/Professionals can view company cashback transactions"
ON public.cashback_transactions
FOR SELECT
USING (
    EXISTS (
        SELECT 1 FROM public.profiles p
        WHERE p.user_id = auth.uid()
        AND (p.role = 'admin' OR p.role = 'professional')
        AND EXISTS (
            SELECT 1 FROM public.collaborators col
            WHERE col.profile_id = p.id
            AND col.company_id = cashback_transactions.company_id
        )
    )
);

-- Backfill from client_cashback
-- 1. Credits (all existing records were credits)
INSERT INTO public.cashback_transactions (company_id, client_id, amount, type, reference_id, description, created_at)
SELECT 
    company_id, 
    client_id, 
    amount, 
    'credit', 
    appointment_id, 
    'Cashback ganho no agendamento', 
    created_at
FROM public.client_cashback;

-- 2. Debits (for records marked as used)
INSERT INTO public.cashback_transactions (company_id, client_id, amount, type, reference_id, description, created_at)
SELECT 
    company_id, 
    client_id, 
    amount, 
    'debit', 
    used_appointment_id, 
    'Cashback utilizado no agendamento', 
    used_at
FROM public.client_cashback
WHERE status = 'used' AND used_at IS NOT NULL;

-- 3. Expirations (for records that are past their expiry date and not used)
INSERT INTO public.cashback_transactions (company_id, client_id, amount, type, description, created_at)
SELECT 
    company_id, 
    client_id, 
    amount, 
    'expiration', 
    'Cashback expirado', 
    expires_at
FROM public.client_cashback
WHERE expires_at < now() AND status != 'used';
