import { addMinutes, format, parseISO } from 'date-fns';
import { toZonedTime } from 'date-fns-tz';

export type BookingMode = 'intelligent' | 'fixed_grid' | 'hybrid';

/**
 * Default timezone used to interpret appointment timestamps as wall-clock time.
 * The engine generates slots in local wall-clock (e.g. "09:00"), so existing
 * appointments — which arrive as UTC ISO strings — must be converted to the
 * SAME wall-clock frame before any overlap check. Otherwise a browser/server
 * running in UTC will see "09:00 UTC slot" vs "12:00 UTC appointment" and
 * (incorrectly) decide there is no conflict, leaking booked slots into the
 * public list.
 */
const COMPANY_TZ = 'America/Sao_Paulo';

/**
 * Convert an ISO timestamp from the database into a Date whose getHours()/getMinutes()
 * return the wall-clock time in the company's timezone.
 *
 * Example: '2026-04-20T12:00:00Z' (= 09:00 BRT) → Date with hours=9, minutes=0
 *   regardless of the runtime's local timezone.
 */
function toCompanyWallClock(iso: string): Date {
  return toZonedTime(parseISO(iso), COMPANY_TZ);
}

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

export type EngineVersion = 'v1' | 'v2';

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
  /**
   * Engine version. v2 uses base-slot stepping (smallest service duration in catalog)
   * for the intelligent mode, exposing many more candidate times.
   * Defaults to 'v2'. Set to 'v1' to fall back to legacy behavior.
   */
  engineVersion?: EngineVersion;
  /**
   * Base step (minutes) used by intelligent v2 to walk the timeline.
   * Should be the smallest service duration in the company/professional catalog.
   * Falls back to 10 if not provided.
   */
  baseSlotMinutes?: number;
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
 * Build the list of OCCUPIED intervals from lunch, existing appointments, and manual blocks.
 * Returns a sorted, MERGED list of [start, end) ranges in company wall-clock time.
 * Buffer is intentionally NOT added here — `buildFreeWindows` applies it as a margin
 * around each occupied range so consecutive bookings don't collapse into a single block.
 */
function buildBlockedIntervals(
  date: Date,
  dateStr: string,
  hours: BusinessHours,
  existingAppointments: ExistingAppointment[],
  blockedTimes: BlockedTime[],
): Array<{ start: Date; end: Date }> {
  const occupied: Array<{ start: Date; end: Date }> = [];

  const lunchStart = hours.lunch_start ? parseTime(hours.lunch_start, date) : null;
  const lunchEnd = hours.lunch_end ? parseTime(hours.lunch_end, date) : null;
  if (lunchStart && lunchEnd) {
    occupied.push({ start: lunchStart, end: lunchEnd });
  }

  for (const apt of existingAppointments) {
    // Convert DB UTC ISO → company wall-clock so it aligns with parseTime()
    // (which produces a local-time Date via setHours). Without this conversion,
    // a UTC runtime sees no overlap between booked 09:00 BRT and a generated
    // 09:00 slot and renders busy times as available.
    const aptStart = toCompanyWallClock(apt.start_time);
    const aptEnd = toCompanyWallClock(apt.end_time);
    if (aptEnd > aptStart) occupied.push({ start: aptStart, end: aptEnd });
  }

  for (const bt of blockedTimes) {
    if (bt.block_date === dateStr) {
      const s = parseTime(bt.start_time, date);
      const e = parseTime(bt.end_time, date);
      if (e > s) occupied.push({ start: s, end: e });
    }
  }

  occupied.sort((a, b) => a.start.getTime() - b.start.getTime());

  // Merge overlapping / touching ranges so the free-window algorithm can't
  // emit a phantom gap between two adjacent bookings (e.g. 09:23-09:53
  // arriving after 09:00-09:23). Touching ranges (b.start === prev.end) are
  // also merged to prevent zero-width slots.
  const merged: Array<{ start: Date; end: Date }> = [];
  for (const range of occupied) {
    const prev = merged[merged.length - 1];
    if (prev && range.start.getTime() <= prev.end.getTime()) {
      if (range.end.getTime() > prev.end.getTime()) prev.end = new Date(range.end);
    } else {
      merged.push({ start: new Date(range.start), end: new Date(range.end) });
    }
  }
  return merged;
}

/**
 * Get the earliest allowed slot time if the date is today.
 * When roundTo <= 1, no rounding is applied (continuous time — used by intelligent mode).
 */
function getEarliestSlotTime(date: Date, roundTo: number): Date | null {
  const now = new Date();
  const isToday = date.getFullYear() === now.getFullYear() &&
    date.getMonth() === now.getMonth() &&
    date.getDate() === now.getDate();

  if (!isToday) return null;

  // Continuous time: no grid rounding, return current minute exactly.
  if (roundTo <= 1) {
    const earliest = new Date(date);
    earliest.setHours(now.getHours(), now.getMinutes(), 0, 0);
    return earliest;
  }

  const nowMinutes = now.getHours() * 60 + now.getMinutes();
  const roundedMinutes = Math.ceil(nowMinutes / roundTo) * roundTo;
  const earliest = new Date(date);
  earliest.setHours(Math.floor(roundedMinutes / 60), roundedMinutes % 60, 0, 0);
  return earliest;
}

