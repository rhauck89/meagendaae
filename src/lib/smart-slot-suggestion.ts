/**
 * Smart slot suggestion (gap fitting).
 *
 * Given a list of valid slots already produced by the availability engine,
 * find the one that "fits best" in the agenda — i.e. the slot whose end time
 * leaves the smallest leftover before the next existing appointment.
 *
 * This is purely a UX layer. It does NOT change generation, validation, or
 * any business logic. If no good fit exists, the caller should fall back to
 * the first available slot.
 */
import type { ExistingAppointment } from './availability-engine';

const DEFAULT_TZ = 'America/Sao_Paulo';

const slotToMinutes = (slot: string) => {
  const [h, m] = slot.split(':').map(Number);
  return (h || 0) * 60 + (m || 0);
};

const apptStartMinutesInTz = (iso: string, tz: string) => {
  const parts = new Intl.DateTimeFormat('en-GB', {
    timeZone: tz, hour: '2-digit', minute: '2-digit', hour12: false,
  }).formatToParts(new Date(iso));
  const h = Number(parts.find((p) => p.type === 'hour')?.value ?? '0');
  const m = Number(parts.find((p) => p.type === 'minute')?.value ?? '0');
  return h * 60 + m;
};

export interface SmartSuggestion {
  slot: string;
  leftoverMinutes: number; // gap leftover after the service ends (lower = tighter fit)
  reason: 'tight-fit' | 'first-available';
}

export interface AIOperationalSuggestion {
  professionalId: string;
  professionalName: string;
  slot: string;
  date: Date;
  reason: string;
  type: 'same-time' | 'earliest' | 'best-fit';
}

/**
 * Pick the slot with the smallest leftover minutes between (slot end + duration)
 * and the start of the next existing appointment on the same day.
 */
export function pickSmartSuggestion(
  slots: string[],
  appointments: ExistingAppointment[],
  serviceDuration: number,
  timezone: string = DEFAULT_TZ,
): SmartSuggestion | null {
  if (!slots || slots.length === 0) return null;

  if (serviceDuration <= 0) {
    return { slot: slots[0], leftoverMinutes: Infinity, reason: 'first-available' };
  }

  const occupiedStarts = appointments
    .map((a) => apptStartMinutesInTz(a.start_time, timezone))
    .sort((a, b) => a - b);

  let best: SmartSuggestion | null = null;

  for (const slot of slots) {
    const start = slotToMinutes(slot);
    const end = start + serviceDuration;
    const nextStart = occupiedStarts.find((s) => s >= end);
    const leftover = nextStart != null ? nextStart - end : Infinity;

    if (
      !best ||
      leftover < best.leftoverMinutes ||
      (leftover === best.leftoverMinutes && start < slotToMinutes(best.slot))
    ) {
      best = {
        slot,
        leftoverMinutes: leftover,
        reason: leftover === Infinity ? 'first-available' : 'tight-fit',
      };
    }
  }

  return best;
}

/**
 * MVP AI Operational Suggestion.
 * Ranks suggestions based on:
 * 1. Professional available at the exact same time (priority)
 * 2. Earliest slot for the same professional
 * 3. Best gap fit overall
 */
export function calculateAIOperationalSuggestion(
  currentAppointment: { 
    start_time: string; 
    professional_id: string; 
    professional_name: string;
    duration: number;
  },
  availabilities: Array<{
    professionalId: string;
    professionalName: string;
    slots: string[];
    appointments: ExistingAppointment[];
  }>,
  date: Date
): AIOperationalSuggestion | null {
  const currentStart = format(new Date(currentAppointment.start_time), 'HH:mm');
  
  // 1. Try "Same Time, Different Professional"
  for (const avail of availabilities) {
    if (avail.professionalId === currentAppointment.professional_id) continue;
    if (avail.slots.includes(currentStart)) {
      return {
        professionalId: avail.professionalId,
        professionalName: avail.professionalName,
        slot: currentStart,
        date,
        type: 'same-time',
        reason: `${avail.professionalName} está disponível neste mesmo horário.`
      };
    }
  }

  // 2. Try "Earliest for Same Professional" (if not current slot)
  const currentProfAvail = availabilities.find(a => a.professionalId === currentAppointment.professional_id);
  if (currentProfAvail) {
    const otherSlots = currentProfAvail.slots.filter(s => s !== currentStart);
    if (otherSlots.length > 0) {
      // Find the slot closest to current time (could be before or after, but usually we want "next")
      const nextSlot = otherSlots.find(s => s > currentStart) || otherSlots[0];
      return {
        professionalId: currentProfAvail.professionalId,
        professionalName: currentProfAvail.professionalName,
        slot: nextSlot,
        date,
        type: 'earliest',
        reason: `Horário mais próximo disponível com ${currentProfAvail.professionalName}.`
      };
    }
  }

  // 3. Try "Best Gap Fit Overall"
  let bestOverall: AIOperationalSuggestion | null = null;
  let minLeftover = Infinity;

  for (const avail of availabilities) {
    const smart = pickSmartSuggestion(avail.slots, avail.appointments, currentAppointment.duration);
    if (smart && (smart.leftoverMinutes < minLeftover || !bestOverall)) {
      minLeftover = smart.leftoverMinutes;
      bestOverall = {
        professionalId: avail.professionalId,
        professionalName: avail.professionalName,
        slot: smart.slot,
        date,
        type: 'best-fit',
        reason: `Sugestão baseada na melhor otimização da agenda de ${avail.professionalName}.`
      };
    }
  }

  return bestOverall;
}
