import { supabase } from '@/integrations/supabase/client';
import type { WhatsAppStatus, WhatsAppMessageStatus } from './types';

export interface PlatformWhatsAppSettings {
  id: string;
  instance_name: string;
  instance_id: string | null;
  api_url: string;
  api_key: string | null;
  status: WhatsAppStatus;
  connected_phone: string | null;
  qr_code: string | null;
  created_at: string;
  updated_at: string;
}

export interface PlatformWhatsAppTemplate {
  id: string;
  type: string;
  name: string;
  content: string;
  active: boolean;
  created_at: string;
  updated_at: string;
}

export interface PlatformWhatsAppAutomation {
  id: string;
  type: string;
  enabled: boolean;
  template_id: string | null;
  delay_minutes: number;
  daily_limit: number;
  created_at: string;
  updated_at: string;
}

export interface PlatformWhatsAppLog {
  id: string;
  company_id: string | null;
  recipient_user_id: string | null;
  recipient_phone: string;
  type: string;
  message: string;
  status: string;
  error: string | null;
  created_at: string;
}

// ---------------------------------------------------------------------------
// Service Layer
// ---------------------------------------------------------------------------

async function callPlatformEdgeFunction(action: string, params: any = {}) {
  const { data, error } = await supabase.functions.invoke('platform-whatsapp-integration', {
    body: { action, ...params },
  });
  if (error) throw error;
  return data;
}

export async function getPlatformSettings(): Promise<PlatformWhatsAppSettings | null> {
  const { data, error } = await supabase
    .from('platform_whatsapp_settings')
    .select('*')
    .limit(1)
    .maybeSingle();
  if (error) throw error;
  return data as PlatformWhatsAppSettings | null;
}

export async function connectPlatformInstance(instanceName: string, apiUrl: string, apiKey: string): Promise<PlatformWhatsAppSettings> {
  return callPlatformEdgeFunction('connect', { instanceName, apiUrl, apiKey });
}

export async function disconnectPlatformInstance(): Promise<void> {
  await callPlatformEdgeFunction('disconnect');
}

export async function sendPlatformTest(phone: string, text: string): Promise<any> {
  return callPlatformEdgeFunction('send-test', { phone, text });
}

export async function listPlatformTemplates(): Promise<PlatformWhatsAppTemplate[]> {
  const { data, error } = await supabase
    .from('platform_whatsapp_templates')
    .select('*')
    .order('created_at', { ascending: false });
  if (error) throw error;
  return data || [];
}

export async function savePlatformTemplate(template: Partial<PlatformWhatsAppTemplate>): Promise<PlatformWhatsAppTemplate> {
  const { data, error } = await supabase
    .from('platform_whatsapp_templates')
    .upsert(template)
    .select()
    .single();
  if (error) throw error;
  return data;
}

export async function listPlatformAutomations(): Promise<PlatformWhatsAppAutomation[]> {
  const { data, error } = await supabase
    .from('platform_whatsapp_automations')
    .select('*')
    .order('type');
  if (error) throw error;
  return data || [];
}

export async function togglePlatformAutomation(id: string, enabled: boolean): Promise<void> {
  const { error } = await supabase
    .from('platform_whatsapp_automations')
    .update({ enabled })
    .eq('id', id);
  if (error) throw error;
}

export async function listPlatformLogs(limit = 100): Promise<PlatformWhatsAppLog[]> {
  const { data, error } = await supabase
    .from('platform_whatsapp_logs')
    .select('*')
    .order('created_at', { ascending: false })
    .limit(limit);
  if (error) throw error;
  return data || [];
}
