-- Ensure administrative staff salary settings create a finance expense,
-- and subscription payments always create the responsible professional commission.

ALTER TABLE public.professional_commissions
  DROP CONSTRAINT IF EXISTS professional_commissions_source_type_check;

ALTER TABLE public.professional_commissions
  ADD CONSTRAINT professional_commissions_source_type_check
  CHECK (source_type = ANY (ARRAY['service'::text, 'subscription'::text, 'subscription_charge'::text]));

ALTER TABLE public.professional_commissions
  DROP CONSTRAINT IF EXISTS professional_commissions_source_id_source_type_key;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'professional_commissions_source_id_source_type_prof_key'
  ) THEN
    ALTER TABLE public.professional_commissions
      ADD CONSTRAINT professional_commissions_source_id_source_type_prof_key
      UNIQUE (source_id, source_type, professional_id);
  END IF;
END $$;

DROP POLICY IF EXISTS "Company members can insert own commissions" ON public.professional_commissions;
CREATE POLICY "Company members can insert own commissions"
  ON public.professional_commissions FOR INSERT
  TO authenticated
  WITH CHECK (company_id = get_my_company_id());

DROP POLICY IF EXISTS "Company members can update own commissions" ON public.professional_commissions;
CREATE POLICY "Company members can update own commissions"
  ON public.professional_commissions FOR UPDATE
  TO authenticated
  USING (company_id = get_my_company_id())
  WITH CHECK (company_id = get_my_company_id());

CREATE OR REPLACE FUNCTION public.handle_subscription_commission()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
AS $function$
DECLARE
  v_sub_info RECORD;
  v_total_commission numeric;
BEGIN
  IF NEW.status = 'paid' AND (OLD.status IS NULL OR OLD.status <> 'paid') THEN
    SELECT
      cs.id,
      cs.professional_id,
      cs.professional_commission,
      cs.client_id,
      cs.company_id,
      sp.name AS plan_name
    INTO v_sub_info
    FROM public.client_subscriptions cs
    JOIN public.subscription_plans sp ON sp.id = cs.plan_id
    WHERE cs.id = NEW.subscription_id;

    IF v_sub_info.id IS NULL OR v_sub_info.professional_id IS NULL THEN
      RETURN NEW;
    END IF;

    v_total_commission := ROUND((NEW.amount * COALESCE(v_sub_info.professional_commission, 0)) / 100, 2);

    IF v_total_commission <= 0 THEN
      RETURN NEW;
    END IF;

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
      v_sub_info.company_id,
      v_sub_info.professional_id,
      v_sub_info.client_id,
      'subscription_charge',
      NEW.id,
      'Comissão Assinatura: ' || v_sub_info.plan_name,
      NEW.amount,
      'percentage',
      COALESCE(v_sub_info.professional_commission, 0),
      v_total_commission,
      NEW.amount - v_total_commission,
      COALESCE(NEW.paid_at, now()),
      'paid'
    )
    ON CONFLICT ON CONSTRAINT professional_commissions_source_id_source_type_prof_key
    DO UPDATE SET
      gross_amount = EXCLUDED.gross_amount,
      commission_rate = EXCLUDED.commission_rate,
      commission_amount = EXCLUDED.commission_amount,
      company_net_amount = EXCLUDED.company_net_amount,
      paid_at = EXCLUDED.paid_at,
      status = EXCLUDED.status,
      description = EXCLUDED.description,
      updated_at = now();
  END IF;

  RETURN NEW;
END;
$function$;

DROP TRIGGER IF EXISTS on_subscription_charge_paid ON public.subscription_charges;
CREATE TRIGGER on_subscription_charge_paid
  AFTER UPDATE ON public.subscription_charges
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_subscription_commission();

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
)
SELECT
  cs.company_id,
  cs.professional_id,
  cs.client_id,
  'subscription_charge',
  sc.id,
  'Comissão Assinatura: ' || sp.name,
  sc.amount,
  'percentage',
  COALESCE(cs.professional_commission, 0),
  ROUND((sc.amount * COALESCE(cs.professional_commission, 0)) / 100, 2),
  sc.amount - ROUND((sc.amount * COALESCE(cs.professional_commission, 0)) / 100, 2),
  COALESCE(sc.paid_at, sc.updated_at, now()),
  'paid'
FROM public.subscription_charges sc
JOIN public.client_subscriptions cs ON cs.id = sc.subscription_id
JOIN public.subscription_plans sp ON sp.id = cs.plan_id
WHERE sc.status = 'paid'
  AND cs.professional_id IS NOT NULL
  AND COALESCE(cs.professional_commission, 0) > 0
