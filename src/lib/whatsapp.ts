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
