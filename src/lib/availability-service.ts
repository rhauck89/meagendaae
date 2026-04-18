/**
 * Unified availability service.
 *
 * Single source of truth for "what slots are free for professional X on date Y for service(s) Z".
 *
 * Both the public booking page (src/pages/Booking.tsx) and the internal manual
 * appointment dialog (src/components/ManualAppointmentDialog.tsx) MUST call
 * `getAvailableSlots()` from this module so they always return identical results
 * for the same inputs.
 *
 * Configuration resolution order (per parameter):
 *   1. Professional-level (collaborators / public_professionals): booking_mode, grid_interval, break_time
 *   2. Company-level fallback (companies / public_company): booking_mode, fixed_slot_interval, buffer_minutes
 *
 * Data fetched:
 *   - Business hours (company)
 *   - Professional working hours (override, optional)
 *   - Business exceptions (holidays, special days)
 *   - Blocked times (manual blocks for that professional/date)
 *   - Existing appointments (excluding cancelled / no_show)
 *
 * Both flows are authenticated equally — manual uses the private tables, public uses
 * the public_* views. The computation engine is the same: calculateAvailableSlots().
 */
import { addMinutes, format, isToday, parseISO } from 'date-fns';
import { supabase } from '@/integrations/supabase/client';
import {
  calculateAvailableSlots,
  type BookingMode,
  type BusinessHours,
  type BusinessException,
  type ExistingAppointment,
  type BlockedTime,
} from './availability-engine';

export type AvailabilitySource = 'manual' | 'public';

export interface GetAvailableSlotsParams {
  source: AvailabilitySource;
  companyId: string;
  professionalId: string;
  date: Date;
  totalDuration: number;
  /** When true, filters out past times if the date is today. Defaults to true. */
  filterPastForToday?: boolean;
}

export interface GetAvailableSlotsResult {
  slots: string[];
  bookingMode: BookingMode;
  slotInterval: number;
  bufferMinutes: number;
  existingAppointments: ExistingAppointment[];
}

function filterOverlappingGeneratedSlots(
  date: Date,
  slots: string[],
  existingAppointments: ExistingAppointment[],
  totalDuration: number,
) {
  if (slots.length === 0 || existingAppointments.length === 0 || totalDuration <= 0) {
    return slots;
  }

  return slots.filter((slot) => {
    const [hours, minutes] = slot.split(':').map(Number);
    const slotStart = new Date(date);
    slotStart.setHours(hours, minutes, 0, 0);
    const slotEnd = addMinutes(slotStart, totalDuration);

    return !existingAppointments.some((appointment) => {
      const existingStart = parseISO(appointment.start_time);
      const existingEnd = parseISO(appointment.end_time);
      return slotStart < existingEnd && slotEnd > existingStart;
    });
  });
}

/**
 * Resolve effective booking config: professional override wins over company default.
 */
async function resolveBookingConfig(
  source: AvailabilitySource,
  companyId: string,
  professionalId: string,
): Promise<{ bookingMode: BookingMode; slotInterval: number; bufferMinutes: number }> {
  const companyTable = source === 'public' ? 'public_company' : 'companies';

  const [companyRes, professionalRes] = await Promise.all([
    supabase
      .from(companyTable as any)
      .select('booking_mode, fixed_slot_interval, buffer_minutes')
      .eq('id', companyId)
      .maybeSingle(),
    // collaborators table is RLS-protected for the company members; for public flow
    // we read from public_professionals view which exposes the same effective fields.
    source === 'public'
      ? supabase
          .from('public_professionals' as any)
          .select('booking_mode, grid_interval, break_time')
          .eq('id', professionalId)
          .maybeSingle()
      : supabase
          .from('collaborators' as any)
          .select('booking_mode, grid_interval, break_time')
          .eq('profile_id', professionalId)
          .eq('company_id', companyId)
          .maybeSingle(),
  ]);

  const company = (companyRes.data as any) || {};
  const professional = (professionalRes.data as any) || {};

  // Priority: professional override > company default > 'fixed_grid'
  const resolvedMode = (professional?.booking_mode ?? company?.booking_mode ?? 'fixed_grid') as BookingMode;

  // ⚠️ TEMP FORCE OVERRIDE — requested by user to confirm no other source is injecting fixed_grid.
  // Set FORCE_INTELLIGENT to false to restore DB-driven resolution.
  const FORCE_INTELLIGENT = true;
  const bookingMode: BookingMode = FORCE_INTELLIGENT ? 'intelligent' : resolvedMode;

  const configuredInterval = professional.grid_interval ?? company.fixed_slot_interval;
  const slotInterval = bookingMode === 'intelligent'
    ? 1
    : Math.max(1, configuredInterval ?? 15);
  const bufferMinutes = professional.break_time ?? company.buffer_minutes ?? 0;

  console.log('[BOOKING MODE RESOLVED]', {
    source,
    professionalId,
    companyId,
    professionalMode: professional?.booking_mode ?? null,
    companyMode: company?.booking_mode ?? null,
    resolvedMode,
    forced: FORCE_INTELLIGENT,
    finalMode: bookingMode,
  });
  console.log('[FINAL MODE]', bookingMode, 'slotInterval:', slotInterval);

  return { bookingMode, slotInterval, bufferMinutes };
}

/**
 * Fetch the inputs the engine needs to compute slots for one professional on one date.
 */
