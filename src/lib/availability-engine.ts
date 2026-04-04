import { addMinutes, format, parseISO } from 'date-fns';

export type BookingMode = 'intelligent' | 'fixed_grid' | 'hybrid';

export interface BusinessHours {
  day_of_week: number;
  open_time: string;
  close_time: string;
  lunch_start: string | null;
  lunch_end: string | null;
  is_closed: boolean;
}

export interface BusinessException {
  exception_date: string;
  is_closed: boolean;
  open_time: string | null;
  close_time: string | null;
}

export interface ExistingAppointment {
  start_time: string;
  end_time: string;
}

export interface BlockedTime {
  block_date: string;
  start_time: string;
  end_time: string;
}

export interface AvailabilityParams {
  date: Date;
  totalDuration: number;
  businessHours: BusinessHours[];
  exceptions: BusinessException[];
  existingAppointments: ExistingAppointment[];
  slotInterval?: number;
  bufferMinutes?: number;
  professionalHours?: BusinessHours[];
  blockedTimes?: BlockedTime[];
  professionalId?: string;
  bookingMode?: BookingMode;
}

/**
 * Parse a time string "HH:mm" or "HH:mm:ss" into a Date on the given base date.
 */
function parseTime(t: string, baseDate: Date): Date {
  const [h, m] = t.split(':').map(Number);
  const d = new Date(baseDate);
  d.setHours(h, m, 0, 0);
  return d;
}

/**
 * Build the list of blocked intervals from lunch, existing appointments, and manual blocks.
 */
function buildBlockedIntervals(
  date: Date,
  dateStr: string,
  hours: BusinessHours,
  existingAppointments: ExistingAppointment[],
  blockedTimes: BlockedTime[],
  bufferMinutes: number
): Array<{ start: Date; end: Date }> {
  const blocked: Array<{ start: Date; end: Date }> = [];

  const lunchStart = hours.lunch_start ? parseTime(hours.lunch_start, date) : null;
  const lunchEnd = hours.lunch_end ? parseTime(hours.lunch_end, date) : null;
  if (lunchStart && lunchEnd) {
    blocked.push({ start: lunchStart, end: lunchEnd });
  }

  for (const apt of existingAppointments) {
    const aptStart = parseISO(apt.start_time);
    const aptEnd = addMinutes(parseISO(apt.end_time), bufferMinutes);
    blocked.push({ start: aptStart, end: aptEnd });
  }

  for (const bt of blockedTimes) {
    if (bt.block_date === dateStr) {
      blocked.push({ start: parseTime(bt.start_time, date), end: parseTime(bt.end_time, date) });
    }
  }

  blocked.sort((a, b) => a.start.getTime() - b.start.getTime());
  return blocked;
}

/**
 * Get the earliest allowed slot time if the date is today.
 */
function getEarliestSlotTime(date: Date, slotInterval: number): Date | null {
  const now = new Date();
  const isToday = date.getFullYear() === now.getFullYear() &&
    date.getMonth() === now.getMonth() &&
    date.getDate() === now.getDate();

  if (!isToday) return null;

  const nowMinutes = now.getHours() * 60 + now.getMinutes();
  const roundedMinutes = Math.ceil(nowMinutes / slotInterval) * slotInterval;
  const earliest = new Date(date);
  earliest.setHours(Math.floor(roundedMinutes / 60), roundedMinutes % 60, 0, 0);
  return earliest;
}

/**
 * Resolve working hours for a given date, considering exceptions and professional overrides.
 */
function resolveWorkingHours(
  date: Date,
  businessHours: BusinessHours[],
  professionalHours: BusinessHours[] | undefined,
  exceptions: BusinessException[]
): { hours: BusinessHours; openTimeStr: string; closeTimeStr: string } | null {
  const dateStr = format(date, 'yyyy-MM-dd');
  const exception = exceptions.find((e) => e.exception_date === dateStr);
  if (exception?.is_closed) return null;

  const dayOfWeek = date.getDay();
  const activeHours = (professionalHours && professionalHours.length > 0) ? professionalHours : businessHours;
  const hours = activeHours.find((h) => h.day_of_week === dayOfWeek);
  if (!hours || hours.is_closed) return null;

  return {
    hours,
    openTimeStr: exception?.open_time || hours.open_time,
    closeTimeStr: exception?.close_time || hours.close_time,
  };
}

/**
 * FIXED GRID MODE: Slots at regular intervals regardless of service duration.
 * Uses slotInterval as the fixed step (e.g. every 15, 30, 45, or 60 min).
 */
function calculateFixedGridSlots(
  date: Date,
  openTime: Date,
  closeTime: Date,
  totalDuration: number,
  bufferMinutes: number,
  slotInterval: number,
  blocked: Array<{ start: Date; end: Date }>,
  earliestSlotTime: Date | null
): string[] {
  const effectiveDuration = totalDuration + bufferMinutes;
  const slots: string[] = [];
  let current = new Date(openTime);

  while (current.getTime() + effectiveDuration * 60000 <= closeTime.getTime()) {
    const slotEnd = addMinutes(current, effectiveDuration);

    if (earliestSlotTime && current < earliestSlotTime) {
      current = addMinutes(current, slotInterval);
      continue;
    }

    const hasConflict = blocked.some(
      (b) => current < b.end && slotEnd > b.start
    );

    if (!hasConflict) {
      slots.push(format(current, 'HH:mm'));
    }

    current = addMinutes(current, slotInterval);
  }

  return slots;
}

