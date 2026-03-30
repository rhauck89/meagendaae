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
  professionalId?: string; // for debug logging
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
    professionalId,
  } = params;

  const debugInfo = {
    professionalId: professionalId ?? 'N/A',
    date: format(date, 'yyyy-MM-dd'),
    totalDuration,
    businessHoursCount: businessHours.length,
    professionalHoursCount: professionalHours?.length ?? 0,
    existingAppointmentsCount: existingAppointments.length,
    blockedTimesCount: blockedTimes.length,
    bufferMinutes,
    slotInterval,
  };

  if (totalDuration <= 0) {
    console.warn('[AvailabilityEngine] totalDuration <= 0, returning no slots', debugInfo);
    return [];
  }

  const dateStr = format(date, 'yyyy-MM-dd');

  // 1. Check for exception on this date
  const exception = exceptions.find((e) => e.exception_date === dateStr);
  if (exception?.is_closed) {
    console.warn('[AvailabilityEngine] Date is closed (exception)', { dateStr, exception });
    return [];
  }

  // 2. Get working hours - professional hours override company hours
  const dayOfWeek = date.getDay();
  const usingProfessionalHours = !!(professionalHours && professionalHours.length > 0);
  const activeHours = usingProfessionalHours ? professionalHours! : businessHours;
  const hours = activeHours.find((h) => h.day_of_week === dayOfWeek);

  console.log('[AvailabilityEngine] Hours resolution', {
    dayOfWeek,
    usingProfessionalHours,
    fallbackToCompany: !usingProfessionalHours,
    activeHoursEntries: activeHours.map(h => ({
      day: h.day_of_week,
      open: h.open_time,
      close: h.close_time,
      closed: h.is_closed,
    })),
    matchedDay: hours ? { open: hours.open_time, close: hours.close_time, closed: hours.is_closed } : 'NOT FOUND',
    ...debugInfo,
  });
  
  if (!hours || hours.is_closed) {
    console.warn('[AvailabilityEngine] No working hours for day', {
      dayOfWeek,
      reason: !hours ? 'No entry for this day_of_week' : 'Day is marked as closed',
      ...debugInfo,
    });
    return [];
  }

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

  // 4. Calculate earliest allowed slot if date is today
  const now = new Date();
  const isToday = date.getFullYear() === now.getFullYear() &&
    date.getMonth() === now.getMonth() &&
    date.getDate() === now.getDate();

  let earliestSlotTime: Date | null = null;
  if (isToday) {
    const nowMinutes = now.getHours() * 60 + now.getMinutes();
    const roundedMinutes = Math.ceil(nowMinutes / slotInterval) * slotInterval;
    earliestSlotTime = new Date(date);
    earliestSlotTime.setHours(Math.floor(roundedMinutes / 60), roundedMinutes % 60, 0, 0);
  }

  // 5. Generate slots - the slot itself occupies totalDuration + buffer
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

  console.log('[AvailabilityEngine] Result', {
    ...debugInfo,
    openTime: format(openTime, 'HH:mm'),
    closeTime: format(closeTime, 'HH:mm'),
    lunchBreak: hours.lunch_start ? `${hours.lunch_start}-${hours.lunch_end}` : 'none',
    blockedIntervals: blocked.length,
    effectiveDuration,
    slotsFound: slots.length,
  });

  return slots;
}
