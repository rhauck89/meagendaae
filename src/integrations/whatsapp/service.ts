/**
 * WhatsApp Center service layer.
 *
 * Mocked Evolution API integration. Real calls will be wired up later;
 * this module exposes the surface so the UI can be built and tested today.
 */
import { supabase } from '@/integrations/supabase/client';
import type {
  WhatsAppInstance,
  WhatsAppAutomation,
  WhatsAppTemplate,
  WhatsAppLog,
  WhatsAppMetric,
  WhatsAppStatus,
} from './types';

// ---------------------------------------------------------------------------
// Instance / connection
// ---------------------------------------------------------------------------

export async function getInstance(companyId: string): Promise<WhatsAppInstance | null> {
  const { data, error } = await supabase
    .from('whatsapp_instances')
    .select('*')
    .eq('company_id', companyId)
    .maybeSingle();
  if (error) throw error;
  return (data as WhatsAppInstance | null) ?? null;
}

async function upsertInstance(companyId: string, patch: Partial<WhatsAppInstance>) {
  const { data, error } = await supabase
    .from('whatsapp_instances')
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    .upsert([{ company_id: companyId, ...patch }] as any, { onConflict: 'company_id' })
    .select()
    .single();
  if (error) throw error;
  return data as WhatsAppInstance;
}

/**
 * MOCK — eventually calls Evolution API to spin up an instance and return a QR.
 */
export async function connectInstance(companyId: string): Promise<WhatsAppInstance> {
  const fakeQr =
    'data:image/svg+xml;base64,' +
    btoa(
      `<svg xmlns="http://www.w3.org/2000/svg" width="240" height="240" viewBox="0 0 240 240">
        <rect width="240" height="240" fill="#ffffff"/>
        <g fill="#000000">
          ${Array.from({ length: 144 })
            .map((_, i) => {
              const x = (i % 12) * 18 + 12;
              const y = Math.floor(i / 12) * 18 + 12;
              return Math.random() > 0.5 ? `<rect x="${x}" y="${y}" width="16" height="16"/>` : '';
            })
            .join('')}
        </g>
      </svg>`,
    );
  return upsertInstance(companyId, {
    status: 'connecting',
    qr_code: fakeQr,
    instance_id: `mock-${companyId.slice(0, 8)}`,
    session_name: `agendae-${companyId.slice(0, 8)}`,
  });
}

export async function disconnectInstance(companyId: string): Promise<WhatsAppInstance> {
  return upsertInstance(companyId, {
    status: 'disconnected',
    qr_code: null,
    phone: null,
    connected_at: null,
  });
}

export async function setInstanceStatus(
  companyId: string,
  status: WhatsAppStatus,
  phone?: string,
): Promise<WhatsAppInstance> {
  const patch: Partial<WhatsAppInstance> = { status };
  if (status === 'connected') {
    patch.connected_at = new Date().toISOString();
    patch.last_seen_at = new Date().toISOString();
    patch.qr_code = null;
    if (phone) patch.phone = phone;
  }
  return upsertInstance(companyId, patch);
}

/** MOCK send a test message — logs it and returns a fake id. */
export async function sendTest(companyId: string, phone: string, body: string): Promise<WhatsAppLog> {
  return logMessage({
    company_id: companyId,
    phone,
    body,
    message_type: 'test',
    source: 'whatsapp-center-test',
    status: 'sent',
  });
}

// ---------------------------------------------------------------------------
// Automations
// ---------------------------------------------------------------------------

export async function listAutomations(companyId: string): Promise<WhatsAppAutomation[]> {
  const { data, error } = await supabase
    .from('whatsapp_automations')
    .select('*')
    .eq('company_id', companyId)
    .order('created_at');
  if (error) throw error;
  return (data ?? []) as WhatsAppAutomation[];
}

export async function upsertAutomation(
  companyId: string,
  automation: Partial<WhatsAppAutomation> & { trigger: WhatsAppAutomation['trigger']; name: string },
): Promise<WhatsAppAutomation> {
  const { data, error } = await supabase
    .from('whatsapp_automations')
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    .upsert([{ company_id: companyId, ...automation }] as any, { onConflict: 'company_id,trigger' })
    .select()
    .single();
  if (error) throw error;
  return data as WhatsAppAutomation;
}

export async function toggleAutomation(id: string, enabled: boolean) {
  const { error } = await supabase.from('whatsapp_automations').update({ enabled }).eq('id', id);
  if (error) throw error;
}

// ---------------------------------------------------------------------------
// Templates
// ---------------------------------------------------------------------------

export async function listTemplates(companyId: string): Promise<WhatsAppTemplate[]> {
  const { data, error } = await supabase
    .from('whatsapp_templates')
    .select('*')
    .eq('company_id', companyId)
    .order('created_at', { ascending: false });
  if (error) throw error;
  return (data ?? []) as WhatsAppTemplate[];
}

export async function saveTemplate(
  companyId: string,
  template: Partial<WhatsAppTemplate> & { name: string; body: string },
): Promise<WhatsAppTemplate> {
  const payload = { company_id: companyId, ...template };
  const query = template.id
    ? supabase.from('whatsapp_templates').update(payload).eq('id', template.id).select().single()
    : supabase.from('whatsapp_templates').insert(payload).select().single();
  const { data, error } = await query;
  if (error) throw error;
  return data as WhatsAppTemplate;
}

export async function deleteTemplate(id: string) {
  const { error } = await supabase.from('whatsapp_templates').delete().eq('id', id);
  if (error) throw error;
}

// ---------------------------------------------------------------------------
// Logs / metrics
// ---------------------------------------------------------------------------

export async function listLogs(
  companyId: string,
  opts: { limit?: number; status?: string; sinceDays?: number } = {},
): Promise<WhatsAppLog[]> {
  let query = supabase
    .from('whatsapp_logs')
    .select('*')
    .eq('company_id', companyId)
    .order('created_at', { ascending: false })
    .limit(opts.limit ?? 100);
  if (opts.status) query = query.eq('status', opts.status as WhatsAppLog['status']);
  if (opts.sinceDays) {
    const since = new Date();
    since.setDate(since.getDate() - opts.sinceDays);
    query = query.gte('created_at', since.toISOString());
  }
  const { data, error } = await query;
  if (error) throw error;
  return (data ?? []) as WhatsAppLog[];
}

export async function logMessage(
  entry: Partial<WhatsAppLog> & { company_id: string; phone: string; body: string },
): Promise<WhatsAppLog> {
  const { data, error } = await supabase
    .from('whatsapp_logs')
    .insert({ message_type: 'manual', status: 'sent', ...entry })
    .select()
    .single();
  if (error) throw error;
  return data as WhatsAppLog;
}

export async function listMetrics(companyId: string, days = 30): Promise<WhatsAppMetric[]> {
  const since = new Date();
  since.setDate(since.getDate() - days);
  const { data, error } = await supabase
    .from('whatsapp_metrics')
    .select('*')
    .eq('company_id', companyId)
    .gte('metric_date', since.toISOString().slice(0, 10))
    .order('metric_date');
  if (error) throw error;
  return (data ?? []) as WhatsAppMetric[];
}
