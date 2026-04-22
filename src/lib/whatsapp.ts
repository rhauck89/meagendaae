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

interface OpenWhatsAppOptions {
  message?: string;
  /** Shown in console logs to help trace which screen triggered the open. */
  origin?: string;
}

/**
 * Open WhatsApp using the universal `wa.me` link.
 *
 * Validates the phone, shows a toast if invalid/empty, logs to console for
 * debugging, and opens the link in a new tab (works on every platform).
 *
 * Use this everywhere instead of manual `window.open` / `wa.me` / `api.whatsapp` links.
 */
export function openWhatsApp(phone: string, messageOrOptions?: string | OpenWhatsAppOptions): void {
  const opts: OpenWhatsAppOptions =
    typeof messageOrOptions === 'string' ? { message: messageOrOptions } : (messageOrOptions || {});

  // Lazy import to avoid circular deps and keep tree-shakeable in non-UI contexts.
  const showToast = (type: 'error', text: string) => {
    try {
      // eslint-disable-next-line @typescript-eslint/no-var-requires
      const { toast } = require('sonner');
      toast?.[type]?.(text);
    } catch {
      // sonner not available — silently degrade.
    }
  };

  if (!phone || !String(phone).trim()) {
    showToast('error', 'Cliente sem WhatsApp cadastrado.');
    if (typeof console !== 'undefined') {
      console.warn('[WHATSAPP] empty phone', { origin: opts.origin });
    }
    return;
  }

  const digits = formatWhatsApp(phone);
  if (!isValidWhatsApp(digits)) {
    showToast('error', 'Número de WhatsApp inválido.');
    if (typeof console !== 'undefined') {
      console.warn('[WHATSAPP] invalid phone', { phone, digits, origin: opts.origin });
    }
    return;
  }

  const url = buildWhatsAppUrl(digits, opts.message);
  const device = isMobileDevice() ? 'mobile' : 'desktop';

  if (typeof console !== 'undefined') {
    // Compact debug breadcrumb — useful when users report broken links.
    console.info(`[WHATSAPP] device=${device} phone=${digits} target=wa.me origin=${opts.origin || 'unknown'}`);
  }

  if (typeof window !== 'undefined') {
    const win = window.open(url, '_blank', 'noopener,noreferrer');
    if (!win) {
      // Popup blocked — fall back to same-tab navigation.
      window.location.href = url;
    }
  }
}
