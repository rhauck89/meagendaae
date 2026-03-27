import { addMinutes, format, parseISO } from 'date-fns';

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
  start_time: string; // HH:mm or HH:mm:ss
  end_time: string;
}

export interface AvailabilityParams {
  date: Date;
  totalDuration: number; // in minutes
  businessHours: BusinessHours[];
  exceptions: BusinessException[];
  existingAppointments: ExistingAppointment[];
  slotInterval?: number; // default 15 minutes
  bufferMinutes?: number; // buffer between appointments
  professionalHours?: BusinessHours[]; // override company hours
  blockedTimes?: BlockedTime[]; // manual time blocks
}

/**
 * Smart availability engine that calculates available time slots
 * considering business hours, lunch breaks, exceptions, existing appointments,
 * buffer time, professional-specific working hours, and blocked times.
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
  } = params;

  if (totalDuration <= 0) return [];

  const dateStr = format(date, 'yyyy-MM-dd');

  // 1. Check for exception on this date
  const exception = exceptions.find((e) => e.exception_date === dateStr);
  if (exception?.is_closed) return [];

  // 2. Get working hours - professional hours override company hours
  const dayOfWeek = date.getDay();
  const activeHours = professionalHours && professionalHours.length > 0
    ? professionalHours
    : businessHours;
  const hours = activeHours.find((h) => h.day_of_week === dayOfWeek);
  if (!hours || hours.is_closed) return [];

  // Use exception hours if available
  const openTimeStr = exception?.open_time || hours.open_time;
  const closeTimeStr = exception?.close_time || hours.close_time;

  const parseTime = (t: string): Date => {
    const [h, m] = t.split(':').map(Number);
    const d = new Date(date);
    d.setHours(h, m, 0, 0);
    return d;
  };

  const openTime = parseTime(openTimeStr);
  const closeTime = parseTime(closeTimeStr);
  const lunchStart = hours.lunch_start ? parseTime(hours.lunch_start) : null;
  const lunchEnd = hours.lunch_end ? parseTime(hours.lunch_end) : null;

  // 3. Build blocked intervals (lunch + existing appointments + blocked times)
  const blocked: Array<{ start: Date; end: Date }> = [];

  if (lunchStart && lunchEnd) {
    blocked.push({ start: lunchStart, end: lunchEnd });
  }

  for (const apt of existingAppointments) {
    const aptStart = parseISO(apt.start_time);
    const aptEnd = addMinutes(parseISO(apt.end_time), bufferMinutes);
    blocked.push({ start: aptStart, end: aptEnd });
  }

  // Add blocked times for this date
  for (const bt of blockedTimes) {
    if (bt.block_date === dateStr) {
      blocked.push({ start: parseTime(bt.start_time), end: parseTime(bt.end_time) });
    }
  }

  blocked.sort((a, b) => a.start.getTime() - b.start.getTime());

  // 4. Generate slots - the slot itself occupies totalDuration + buffer
  const effectiveDuration = totalDuration + bufferMinutes;
  const slots: string[] = [];
  let current = new Date(openTime);

  while (current.getTime() + effectiveDuration * 60000 <= closeTime.getTime()) {
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
