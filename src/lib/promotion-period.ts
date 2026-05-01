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
  booking_opens_at?: string | null;
  booking_closes_at?: string | null;
}

/** Combina date (YYYY-MM-DD) + time (HH:MM[:SS]) em Date local. */
function combine(dateStr: string, timeStr: string | null | undefined, fallback: 'start' | 'end'): Date {
  const time = timeStr ?? (fallback === 'start' ? '00:00:00' : '23:59:59');
  const t = time.length === 5 ? `${time}:00` : time;
  return new Date(`${dateStr}T${t}`);
}

export type PromoStatus = 'upcoming' | 'active' | 'ended';

/** 
 * Verifica o status de VALIDADE da promoção (quais horários podem receber o desconto).
 */
export function getPromoValidityStatus(promo: PromoPeriod, now: Date = new Date()): PromoStatus {
  const startsAt = combine(promo.start_date, promo.start_time, 'start');
  const endsAt = combine(promo.end_date, promo.end_time, 'end');
  if (now < startsAt) return 'upcoming';
  if (now > endsAt) return 'ended';
  return 'active';
}

/** 
 * Verifica se um horário específico (slot) é elegível para o desconto da promoção.
 */
export function isSlotEligible(promo: PromoPeriod, slotTime: Date): boolean {
  return getPromoValidityStatus(promo, slotTime) === 'active';
}

/** 
 * Verifica se a promoção está LIBERADA PARA AGENDAMENTO no momento atual.
 */
export function getBookingStatus(promo: PromoPeriod, now: Date = new Date()): PromoStatus {
  const opensAt = promo.booking_opens_at ? new Date(promo.booking_opens_at) : null;
  const closesAt = promo.booking_closes_at ? new Date(promo.booking_closes_at) : null;
  
  // Se não houver data de abertura, usamos o início da promoção como fallback seguro
  const effectiveOpensAt = opensAt || combine(promo.start_date, promo.start_time, 'start');
  
  // Se não houver data de fechamento, usamos o fim da promoção como fallback
  const effectiveClosesAt = closesAt || combine(promo.end_date, promo.end_time, 'end');

  if (now < effectiveOpensAt) return 'upcoming';
  if (now > effectiveClosesAt) return 'ended';
  return 'active';
}

/** Legado para compatibilidade: agora se refere à liberação para agendamento. */
export function isPromoActive(promo: PromoPeriod, now: Date = new Date()): boolean {
  return getBookingStatus(promo, now) === 'active';
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
