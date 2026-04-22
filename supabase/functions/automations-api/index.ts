/**
 * Automations API — internal endpoint for Make.com / no-code platforms.
 *
 * Routes (all GET, protected by ?token= query param):
 *   /appointments-tomorrow   → confirmed appointments for tomorrow
 *   /appointments-today      → confirmed appointments for today (future)
 *   /appointments-7days      → confirmed appointments next 7 days
 *   /inactive-clients-20days → clients with no appointment in last 20 days
 *
 * Security:
 *   - Shared secret via query string (?token=AGENDAE123)
 *   - Service role used internally to bypass RLS (read-only aggregations)
 *   - Never logs token; never echoes it back
 *   - Returns 401 on invalid/missing token
 */
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.45.0';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers':
    'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'GET, OPTIONS',
};

const AUTOMATIONS_TOKEN = 'AGENDAE123';

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

const admin = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
  auth: { persistSession: false },
});

function json(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
}

function unauthorized() {
  return json({ error: 'unauthorized' }, 401);
}

/** YYYY-MM-DD in America/Sao_Paulo (offset days from "today") */
function brDateOffset(daysOffset: number): string {
  const now = new Date();
  // Convert to São Paulo time using Intl
  const fmt = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'America/Sao_Paulo',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  });
  const todayStr = fmt.format(now); // YYYY-MM-DD
  const [y, m, d] = todayStr.split('-').map(Number);
  const base = new Date(Date.UTC(y, m - 1, d));
  base.setUTCDate(base.getUTCDate() + daysOffset);
  const yy = base.getUTCFullYear();
  const mm = String(base.getUTCMonth() + 1).padStart(2, '0');
  const dd = String(base.getUTCDate()).padStart(2, '0');
  return `${yy}-${mm}-${dd}`;
}

/** Build a UTC ISO range that covers a São Paulo calendar day */
function brDayRangeUtc(dateYmd: string): { startIso: string; endIso: string } {
  // São Paulo is UTC-3 (no DST since 2019). We treat the day [00:00, 24:00) BRT
  // as [03:00 UTC of same day, 03:00 UTC of next day).
  const [y, m, d] = dateYmd.split('-').map(Number);
  const startIso = new Date(Date.UTC(y, m - 1, d, 3, 0, 0)).toISOString();
  const endIso = new Date(Date.UTC(y, m - 1, d + 1, 3, 0, 0)).toISOString();
  return { startIso, endIso };
}

function formatTimeBR(iso: string): string {
  return new Intl.DateTimeFormat('en-GB', {
    timeZone: 'America/Sao_Paulo',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  }).format(new Date(iso));
}

function formatDateBR(iso: string): string {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: 'America/Sao_Paulo',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(new Date(iso));
}

interface AppointmentRow {
  id: string;
  company_id: string;
  start_time: string;
  end_time: string;
  status: string;
  client_name: string | null;
  client_whatsapp: string | null;
  client_id: string | null;
  professional_id: string;
  total_price: number;
  clients?: { name: string | null; whatsapp: string | null } | null;
  profiles?: { full_name: string | null } | null;
  appointment_services?: Array<{
    services: { name: string | null } | null;
  }> | null;
}

async function fetchAppointmentsForDay(dateYmd: string, onlyFuture: boolean) {
  const { startIso, endIso } = brDayRangeUtc(dateYmd);
  const nowIso = new Date().toISOString();

  let query = admin
    .from('appointments')
    .select(
      `
      id,
      company_id,
      start_time,
      end_time,
      status,
      client_name,
      client_whatsapp,
      client_id,
      professional_id,
      total_price,
      clients:client_id ( name, whatsapp ),
      profiles:professional_id ( full_name ),
      appointment_services ( services:service_id ( name ) )
    `
    )
    .gte('start_time', onlyFuture && startIso < nowIso ? nowIso : startIso)
    .lt('start_time', endIso)
    .in('status', ['confirmed', 'pending'])
    .order('start_time', { ascending: true });

  const { data, error } = await query;
  if (error) throw error;
  return (data ?? []) as unknown as AppointmentRow[];
}

function mapAppointment(row: AppointmentRow) {
  const clientName = row.clients?.name ?? row.client_name ?? null;
  const clientPhone = row.clients?.whatsapp ?? row.client_whatsapp ?? null;
  const professionalName = row.profiles?.full_name ?? null;
  const serviceName =
    row.appointment_services
      ?.map((s) => s.services?.name)
      .filter(Boolean)
      .join(', ') || null;

  return {
    appointment_id: row.id,
    company_id: row.company_id,
    client_name: clientName,
    client_phone: clientPhone,
    professional_name: professionalName,
    service_name: serviceName,
    service_price: row.total_price,
    appointment_date: formatDateBR(row.start_time),
    appointment_time: formatTimeBR(row.start_time),
    datetime_iso: row.start_time,
    status: row.status,
  };
}

