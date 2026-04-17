-- 1. Criar tabela company_billing
CREATE TABLE IF NOT EXISTS public.company_billing (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL UNIQUE REFERENCES public.companies(id) ON DELETE CASCADE,
  stripe_customer_id TEXT,
  stripe_subscription_id TEXT,
  subscription_status public.subscription_status NOT NULL DEFAULT 'trial',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 2. Migrar dados existentes
INSERT INTO public.company_billing (company_id, stripe_customer_id, stripe_subscription_id, subscription_status)
SELECT id, stripe_customer_id, stripe_subscription_id, subscription_status
FROM public.companies
ON CONFLICT (company_id) DO NOTHING;

-- 3. Habilitar RLS
ALTER TABLE public.company_billing ENABLE ROW LEVEL SECURITY;

-- 4. Policies: apenas owner vê/gerencia, super_admin gerencia tudo
CREATE POLICY "Owner can view billing"
ON public.company_billing
FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.companies c
    WHERE c.id = company_billing.company_id
    AND c.owner_id = auth.uid()
  )
);

CREATE POLICY "Owner can update billing"
ON public.company_billing
FOR UPDATE
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.companies c
    WHERE c.id = company_billing.company_id
    AND c.owner_id = auth.uid()
  )
);

CREATE POLICY "Super admins can manage billing"
ON public.company_billing
FOR ALL
TO authenticated
USING (public.has_role(auth.uid(), 'super_admin'::public.app_role))
WITH CHECK (public.has_role(auth.uid(), 'super_admin'::public.app_role));

-- 5. Trigger updated_at
CREATE TRIGGER update_company_billing_updated_at
BEFORE UPDATE ON public.company_billing
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- 6. Sincronizar mudanças futuras de companies → company_billing (compatibilidade)
CREATE OR REPLACE FUNCTION public.sync_company_billing()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.company_billing (company_id, stripe_customer_id, stripe_subscription_id, subscription_status)
  VALUES (NEW.id, NEW.stripe_customer_id, NEW.stripe_subscription_id, NEW.subscription_status)
  ON CONFLICT (company_id) DO UPDATE SET
    stripe_customer_id = EXCLUDED.stripe_customer_id,
    stripe_subscription_id = EXCLUDED.stripe_subscription_id,
    subscription_status = EXCLUDED.subscription_status,
    updated_at = now();
  RETURN NEW;
END;
$$;

CREATE TRIGGER sync_billing_on_company_change
AFTER INSERT OR UPDATE OF stripe_customer_id, stripe_subscription_id, subscription_status
ON public.companies
FOR EACH ROW EXECUTE FUNCTION public.sync_company_billing();

-- 7. Reforçar collaborators: garantir que UPDATE/DELETE apenas para admin/super_admin
-- A policy "Admins can manage collaborators" já cobre ALL para admin da empresa.
-- A policy "Super admins can manage collaborators" já cobre super_admin.
-- A policy "Collaborators can view own record" é apenas SELECT — mantida.
-- Adicionamos uma policy restritiva para garantir que SELECT-only "Collaborators can view own record"
-- nunca permita UPDATE/DELETE (RLS já bloqueia, mas tornamos explícito).
-- Nada a alterar — política atual já está correta.

-- Comentário documentando intenção
COMMENT ON TABLE public.company_billing IS 'Dados sensíveis de cobrança Stripe. Acesso restrito ao owner da empresa e super_admins.';