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
import { toZonedTime } from 'date-fns-tz';

/** Company-fixed timezone — must match availability-engine.ts COMPANY_TZ. */
const COMPANY_TZ = 'America/Sao_Paulo';
import { supabase } from '@/integrations/supabase/client';
import {
  calculateAvailableSlots,
  type BookingMode,
  type BusinessHours,
  type BusinessException,
  type ExistingAppointment,
  type BlockedTime,
  type EngineVersion,
} from './availability-engine';

/** Default base step (min) for Agenda Inteligente V2 when no services exist yet. */
const DEFAULT_BASE_SLOT_MINUTES = 10;
/** Hard floor — even if a service has duration < this, the timeline never goes finer. */
const MIN_BASE_SLOT_MINUTES = 5;

export type AvailabilitySource = 'manual' | 'public';

export interface GetAvailableSlotsParams {
  source: AvailabilitySource;
  companyId: string;
  professionalId: string;
  date: Date;
  totalDuration: number;
  /** When true, filters out past times if the date is today. Defaults to true. */
  filterPastForToday?: boolean;
  /** Optional pre-fetched inputs to avoid redundant DB calls */
  prefetchData?: {
    businessHours?: BusinessHours[];
    professionalHours?: BusinessHours[];
    exceptions?: BusinessException[];
  };
}

export interface GetAvailableSlotsResult {
  slots: string[];
  bookingMode: BookingMode;
  slotInterval: number;
  bufferMinutes: number;
  existingAppointments: ExistingAppointment[];
}

/**
 * Defense-in-depth post-filter. The engine pipeline already removes occupied
 * slots via the free-window construction; this guard runs on the final list
 * to catch any race condition between engine output and rendering. Kept tiny
 * on purpose — never used as the primary filter.
 */
function assertNoOverlap(
  date: Date,
  slots: string[],
  existingAppointments: ExistingAppointment[],
  totalDuration: number,
) {
  if (slots.length === 0 || existingAppointments.length === 0 || totalDuration <= 0) return slots;

  const ranges = existingAppointments.map((a) => ({
    start: toZonedTime(parseISO(a.start_time), COMPANY_TZ),
    end: toZonedTime(parseISO(a.end_time), COMPANY_TZ),
  }));

  const kept = slots.filter((slot) => {
    const [h, m] = slot.split(':').map(Number);
    const start = new Date(date);
    start.setHours(h, m, 0, 0);
    const end = addMinutes(start, totalDuration);
    return !ranges.some((r) => start < r.end && end > r.start);
  });

  if (kept.length !== slots.length) {
    console.warn('[FILTER_OVERLAP_GUARD] engine leaked occupied slot(s)', {
      removed: slots.filter((s) => !kept.includes(s)),
      bookings: ranges.map((r) => `${format(r.start, 'HH:mm')}-${format(r.end, 'HH:mm')}`),
    });
  }

  return kept;
}

function getBaseSlotMinutes(serviceDurations: number[], intervalMinutes: number) {
  const smallestServiceMinutes = serviceDurations.length > 0
    ? Math.min(...serviceDurations)
    : DEFAULT_BASE_SLOT_MINUTES;

  return {
    smallestServiceMinutes,
    slotBaseMinutes: Math.max(
      MIN_BASE_SLOT_MINUTES,
      Math.floor(smallestServiceMinutes) + Math.max(0, Math.floor(intervalMinutes ?? 0)),
    ),
  };
}

/**
 * Simple session-level cache for booking configuration.
 * Professional settings and company settings don't change often enough
 * to justify refetching them for every single day in a multi-day search.
 */
const configCache = new Map<string, {
  config: { 
    bookingMode: BookingMode; 
    slotInterval: number; 
    bufferMinutes: number; 
    engineVersion: EngineVersion; 
    baseSlotMinutes: number; 
    smallestServiceMinutes: number; 
    serviceCount: number 
  };
  timestamp: number;
}>();

const CACHE_TTL = 30000; // 30 seconds

