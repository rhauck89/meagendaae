-- Update RLS for cashback_transactions to be simpler for admins
DROP POLICY IF EXISTS "Admins/Professionals can view company cashback transactions" ON public.cashback_transactions;

CREATE POLICY "Admins/Professionals can view company cashback transactions"
ON public.cashback_transactions
FOR SELECT
TO authenticated
USING (company_id = get_my_company_id());

-- Ensure clients can view their own transactions
DROP POLICY IF EXISTS "Clients can view their own cashback transactions" ON public.cashback_transactions;

CREATE POLICY "Clients can view their own cashback transactions"
ON public.cashback_transactions
FOR SELECT
TO authenticated
USING (
    user_id = auth.uid() 
    OR client_id IN (
        SELECT id FROM public.clients WHERE user_id = auth.uid()
    )
);

-- Update get_client_portal_cashback RPC to be more robust and include reference_id
CREATE OR REPLACE FUNCTION public.get_client_portal_cashback()
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_ids uuid[];
    v_whatsapps text[];
    v_emails text[];
    v_result JSONB;
BEGIN
    -- Get unified client identity
    SELECT client_ids, whatsapps, emails INTO v_ids, v_whatsapps, v_emails FROM public.get_client_identity_v2();

    WITH active_cashback AS (
        SELECT 
            company_id,
            SUM(amount) as available
        FROM public.client_cashback
        WHERE (user_id = auth.uid() OR client_id = ANY(v_ids))
          AND status = 'active' AND (expires_at > NOW() OR expires_at IS NULL)
        GROUP BY company_id
    ),
    pending_cashback_table AS (
        SELECT 
            company_id,
            SUM(amount) as pending
        FROM public.client_cashback
        WHERE (user_id = auth.uid() OR client_id = ANY(v_ids)) AND status = 'pending'
        GROUP BY company_id
    ),
    pending_cashback_forecast AS (
        SELECT 
            a.company_id,
            SUM(
                COALESCE(a.final_price, a.total_price, 0) * 
                COALESCE(
                    p.discount_value, 
                    (SELECT discount_value FROM public.promotions p2 
                     WHERE p2.company_id = a.company_id 
                       AND p2.promotion_type = 'cashback' 
                       AND p2.status = 'active' 
                       AND p2.start_date <= (a.start_time AT TIME ZONE 'UTC')::date 
                       AND p2.end_date >= (a.start_time AT TIME ZONE 'UTC')::date
                     ORDER BY discount_value DESC LIMIT 1)
                ) / 100.0
            ) as pending
        FROM public.appointments a
        LEFT JOIN public.promotions p ON a.promotion_id = p.id
        WHERE (a.user_id = auth.uid() OR a.client_id = ANY(v_ids) OR public.normalize_whatsapp_v2(a.client_whatsapp) = ANY(v_whatsapps))
          AND a.status IN ('confirmed', 'pending')
          AND (p.promotion_type = 'cashback' OR (a.promotion_id IS NULL AND EXISTS (
              SELECT 1 FROM public.promotions p3 
              WHERE p3.company_id = a.company_id 
                AND p3.promotion_type = 'cashback' 
                AND p3.status = 'active'
                AND p3.start_date <= (a.start_time AT TIME ZONE 'UTC')::date 
                AND p3.end_date >= (a.start_time AT TIME ZONE 'UTC')::date
          )))
          AND NOT EXISTS (
              SELECT 1 FROM public.client_cashback cc 
              WHERE cc.appointment_id = a.id
          )
        GROUP BY a.company_id
    ),
    all_companies AS (
        SELECT DISTINCT company_id FROM public.client_cashback WHERE (user_id = auth.uid() OR client_id = ANY(v_ids))
        UNION
        SELECT DISTINCT company_id FROM public.appointments a 
        LEFT JOIN public.promotions p ON a.promotion_id = p.id
        WHERE (a.user_id = auth.uid() OR a.client_id = ANY(v_ids) OR public.normalize_whatsapp_v2(a.client_whatsapp) = ANY(v_whatsapps))
          AND (p.promotion_type = 'cashback' OR (a.promotion_id IS NULL AND EXISTS (
              SELECT 1 FROM public.promotions p3 
              WHERE p3.company_id = a.company_id 
                AND p3.promotion_type = 'cashback' 
                AND p3.status = 'active'
                AND p3.start_date <= (a.start_time AT TIME ZONE 'UTC')::date 
                AND p3.end_date >= (a.start_time AT TIME ZONE 'UTC')::date
          )))
    ),
    company_summary AS (
        SELECT 
            ac.company_id,
            COALESCE(active.available, 0) as available,
            COALESCE(pt.pending, 0) + COALESCE(pf.pending, 0) as pending
        FROM all_companies ac
        LEFT JOIN active_cashback active ON active.company_id = ac.company_id
        LEFT JOIN pending_cashback_table pt ON pt.company_id = ac.company_id
        LEFT JOIN pending_cashback_forecast pf ON pf.company_id = ac.company_id
    ),
    history_list AS (
        SELECT 
            t.id, t.company_id, t.amount, t.type, t.description, t.created_at, t.reference_id
        FROM public.cashback_transactions t
        WHERE (t.user_id = auth.uid() OR t.client_id = ANY(v_ids))
        
        UNION ALL
        
        -- Include forecasts in history as "pending"
        SELECT 
            a.id::text as id, a.company_id, 
            (
                COALESCE(a.final_price, a.total_price, 0) * 
                COALESCE(
                    p.discount_value, 
                    (SELECT discount_value FROM public.promotions p2 
                     WHERE p2.company_id = a.company_id 
                       AND p2.promotion_type = 'cashback' 
                       AND p2.status = 'active' 
                       AND p2.start_date <= (a.start_time AT TIME ZONE 'UTC')::date 
                       AND p2.end_date >= (a.start_time AT TIME ZONE 'UTC')::date
                     ORDER BY discount_value DESC LIMIT 1)
                ) / 100.0
            ) as amount,
            'pending'::text as type,
            'Cashback previsto (agendamento em ' || to_char(a.start_time, 'DD/MM') || ')' as description,
            a.start_time as created_at,
            a.id as reference_id
        FROM public.appointments a
        LEFT JOIN public.promotions p ON a.promotion_id = p.id
        WHERE (a.user_id = auth.uid() OR a.client_id = ANY(v_ids) OR public.normalize_whatsapp_v2(a.client_whatsapp) = ANY(v_whatsapps))
          AND a.status IN ('confirmed', 'pending')
          AND (p.promotion_type = 'cashback' OR (a.promotion_id IS NULL AND EXISTS (
              SELECT 1 FROM public.promotions p3 
              WHERE p3.company_id = a.company_id 
                AND p3.promotion_type = 'cashback' 
                AND p3.status = 'active'
                AND p3.start_date <= (a.start_time AT TIME ZONE 'UTC')::date 
                AND p3.end_date >= (a.start_time AT TIME ZONE 'UTC')::date
          )))
          AND NOT EXISTS (
              SELECT 1 FROM public.client_cashback cc 
              WHERE cc.appointment_id = a.id
          )
    )
    SELECT 
        jsonb_build_object(
            'balances', COALESCE((SELECT jsonb_object_agg(company_id, jsonb_build_object('available', available, 'pending', pending)) FROM company_summary), '{}'::jsonb),
            'history', COALESCE((SELECT jsonb_agg(h) FROM (SELECT * FROM history_list ORDER BY created_at DESC) h), '[]'::jsonb)
        ) INTO v_result;

    RETURN v_result;
END;
$$;
