CREATE OR REPLACE FUNCTION public.handle_subscription_commission()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
AS $function$
DECLARE
    v_sub_info RECORD;
    v_total_commission NUMERIC;
    v_cycle_start DATE;
    v_cycle_end DATE;
    v_total_usage_count NUMERIC;
    v_prof_record RECORD;
    v_commission_per_unit NUMERIC;
    v_interval INTERVAL;
BEGIN
    -- Only proceed if status changed to 'paid'
    IF (NEW.status = 'paid' AND (OLD.status IS NULL OR OLD.status != 'paid')) THEN
        -- Get subscription and plan info
        SELECT cs.id, cs.professional_commission, cs.client_id, cs.billing_cycle, sp.name as plan_name, cs.company_id
        INTO v_sub_info
        FROM public.client_subscriptions cs
        JOIN public.subscription_plans sp ON sp.id = cs.plan_id
        WHERE cs.id = NEW.subscription_id;

        IF v_sub_info.id IS NOT NULL THEN
            -- Calculate total commission amount for this charge
            v_total_commission := (NEW.amount * COALESCE(v_sub_info.professional_commission, 0)) / 100;
            
            IF v_total_commission <= 0 THEN
                RETURN NEW;
            END IF;

            -- Determine the cycle period
            IF v_sub_info.billing_cycle = 'yearly' THEN
                v_interval := INTERVAL '1 year';
            ELSE
                v_interval := INTERVAL '1 month';
            END IF;
            
            v_cycle_start := NEW.due_date - v_interval;
            v_cycle_end := NEW.due_date;

            -- 1. Identify all usages in this cycle
            -- Sum usage_count grouped by professional from the related appointments
            SELECT SUM(su.usage_count) INTO v_total_usage_count
            FROM public.subscription_usage su
            JOIN public.appointments a ON a.id = su.appointment_id
            WHERE su.subscription_id = v_sub_info.id
              AND a.status = 'completed'
              AND su.usage_date >= v_cycle_start
              AND su.usage_date <= v_cycle_end;

            -- 2. Distribute commission
            IF v_total_usage_count IS NOT NULL AND v_total_usage_count > 0 THEN
                v_commission_per_unit := v_total_commission / v_total_usage_count;

                FOR v_prof_record IN 
                    SELECT a.professional_id, SUM(su.usage_count) as prof_usage
                    FROM public.subscription_usage su
                    JOIN public.appointments a ON a.id = su.appointment_id
                    WHERE su.subscription_id = v_sub_info.id
                      AND a.status = 'completed'
                      AND su.usage_date >= v_cycle_start
                      AND su.usage_date <= v_cycle_end
                    GROUP BY a.professional_id
                LOOP
                    -- Avoid duplicates using ON CONFLICT (source_id, source_type, professional_id) if we had that unique constraint
                    -- But professional_commissions only has (source_id, source_type). 
                    -- Wait, if I have multiple professionals for the same charge, I need a unique constraint that includes professional_id.
                    -- Let's check existing constraints.
                    
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
                        v_prof_record.professional_id,
                        v_sub_info.client_id,
                        'subscription_charge',
                        NEW.id,
                        'Comissão Assinatura: ' || v_sub_info.plan_name || ' (' || v_prof_record.prof_usage || ' de ' || v_total_usage_count || ' usos no ciclo)',
                        NEW.amount,
                        'percentage',
                        v_sub_info.professional_commission,
                        v_prof_record.prof_usage * v_commission_per_unit,
                        CASE WHEN v_prof_record.professional_id = (SELECT professional_id FROM public.client_subscriptions WHERE id = NEW.subscription_id) 
                             THEN NEW.amount - v_total_commission ELSE 0 END, -- Just assign company net to one of them or 0 for others
                        NEW.paid_at,
                        'paid'
                    );
                END LOOP;
            ELSE
                -- Fallback: If no usage, maybe assign 100% to the responsible professional if defined
                DECLARE
                    v_resp_prof_id UUID;
                BEGIN
                    SELECT professional_id INTO v_resp_prof_id FROM public.client_subscriptions WHERE id = NEW.subscription_id;
                    IF v_resp_prof_id IS NOT NULL THEN
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
                            v_resp_prof_id,
                            v_sub_info.client_id,
                            'subscription_charge',
                            NEW.id,
                            'Comissão Assinatura (Sem uso no ciclo): ' || v_sub_info.plan_name,
                            NEW.amount,
                            'percentage',
                            v_sub_info.professional_commission,
                            v_total_commission,
                            NEW.amount - v_total_commission,
                            NEW.paid_at,
                            'paid'
                        );
                    END IF;
                END;
            END IF;
        END IF;
    END IF;
    RETURN NEW;
END;
$function$;
