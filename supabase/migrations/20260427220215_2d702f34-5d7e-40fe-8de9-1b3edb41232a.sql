-- 1. Function to initialize default templates for a company
CREATE OR REPLACE FUNCTION public.initialize_company_whatsapp_templates(p_company_id UUID)
RETURNS void AS $$
DECLARE
    v_company_name TEXT;
BEGIN
    SELECT name INTO v_company_name FROM public.companies WHERE id = p_company_id;

    -- Appointment Confirmation
    INSERT INTO public.whatsapp_templates (company_id, name, category, body, variables, is_system)
    VALUES (p_company_id, 'Confirmação de Agendamento', 'confirmation', 
            'Olá {{nome}} 👋\nSeu horário em {{empresa}} foi confirmado:\n\n📅 {{data}}\n🕐 {{hora}}\n✂️ {{servico}}\n👤 {{profissional}}\n\nAté lá! 🚀',
            ARRAY['{{nome}}', '{{empresa}}', '{{data}}', '{{hora}}', '{{servico}}', '{{profissional}}'], true)
    ON CONFLICT (company_id, name) DO NOTHING;

    -- Reminder 1 Day Before
    INSERT INTO public.whatsapp_templates (company_id, name, category, body, variables, is_system)
    VALUES (p_company_id, 'Lembrete 1 dia antes', 'reminder', 
            'Olá {{nome}}, passando para lembrar do seu horário amanhã em {{empresa}}! ⏰\n\n📅 {{data}}\n🕐 {{hora}}\n✂️ {{servico}}\n\nPodemos confirmar sua presença? 👍',
            ARRAY['{{nome}}', '{{empresa}}', '{{data}}', '{{hora}}', '{{servico}}'], true)
    ON CONFLICT (company_id, name) DO NOTHING;

    -- Reminder 2 Hours Before
    INSERT INTO public.whatsapp_templates (company_id, name, category, body, variables, is_system)
    VALUES (p_company_id, 'Lembrete 2 horas antes', 'reminder', 
            'Olá {{nome}}, seu horário em {{empresa}} é em breve! ⏳\n\n🕐 {{hora}}\n✂️ {{servico}}\n\nTe aguardamos! 🚀',
            ARRAY['{{nome}}', '{{empresa}}', '{{hora}}', '{{servico}}'], true)
    ON CONFLICT (company_id, name) DO NOTHING;

    -- Review Request
    INSERT INTO public.whatsapp_templates (company_id, name, category, body, variables, is_system)
    VALUES (p_company_id, 'Pedido de Avaliação', 'review', 
            'Olá {{nome}}, obrigado pela visita em {{empresa}}! 💛\nSua opinião é muito importante para nós.\n\nComo foi sua experiência?\n{{link_avaliacao}}',
            ARRAY['{{nome}}', '{{empresa}}', '{{link_avaliacao}}'], true)
    ON CONFLICT (company_id, name) DO NOTHING;

    -- Inactive Client
    INSERT INTO public.whatsapp_templates (company_id, name, category, body, variables, is_system)
    VALUES (p_company_id, 'Cliente Sumido', 'inactive', 
            'Oi {{nome}}, estamos com saudades! 😢\nFaz tempo que você não vem na {{empresa}}.\n\nQue tal agendar um horário para renovar o visual?\n{{link_agendamento}}',
            ARRAY['{{nome}}', '{{empresa}}', '{{link_agendamento}}'], true)
    ON CONFLICT (company_id, name) DO NOTHING;

    -- Loyalty/Cashback
    INSERT INTO public.whatsapp_templates (company_id, name, category, body, variables, is_system)
    VALUES (p_company_id, 'Cashback/Fidelidade', 'loyalty', 
            'Olá {{nome}}! Você tem {{cashback}} de cashback disponível em {{empresa}}! 💰\n\nUse na sua próxima visita.\n{{link_agendamento}}',
            ARRAY['{{nome}}', '{{cashback}}', '{{empresa}}', '{{link_agendamento}}'], true)
    ON CONFLICT (company_id, name) DO NOTHING;

    -- Professional Delay
    INSERT INTO public.whatsapp_templates (company_id, name, category, body, variables, is_system)
    VALUES (p_company_id, 'Aviso de Atraso', 'delay', 
            'Olá {{nome}}, pedimos desculpas, mas o profissional {{profissional}} teve um imprevisto e está com um atraso de {{tempo_atraso}} minutos. 🙏\n\nSua nova previsão de atendimento é {{nova_previsao}}.\n\nAgradecemos a compreensão!',
            ARRAY['{{nome}}', '{{profissional}}', '{{tempo_atraso}}', '{{nova_previsao}}'], true)
    ON CONFLICT (company_id, name) DO NOTHING;

    -- Promotional
    INSERT INTO public.whatsapp_templates (company_id, name, category, body, variables, is_system)
    VALUES (p_company_id, 'Promoções', 'promotional', 
            'Olá {{nome}}! Temos uma novidade para você em {{empresa}}! 🌟\n\nConfira nossas promoções exclusivas: {{link_agendamento}}',
            ARRAY['{{nome}}', '{{empresa}}', '{{link_agendamento}}'], true)
    ON CONFLICT (company_id, name) DO NOTHING;

    -- Initialize basic automations
    INSERT INTO public.whatsapp_automations (company_id, name, trigger, enabled, delay_minutes)
    VALUES 
        (p_company_id, 'Confirmação', 'appointment_confirmed', true, 0),
        (p_company_id, 'Lembrete 1 dia', 'appointment_reminder_1d', true, 1440),
        (p_company_id, 'Lembrete 2 horas', 'appointment_reminder_2h', true, 120),
        (p_company_id, 'Avaliação', 'post_service_review', true, 60),
        (p_company_id, 'Atraso', 'professional_delay', true, 0)
    ON CONFLICT (company_id, trigger) DO NOTHING;

END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- 2. Trigger for new companies
CREATE OR REPLACE FUNCTION public.on_company_created_initialize_whatsapp()
RETURNS TRIGGER AS $$
BEGIN
    PERFORM public.initialize_company_whatsapp_templates(NEW.id);
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

DROP TRIGGER IF EXISTS tr_initialize_company_whatsapp ON public.companies;
CREATE TRIGGER tr_initialize_company_whatsapp
AFTER INSERT ON public.companies
FOR EACH ROW
EXECUTE FUNCTION public.on_company_created_initialize_whatsapp();

-- 3. Ensure uniqueness for templates and automations to avoid duplicates during re-runs
DO $$ 
BEGIN 
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'whatsapp_templates_company_name_key') THEN
        ALTER TABLE public.whatsapp_templates ADD CONSTRAINT whatsapp_templates_company_name_key UNIQUE (company_id, name);
    END IF;
    
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'whatsapp_automations_company_trigger_key') THEN
        ALTER TABLE public.whatsapp_automations ADD CONSTRAINT whatsapp_automations_company_trigger_key UNIQUE (company_id, trigger);
    END IF;
END $$;

-- 4. Run for existing companies
DO $$
DECLARE
    r RECORD;
BEGIN
    FOR r IN SELECT id FROM public.companies LOOP
        PERFORM public.initialize_company_whatsapp_templates(r.id);
    END LOOP;
END $$;
