-- Habilitar pg_net se não estiver habilitado
CREATE EXTENSION IF NOT EXISTS pg_net;

-- Função para chamar a Edge Function de e-mail
CREATE OR REPLACE FUNCTION public.notify_ticket_status_change()
RETURNS TRIGGER AS $$
DECLARE
    target_email TEXT;
    target_user_id UUID;
    company_id UUID;
BEGIN
    -- Só disparar se o status mudou
    IF (OLD.status IS NULL OR OLD.status <> NEW.status) THEN
        
        -- Pegar dados do destinatário
        SELECT email, user_id, p.company_id INTO target_email, target_user_id, company_id
        FROM public.profiles p
        WHERE p.user_id = NEW.user_id
        LIMIT 1;

        IF target_email IS NOT NULL THEN
            PERFORM net.http_post(
                url := (SELECT value FROM (SELECT COALESCE(setting, '') as value FROM pg_settings WHERE name = 'app.settings.supabase_url' UNION SELECT '') s WHERE value <> '' LIMIT 1) || '/functions/v1/send-email',
                headers := jsonb_build_object(
                    'Content-Type', 'application/json',
                    'Authorization', 'Bearer ' || (SELECT value FROM (SELECT COALESCE(setting, '') as value FROM pg_settings WHERE name = 'app.settings.service_role_key' UNION SELECT '') s WHERE value <> '' LIMIT 1)
                ),
                body := jsonb_build_object(
                    'to', target_email,
                    'type', 'ticket_status_changed',
                    'data', jsonb_build_object(
                        'protocol', NEW.protocol_number,
                        'status', CASE 
                            WHEN NEW.status = 'open' THEN 'Aberto'
                            WHEN NEW.status = 'in_progress' THEN 'Em andamento'
                            WHEN NEW.status = 'answered' THEN 'Respondido'
                            WHEN NEW.status = 'resolved' THEN 'Resolvido'
                            WHEN NEW.status = 'closed' THEN 'Encerrado'
                            ELSE NEW.status
                        END
                    ),
                    'company_id', company_id,
                    'user_id', target_user_id
                )
            );
        END IF;
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Trigger para mudanças de status
DROP TRIGGER IF EXISTS trigger_ticket_status_change ON public.support_tickets;
CREATE TRIGGER trigger_ticket_status_change
AFTER UPDATE OF status ON public.support_tickets
FOR EACH ROW EXECUTE FUNCTION public.notify_ticket_status_change();