async function getScopedActiveServiceDurations(
  source: AvailabilitySource,
  companyId: string,
  professionalId: string,
) {
  const servicesTable = source === 'public' ? 'public_services' : 'services';
  const servicesSelect = source === 'public' ? 'id, duration_minutes' : 'id, duration_minutes, active';

  // We can optimize this by only fetching what's needed.
  // Actually, fetching all and filtering is often faster than complex joins in Supabase JS client
  // but we should at least use the public views when appropriate.
  const [serviceLinksRes, servicesRes] = await Promise.all([
    supabase
      .from('service_professionals' as any)
      .select('service_id')
      .eq('professional_id', professionalId),
    supabase
      .from(servicesTable as any)
      .select(servicesSelect)
      .eq('company_id', companyId),
  ]);

  const linkedServiceIds = new Set(
    (((serviceLinksRes.data as any[]) || []).map((link) => link?.service_id).filter(Boolean)) as string[],
  );

  const allServices = ((servicesRes.data as any[]) || []).filter((service) => {
    if (source === 'public') return true;
    return service?.active !== false;
  });

  const scopedServices = linkedServiceIds.size > 0
    ? allServices.filter((service) => linkedServiceIds.has(service.id))
    : allServices;

  return scopedServices
    .map((service) => Number(service?.duration_minutes))
    .filter((duration) => Number.isFinite(duration) && duration > 0);
}

/**
 * Resolve effective booking config: professional override wins over company default.
 */
async function resolveBookingConfig(
  source: AvailabilitySource,
  companyId: string,
  professionalId: string,
): Promise<{ bookingMode: BookingMode; slotInterval: number; bufferMinutes: number; engineVersion: EngineVersion; baseSlotMinutes: number; smallestServiceMinutes: number; serviceCount: number }> {
  const cacheKey = `${source}:${companyId}:${professionalId}`;
  const cached = configCache.get(cacheKey);
  
  if (cached && (Date.now() - cached.timestamp < CACHE_TTL)) {
    return cached.config;
  }

  const companyTable = source === 'public' ? 'public_company' : 'companies';

  const [companyRes, professionalRes, activeDurations] = await Promise.all([
    supabase
      .from(companyTable as any)
      .select('booking_mode, fixed_slot_interval, buffer_minutes, agenda_engine_version')
      .eq('id', companyId)
      .maybeSingle(),
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
    getScopedActiveServiceDurations(source, companyId, professionalId),
  ]);

  const company = (companyRes.data as any) || {};
  const professional = (professionalRes.data as any) || {};

  const resolvedMode = (professional?.booking_mode ?? company?.booking_mode ?? 'fixed_grid') as BookingMode;

  // ⚠️ TEMP FORCE OVERRIDE — preserved from previous behavior.
  const FORCE_INTELLIGENT = true;
  const bookingMode: BookingMode = FORCE_INTELLIGENT ? 'intelligent' : resolvedMode;

  const configuredInterval = professional.grid_interval ?? company.fixed_slot_interval;
  const slotInterval = bookingMode === 'intelligent'
    ? 1
    : Math.max(1, configuredInterval ?? 15);
  const bufferMinutes = professional.break_time ?? company.buffer_minutes ?? 0;

  const { smallestServiceMinutes, slotBaseMinutes: baseSlotMinutes } = getBaseSlotMinutes(activeDurations, bufferMinutes);

  const engineVersion: EngineVersion =
    (company?.agenda_engine_version === 'v1' ? 'v1' : 'v2');

  const config = { 
    bookingMode, 
    slotInterval, 
    bufferMinutes, 
    engineVersion, 
    baseSlotMinutes, 
    smallestServiceMinutes, 
    serviceCount: activeDurations.length 
  };

  configCache.set(cacheKey, { config, timestamp: Date.now() });

  return config;
}

/**
 * Fetch the inputs the engine needs to compute slots for one professional on one date.
 */
