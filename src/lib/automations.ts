/**
 * Centralized automations / outbound webhooks helper.
 * Fire-and-forget integration with Make.com (or other no-code platforms).
 *
 * Rules:
 * - Never block the main flow on webhook failures.
 * - 5s timeout maximum.
 * - Silent try/catch with console logging only.
 * - No tokens are exposed in the frontend (public Make webhook URL only).
 */

const MAKE_WEBHOOK_URL =
  'https://hook.us2.make.com/pd4ugdx38at1mvzfvhs13um0bxy3axd3';

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
  payload: Record<string, unknown>
): Promise<void> {
  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(
      () => controller.abort(),
      WEBHOOK_TIMEOUT_MS
    );

    const response = await fetch(MAKE_WEBHOOK_URL, {
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
 * Sends the "appointment_created" event to the Make webhook.
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
  // Fire and forget — do NOT await in caller.
  void dispatchWebhook(payload);
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
  void dispatchWebhook({
    event: 'appointment_rescheduled' as const,
    created_at: new Date().toISOString(),
    ...data,
  });
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
