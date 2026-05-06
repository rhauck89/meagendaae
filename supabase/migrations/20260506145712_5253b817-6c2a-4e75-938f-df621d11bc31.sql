-- Fix type mismatch in get_client_portal_cashback
CREATE OR REPLACE FUNCTION public.get_client_portal_cashback()
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
 AS $function$
 DECLARE
     v_ids uuid[];
     v_whatsapps text[];
     v_emails text[];
     v_result JSONB;
 BEGIN
     -- Get unified client identity
     SELECT client_ids, whatsapps, emails INTO v_ids, v_whatsapps, v_emails FROM public.get_client_identity_v2();
 
     WITH active_cash_list AS (
         SELECT 
             cc1.company_id as cid,
             SUM(cc1.amount) as avail
         FROM public.client_cashback cc1
         WHERE (cc1.user_id = auth.uid() OR cc1.client_id = ANY(v_ids))
           AND cc1.status = 'active' AND (cc1.expires_at > NOW() OR cc1.expires_at IS NULL)
         GROUP BY cc1.company_id
     ),
     pending_cash_table AS (
         SELECT 
             cc2.company_id as cid,
             SUM(cc2.amount) as pend
         FROM public.client_cashback cc2
         WHERE (cc2.user_id = auth.uid() OR cc2.client_id = ANY(v_ids)) AND cc2.status = 'pending'
         GROUP BY cc2.company_id
     ),
     pending_cash_forecast AS (
         SELECT 
             a1.company_id as cid,
             SUM(
                 COALESCE(a1.final_price, a1.total_price, 0) * 
                 COALESCE(
                     p1.discount_value, 
                     (SELECT p2.discount_value FROM public.promotions p2 
                      WHERE p2.company_id = a1.company_id 
                        AND p2.promotion_type = 'cashback' 
                        AND p2.status = 'active' 
                        AND p2.start_date <= (a1.start_time AT TIME ZONE 'UTC')::date 
                        AND p2.end_date >= (a1.start_time AT TIME ZONE 'UTC')::date
                      ORDER BY p2.discount_value DESC LIMIT 1)
                 ) / 100.0
             ) as forecast_pend
         FROM public.appointments a1
         LEFT JOIN public.promotions p1 ON a1.promotion_id = p1.id
         WHERE (a1.user_id = auth.uid() OR a1.client_id = ANY(v_ids) OR public.normalize_whatsapp_v2(a1.client_whatsapp) = ANY(v_whatsapps))
           AND a1.status IN ('confirmed', 'pending')
           AND (p1.promotion_type = 'cashback' OR (a1.promotion_id IS NULL AND EXISTS (
               SELECT 1 FROM public.promotions p3 
               WHERE p3.company_id = a1.company_id 
                 AND p3.promotion_type = 'cashback' 
                 AND p3.status = 'active'
                 AND p3.start_date <= (a1.start_time AT TIME ZONE 'UTC')::date 
                 AND p3.end_date >= (a1.start_time AT TIME ZONE 'UTC')::date
           )))
           AND NOT EXISTS (
               SELECT 1 FROM public.client_cashback cc3 
               WHERE cc3.appointment_id = a1.id
           )
         GROUP BY a1.company_id
     ),
     all_cids AS (
         SELECT DISTINCT company_id FROM public.client_cashback WHERE (user_id = auth.uid() OR client_id = ANY(v_ids))
         UNION
         SELECT DISTINCT a2.company_id FROM public.appointments a2 
         LEFT JOIN public.promotions p2 ON a2.promotion_id = p2.id
         WHERE (a2.user_id = auth.uid() OR a2.client_id = ANY(v_ids) OR public.normalize_whatsapp_v2(a2.client_whatsapp) = ANY(v_whatsapps))
           AND (p2.promotion_type = 'cashback' OR (a2.promotion_id IS NULL AND EXISTS (
               SELECT 1 FROM public.promotions p3 
               WHERE p3.company_id = a2.company_id 
                 AND p3.promotion_type = 'cashback' 
                 AND p3.status = 'active'
                 AND p3.start_date <= (a2.start_time AT TIME ZONE 'UTC')::date 
                 AND p3.end_date >= (a2.start_time AT TIME ZONE 'UTC')::date
           )))
     ),
     company_summary_data AS (
         SELECT 
             ac.company_id,
             COALESCE(acl.avail, 0) as available,
             COALESCE(pct.pend, 0) + COALESCE(pcf.forecast_pend, 0) as pending
         FROM all_cids ac
         LEFT JOIN active_cash_list acl ON acl.cid = ac.company_id
         LEFT JOIN pending_cash_table pct ON pct.cid = ac.company_id
         LEFT JOIN pending_cash_forecast pcf ON pcf.cid = ac.company_id
     ),
     history_full AS (
         SELECT 
             t1.id::text, t1.company_id, t1.amount, t1.type, t1.description, t1.created_at, t1.reference_id::text
         FROM public.cashback_transactions t1
         WHERE (t1.user_id = auth.uid() OR t1.client_id = ANY(v_ids))
         
         UNION ALL
         
         SELECT 
             a3.id::text as id, a3.company_id, 
             (
                 COALESCE(a3.final_price, a3.total_price, 0) * 
                 COALESCE(
                     p4.discount_value, 
                     (SELECT p5.discount_value FROM public.promotions p5 
                      WHERE p5.company_id = a3.company_id 
                        AND p5.promotion_type = 'cashback' 
                        AND p5.status = 'active' 
                        AND p5.start_date <= (a3.start_time AT TIME ZONE 'UTC')::date 
                        AND p5.end_date >= (a3.start_time AT TIME ZONE 'UTC')::date
                      ORDER BY p5.discount_value DESC LIMIT 1)
                 ) / 100.0
             ) as amount,
             'pending'::text as type,
             'Cashback previsto (agendamento em ' || to_char(a3.start_time, 'DD/MM') || ')' as description,
             a3.start_time as created_at,
             a3.id::text as reference_id
         FROM public.appointments a3
         LEFT JOIN public.promotions p4 ON a3.promotion_id = p4.id
         WHERE (a3.user_id = auth.uid() OR a3.client_id = ANY(v_ids) OR public.normalize_whatsapp_v2(a3.client_whatsapp) = ANY(v_whatsapps))
           AND a3.status IN ('confirmed', 'pending')
           AND (p4.promotion_type = 'cashback' OR (a3.promotion_id IS NULL AND EXISTS (
               SELECT 1 FROM public.promotions p6 
               WHERE p6.company_id = a3.company_id 
                 AND p6.promotion_type = 'cashback' 
                 AND p6.status = 'active'
                 AND p6.start_date <= (a3.start_time AT TIME ZONE 'UTC')::date 
                 AND p6.end_date >= (a3.start_time AT TIME ZONE 'UTC')::date
           )))
           AND NOT EXISTS (
               SELECT 1 FROM public.client_cashback cc4 
               WHERE cc4.appointment_id = a3.id
           )
     )
     SELECT 
         jsonb_build_object(
             'balances', COALESCE((SELECT jsonb_object_agg(csd.company_id, jsonb_build_object('available', csd.available, 'pending', csd.pending)) FROM company_summary_data csd), '{}'::jsonb),
             'history', COALESCE((SELECT jsonb_agg(h1) FROM (SELECT * FROM history_full ORDER BY created_at DESC) h1), '[]'::jsonb)
         ) INTO v_result;
 
     RETURN v_result;
 END;
 $function$;
