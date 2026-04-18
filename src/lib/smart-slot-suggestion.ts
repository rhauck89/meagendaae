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

/**
 * Pick the slot with the smallest leftover minutes between (slot end + duration)
 * and the start of the next existing appointment on the same day.
 *
 * Slots without a "next appointment" after them (i.e. open-ended) are ranked last.
 * Ties are broken by the earliest start time.
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

  // Collect occupied start times (in minutes since midnight, in target tz)
  const occupiedStarts = appointments
    .map((a) => apptStartMinutesInTz(a.start_time, timezone))
    .sort((a, b) => a - b);

  let best: SmartSuggestion | null = null;

  for (const slot of slots) {
    const start = slotToMinutes(slot);
    const end = start + serviceDuration;
    // Find the next appointment that starts AT OR AFTER our end
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