ON CONFLICT ON CONSTRAINT professional_commissions_source_id_source_type_prof_key
DO UPDATE SET
  gross_amount = EXCLUDED.gross_amount,
  commission_rate = EXCLUDED.commission_rate,
  commission_amount = EXCLUDED.commission_amount,
  company_net_amount = EXCLUDED.company_net_amount,
  paid_at = EXCLUDED.paid_at,
  status = EXCLUDED.status,
  description = EXCLUDED.description,
  updated_at = now();

CREATE OR REPLACE FUNCTION public.sync_staff_salary_expense()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
AS $function$
DECLARE
  v_category_id uuid;
  v_existing_expense_id uuid;
  v_due_date date;
  v_member_name text;
  v_created_by uuid;
  v_source_token text;
BEGIN
  IF COALESCE(NEW.is_service_provider, true) = true
     OR COALESCE(NEW.salary_auto_expense, false) = false
     OR COALESCE(NEW.salary_amount, 0) <= 0 THEN
    RETURN NEW;
  END IF;

  SELECT id INTO v_category_id
  FROM public.company_expense_categories
  WHERE company_id = NEW.company_id
    AND name IN ('Salário', 'Salários', 'Salarios')
  ORDER BY created_at
  LIMIT 1;

  IF v_category_id IS NULL THEN
    INSERT INTO public.company_expense_categories (company_id, name, type, description)
    VALUES (NEW.company_id, 'Salários', 'expense', 'Despesas de salário e pagamentos fixos da equipe')
    RETURNING id INTO v_category_id;
  END IF;

  UPDATE public.company_collaborators
  SET salary_expense_category_id = v_category_id
  WHERE company_id = NEW.company_id
    AND profile_id = NEW.profile_id
    AND salary_expense_category_id IS DISTINCT FROM v_category_id;

  SELECT full_name INTO v_member_name
  FROM public.profiles
  WHERE id = NEW.profile_id;

  SELECT user_id INTO v_created_by
  FROM public.companies
  WHERE id = NEW.company_id;

  v_due_date := COALESCE(NEW.salary_next_due_date, CURRENT_DATE);
  v_source_token := 'salary_profile_id:' || NEW.profile_id::text;

  SELECT id INTO v_existing_expense_id
  FROM public.company_expenses
  WHERE company_id = NEW.company_id
    AND notes ILIKE '%' || v_source_token || '%'
  LIMIT 1;

  IF v_existing_expense_id IS NULL THEN
    INSERT INTO public.company_expenses (
      company_id,
      description,
      amount,
      expense_date,
      due_date,
      status,
      category_id,
      is_recurring,
      recurrence_type,
      recurrence_interval,
      notes,
      created_by,
      payment_method
    ) VALUES (
      NEW.company_id,
      'Salário - ' || COALESCE(v_member_name, 'Membro da equipe'),
      NEW.salary_amount,
      v_due_date,
      v_due_date,
      'pending',
      v_category_id,
      COALESCE(NEW.salary_recurrence, 'monthly') <> 'none',
      CASE WHEN NEW.salary_recurrence = 'weekly' THEN 'weekly' ELSE 'monthly' END,
      CASE WHEN NEW.salary_recurrence = 'biweekly' THEN 2 ELSE 1 END,
      'Despesa gerada automaticamente pelo cadastro de membro da equipe. Recorrência: ' || COALESCE(NEW.salary_recurrence, 'monthly') || '. ' || v_source_token,
      v_created_by,
      NEW.salary_payment_method
    );
  ELSE
    UPDATE public.company_expenses
    SET
      description = 'Salário - ' || COALESCE(v_member_name, 'Membro da equipe'),
      amount = NEW.salary_amount,
      expense_date = v_due_date,
      due_date = v_due_date,
      category_id = v_category_id,
      is_recurring = COALESCE(NEW.salary_recurrence, 'monthly') <> 'none',
      recurrence_type = CASE WHEN NEW.salary_recurrence = 'weekly' THEN 'weekly' ELSE 'monthly' END,
      recurrence_interval = CASE WHEN NEW.salary_recurrence = 'biweekly' THEN 2 ELSE 1 END,
      payment_method = NEW.salary_payment_method,
      updated_at = now()
    WHERE id = v_existing_expense_id;
  END IF;

  RETURN NEW;
END;
$function$;

DROP TRIGGER IF EXISTS on_staff_salary_expense_sync ON public.collaborators;
CREATE TRIGGER on_staff_salary_expense_sync
  AFTER INSERT OR UPDATE OF is_service_provider, salary_auto_expense, salary_amount, salary_next_due_date, salary_recurrence, salary_payment_method
  ON public.collaborators
  FOR EACH ROW
  EXECUTE FUNCTION public.sync_staff_salary_expense();

UPDATE public.collaborators
SET salary_auto_expense = salary_auto_expense
WHERE COALESCE(is_service_provider, true) = false
  AND COALESCE(salary_auto_expense, false) = true
  AND COALESCE(salary_amount, 0) > 0;
