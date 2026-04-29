-- Função para notificar suporte sobre novo ticket
CREATE OR REPLACE FUNCTION public.notify_support_new_ticket()
RETURNS TRIGGER AS $$
BEGIN
    PERFORM net.http_post(
        url := (SELECT value FROM (SELECT COALESCE(setting, '') as value FROM pg_settings WHERE name = 'app.settings.supabase_url' UNION SELECT '') s WHERE value <> '' LIMIT 1) || '/functions/v1/send-email',
        headers := jsonb_build_object(
            'Content-Type', 'application/json',
            'Authorization', 'Bearer ' || (SELECT value FROM (SELECT COALESCE(setting, '') as value FROM pg_settings WHERE name = 'app.settings.service_role_key' UNION SELECT '') s WHERE value <> '' LIMIT 1)
        ),
        body := jsonb_build_object(
            'to', 'suporte@meagendae.com.br',
            'type', 'ticket_created',
            'data', jsonb_build_object(
                'protocol', NEW.protocol_number,
                'title', '[NOVO TICKET BANCO] ' || NEW.title
            )
        )
    );
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Trigger para novos tickets
DROP TRIGGER IF EXISTS trigger_new_ticket_notification ON public.support_tickets;
CREATE TRIGGER trigger_new_ticket_notification
AFTER INSERT ON public.support_tickets
FOR EACH ROW EXECUTE FUNCTION public.notify_support_new_ticket();