/**
 * Resolve working hours for a given date, considering exceptions and professional overrides.
 */
export function resolveWorkingHours(
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
 * Subtract OCCUPIED ranges (plus a buffer margin) from [openTime, closeTime] and
 * return the contiguous FREE WINDOWS where new bookings can possibly start.
 *
 * The buffer is added on BOTH sides of each occupied range so the engine never
 * leaks slots that would touch a busy interval (e.g. starting 1 min before or
 * ending 1 min into another appointment). Windows narrower than 1 minute are
 * discarded.
 */
function buildFreeWindows(
  openTime: Date,
  closeTime: Date,
  occupied: Array<{ start: Date; end: Date }>,
  bufferMinutes: number
): Array<{ start: Date; end: Date }> {
  const freeWindows: Array<{ start: Date; end: Date }> = [];
  let cursor = new Date(openTime);
  const buffer = Math.max(0, bufferMinutes);

  for (const range of occupied) {
    const blockedStart = buffer > 0 ? addMinutes(range.start, -buffer) : range.start;
    const blockedEnd = buffer > 0 ? addMinutes(range.end, buffer) : range.end;

    // Range starts after the cursor → emit the gap before it.
    if (blockedStart.getTime() > cursor.getTime() && cursor.getTime() < closeTime.getTime()) {
      const end = blockedStart.getTime() < closeTime.getTime() ? blockedStart : closeTime;
      if (end.getTime() - cursor.getTime() >= 60_000) {
        freeWindows.push({ start: new Date(cursor), end: new Date(end) });
      }
    }

    if (blockedEnd.getTime() > cursor.getTime()) {
      cursor = new Date(blockedEnd);
    }
  }

  if (cursor.getTime() < closeTime.getTime() &&
      closeTime.getTime() - cursor.getTime() >= 60_000) {
    freeWindows.push({ start: new Date(cursor), end: new Date(closeTime) });
  }

  return freeWindows;
}

/**
 * Final guard: confirm a candidate slot fits the service inside [openTime, closeTime]
 * AND does not overlap any occupied range. Free windows already exclude blocked
 * intervals, so this is a defense-in-depth check (catches buffer rounding edges).
 */
function slotFitsService(
  slotStart: Date,
  totalDuration: number,
  bufferMinutes: number,
  closeTime: Date,
  occupied: Array<{ start: Date; end: Date }>,
): boolean {
  const slotEnd = addMinutes(slotStart, totalDuration);
  if (slotEnd.getTime() > closeTime.getTime()) {
    return false;
  }
  const slotEndWithBuffer = bufferMinutes > 0 ? addMinutes(slotEnd, bufferMinutes) : slotEnd;
  const slotStartWithBuffer = bufferMinutes > 0 ? addMinutes(slotStart, -bufferMinutes) : slotStart;

  return !occupied.some((b) => slotStartWithBuffer < b.end && slotEndWithBuffer > b.start);
}

/**
 * Walk a single FREE WINDOW and emit candidate slots stepping by `step` minutes.
 * Each candidate must (a) fit the service duration before the window ends and
 * (b) survive the final overlap guard. This is the SHARED inner loop used by
 * every booking mode so the pipeline (occupied → free → candidate → final)
 * is identical regardless of grid/intelligent.
 */
function emitSlotsForWindow(
  window: { start: Date; end: Date },
  step: number,
  totalDuration: number,
  bufferMinutes: number,
  closeTime: Date,
  occupied: Array<{ start: Date; end: Date }>,
  earliestSlotTime: Date | null,
  alignToGrid: { openTime: Date; interval: number } | null,
): string[] {
  const out: string[] = [];
  const requiredMs = totalDuration * 60_000;
  if (window.end.getTime() - window.start.getTime() < requiredMs) return out;

  let current = new Date(window.start);
  current.setSeconds(0, 0);

  // Snap the cursor to the configured grid (fixed_grid / hybrid only). For
  // intelligent mode `alignToGrid` is null and the cursor stays on the gap edge.
  if (alignToGrid) {
    const baseMin = alignToGrid.openTime.getHours() * 60 + alignToGrid.openTime.getMinutes();
    const curMin = current.getHours() * 60 + current.getMinutes();
    const offset = ((curMin - baseMin) % alignToGrid.interval + alignToGrid.interval) % alignToGrid.interval;
    if (offset !== 0) current = addMinutes(current, alignToGrid.interval - offset);
  }

  if (earliestSlotTime && current < earliestSlotTime) {
    current = new Date(earliestSlotTime);
    current.setSeconds(0, 0);
    if (alignToGrid) {
      const baseMin = alignToGrid.openTime.getHours() * 60 + alignToGrid.openTime.getMinutes();
      const curMin = current.getHours() * 60 + current.getMinutes();
      const offset = ((curMin - baseMin) % alignToGrid.interval + alignToGrid.interval) % alignToGrid.interval;
      if (offset !== 0) current = addMinutes(current, alignToGrid.interval - offset);
    }
  }

  const safety = Math.ceil((window.end.getTime() - window.start.getTime()) / (Math.max(1, step) * 60_000)) + 4;
  let iter = 0;

  while (iter++ < safety && current.getTime() + requiredMs <= window.end.getTime()) {
    if (slotFitsService(current, totalDuration, bufferMinutes, closeTime, occupied)) {
      out.push(format(current, 'HH:mm'));
    }
    current = addMinutes(current, Math.max(1, step));
  }

  return out;
}

/**
 * Smart availability engine that calculates available time slots.
 *
 * Pipeline (single source of truth):
 *   occupiedRanges  → buildBlockedIntervals (sorted + merged + tz-normalized)
 *   freeRanges      → buildFreeWindows      (subtract occupied + buffer margin)
 *   candidateSlots  → emitSlotsForWindow    (step inside each free range)
 *   finalSlots      → slotFitsService       (defense-in-depth overlap guard)
 *
 * Three booking modes only differ on the STEP and grid alignment:
 *   - fixed_grid : step = slotInterval, aligned to openTime
 *   - hybrid     : step = slotInterval, aligned to openTime
 *   - intelligent: step = baseSlotMinutes (V2) or service duration+buffer (V1),
 *                   not aligned (slots start at gap boundaries)
 *
 * Occupied slots can NEVER be returned — by construction a slot starting on or
 * inside a busy range is excluded by buildFreeWindows itself.
 */
export function calculateAvailableSlots(params: AvailabilityParams): string[] {
  const {
    date,
    totalDuration,
    businessHours,
    exceptions,
    existingAppointments,
    slotInterval = 1,
    bufferMinutes = 0,
    professionalHours,
    blockedTimes = [],
    professionalId,
    bookingMode = 'hybrid',
    engineVersion = 'v2',
    baseSlotMinutes,
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
  const effectiveSlotInterval = bookingMode === 'intelligent' ? 1 : Math.max(1, slotInterval);

  // ── PIPELINE STEP 1: occupied ranges (sorted + merged in company tz) ──
  const occupied = buildBlockedIntervals(date, dateStr, hours, existingAppointments, blockedTimes);

  // ── PIPELINE STEP 2: free ranges (occupied + buffer subtracted from open hours) ──
  const freeWindows = buildFreeWindows(openTime, closeTime, occupied, bufferMinutes);

  // Resolve the cadence used to walk each free window.
  let step: number;
  let alignToGrid: { openTime: Date; interval: number } | null;
  if (bookingMode === 'intelligent') {
    step = engineVersion === 'v2'
      ? Math.max(1, Math.floor(baseSlotMinutes ?? 10))
      : Math.max(1, totalDuration + Math.max(0, bufferMinutes));
    alignToGrid = null;
  } else {
    step = effectiveSlotInterval;
    alignToGrid = { openTime, interval: effectiveSlotInterval };
  }

  const earliestSlotTime = getEarliestSlotTime(date, alignToGrid ? effectiveSlotInterval : 1);

  // ── PIPELINE STEP 3 + 4: candidate slots → final overlap guard ──
  const slots: string[] = [];
  for (const window of freeWindows) {
    const winSlots = emitSlotsForWindow(
      window, step, totalDuration, bufferMinutes, closeTime, occupied, earliestSlotTime, alignToGrid,
    );
    slots.push(...winSlots);
  }

  console.log('[ENGINE_PIPELINE]', {
    professionalId: professionalId ?? 'N/A',
    date: dateStr,
    mode: bookingMode,
    engineVersion,
    step,
    open: format(openTime, 'HH:mm'),
    close: format(closeTime, 'HH:mm'),
    occupiedRanges: occupied.map((r) => `${format(r.start, 'HH:mm')}-${format(r.end, 'HH:mm')}`),
    freeRanges: freeWindows.map((r) => `${format(r.start, 'HH:mm')}-${format(r.end, 'HH:mm')}`),
    candidateSlotsBefore: slots.length, // candidates already validated, kept for legacy debug
    candidateSlotsAfter: slots,
  });

  console.log('[AvailabilityEngine] Result', {
    professionalId: professionalId ?? 'N/A',
    date: dateStr,
    bookingMode,
    totalDuration,
    bufferMinutes,
    slotInterval: effectiveSlotInterval,
    openTime: format(openTime, 'HH:mm'),
    closeTime: format(closeTime, 'HH:mm'),
    blockedIntervals: occupied.length,
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
