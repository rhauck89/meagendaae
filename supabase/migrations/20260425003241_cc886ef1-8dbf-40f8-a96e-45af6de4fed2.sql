-- First, backfill missing debit transactions from client_cashback
INSERT INTO public.cashback_transactions (company_id, client_id, amount, type, reference_id, description, created_at)
SELECT 
    cc.company_id, 
    cc.client_id, 
    cc.amount, 
    'debit' as type, 
    cc.id as reference_id, 
    COALESCE('Cashback utilizado no agendamento #' || substring(cc.used_appointment_id::text from 1 for 8), 'Cashback utilizado') as description,
    cc.used_at as created_at
FROM public.client_cashback cc
WHERE cc.used_at IS NOT NULL
  AND NOT EXISTS (
    SELECT 1 FROM public.cashback_transactions ct 
    WHERE ct.reference_id = cc.id AND ct.type = 'debit'
  );

-- Backfill missing expire transactions (if any)
INSERT INTO public.cashback_transactions (company_id, client_id, amount, type, reference_id, description, created_at)
SELECT 
    cc.company_id, 
    cc.client_id, 
    cc.amount, 
    'expire' as type, 
    cc.id as reference_id, 
    'Cashback expirado' as description,
    cc.expires_at as created_at
FROM public.client_cashback cc
WHERE cc.status = 'expired'
  AND NOT EXISTS (
    SELECT 1 FROM public.cashback_transactions ct 
    WHERE ct.reference_id = cc.id AND ct.type = 'expire'
  );

-- Create trigger function to handle automated transactions
CREATE OR REPLACE FUNCTION public.handle_cashback_transaction_sync()
RETURNS TRIGGER AS $$
BEGIN
    -- If a new cashback is created (credit)
    IF (TG_OP = 'INSERT') THEN
        INSERT INTO public.cashback_transactions (company_id, client_id, amount, type, reference_id, description, created_at)
        VALUES (
            NEW.company_id,
            NEW.client_id,
            NEW.amount,
            'credit',
            NEW.id,
            'Cashback ganho',
            NEW.created_at
        );
    END IF;

    -- If cashback is updated (used or expired)
    IF (TG_OP = 'UPDATE') THEN
        -- Check if it was used
        IF (OLD.used_at IS NULL AND NEW.used_at IS NOT NULL) THEN
            INSERT INTO public.cashback_transactions (company_id, client_id, amount, type, reference_id, description, created_at)
            VALUES (
                NEW.company_id,
                NEW.client_id,
                NEW.amount,
                'debit',
                NEW.id,
                'Cashback utilizado',
                NEW.used_at
            );
        END IF;

        -- Check if it expired
        IF (OLD.status != 'expired' AND NEW.status = 'expired') THEN
            INSERT INTO public.cashback_transactions (company_id, client_id, amount, type, reference_id, description, created_at)
            VALUES (
                NEW.company_id,
                NEW.client_id,
                NEW.amount,
                'expire',
                NEW.id,
                'Cashback expirado',
                NOW()
            );
        END IF;
    END IF;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create trigger
DROP TRIGGER IF EXISTS on_cashback_change_sync_ledger ON public.client_cashback;
CREATE TRIGGER on_cashback_change_sync_ledger
AFTER INSERT OR UPDATE ON public.client_cashback
FOR EACH ROW EXECUTE FUNCTION public.handle_cashback_transaction_sync();
