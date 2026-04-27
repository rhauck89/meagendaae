import { supabase } from '@/integrations/supabase/client';

/**
 * Centralized automations / outbound webhooks helper.
 * 
 * Rules:
 * - Never block the main flow on automation failures.
 * - 5s timeout maximum.
 * - Silent try/catch with console logging only.
 */

const MAKE_WEBHOOK_URL =
  'https://hook.us2.make.com/pd4ugdx38at1mvzfvhs13um0bxy3axd3';

const MAKE_WEBHOOK_URL_RESCHEDULED =
  'https://hook.us2.make.com/j79bi13udqwnxm7xp27z89nmj1yswdyk';

const WEBHOOK_TIMEOUT_MS = 5000;

export type AppointmentOrigin =
  | 'dashboard'
  | 'public'
  | 'open'
  | 'request'
  | 'waitlist'
  | 'unknown';

export type AutomationEvent =
  | 'appointment_created'
  | 'appointment_cancelled'
  | 'appointment_rescheduled'
  | 'appointment_completed';

export interface AppointmentWebhookData {
  event?: AutomationEvent;
  appointment_id: string;
  company_id: string;
  client_name?: string | null;
  client_phone?: string | null;
  professional_name?: string | null;
  service_name?: string | null;
  service_price?: number | null;
  appointment_date?: string | null; // YYYY-MM-DD
  appointment_time?: string | null; // HH:mm
  datetime_iso?: string | null;
  origin?: AppointmentOrigin;
  created_at?: string;
  [key: string]: unknown;
}

/**
 * Generic dispatcher (fire-and-forget, never throws).
 */
async function dispatchWebhook(
  payload: Record<string, unknown>,
  url: string = MAKE_WEBHOOK_URL
): Promise<void> {
  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(
      () => controller.abort(),
      WEBHOOK_TIMEOUT_MS
    );

    const response = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
      signal: controller.signal,
      // keepalive lets the request survive a page unload
      keepalive: true,
    }).catch((err) => {
      console.warn('[automations] webhook fetch failed:', err?.message || err);
      return null;
    });

    clearTimeout(timeoutId);

    if (response && !response.ok) {
      console.warn(
        '[automations] webhook responded with non-OK status:',
        response.status
      );
    } else if (response) {
      console.info('[automations] webhook dispatched:', payload.event);
    }
  } catch (err: any) {
    // Silent — automations must never break the user flow.
    console.warn('[automations] dispatch error (ignored):', err?.message || err);
  }
}

/**
 * Sends a native WhatsApp confirmation using the Evolution API integration.
 */
async function sendNativeWhatsAppConfirmation(data: AppointmentWebhookData) {
  try {
    const { appointment_id, company_id, client_name, client_phone, professional_name, service_name, appointment_date, appointment_time } = data;
    
    if (!client_phone) return;

    // Format date for display
    const dateArr = appointment_date?.split('-') || [];
    const displayDate = dateArr.length === 3 ? `${dateArr[2]}/${dateArr[1]}/${dateArr[0]}` : appointment_date;

    const message = `Olá ${client_name} 👋\nSeu horário foi confirmado:\n\n📅 ${displayDate}\n🕐 ${appointment_time}\n✂️ ${service_name}\n👤 ${professional_name}`;

    const { error } = await supabase.functions.invoke('whatsapp-integration', {
      body: {
        action: 'send-message',
        companyId: company_id,
        phone: client_phone,
        message,
        type: 'appointment_confirmed',
        appointmentId: appointment_id,
        clientName: client_name
      }
    });

    if (error) {
      console.warn('[automations] Native WhatsApp confirmation failed:', error);
    } else {
      console.info('[automations] Native WhatsApp confirmation sent');
    }
  } catch (err) {
    console.warn('[automations] Native WhatsApp error (ignored):', err);
  }
}

/**
 * Sends the "appointment_created" event to the Make webhook and native WhatsApp.
 * Safe to call after the appointment row is persisted.
 */
export function sendAppointmentCreatedWebhook(
  data: AppointmentWebhookData
): void {
  const payload = {
    event: 'appointment_created' as const,
    created_at: new Date().toISOString(),
    ...data,
  };
  // Fire and forget webhooks
  void dispatchWebhook(payload);
  
  // Fire and forget native WhatsApp
  void sendNativeWhatsAppConfirmation(data);
}

/**
 * Reserved for future use. Same fire-and-forget contract.
 */
export function sendAppointmentCancelledWebhook(
  data: AppointmentWebhookData
): void {
  void dispatchWebhook({
    event: 'appointment_cancelled' as const,
    created_at: new Date().toISOString(),
    ...data,
  });
}

export function sendAppointmentRescheduledWebhook(
  data: AppointmentWebhookData
): void {
  void dispatchWebhook(
    {
      event: 'appointment_rescheduled' as const,
      created_at: new Date().toISOString(),
      ...data,
    },
    MAKE_WEBHOOK_URL_RESCHEDULED
  );
}

export function sendAppointmentCompletedWebhook(
  data: AppointmentWebhookData
): void {
  void dispatchWebhook({
    event: 'appointment_completed' as const,
    created_at: new Date().toISOString(),
    ...data,
  });
}
