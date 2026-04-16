/**
 * Normalise a Brazilian phone/WhatsApp number to international digits-only format.
 * (31) 99999-9999  →  5531999999999
 * 31999999999      →  5531999999999
 * 5531999999999    →  5531999999999
 */
export function formatWhatsApp(raw: string): string {
  const digits = raw.replace(/\D/g, '');
  if (digits.startsWith('55') && digits.length >= 12) return digits;
  if (digits.length >= 10) return '55' + digits;
  return digits;
}

/**
 * Display mask: 5531999999999 → (31) 99999-9999
 */
export function displayWhatsApp(digits: string): string {
  const d = digits.replace(/\D/g, '');
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
 * Returns true if the normalised number has at least 12 digits (55 + DDD + number).
 */
export function isValidWhatsApp(raw: string): boolean {
  const normalised = formatWhatsApp(raw);
  return normalised.length >= 12 && normalised.length <= 13;
}

/**
 * Detect if user is on a mobile device.
 */
function isMobileDevice(): boolean {
  if (typeof navigator === 'undefined') return false;
  return /Android|iPhone|iPad|iPod|Opera Mini|IEMobile|WPDesktop/i.test(navigator.userAgent);
}

/**
 * Build the correct WhatsApp URL based on environment (mobile vs desktop).
 */
export function buildWhatsAppUrl(phone: string, message?: string): string {
  const digits = formatWhatsApp(phone);
  const base = isMobileDevice()
    ? 'https://api.whatsapp.com/send'
    : 'https://web.whatsapp.com/send';
  const params = new URLSearchParams();
  if (digits) params.set('phone', digits);
  if (message) params.set('text', message);
  return `${base}?${params.toString()}`;
}

/**
 * Open WhatsApp with the correct URL for the current device.
 * Use this everywhere instead of manual window.open / wa.me links.
 */
export function openWhatsApp(phone: string, message?: string): void {
  const url = buildWhatsAppUrl(phone, message);
  window.open(url, '_blank');
}
