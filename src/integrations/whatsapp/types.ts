// WhatsApp Center types
export type WhatsAppStatus = 'disconnected' | 'connecting' | 'connected' | 'error' | 'pending' | 'closed';
export type WhatsAppMessageStatus = 'pending' | 'sent' | 'delivered' | 'read' | 'failed';
export type WhatsAppAutomationTrigger =
  | 'appointment_confirmed'
  | 'appointment_reminder'
  | 'appointment_reminder_1d'
  | 'appointment_reminder_2h'
  | 'post_service_review'
  | 'inactive_client'
  | 'birthday'
  | 'appointment_cancelled'
  | 'appointment_rescheduled'
  | 'loyalty_cashback'
  | 'waitlist_slot_open'
  | 'professional_delay'
  | 'promotional';

export interface WhatsAppInstance {
  id: string;
  company_id: string;
  instance_id: string | null;
  instance_name: string | null;
  session_name: string | null;
  phone: string | null;
  profile_name: string | null;
  status: WhatsAppStatus;
  qr_code: string | null;
  last_seen_at: string | null;
  connected_at: string | null;
  metadata: Record<string, unknown>;
  created_at: string;
  updated_at: string;
}

export interface WhatsAppTemplate {
  id: string;
  company_id: string;
  name: string;
  category: string;
  body: string;
  variables: string[];
  is_system: boolean;
  created_at: string;
  updated_at: string;
}

export interface WhatsAppAutomation {
  id: string;
  company_id: string;
  trigger: WhatsAppAutomationTrigger;
  name: string;
  description: string | null;
  enabled: boolean;
  template_id: string | null;
  delay_minutes: number;
  send_window_start: string;
  send_window_end: string;
  weekdays: number[];
  daily_limit: number;
  exclude_blocked: boolean;
  config: Record<string, unknown>;
  created_at: string;
  updated_at: string;
}

export interface WhatsAppLog {
  id: string;
  company_id: string;
  client_id: string | null;
  client_name: string | null;
  phone: string;
  message_type: string;
  template_id: string | null;
  automation_id: string | null;
  body: string;
  status: WhatsAppMessageStatus;
  source: string | null;
  error_message: string | null;
  delivered_at: string | null;
  read_at: string | null;
  created_at: string;
}

export interface WhatsAppMetric {
  id: string;
  company_id: string;
  metric_date: string;
  sent_count: number;
  delivered_count: number;
  read_count: number;
  failed_count: number;
  reply_count: number;
}

export const AUTOMATION_DEFINITIONS: Array<{
  trigger: WhatsAppAutomationTrigger;
  name: string;
  description: string;
  defaultDelayMinutes: number;
  category: string;
}> = [
  { trigger: 'appointment_confirmed', name: 'Confirmação', description: 'Envia mensagem assim que o cliente agenda.', defaultDelayMinutes: 0, category: 'confirmation' },
  { trigger: 'appointment_reminder_1d', name: 'Lembrete (1 dia)', description: 'Lembra o cliente um dia antes do atendimento.', defaultDelayMinutes: 1440, category: 'reminder' },
  { trigger: 'appointment_reminder_2h', name: 'Lembrete (2 horas)', description: 'Lembra o cliente duas horas antes do atendimento.', defaultDelayMinutes: 120, category: 'reminder' },
  { trigger: 'post_service_review', name: 'Avaliação', description: 'Solicita avaliação após o atendimento concluído.', defaultDelayMinutes: 60, category: 'review' },
  { trigger: 'inactive_client', name: 'Cliente Sumido', description: 'Reativa clientes que não voltam há 20 dias.', defaultDelayMinutes: 28800, category: 'inactive' },
  { trigger: 'professional_delay', name: 'Aviso de Atraso', description: 'Avisa os próximos clientes quando houver atraso.', defaultDelayMinutes: 0, category: 'delay' },
  { trigger: 'loyalty_cashback', name: 'Cashback / Fidelidade', description: 'Avisa o cliente sobre crédito disponível.', defaultDelayMinutes: 0, category: 'loyalty' },
  { trigger: 'promotional', name: 'Promoções', description: 'Envio manual de promoções para a base.', defaultDelayMinutes: 0, category: 'promotional' },
  { trigger: 'appointment_cancelled', name: 'Cancelamento', description: 'Confirma o cancelamento do agendamento.', defaultDelayMinutes: 0, category: 'cancellation' },
  { trigger: 'appointment_rescheduled', name: 'Reagendamento', description: 'Confirma o novo horário do cliente.', defaultDelayMinutes: 0, category: 'reschedule' },
];
