ALTER TABLE public.platform_whatsapp_settings 
DROP COLUMN IF EXISTS api_url,
DROP COLUMN IF EXISTS api_key;

ALTER TABLE public.platform_whatsapp_settings 
ADD COLUMN IF NOT EXISTS last_connected_at TIMESTAMP WITH TIME ZONE;

-- Add remaining platform templates
INSERT INTO public.platform_whatsapp_templates (type, name, content)
VALUES 
('trial_expired', 'Trial Expirado', 'Olá {{nome}}! Seu período de teste na Agendaê expirou. Para reativar sua conta e continuar agendando, escolha um plano em seu dashboard: {{link_dashboard}}'),
('subscription_activated', 'Assinatura Ativada', 'Olá {{nome}}! 🎉 Sua assinatura na Agendaê foi ativada com sucesso. Obrigado por confiar em nossa plataforma!'),
('subscription_upgraded', 'Upgrade de Plano', 'Olá {{nome}}! Seu plano foi atualizado para {{plano}}. Agora você tem acesso a novos recursos!'),
('subscription_downgraded', 'Downgrade de Plano', 'Olá {{nome}}! Confirmamos a alteração do seu plano para {{plano}}.'),
('support_ticket_opened', 'Chamado Aberto', 'Olá {{nome}}, recebemos seu pedido de suporte. Nossa equipe analisará e responderá em breve. Ticket: {{ticket_id}}'),
('support_ticket_updated', 'Chamado Atualizado', 'Olá {{nome}}, seu chamado {{ticket_id}} foi atualizado. Confira a resposta em seu painel: {{link_suporte}}'),
('password_reset_notice', 'Troca de Senha', 'Olá {{nome}}, sua senha na Agendaê foi alterada recentemente. Se não foi você, entre em contato com o suporte imediatamente.')
ON CONFLICT (type) DO NOTHING;

-- Ensure automations exist for these templates
INSERT INTO public.platform_whatsapp_automations (type, enabled, template_id)
SELECT t.type, false, t.id 
FROM public.platform_whatsapp_templates t
WHERE t.type IN ('trial_expired', 'subscription_activated', 'subscription_upgraded', 'subscription_downgraded', 'support_ticket_opened', 'support_ticket_updated', 'password_reset_notice')
ON CONFLICT (type) DO NOTHING;
