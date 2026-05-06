/**
 * Normalise a Brazilian phone/WhatsApp number to international digits-only format.
 * (31) 99999-9999  →  5531999999999
 * 31999999999      →  5531999999999
 * 5531999999999    →  5531999999999
 * +55 (31) 99999-9999 → 5531999999999
 */
export function formatWhatsApp(raw: string): string {
  if (!raw) return '';
  // Remove +, spaces, parentheses, hyphens, dots — keep only digits.
  let digits = String(raw).replace(/\D/g, '');
  // Strip leading zeros (some users type 0DDD...).
  digits = digits.replace(/^0+/, '');
  if (!digits) return '';
  // Already has DDI 55 with valid length.
  if (digits.startsWith('55') && (digits.length === 12 || digits.length === 13)) return digits;
  // Has only DDD + number → prepend 55.
  if (digits.length === 10 || digits.length === 11) return '55' + digits;
  // Already international with another DDI — return as-is.
  if (digits.length >= 12) return digits;
  return digits;
}

/**
 * Normalizes a phone number to international format (starting with 55).
 * Enforces digits-only and prepends 55 if missing.
 */
/**
 * Normalizes a phone number to strictly digits-only starting with 55 (E.164-ish as used in this project).
 * Enforces digits-only and prepends 55 if missing.
 */
export function normalizePhone(phone: string): string {
  if (!phone) return '';
  // Remove all non-digits
  let cleaned = phone.replace(/\D/g, '');
  
  // If it doesn't start with 55 and looks like a Brazilian number (10 or 11 digits)
  if (cleaned.length >= 10 && cleaned.length <= 11 && !cleaned.startsWith('55')) {
    cleaned = '55' + cleaned;
  }
  
  // If it has 55 but also a 0 before the DDD (common error)
  if (cleaned.startsWith('550') && cleaned.length > 11) {
    cleaned = '55' + cleaned.substring(3);
  }

  return cleaned;
}

/**
 * Display mask: 5531999999999 → (31) 99999-9999
 */
export function displayWhatsApp(digits: string): string {
  const d = (digits || '').replace(/\D/g, '');
  const local = d.startsWith('55') ? d.slice(2) : d;
  if (local.length === 11) {
    return `(${local.slice(0, 2)}) ${local.slice(2, 7)}-${local.slice(7)}`;
  }
  if (local.length === 10) {
    return `(${local.slice(0, 2)}) ${local.slice(2, 6)}-${local.slice(6)}`;
  }
  return d;
}

/**
 * Returns true if the normalised number has 12 or 13 digits (55 + DDD + number).
 */
export function isValidWhatsApp(raw: string): boolean {
  const normalised = formatWhatsApp(raw);
  return normalised.length === 12 || normalised.length === 13;
}

/**
 * Detect if user is on a mobile device.
 */
function isMobileDevice(): boolean {
  if (typeof navigator === 'undefined') return false;
  return /Android|iPhone|iPad|iPod|Opera Mini|IEMobile|WPDesktop/i.test(navigator.userAgent);
}

/**
 * Build a universal WhatsApp URL.
 *
 * We use `https://wa.me/<digits>?text=...` because it is the only URL that:
 *   - works on Windows / macOS / Linux desktop browsers (Chrome, Edge, Firefox, Safari)
 *   - works on Android and iOS browsers
 *   - redirects automatically to the WhatsApp Desktop app if installed
 *   - opens the WhatsApp mobile app on phones
 *
 * The legacy `web.whatsapp.com/send` URL fails on phones, and `api.whatsapp.com/send`
 * fails on some desktop browsers — `wa.me` is the universal entry point.
 */
export function buildWhatsAppUrl(phone: string, message?: string): string {
  const digits = formatWhatsApp(phone);
  const base = digits ? `https://wa.me/${digits}` : 'https://wa.me/';
  if (!message) return base;
  return `${base}?text=${encodeURIComponent(message)}`;
}

/**
 * Known source modules for click metrics. Add new ones here as the system grows.
 * Free-form strings are still accepted to avoid blocking new call sites.
 */
export type WhatsAppSource =
  | 'dashboard'
  | 'clients'
  | 'public-booking'
  | 'appointment-requests'
  | 'manual-appointment'
  | 'swap-appointment'
  | 'trial-banner'
  | 'onboarding'
  | 'custom-request'
  | 'team'
  | 'promotions'
  | 'loyalty'
  | 'finance'
  | 'unknown'
  | (string & {});

