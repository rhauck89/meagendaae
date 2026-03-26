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

export interface AvailabilityParams {
  date: Date;
  totalDuration: number; // in minutes
  businessHours: BusinessHours[];
  exceptions: BusinessException[];
  existingAppointments: ExistingAppointment[];
  slotInterval?: number; // default 15 minutes
}

/**
 * Smart availability engine that calculates available time slots
 * considering business hours, lunch breaks, exceptions, and existing appointments.
 * 
 * It finds continuous blocks of the required duration, ensuring no overlap
 * with lunch or booked appointments.
 */
export function calculateAvailableSlots(params: AvailabilityParams): string[] {
  const {
    date,
    totalDuration,
    businessHours,
    exceptions,
    existingAppointments,
    slotInterval = 15,
  } = params;

  if (totalDuration <= 0) return [];

  const dateStr = format(date, 'yyyy-MM-dd');

  // 1. Check for exception on this date
  const exception = exceptions.find((e) => e.exception_date === dateStr);
  if (exception?.is_closed) return [];

  // 2. Get business hours for this day of week
  const dayOfWeek = date.getDay();
  const hours = businessHours.find((h) => h.day_of_week === dayOfWeek);
  if (!hours || hours.is_closed) return [];

  // Use exception hours if available (special hours for holidays etc.)
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

  // 3. Build list of blocked intervals (lunch + existing appointments)
  const blocked: Array<{ start: Date; end: Date }> = [];

  if (lunchStart && lunchEnd) {
    blocked.push({ start: lunchStart, end: lunchEnd });
  }

  for (const apt of existingAppointments) {
    blocked.push({
      start: parseISO(apt.start_time),
      end: parseISO(apt.end_time),
    });
  }

  // Sort blocked intervals by start time
  blocked.sort((a, b) => a.start.getTime() - b.start.getTime());

  // 4. Generate slots by scanning from open to close
  const slots: string[] = [];
  let current = new Date(openTime);

  while (current.getTime() + totalDuration * 60000 <= closeTime.getTime()) {
    const slotEnd = addMinutes(current, totalDuration);

    // Check if this slot overlaps with any blocked interval
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
