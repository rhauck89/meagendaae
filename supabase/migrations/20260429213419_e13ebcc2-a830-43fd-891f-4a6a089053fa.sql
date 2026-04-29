-- Tabela de Logs de E-mail
CREATE TABLE IF NOT EXISTS public.email_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    company_id UUID REFERENCES public.companies(id),
    user_id UUID REFERENCES auth.users(id),
    ticket_id UUID, -- Referência opcional se for e-mail de ticket
    to_email TEXT NOT NULL,
    from_email TEXT NOT NULL,
    subject TEXT NOT NULL,
    email_type TEXT NOT NULL,
    status TEXT NOT NULL, -- 'sent', 'failed', 'delivered', etc
    resend_id TEXT,
    error_message TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Tabela de Mensagens dos Tickets (se não existir)
CREATE TABLE IF NOT EXISTS public.support_ticket_messages (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    ticket_id UUID NOT NULL REFERENCES public.support_tickets(id) ON DELETE CASCADE,
    sender_id UUID REFERENCES auth.users(id),
    sender_type TEXT NOT NULL CHECK (sender_type IN ('user', 'admin')),
    message TEXT NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Tabela de Anexos dos Tickets
CREATE TABLE IF NOT EXISTS public.support_ticket_attachments (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    ticket_id UUID REFERENCES public.support_tickets(id) ON DELETE CASCADE,
    message_id UUID REFERENCES public.support_ticket_messages(id) ON DELETE CASCADE,
    file_path TEXT NOT NULL,
    file_name TEXT NOT NULL,
    file_type TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Habilitar RLS
ALTER TABLE public.email_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.support_ticket_messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.support_ticket_attachments ENABLE ROW LEVEL SECURITY;

-- Políticas para Logs de E-mail
CREATE POLICY "Admins can view all email logs" 
ON public.email_logs FOR SELECT 
USING (EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin'));

CREATE POLICY "Companies can view their own email logs" 
ON public.email_logs FOR SELECT 
USING (company_id IN (SELECT company_id FROM public.profiles WHERE id = auth.uid()));

-- Políticas para Mensagens de Tickets
CREATE POLICY "Users can view messages for their own tickets" 
ON public.support_ticket_messages FOR SELECT 
USING (EXISTS (
    SELECT 1 FROM public.support_tickets t 
    WHERE t.id = ticket_id 
    AND (t.company_id IN (SELECT company_id FROM public.profiles WHERE id = auth.uid()) OR EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = auth.uid() AND p.role = 'admin'))
));

CREATE POLICY "Users can insert messages to their own tickets" 
ON public.support_ticket_messages FOR INSERT 
WITH CHECK (EXISTS (
    SELECT 1 FROM public.support_tickets t 
    WHERE t.id = ticket_id 
    AND (t.company_id IN (SELECT company_id FROM public.profiles WHERE id = auth.uid()) OR EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = auth.uid() AND p.role = 'admin'))
));

-- Trigger para atualizar support_tickets.updated_at quando houver nova mensagem
CREATE OR REPLACE FUNCTION public.update_ticket_timestamp()
RETURNS TRIGGER AS $$
BEGIN
    UPDATE public.support_tickets 
    SET updated_at = now() 
    WHERE id = NEW.ticket_id;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_update_ticket_timestamp
AFTER INSERT ON public.support_ticket_messages
FOR EACH ROW EXECUTE FUNCTION public.update_ticket_timestamp();