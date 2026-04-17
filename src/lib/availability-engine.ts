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

export interface SlotSuggestion {
  slot: string;
  gapMinutes: number;
  fitsService: boolean;
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
 * NOTE: Buffer is NOT added here — each mode handles buffer in its own slot logic.
 */
function buildBlockedIntervals(
  date: Date,
  dateStr: string,
  hours: BusinessHours,
  existingAppointments: ExistingAppointment[],
  blockedTimes: BlockedTime[],
): Array<{ start: Date; end: Date }> {
  const blocked: Array<{ start: Date; end: Date }> = [];

  const lunchStart = hours.lunch_start ? parseTime(hours.lunch_start, date) : null;
  const lunchEnd = hours.lunch_end ? parseTime(hours.lunch_end, date) : null;
  if (lunchStart && lunchEnd) {
    blocked.push({ start: lunchStart, end: lunchEnd });
  }

  for (const apt of existingAppointments) {
    const aptStart = parseISO(apt.start_time);
    const aptEnd = parseISO(apt.end_time);
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
function getEarliestSlotTime(date: Date, roundTo: number): Date | null {
  const now = new Date();
  const isToday = date.getFullYear() === now.getFullYear() &&
    date.getMonth() === now.getMonth() &&
    date.getDate() === now.getDate();

  if (!isToday) return null;

  const nowMinutes = now.getHours() * 60 + now.getMinutes();
  const roundedMinutes = Math.ceil(nowMinutes / roundTo) * roundTo;
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
 * Build free windows by subtracting blocked intervals (with buffer) from [openTime, closeTime].
 */
function buildFreeWindows(
  openTime: Date,
  closeTime: Date,
  blocked: Array<{ start: Date; end: Date }>,
  bufferMinutes: number
): Array<{ start: Date; end: Date }> {
  const freeWindows: Array<{ start: Date; end: Date }> = [];
  let windowStart = new Date(openTime);

  for (const b of blocked) {
    if (b.start > windowStart && b.start < closeTime) {
      freeWindows.push({ start: new Date(windowStart), end: new Date(b.start) });
    }
    // After each blocked interval, add buffer before next available slot
    const endWithBuffer = addMinutes(b.end, bufferMinutes);
    if (endWithBuffer > windowStart) {
      windowStart = new Date(endWithBuffer);
    }
  }
  if (windowStart < closeTime) {
    freeWindows.push({ start: new Date(windowStart), end: new Date(closeTime) });
  }

  return freeWindows;
}

/**
 * Validate that a slot has enough room to fit the full service duration
 * before hitting the next blocked interval, break, or close of business.
 * This prevents showing slots that visually start free but cannot accommodate the service.
 */
function slotFitsService(
  slotStart: Date,
  totalDuration: number,
  bufferMinutes: number,
  closeTime: Date,
  blocked: Array<{ start: Date; end: Date }>
): boolean {
  const slotEnd = addMinutes(slotStart, totalDuration);
  const slotEndWithBuffer = addMinutes(slotStart, totalDuration + bufferMinutes);

  // Hard ceiling: end of business hours
  if (slotEnd.getTime() > closeTime.getTime()) {
    if (typeof console !== 'undefined') {
      console.log('[SLOT_VALIDATION]', {
        slot: format(slotStart, 'HH:mm'),
        service_duration: totalDuration,
        isValid: false,
        reason: 'exceeds_close_time',
      });
    }
    return false;
  }

  // Check overlap with any blocked interval (lunch, appointments, manual blocks)
  const hasConflict = blocked.some((b) => slotStart < b.end && slotEnd > b.start);
  if (hasConflict) {
    console.log('[SLOT_VALIDATION]', {
      slot: format(slotStart, 'HH:mm'),
      service_duration: totalDuration,
      isValid: false,
      reason: 'overlaps_blocked',
    });
    return false;
  }

  // Buffer after slot must not bleed into next blocked interval
  const bufferConflict = blocked.some((b) => slotEndWithBuffer > b.start && slotEnd <= b.start);
  if (bufferConflict) {
    console.log('[SLOT_VALIDATION]', {
      slot: format(slotStart, 'HH:mm'),
      service_duration: totalDuration,
      isValid: false,
      reason: 'buffer_overlaps_next',
    });
    return false;
  }

  return true;
}

/**
 * FIXED GRID MODE: Slots at regular intervals regardless of service duration.
 * Each slot is validated to ensure the full service fits before showing it.
 */
function calculateFixedGridSlots(
  openTime: Date,
  closeTime: Date,
  totalDuration: number,
  bufferMinutes: number,
  slotInterval: number,
  blocked: Array<{ start: Date; end: Date }>,
  earliestSlotTime: Date | null
): string[] {
  const slots: string[] = [];
  let current = new Date(openTime);

  while (current.getTime() + totalDuration * 60000 <= closeTime.getTime()) {
    if (earliestSlotTime && current < earliestSlotTime) {
      current = addMinutes(current, slotInterval);
      continue;
    }

    if (slotFitsService(current, totalDuration, bufferMinutes, closeTime, blocked)) {
      slots.push(format(current, 'HH:mm'));
    }

    current = addMinutes(current, slotInterval);
  }

  return slots;
}

/**
 * INTELLIGENT MODE: Slots are calculated dynamically based on real free gaps.
 * Slots start at exact gap boundaries — no fixed grid.
 * Example: if a 20min service ends at 11:20 with 5min buffer,
 * next slot starts at 11:25, not 11:30.
 */
function calculateIntelligentSlots(
  openTime: Date,
  closeTime: Date,
  totalDuration: number,
  bufferMinutes: number,
  blocked: Array<{ start: Date; end: Date }>,
  earliestSlotTime: Date | null
): string[] {
  const freeWindows = buildFreeWindows(openTime, closeTime, blocked, bufferMinutes);
  const slots: string[] = [];

  for (const window of freeWindows) {
    let current = new Date(window.start);

    while (current.getTime() + totalDuration * 60000 <= window.end.getTime()) {
      if (earliestSlotTime && current < earliestSlotTime) {
        // Jump forward by 1 minute to find the exact earliest valid time
        current = addMinutes(current, 1);
        continue;
      }

      slots.push(format(current, 'HH:mm'));
      // Next slot starts after service duration + buffer
      current = addMinutes(current, totalDuration + bufferMinutes);
    }
  }

  return slots;
}

/**
 * HYBRID MODE: Uses fixed grid intervals but validates each slot
 * can actually fit the service duration without overlapping blocked intervals.
 */
function calculateHybridSlots(
  openTime: Date,
  closeTime: Date,
  totalDuration: number,
  bufferMinutes: number,
  slotInterval: number,
  blocked: Array<{ start: Date; end: Date }>,
  earliestSlotTime: Date | null
): string[] {
  const slots: string[] = [];
  let current = new Date(openTime);

  while (current.getTime() + totalDuration * 60000 <= closeTime.getTime()) {
    if (earliestSlotTime && current < earliestSlotTime) {
      current = addMinutes(current, slotInterval);
      continue;
    }

    const slotEnd = addMinutes(current, totalDuration);
    const slotEndWithBuffer = addMinutes(current, totalDuration + bufferMinutes);

    const hasConflict = blocked.some((b) => {
      const bEndWithBuffer = addMinutes(b.end, bufferMinutes);
      return current < bEndWithBuffer && slotEnd > b.start;
    });

    if (!hasConflict) {
      // Also verify buffer after this slot doesn't overlap next blocked
      const bufferConflict = blocked.some((b) => {
        return slotEndWithBuffer > b.start && slotEnd <= b.start;
      });
      if (!bufferConflict) {
        slots.push(format(current, 'HH:mm'));
      }
    }

    current = addMinutes(current, slotInterval);
  }

  return slots;
}

/**
 * Smart availability engine that calculates available time slots.
 * Supports three modes:
 * - intelligent: Dynamic gaps based on real service duration (recommended)
 * - fixed_grid: Regular intervals (backward compatible)
 * - hybrid: Fixed grid with gap validation
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
    bookingMode = 'hybrid',
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

  // Build blocked intervals WITHOUT buffer (each mode handles buffer internally)
  const blocked = buildBlockedIntervals(date, dateStr, hours, existingAppointments, blockedTimes);
  const earliestSlotTime = getEarliestSlotTime(date, bookingMode === 'intelligent' ? 1 : slotInterval);

  let slots: string[];

  if (bookingMode === 'intelligent') {
    slots = calculateIntelligentSlots(openTime, closeTime, totalDuration, bufferMinutes, blocked, earliestSlotTime);
  } else if (bookingMode === 'hybrid') {
    slots = calculateHybridSlots(openTime, closeTime, totalDuration, bufferMinutes, slotInterval, blocked, earliestSlotTime);
  } else {
    slots = calculateFixedGridSlots(openTime, closeTime, totalDuration, bufferMinutes, slotInterval, blocked, earliestSlotTime);
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

/**
 * Find the next available slot suggestion when a service doesn't fit.
 * Returns the earliest slot where the service can be scheduled.
 */
export function suggestNextAvailableSlot(params: AvailabilityParams): SlotSuggestion | null {
  const slots = calculateAvailableSlots(params);
  if (slots.length === 0) return null;

  return {
    slot: slots[0],
    gapMinutes: params.totalDuration,
    fitsService: true,
  };
}

/**
 * Validate that a given time string is on the fixed grid.
 */
export function isTimeOnGrid(
  time: string,
  openTime: string,
  slotInterval: number
): boolean {
  const [th, tm] = time.split(':').map(Number);
  const [oh, om] = openTime.split(':').map(Number);
  const timeMinutes = th * 60 + tm;
  const openMinutes = oh * 60 + om;
  const diff = timeMinutes - openMinutes;
  return diff >= 0 && diff % slotInterval === 0;
}

/**
 * Validate a selected time slot for fixed_grid mode.
 */
export function validateTimeSlot(
  selectedTime: string,
  bookingMode: BookingMode,
  slotInterval: number,
  openTime: string
): { valid: boolean; error?: string } {
  if (bookingMode !== 'fixed_grid') {
    return { valid: true };
  }

  if (!isTimeOnGrid(selectedTime, openTime, slotInterval)) {
    return {
      valid: false,
      error: `INVALID_TIME_SLOT: ${selectedTime} não está na grade de ${slotInterval} minutos`,
    };
  }

  return { valid: true };
}