async function handleAppointmentsTomorrow() {
  const date = brDateOffset(1);
  const rows = await fetchAppointmentsForDay(date, false);
  return rows
    .filter((r) => (r.clients?.whatsapp ?? r.client_whatsapp ?? '').trim() !== '')
    .map(mapAppointment);
}

async function handleAppointmentsToday() {
  const date = brDateOffset(0);
  const rows = await fetchAppointmentsForDay(date, true);
  return rows
    .filter((r) => (r.clients?.whatsapp ?? r.client_whatsapp ?? '').trim() !== '')
    .map(mapAppointment);
}

async function handleAppointments7Days() {
  const start = brDateOffset(0);
  const end = brDateOffset(7);
  const { startIso } = brDayRangeUtc(start);
  const { endIso } = brDayRangeUtc(end);

  const { data, error } = await admin
    .from('appointments')
    .select(
      `
      id, company_id, start_time, end_time, status,
      client_name, client_whatsapp, client_id, professional_id, total_price,
      clients:client_id ( name, whatsapp ),
      profiles:professional_id ( full_name ),
      appointment_services ( services:service_id ( name ) )
    `
    )
    .gte('start_time', startIso)
    .lt('start_time', endIso)
    .in('status', ['confirmed', 'pending'])
    .order('start_time', { ascending: true });

  if (error) throw error;
  return ((data ?? []) as unknown as AppointmentRow[])
    .filter((r) => (r.clients?.whatsapp ?? r.client_whatsapp ?? '').trim() !== '')
    .map(mapAppointment);
}

async function handleInactive20Days() {
  // Clients whose latest appointment is older than 20 days (and no future appt).
  const cutoffIso = new Date(
    Date.now() - 20 * 24 * 60 * 60 * 1000
  ).toISOString();

  const { data, error } = await admin
    .from('clients')
    .select(
      `
      id, company_id, name, whatsapp,
      appointments:appointments!appointments_client_id_fkey (
        start_time, status
      )
    `
    )
    .not('whatsapp', 'is', null)
    .eq('is_blocked', false);

  if (error) throw error;

  const nowIso = new Date().toISOString();
  const result: Array<Record<string, unknown>> = [];

  for (const c of (data ?? []) as Array<{
    id: string;
    company_id: string;
    name: string;
    whatsapp: string | null;
    appointments: Array<{ start_time: string; status: string }> | null;
  }>) {
    if (!c.whatsapp || c.whatsapp.trim() === '') continue;
    const appts = c.appointments ?? [];
    if (appts.length === 0) continue;

    const validAppts = appts.filter(
      (a) => a.status !== 'cancelled' && a.status !== 'no_show'
    );
    if (validAppts.length === 0) continue;

    const hasFuture = validAppts.some((a) => a.start_time > nowIso);
    if (hasFuture) continue;

    const lastVisit = validAppts
      .map((a) => a.start_time)
      .sort()
      .pop();
    if (!lastVisit || lastVisit > cutoffIso) continue;

    result.push({
      client_id: c.id,
      company_id: c.company_id,
      client_name: c.name,
      client_phone: c.whatsapp,
      last_visit: lastVisit,
      days_since_visit: Math.floor(
        (Date.now() - new Date(lastVisit).getTime()) / (24 * 60 * 60 * 1000)
      ),
    });
  }

  return result;
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  if (req.method !== 'GET') {
    return json({ error: 'method_not_allowed' }, 405);
  }

  try {
    const url = new URL(req.url);
    const token = url.searchParams.get('token');
    if (!token || token !== AUTOMATIONS_TOKEN) {
      return unauthorized();
    }

    // Last path segment determines route (works behind /functions/v1/automations-api/<route>)
    const segments = url.pathname.split('/').filter(Boolean);
    const route = segments[segments.length - 1] || '';

    let payload: unknown;
    switch (route) {
      case 'appointments-tomorrow':
        payload = await handleAppointmentsTomorrow();
        break;
      case 'appointments-today':
        payload = await handleAppointmentsToday();
        break;
      case 'appointments-7days':
        payload = await handleAppointments7Days();
        break;
      case 'inactive-clients-20days':
        payload = await handleInactive20Days();
        break;
      default:
        return json(
          {
            error: 'not_found',
            available_routes: [
              'appointments-tomorrow',
              'appointments-today',
              'appointments-7days',
              'inactive-clients-20days',
            ],
          },
          404
        );
    }

    return json(payload, 200);
  } catch (err) {
    console.error('[automations-api] error:', err);
    return json({ error: 'internal_error' }, 500);
  }
});
