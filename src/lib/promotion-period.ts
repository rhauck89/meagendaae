/**
 * Utilitários de validação de período de promoções.
 * Considera start_date/end_date (datas) e start_time/end_time (horários opcionais).
 * Tudo no fuso local da aplicação (datas armazenadas como DATE puro, sem TZ).
 */

export interface PromoPeriod {
  start_date: string;
  end_date: string;
  start_time?: string | null;
  end_time?: string | null;
}

/** Combina date (YYYY-MM-DD) + time (HH:MM[:SS]) em Date local. */
function combine(dateStr: string, timeStr: string | null | undefined, fallback: 'start' | 'end'): Date {
  const time = timeStr ?? (fallback === 'start' ? '00:00:00' : '23:59:59');
  const t = time.length === 5 ? `${time}:00` : time;
  return new Date(`${dateStr}T${t}`);
}

export type PromoStatus = 'upcoming' | 'active' | 'ended';

export function getPromoStatus(promo: PromoPeriod, now: Date = new Date()): PromoStatus {
  const startsAt = combine(promo.start_date, promo.start_time, 'start');
  const endsAt = combine(promo.end_date, promo.end_time, 'end');
  if (now < startsAt) return 'upcoming';
  if (now > endsAt) return 'ended';
  return 'active';
}

export function isPromoActive(promo: PromoPeriod, now: Date = new Date()): boolean {
  return getPromoStatus(promo, now) === 'active';
}

/** Texto amigável tipo "válido até hoje 18:00" / "começa amanhã" */
export function getPromoEndLabel(promo: PromoPeriod, now: Date = new Date()): string {
  const endsAt = combine(promo.end_date, promo.end_time, 'end');
  const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const startOfTomorrow = new Date(startOfToday); startOfTomorrow.setDate(startOfTomorrow.getDate() + 1);
  const startOfDayAfter = new Date(startOfTomorrow); startOfDayAfter.setDate(startOfDayAfter.getDate() + 1);

  const timePart = promo.end_time
    ? ` ${promo.end_time.slice(0, 5)}`
    : '';

  if (endsAt >= startOfToday && endsAt < startOfTomorrow) return `válido até hoje${timePart}`;
  if (endsAt >= startOfTomorrow && endsAt < startOfDayAfter) return `válido até amanhã${timePart}`;
  const dd = String(endsAt.getDate()).padStart(2, '0');
  const mm = String(endsAt.getMonth() + 1).padStart(2, '0');
  return `válido até ${dd}/${mm}${timePart}`;
}

export function getPromoStartLabel(promo: PromoPeriod): string {
  const [y, m, d] = promo.start_date.split('-');
  const timePart = promo.start_time ? ` às ${promo.start_time.slice(0, 5)}` : '';
  return `começa em ${d}/${m}${timePart}`;
}