async function fetchSlotInputs(
  source: AvailabilitySource,
  companyId: string,
  professionalId: string,
  date: Date,
) {
  const dateStr = format(date, 'yyyy-MM-dd');
  const startISO = `${dateStr}T00:00:00`;
  const endISO = `${dateStr}T23:59:59`;

  // business_hours / business_exceptions / appointments allow public SELECT via RLS,
  // and blocked_times has a public_blocked_times view used for anonymous reads.
  const businessHoursTable = 'business_hours';
  const exceptionsTable = 'business_exceptions';
  const blockedTable = source === 'public' ? 'public_blocked_times' : 'blocked_times';
  const apptsTable = 'appointments';

  const [profHoursRes, bizHoursRes, exceptionsRes, blocksRes, apptsRes, eventSlotsRes] =
    await Promise.all([
      supabase
        .from('professional_working_hours' as any)
        .select('day_of_week, open_time, close_time, lunch_start, lunch_end, is_closed')
        .eq('professional_id', professionalId),
      supabase
        .from(businessHoursTable as any)
        .select('day_of_week, open_time, close_time, lunch_start, lunch_end, is_closed')
        .eq('company_id', companyId),
      supabase
        .from(exceptionsTable as any)
        .select('exception_date, is_closed, open_time, close_time')
        .eq('company_id', companyId)
        .eq('exception_date', dateStr),
      supabase
        .from(blockedTable as any)
        .select('block_date, start_time, end_time')
        .eq('company_id', companyId)
        .eq('professional_id', professionalId)
        .eq('block_date', dateStr),
      // Public anonymous flow cannot SELECT appointments directly (RLS forbids).
      // It must go through the SECURITY DEFINER RPC `get_booking_appointments`.
      source === 'public'
        ? supabase.rpc('get_booking_appointments' as any, {
            p_company_id: companyId,
            p_professional_id: professionalId,
            p_selected_date: dateStr,
            p_timezone: 'America/Sao_Paulo',
          })
        : supabase
            .from(apptsTable as any)
            .select('start_time, end_time')
            .eq('professional_id', professionalId)
            .eq('company_id', companyId)
            .gte('start_time', startISO)
            .lt('start_time', endISO)
            .not('status', 'in', '("cancelled","no_show")'),
      // Event slots also block time on the professional's calendar
      supabase
        .from('event_slots' as any)
        .select('slot_date, start_time, end_time')
        .eq('professional_id', professionalId)
        .eq('slot_date', dateStr),
    ]);

  const businessHours = (bizHoursRes.data || []) as unknown as BusinessHours[];
  const professionalHours = ((profHoursRes.data || []) as unknown as BusinessHours[]);
  const exceptions = (exceptionsRes.data || []) as unknown as BusinessException[];

  const eventBlockedTimes: BlockedTime[] = ((eventSlotsRes.data || []) as any[]).map((es) => ({
    block_date: es.slot_date,
    start_time: es.start_time,
    end_time: es.end_time,
  }));
  const blockedTimes: BlockedTime[] = [
    ...((blocksRes.data || []) as unknown as BlockedTime[]),
    ...eventBlockedTimes,
  ];

  const existingAppointments = ((apptsRes.data || []) as unknown as ExistingAppointment[]);

  return { businessHours, professionalHours, exceptions, blockedTimes, existingAppointments };
}

/**
 * Compute available slots for a single professional on one date.
 * Both manual and public flows must use this — never call calculateAvailableSlots directly.
 */
export async function getAvailableSlots(
  params: GetAvailableSlotsParams,
): Promise<GetAvailableSlotsResult> {
  const {
    source,
    companyId,
    professionalId,
    date,
    totalDuration,
    filterPastForToday = true,
  } = params;

  if (!companyId || !professionalId || totalDuration <= 0) {
    return {
      slots: [],
      bookingMode: 'hybrid',
      slotInterval: 15,
      bufferMinutes: 0,
      existingAppointments: [],
    };
  }

  const [config, inputs] = await Promise.all([
    resolveBookingConfig(source, companyId, professionalId),
    fetchSlotInputs(source, companyId, professionalId, date),
  ]);

  console.log('[SERVICE INPUT]', {
    bookingMode: config.bookingMode,
    slotInterval: config.slotInterval,
    serviceDuration: totalDuration,
  });

  let slots = calculateAvailableSlots({
    date,
    totalDuration,
    businessHours: inputs.businessHours,
    exceptions: inputs.exceptions,
    existingAppointments: inputs.existingAppointments,
    slotInterval: config.slotInterval,
    bufferMinutes: config.bufferMinutes,
    bookingMode: config.bookingMode,
    professionalHours: inputs.professionalHours.length > 0 ? inputs.professionalHours : undefined,
    blockedTimes: inputs.blockedTimes,
    professionalId,
  });

  slots = filterOverlappingGeneratedSlots(date, slots, inputs.existingAppointments, totalDuration);

  if (filterPastForToday && isToday(date)) {
    const currentTime = format(new Date(), 'HH:mm');
    slots = slots.filter((s) => s > currentTime);
  }

  console.log('[BOOKINGS_USED]', inputs.existingAppointments);
  console.log('[REAL_SLOTS]', slots);
  console.log('[SERVICE]', slots);

  // Unified debug log so manual + public output can be diff-compared
  console.log('[SLOTS]', {
    source,
    professional_id: professionalId,
    date: format(date, 'yyyy-MM-dd'),
    bookingMode: config.bookingMode,
    slotInterval: config.slotInterval,
    bufferMinutes: config.bufferMinutes,
    totalDuration,
    slots,
  });

  console.log('[SERVICE FINAL]', slots);

  return {
    slots,
    bookingMode: config.bookingMode,
    slotInterval: config.slotInterval,
    bufferMinutes: config.bufferMinutes,
    existingAppointments: inputs.existingAppointments,
  };
}
