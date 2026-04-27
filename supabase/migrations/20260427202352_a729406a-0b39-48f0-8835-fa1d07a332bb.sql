-- Add tracking columns to appointments
ALTER TABLE public.appointments 
ADD COLUMN IF NOT EXISTS whatsapp_confirmation_sent BOOLEAN DEFAULT false,
ADD COLUMN IF NOT EXISTS whatsapp_reminder_sent BOOLEAN DEFAULT false,
ADD COLUMN IF NOT EXISTS whatsapp_review_sent BOOLEAN DEFAULT false;

-- Add appointment_id to whatsapp_logs if not exists
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'whatsapp_logs' AND column_name = 'appointment_id') THEN
        ALTER TABLE public.whatsapp_logs ADD COLUMN appointment_id UUID REFERENCES public.appointments(id) ON DELETE SET NULL;
    END IF;
END $$;

-- Ensure default automations exist with correct enum values
-- Values are: appointment_confirmed, appointment_reminder, post_service_review
INSERT INTO public.whatsapp_automations (company_id, name, trigger, enabled)
SELECT id, 'Confirmação de Agendamento', 'appointment_confirmed', true FROM public.companies
ON CONFLICT (company_id, trigger) DO NOTHING;

INSERT INTO public.whatsapp_automations (company_id, name, trigger, enabled)
SELECT id, 'Lembrete de Agendamento', 'appointment_reminder', true FROM public.companies
ON CONFLICT (company_id, trigger) DO NOTHING;

INSERT INTO public.whatsapp_automations (company_id, name, trigger, enabled)
SELECT id, 'Solicitação de Avaliação', 'post_service_review', true FROM public.companies
ON CONFLICT (company_id, trigger) DO NOTHING;