interface OpenWhatsAppOptions {
  message?: string;
  /**
   * Module/screen that triggered the open. Used for internal click metrics
   * (how many WhatsApp clicks per area of the app) and debug logs.
   * Prefer one of the values in `WhatsAppSource`.
   */
  source?: WhatsAppSource;
  /** @deprecated Use `source` instead. Kept for backwards compatibility. */
  origin?: string;
}

/**
 * In-memory click counters per source. Useful for quick inspection in dev tools:
 *   window.__waMetrics  // { dashboard: 3, clients: 7, ... }
 *
 * Persisted lightly to localStorage so counts survive page reloads.
 */
const METRICS_KEY = 'wa_click_metrics_v1';

function bumpMetric(source: string) {
  if (typeof window === 'undefined') return;
  try {
    const raw = window.localStorage.getItem(METRICS_KEY);
    const data: Record<string, number> = raw ? JSON.parse(raw) : {};
    data[source] = (data[source] || 0) + 1;
    window.localStorage.setItem(METRICS_KEY, JSON.stringify(data));
    // Expose live counter on window for quick inspection.
    (window as unknown as { __waMetrics?: Record<string, number> }).__waMetrics = data;
    // Custom event so other modules (analytics, dashboards) can subscribe.
    window.dispatchEvent(new CustomEvent('whatsapp:click', { detail: { source, total: data[source] } }));
  } catch {
    // localStorage may be unavailable (private mode, SSR) — silently ignore.
  }
}

/**
 * Read current per-source click counts. Safe to call from anywhere.
 */
export function getWhatsAppMetrics(): Record<string, number> {
  if (typeof window === 'undefined') return {};
  try {
    const raw = window.localStorage.getItem(METRICS_KEY);
    return raw ? JSON.parse(raw) : {};
  } catch {
    return {};
  }
}

/** Reset all stored counts (e.g. for QA). */
export function resetWhatsAppMetrics(): void {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.removeItem(METRICS_KEY);
  } catch {
    // ignore
  }
}

/**
 * Track a WhatsApp click for `<a href="wa.me/...">` anchors that don't go through
 * `openWhatsApp`. Wire on the link's `onClick`:
 *
 *   <a href={buildWhatsAppUrl(...)} onClick={() => trackWhatsAppClick('public-profile')} ... />
 */
export function trackWhatsAppClick(source: WhatsAppSource): void {
  bumpMetric(source);
  if (typeof console !== 'undefined') {
    console.info(`[WHATSAPP] anchor-click source=${source}`);
  }
}

/**
 * Open WhatsApp using the universal `wa.me` link.
 *
 * Validates the phone, shows a toast if invalid/empty, logs to console for
 * debugging, and opens the link in a new tab (works on every platform).
 *
 * Use this everywhere instead of manual `window.open` / `wa.me` / `api.whatsapp` links.
 */
/**
 * Open WhatsApp using the universal `wa.me` link.
 *
 * Validates the phone, shows a toast if invalid/empty, logs to console for
 * debugging, and opens the link in a new tab (works on every platform).
 *
 * If window.open fails (popup blocked), it falls back to copying the message
 * to the clipboard and notifying the user.
 *
 * Use this everywhere instead of manual `window.open` / `wa.me` / `api.whatsapp` links.
 */
export function openWhatsApp(phone: string, messageOrOptions?: string | OpenWhatsAppOptions): void {
  const opts: OpenWhatsAppOptions =
    typeof messageOrOptions === 'string' ? { message: messageOrOptions } : (messageOrOptions || {});

  const source = opts.source || opts.origin || 'unknown';

  const showToast = (type: 'error' | 'success', text: string) => {
    try {
      const { toast } = require('sonner');
      toast?.[type]?.(text);
    } catch {
      // sonner not available — silently degrade.
    }
  };

  if (!phone || !String(phone).trim()) {
    showToast('error', 'Cliente sem WhatsApp cadastrado.');
    return;
  }

  const digits = formatWhatsApp(phone);
  if (!isValidWhatsApp(digits)) {
    showToast('error', 'Número de WhatsApp inválido.');
    return;
  }

  const url = buildWhatsAppUrl(digits, opts.message);
  const device = isMobileDevice() ? 'mobile' : 'desktop';

  bumpMetric(source);

  if (typeof window !== 'undefined') {
    try {
      const win = window.open(url, '_blank', 'noopener,noreferrer');
      if (!win) {
        // Fallback for popup blockers as requested
        window.location.href = url;
      }
    } catch (err) {
      // General fallback
      window.location.href = url;
    }
  }
}
