// WhatsApp Center types
export type WhatsAppStatus = 'disconnected' | 'connecting' | 'connected' | 'error';
export type WhatsAppMessageStatus = 'pending' | 'sent' | 'delivered' | 'read' | 'failed';
export type WhatsAppAutomationTrigger =
  | 'appointment_confirmed'
  | 'appointment_reminder'
  | 'post_service_review'
  | 'inactive_client'
  | 'birthday'
  | 'appointment_cancelled'
  | 'appointment_rescheduled'
  | 'loyalty_cashback'
  | 'waitlist_slot_open';

export interface WhatsAppInstance {
  id: string;
  company_id: string;
  instance_id: string | null;
  session_name: string | null;
  phone: string | null;
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
}> = [
  { trigger: 'appointment_confirmed', name: 'Confirmação de agendamento', description: 'Envia mensagem assim que o cliente agenda.', defaultDelayMinutes: 0 },
  { trigger: 'appointment_reminder', name: 'Lembrete antes do horário', description: 'Lembra o cliente algumas horas antes do atendimento.', defaultDelayMinutes: 120 },
  { trigger: 'post_service_review', name: 'Pós-atendimento + avaliação', description: 'Solicita avaliação após o atendimento concluído.', defaultDelayMinutes: 60 },
  { trigger: 'inactive_client', name: 'Cliente sem retorno', description: 'Reativa clientes que não voltam há 20 dias.', defaultDelayMinutes: 28800 },
  { trigger: 'birthday', name: 'Aniversário', description: 'Mensagem de feliz aniversário com benefício.', defaultDelayMinutes: 0 },
  { trigger: 'appointment_cancelled', name: 'Cancelamento', description: 'Confirma cancelamento e oferece reagendamento.', defaultDelayMinutes: 0 },
  { trigger: 'appointment_rescheduled', name: 'Reagendamento', description: 'Confirma o novo horário do cliente.', defaultDelayMinutes: 0 },
  { trigger: 'loyalty_cashback', name: 'Cashback / Pontos', description: 'Avisa o cliente sobre crédito ou pontos disponíveis.', defaultDelayMinutes: 0 },
  { trigger: 'waitlist_slot_open', name: 'Lista de espera', description: 'Avisa quando uma vaga abre para a lista de espera.', defaultDelayMinutes: 0 },
];
