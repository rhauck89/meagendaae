-- Create missing categories for all existing companies
DO $$
DECLARE
    company_record RECORD;
BEGIN
    FOR company_record IN SELECT id FROM public.companies LOOP
        -- Cancellation Template
        IF NOT EXISTS (SELECT 1 FROM public.whatsapp_templates WHERE company_id = company_record.id AND category = 'cancellation') THEN
            INSERT INTO public.whatsapp_templates (company_id, name, category, body, variables)
            VALUES (
                company_record.id,
                'Cancelamento de Agendamento',
                'cancellation',
                'Olá {{nome}}, seu agendamento para o dia {{data}} às {{hora}} foi cancelado.',
                ARRAY['nome', 'data', 'hora']
            );
        END IF;

        -- Rescheduling Template
        IF NOT EXISTS (SELECT 1 FROM public.whatsapp_templates WHERE company_id = company_record.id AND category = 'rescheduling') THEN
            INSERT INTO public.whatsapp_templates (company_id, name, category, body, variables)
            VALUES (
                company_record.id,
                'Reagendamento de Agendamento',
                'rescheduling',
                'Olá {{nome}}, seu agendamento foi reagendado para o dia {{data}} às {{hora}}.',
                ARRAY['nome', 'data', 'hora']
            );
        END IF;
    END LOOP;
END $$;

-- Update existing automations to link to the correct templates
UPDATE public.whatsapp_automations wa
SET template_id = (
    SELECT id 
    FROM public.whatsapp_templates wt 
    WHERE wt.company_id = wa.company_id 
    AND (
        (wa.trigger = 'appointment_confirmed' AND wt.category = 'confirmation') OR
        (wa.trigger = 'appointment_reminder_1d' AND wt.category = 'reminder') OR
        (wa.trigger = 'appointment_reminder_2h' AND wt.category = 'reminder') OR
        (wa.trigger = 'post_service_review' AND wt.category = 'review') OR
        (wa.trigger = 'inactive_client' AND wt.category = 'inactive') OR
        (wa.trigger = 'professional_delay' AND wt.category = 'delay') OR
        (wa.trigger = 'loyalty_cashback' AND wt.category = 'loyalty') OR
        (wa.trigger = 'promotional' AND wt.category = 'promotional') OR
        (wa.trigger = 'appointment_cancelled' AND wt.category = 'cancellation') OR
        (wa.trigger = 'appointment_rescheduled' AND wt.category = 'rescheduling')
    )
    LIMIT 1
)
WHERE template_id IS NULL;

-- Create or update the initialization function
CREATE OR REPLACE FUNCTION public.initialize_company_whatsapp_defaults(p_company_id uuid)
RETURNS void AS $$
DECLARE
    v_template_id uuid;
BEGIN
    -- Ensure system/default templates are copied if they don't exist
    -- (Assuming here we insert standard ones for the company)
    
    -- Confirmação
    INSERT INTO public.whatsapp_templates (company_id, name, category, body, variables)
    VALUES (p_company_id, 'Confirmação de Agendamento', 'confirmation', 'Olá {{nome}}! Seu agendamento foi confirmado para o dia {{data}} às {{hora}}. Aguardamos você!', ARRAY['nome', 'data', 'hora'])
    ON CONFLICT DO NOTHING RETURNING id INTO v_template_id;
    
    INSERT INTO public.whatsapp_automations (company_id, trigger, name, enabled, template_id)
    VALUES (p_company_id, 'appointment_confirmed', 'Confirmação de Agendamento', true, v_template_id)
    ON CONFLICT (company_id, trigger) DO UPDATE SET template_id = EXCLUDED.template_id;

    -- Lembrete 1 dia
    INSERT INTO public.whatsapp_templates (company_id, name, category, body, variables)
    VALUES (p_company_id, 'Lembrete (1 dia antes)', 'reminder', 'Olá {{nome}}, passando para lembrar do seu agendamento amanhã às {{hora}}. Até lá!', ARRAY['nome', 'hora'])
    ON CONFLICT DO NOTHING RETURNING id INTO v_template_id;
    
    INSERT INTO public.whatsapp_automations (company_id, trigger, name, enabled, template_id)
    VALUES (p_company_id, 'appointment_reminder_1d', 'Lembrete 24h', true, v_template_id)
    ON CONFLICT (company_id, trigger) DO UPDATE SET template_id = EXCLUDED.template_id;

    -- Lembrete 2 horas
    INSERT INTO public.whatsapp_automations (company_id, trigger, name, enabled, template_id)
    VALUES (p_company_id, 'appointment_reminder_2h', 'Lembrete 2h', true, v_template_id)
    ON CONFLICT (company_id, trigger) DO UPDATE SET template_id = EXCLUDED.template_id;

    -- Avaliação
    INSERT INTO public.whatsapp_templates (company_id, name, category, body, variables)
    VALUES (p_company_id, 'Pedido de Avaliação', 'review', 'Olá {{nome}}, o que achou do seu atendimento hoje? Avalie aqui: {{link_avaliacao}}', ARRAY['nome', 'link_avaliacao'])
    ON CONFLICT DO NOTHING RETURNING id INTO v_template_id;
    
    INSERT INTO public.whatsapp_automations (company_id, trigger, name, enabled, template_id)
    VALUES (p_company_id, 'post_service_review', 'Pedido de Avaliação', true, v_template_id)
    ON CONFLICT (company_id, trigger) DO UPDATE SET template_id = EXCLUDED.template_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Trigger to call initialize for new companies
CREATE OR REPLACE FUNCTION public.on_company_created_whatsapp_init()
RETURNS TRIGGER AS $$
BEGIN
    PERFORM public.initialize_company_whatsapp_defaults(NEW.id);
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS tr_on_company_created_whatsapp_init ON public.companies;
CREATE TRIGGER tr_on_company_created_whatsapp_init
AFTER INSERT ON public.companies
FOR EACH ROW EXECUTE FUNCTION public.on_company_created_whatsapp_init();

-- Fix the appointment confirmation trigger
CREATE OR REPLACE FUNCTION public.handle_appointment_confirmation()
RETURNS TRIGGER AS $$
BEGIN
    -- Only trigger for confirmed appointments that aren't old
    IF (TG_OP = 'INSERT' AND NEW.status = 'confirmed') OR (TG_OP = 'UPDATE' AND OLD.status != 'confirmed' AND NEW.status = 'confirmed') THEN
        PERFORM net.http_post(
            url := (SELECT value FROM public.system_settings WHERE key = 'edge_function_base_url') || '/whatsapp-integration',
            headers := jsonb_build_object(
                'Content-Type', 'application/json',
                'Authorization', 'Bearer ' || (SELECT value FROM public.system_settings WHERE key = 'service_role_key')
            ),
            body := jsonb_build_object(
                'action', 'send-message',
                'companyId', NEW.company_id,
                'appointmentId', NEW.id,
                'type', 'appointment_confirmed'
            )
        );
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