/**
 * INTELLIGENT MODE: Slots are calculated dynamically based on real free gaps.
 * After each existing appointment, the next slot starts at appointment_end + buffer.
 * This prevents unusable gaps in the schedule.
 */
function calculateIntelligentSlots(
  date: Date,
  openTime: Date,
  closeTime: Date,
  totalDuration: number,
  bufferMinutes: number,
  blocked: Array<{ start: Date; end: Date }>,
  earliestSlotTime: Date | null
): string[] {
  const effectiveDuration = totalDuration + bufferMinutes;

  // Build free windows by subtracting blocked intervals from [openTime, closeTime]
  const freeWindows: Array<{ start: Date; end: Date }> = [];
  let windowStart = new Date(openTime);

  for (const b of blocked) {
    if (b.start > windowStart && b.start < closeTime) {
      freeWindows.push({ start: new Date(windowStart), end: new Date(b.start) });
    }
    if (b.end > windowStart) {
      windowStart = new Date(b.end);
    }
  }
  if (windowStart < closeTime) {
    freeWindows.push({ start: new Date(windowStart), end: new Date(closeTime) });
  }

  const slots: string[] = [];

  for (const window of freeWindows) {
    let current = new Date(window.start);

    while (current.getTime() + effectiveDuration * 60000 <= window.end.getTime()) {
      if (earliestSlotTime && current < earliestSlotTime) {
        // In intelligent mode, jump by service duration to avoid tiny increments
        current = addMinutes(current, totalDuration + bufferMinutes);
        continue;
      }

      slots.push(format(current, 'HH:mm'));
      // Next slot starts right after this service + buffer
      current = addMinutes(current, totalDuration + bufferMinutes);
    }
  }

  return slots;
}

/**
 * HYBRID MODE: Uses fixed grid intervals but validates each slot
 * can actually fit the service duration without overlapping blocked intervals.
 * Combines predictable grid times with intelligent gap prevention.
 */
function calculateHybridSlots(
  date: Date,
  openTime: Date,
  closeTime: Date,
  totalDuration: number,
  bufferMinutes: number,
  slotInterval: number,
  blocked: Array<{ start: Date; end: Date }>,
  earliestSlotTime: Date | null
): string[] {
  const effectiveDuration = totalDuration + bufferMinutes;
  const slots: string[] = [];
  let current = new Date(openTime);

  while (current.getTime() + effectiveDuration * 60000 <= closeTime.getTime()) {
    if (earliestSlotTime && current < earliestSlotTime) {
      current = addMinutes(current, slotInterval);
      continue;
    }

    const slotEnd = addMinutes(current, effectiveDuration);

    const hasConflict = blocked.some(
      (b) => current < b.end && slotEnd > b.start
    );

    if (!hasConflict) {
      slots.push(format(current, 'HH:mm'));
    }

    current = addMinutes(current, slotInterval);
  }

  return slots;
}

/**
 * Smart availability engine that calculates available time slots.
 * Supports two modes:
 * - fixed_grid: Regular intervals (default, backward compatible)
 * - intelligent: Dynamic gaps based on service duration + buffer
 */
export function calculateAvailableSlots(params: AvailabilityParams): string[] {
  const {
    date,
    totalDuration,
    businessHours,
    exceptions,
    existingAppointments,
    slotInterval = 15,
    bufferMinutes = 0,
    professionalHours,
    blockedTimes = [],
    professionalId,
    bookingMode = 'fixed_grid',
  } = params;

  if (totalDuration <= 0) {
    console.warn('[AvailabilityEngine] totalDuration <= 0, returning no slots');
    return [];
  }

  const dateStr = format(date, 'yyyy-MM-dd');

  const resolved = resolveWorkingHours(date, businessHours, professionalHours, exceptions);
  if (!resolved) return [];

  const { hours, openTimeStr, closeTimeStr } = resolved;
  const openTime = parseTime(openTimeStr, date);
  const closeTime = parseTime(closeTimeStr, date);

  const blocked = buildBlockedIntervals(date, dateStr, hours, existingAppointments, blockedTimes, bufferMinutes);
  const earliestSlotTime = getEarliestSlotTime(date, bookingMode === 'intelligent' ? 5 : slotInterval);

  let slots: string[];

  if (bookingMode === 'intelligent') {
    slots = calculateIntelligentSlots(date, openTime, closeTime, totalDuration, bufferMinutes, blocked, earliestSlotTime);
  } else if (bookingMode === 'hybrid') {
    slots = calculateHybridSlots(date, openTime, closeTime, totalDuration, bufferMinutes, slotInterval, blocked, earliestSlotTime);
  } else {
    slots = calculateFixedGridSlots(date, openTime, closeTime, totalDuration, bufferMinutes, slotInterval, blocked, earliestSlotTime);
  }

  console.log('[AvailabilityEngine] Result', {
    professionalId: professionalId ?? 'N/A',
    date: dateStr,
    bookingMode,
    totalDuration,
    bufferMinutes,
    slotInterval,
    openTime: format(openTime, 'HH:mm'),
    closeTime: format(closeTime, 'HH:mm'),
    blockedIntervals: blocked.length,
    slotsFound: slots.length,
  });

  return slots;
}