async function fetchSlotInputs(
  source: AvailabilitySource,
  companyId: string,
  professionalId: string,
  date: Date,
  prefetchData?: GetAvailableSlotsParams['prefetchData'],
) {
  const dateStr = format(date, 'yyyy-MM-dd');
  const startISO = `${dateStr}T00:00:00`;
  const endISO = `${dateStr}T23:59:59`;

  const blockedTable = source === 'public' ? 'public_blocked_times' : 'blocked_times';
  const apptsTable = 'appointments';

  // Only fetch what isn't already provided
  const fetchTasks: Promise<any>[] = [];
  
  // Index 0: Professional working hours
  if (prefetchData?.professionalHours) {
    fetchTasks.push(Promise.resolve({ data: prefetchData.professionalHours }));
  } else {
    fetchTasks.push(supabase
      .from('professional_working_hours' as any)
      .select('day_of_week, open_time, close_time, lunch_start, lunch_end, is_closed')
      .eq('professional_id', professionalId));
  }

  // Index 1: Business hours
  if (prefetchData?.businessHours) {
    fetchTasks.push(Promise.resolve({ data: prefetchData.businessHours }));
  } else {
    fetchTasks.push(supabase
      .from('business_hours' as any)
      .select('day_of_week, open_time, close_time, lunch_start, lunch_end, is_closed')
      .eq('company_id', companyId));
  }

  // Index 2: Exceptions
  // Note: Exceptions are usually date-specific, so if prefetchData.exceptions has all exceptions for the company,
  // we can filter it here. If it's already filtered for the date, even better.
  if (prefetchData?.exceptions) {
    const dailyExceptions = prefetchData.exceptions.filter(e => e.exception_date === dateStr);
    fetchTasks.push(Promise.resolve({ data: dailyExceptions }));
  } else {
    fetchTasks.push(supabase
      .from('business_exceptions' as any)
      .select('exception_date, is_closed, open_time, close_time')
      .eq('company_id', companyId)
      .eq('exception_date', dateStr));
  }

  // Index 3: Blocked times
  fetchTasks.push(supabase
    .from(blockedTable as any)
    .select('block_date, start_time, end_time')
    .eq('company_id', companyId)
    .eq('professional_id', professionalId)
    .eq('block_date', dateStr));

  // Index 4: Appointments
  if (source === 'public') {
    fetchTasks.push(supabase.rpc('get_booking_appointments' as any, {
      p_company_id: companyId,
      p_professional_id: professionalId,
      p_selected_date: dateStr,
      p_timezone: 'America/Sao_Paulo',
    }));
  } else {
    fetchTasks.push(supabase
      .from(apptsTable as any)
      .select('start_time, end_time')
      .eq('professional_id', professionalId)
      .eq('company_id', companyId)
      .gte('start_time', startISO)
      .lt('start_time', endISO)
      .not('status', 'in', '("cancelled","no_show")'));
  }

  // Index 5: Event slots
  fetchTasks.push(supabase
    .from('event_slots' as any)
    .select('slot_date, start_time, end_time')
    .eq('professional_id', professionalId)
    .eq('slot_date', dateStr));

  const [profHoursRes, bizHoursRes, exceptionsRes, blocksRes, apptsRes, eventSlotsRes] = await Promise.all(fetchTasks);

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

  console.log('[AGENDA_V2_DEBUG]', {
    menorServico: config.smallestServiceMinutes,
    intervalo: config.bufferMinutes,
    slotBase: config.baseSlotMinutes,
    serviceCount: config.serviceCount,
    professionalId,
    companyId,
    date: format(date, 'yyyy-MM-dd'),
  });

  let slots: string[] = [];
  try {
    slots = calculateAvailableSlots({
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
      engineVersion: config.engineVersion,
      baseSlotMinutes: config.baseSlotMinutes,
    });
  } catch (err) {
    // Safety fallback: if V2 throws unexpectedly, retry with V1 so booking never breaks.
    console.error('[AvailabilityService] V2 engine failed, falling back to V1', err);
    slots = calculateAvailableSlots({
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
      engineVersion: 'v1',
    });
  }

  slots = assertNoOverlap(date, slots, inputs.existingAppointments, totalDuration);

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
    menorServico: config.smallestServiceMinutes,
    intervalo: config.bufferMinutes,
    slotBase: config.baseSlotMinutes,
    firstAvailable: slots[0] ?? null,
    generatedSlots: slots,
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
