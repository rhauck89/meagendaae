/**
 * Automations API — internal endpoint for Make.com / no-code platforms.
 *
 * Routes (all GET, protected by ?token= query param):
 *   /appointments-tomorrow   → confirmed appointments for tomorrow
 *   /appointments-today      → confirmed appointments for today (future)
 *   /appointments-7days      → confirmed appointments next 7 days
 *   /inactive-clients-20days → clients with no appointment in last 20 days
 *   /reviews-followup        → completed appointments 1-10min ago, not yet sent
 *
 * Every record now also returns:
 *   - company_name, company_slug
 *   - professional_name, professional_slug
 *   - booking_url, booking_url_type ("professional" | "company" | null)
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
const APP_BASE_URL = (Deno.env.get('APP_BASE_URL') ?? 'https://meagendae.com.br').replace(/\/$/, '');

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
  const fmt = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'America/Sao_Paulo',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  });
  const todayStr = fmt.format(now);
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

/**
 * Map a company business_type to the public route prefix used on the platform domain.
 * Routes registered in src/App.tsx (PlatformRoutes):
 *   - /barbearia/:slug        (barbershop)
 *   - /estetica/:slug         (esthetic / aesthetics / salons)
 *   - /barbearia/:slug/:professionalSlug
 *   - /estetica/:slug/:professionalSlug
 */
function routePrefixFor(businessType: string | null | undefined): 'barbearia' | 'estetica' {
  return businessType === 'esthetic' ? 'estetica' : 'barbearia';
}

/**
 * Build booking_url + booking_url_type given the slugs and the company's business_type.
 * URLs always use the platform's canonical public routes so they resolve on
 * meagendae.com.br without depending on subdomain/custom-domain configuration.
 */
function buildBookingUrl(
  companySlug: string | null,
  professionalSlug: string | null,
  businessType: string | null | undefined,
): {
  booking_url: string | null;
  booking_url_type: 'professional' | 'company' | null;
  route_prefix: 'barbearia' | 'estetica' | null;
} {
  if (!companySlug) {
    return { booking_url: null, booking_url_type: null, route_prefix: null };
  }
  const prefix = routePrefixFor(businessType);
  if (professionalSlug && professionalSlug.trim() !== '') {
    return {
      booking_url: `${APP_BASE_URL}/${prefix}/${companySlug}/${professionalSlug}`,
      booking_url_type: 'professional',
      route_prefix: prefix,
    };
  }
  return {
    booking_url: `${APP_BASE_URL}/${prefix}/${companySlug}`,
    booking_url_type: 'company',
    route_prefix: prefix,
  };
}

/** Cancel/reschedule pages are global (keyed by appointment id). */
function buildAppointmentManagementUrls(appointmentId: string) {
  return {
    cancel_url: `${APP_BASE_URL}/cancel/${appointmentId}`,
    reschedule_url: `${APP_BASE_URL}/reschedule/${appointmentId}`,
  };
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

/**
 * Bulk-load company + professional metadata for a set of appointment-like rows.
 * Returns helpers to look up names/slugs without N+1 queries.
 *
 * Tables used (existing):
 *   - companies(id, name, slug)
 *   - profiles(id, full_name)
 *   - collaborators(profile_id, company_id, slug, active)
 *
 * A professional is considered to have a public page only when there is an
 * ACTIVE collaborator row for (profile_id, company_id) AND it has a non-empty slug.
 */
async function loadCompanyAndProfessionalMeta(
  pairs: Array<{ company_id: string; professional_id: string | null }>,
) {
  const companyIds = [...new Set(pairs.map((p) => p.company_id).filter(Boolean))];
  const proIds = [
    ...new Set(
      pairs
        .map((p) => p.professional_id)
        .filter((p): p is string => !!p),
    ),
  ];

  const companyMap = new Map<
    string,
    { name: string | null; slug: string | null; business_type: string | null }
  >();
  if (companyIds.length > 0) {
    const { data: companies } = await admin
      .from('companies')
      .select('id, name, slug, business_type')
      .in('id', companyIds);
    for (const c of (companies ?? []) as Array<{
      id: string;
      name: string | null;
      slug: string | null;
      business_type: string | null;
    }>) {
      companyMap.set(c.id, { name: c.name, slug: c.slug, business_type: c.business_type });
    }
  }

  const profileMap = new Map<string, { full_name: string | null }>();
  if (proIds.length > 0) {
    const { data: profiles } = await admin
      .from('profiles')
      .select('id, full_name')
      .in('id', proIds);
    for (const p of (profiles ?? []) as Array<{ id: string; full_name: string | null }>) {
      profileMap.set(p.id, { full_name: p.full_name });
    }
  }

  // Key collaborator slug by `${company_id}:${profile_id}` to avoid cross-tenant collisions.
  // Only consider ACTIVE collaborators with a non-empty slug as "public page enabled".
  const collabSlugMap = new Map<string, string | null>();
  if (proIds.length > 0 && companyIds.length > 0) {
    const { data: collabs } = await admin
      .from('collaborators')
      .select('profile_id, company_id, slug, active')
      .in('profile_id', proIds)
      .in('company_id', companyIds)
      .eq('active', true);
    for (const col of (collabs ?? []) as Array<{
      profile_id: string;
      company_id: string;
      slug: string | null;
      active: boolean;
    }>) {
      const slug = col.slug && col.slug.trim() !== '' ? col.slug : null;
      collabSlugMap.set(`${col.company_id}:${col.profile_id}`, slug);
    }
  }

  return {
    getCompany: (companyId: string) =>
      companyMap.get(companyId) ?? { name: null, slug: null, business_type: null },
    getProfessionalName: (professionalId: string | null) =>
      professionalId ? profileMap.get(professionalId)?.full_name ?? null : null,
    getProfessionalSlug: (companyId: string, professionalId: string | null) => {
      if (!professionalId) return null;
      return collabSlugMap.get(`${companyId}:${professionalId}`) ?? null;
    },
  };
}

async function fetchAppointmentsForDay(dateYmd: string, onlyFuture: boolean) {
  const { startIso, endIso } = brDayRangeUtc(dateYmd);
  const nowIso = new Date().toISOString();

  const { data, error } = await admin
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
    `,
    )
    .gte('start_time', onlyFuture && startIso < nowIso ? nowIso : startIso)
    .lt('start_time', endIso)
    .in('status', ['confirmed', 'pending'])
    .order('start_time', { ascending: true });

  if (error) throw error;
  return (data ?? []) as unknown as AppointmentRow[];
}

async function mapAppointmentsWithUrls(rows: AppointmentRow[]) {
  const meta = await loadCompanyAndProfessionalMeta(
    rows.map((r) => ({ company_id: r.company_id, professional_id: r.professional_id })),
  );

  return rows.map((row) => {
    const clientName = row.clients?.name ?? row.client_name ?? null;
    const clientPhone = row.clients?.whatsapp ?? row.client_whatsapp ?? null;
    const company = meta.getCompany(row.company_id);
    const professionalName =
      row.profiles?.full_name ?? meta.getProfessionalName(row.professional_id) ?? null;
    const professionalSlug = meta.getProfessionalSlug(row.company_id, row.professional_id);
    const serviceName =
      row.appointment_services
        ?.map((s) => s.services?.name)
        .filter(Boolean)
        .join(', ') || null;

    const url = buildBookingUrl(company.slug, professionalSlug, company.business_type);
    const mgmt = buildAppointmentManagementUrls(row.id);

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
      // SaaS multi-tenant URL fields
      company_name: company.name,
      company_slug: company.slug,
      professional_slug: professionalSlug,
      business_type: company.business_type,
      route_prefix: url.route_prefix,
      booking_url: url.booking_url,
      booking_url_type: url.booking_url_type,
      cancel_url: mgmt.cancel_url,
      reschedule_url: mgmt.reschedule_url,
    };
  });
}

async function handleAppointmentsTomorrow() {
  const date = brDateOffset(1);
  const rows = (await fetchAppointmentsForDay(date, false)).filter(
    (r) => (r.clients?.whatsapp ?? r.client_whatsapp ?? '').trim() !== '',
  );
  return mapAppointmentsWithUrls(rows);
}

async function handleAppointmentsToday() {
  const date = brDateOffset(0);
  const rows = (await fetchAppointmentsForDay(date, true)).filter(
    (r) => (r.clients?.whatsapp ?? r.client_whatsapp ?? '').trim() !== '',
  );
  return mapAppointmentsWithUrls(rows);
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
    `,
    )
    .gte('start_time', startIso)
    .lt('start_time', endIso)
    .in('status', ['confirmed', 'pending'])
    .order('start_time', { ascending: true });

  if (error) throw error;
  const rows = ((data ?? []) as unknown as AppointmentRow[]).filter(
    (r) => (r.clients?.whatsapp ?? r.client_whatsapp ?? '').trim() !== '',
  );
  return mapAppointmentsWithUrls(rows);
}

async function handleInactive20Days() {
  // Clients whose latest appointment is older than 20 days (and no future appt).
  const cutoffIso = new Date(Date.now() - 20 * 24 * 60 * 60 * 1000).toISOString();

  const { data, error } = await admin
    .from('clients')
    .select(
      `
      id, company_id, name, whatsapp,
      appointments:appointments!appointments_client_id_fkey (
        start_time, status, professional_id
      )
    `,
    )
    .not('whatsapp', 'is', null)
    .eq('is_blocked', false);

  if (error) throw error;

  const nowIso = new Date().toISOString();

  type ClientRow = {
    id: string;
    company_id: string;
    name: string;
    whatsapp: string | null;
    appointments: Array<{
      start_time: string;
      status: string;
      professional_id: string | null;
    }> | null;
  };

  const candidates: Array<{
    client: ClientRow;
    lastVisit: string;
    lastProfessionalId: string | null;
  }> = [];

  for (const c of (data ?? []) as ClientRow[]) {
    if (!c.whatsapp || c.whatsapp.trim() === '') continue;
    const appts = c.appointments ?? [];
    if (appts.length === 0) continue;

    const validAppts = appts.filter(
      (a) => a.status !== 'cancelled' && a.status !== 'no_show',
    );
    if (validAppts.length === 0) continue;

    const hasFuture = validAppts.some((a) => a.start_time > nowIso);
    if (hasFuture) continue;

    const sorted = [...validAppts].sort((a, b) =>
      a.start_time < b.start_time ? 1 : -1,
    );
    const last = sorted[0];
    if (!last || last.start_time > cutoffIso) continue;

    candidates.push({
      client: c,
      lastVisit: last.start_time,
      lastProfessionalId: last.professional_id ?? null,
    });
  }

  if (candidates.length === 0) return [];

  const meta = await loadCompanyAndProfessionalMeta(
    candidates.map((c) => ({
      company_id: c.client.company_id,
      professional_id: c.lastProfessionalId,
    })),
  );

  return candidates.map(({ client, lastVisit, lastProfessionalId }) => {
    const company = meta.getCompany(client.company_id);
    const professionalName = meta.getProfessionalName(lastProfessionalId);
    const professionalSlug = meta.getProfessionalSlug(
      client.company_id,
      lastProfessionalId,
    );
    const url = buildBookingUrl(company.slug, professionalSlug, company.business_type);

    return {
      client_id: client.id,
      company_id: client.company_id,
      client_name: client.name,
      client_phone: client.whatsapp,
      last_visit: lastVisit,
      days_since_visit: Math.floor(
        (Date.now() - new Date(lastVisit).getTime()) / (24 * 60 * 60 * 1000),
      ),
      // SaaS multi-tenant URL fields
      company_name: company.name,
      company_slug: company.slug,
      business_type: company.business_type,
      route_prefix: url.route_prefix,
      professional_name: professionalName,
      professional_slug: professionalSlug,
      booking_url: url.booking_url,
      booking_url_type: url.booking_url_type,
    };
  });
}

/**
 * CENÁRIO 4 — Pós-atendimento + avaliação automática
 *
 * Returns appointments completed between 1 and 10 minutes ago, with valid phone,
 * not yet flagged as sent in whatsapp_logs (source LIKE 'reviews-followup:<id>').
 *
 * Review URL strategy:
 *   - Existing public route: /review/:appointmentId  (handles both pro + company rating)
 *   - We expose it as both `review_professional_url` and `review_company_url`
 *     so Make scenarios can reference either field without breaking.
 */
async function handleReviewsFollowup() {
  const now = Date.now();
  // Completed window: between 10 minutes ago and 1 minute ago
  // Prefer completed_at (real conclusion timestamp); fallback to end_time.
  const windowStartMs = now - 10 * 60 * 1000;
  const windowEndMs = now - 1 * 60 * 1000;
  const windowStart = new Date(windowStartMs).toISOString();
  const windowEnd = new Date(windowEndMs).toISOString();

  // Fetch any completed appointment whose completed_at OR end_time falls in window.
  // We OR over both columns at the DB level, then refine the effective timestamp in code.
  const { data, error } = await admin
    .from('appointments')
    .select(
      `
      id, company_id, start_time, end_time, completed_at, status, updated_at,
      client_id, client_name, client_whatsapp, professional_id, total_price,
      clients:client_id ( name, whatsapp ),
      profiles:professional_id ( full_name ),
      appointment_services ( services:service_id ( name ) )
    `,
    )
    .eq('status', 'completed')
    .or(
      `and(completed_at.gte.${windowStart},completed_at.lte.${windowEnd}),` +
        `and(completed_at.is.null,end_time.gte.${windowStart},end_time.lte.${windowEnd})`,
    )
    .order('completed_at', { ascending: false, nullsFirst: false });

  if (error) throw error;

  const rows = ((data ?? []) as unknown as (AppointmentRow & { completed_at?: string | null })[])
    .filter((r) => (r.clients?.whatsapp ?? r.client_whatsapp ?? '').trim() !== '')
    .filter((r) => {
      // Effective completion timestamp with fallback
      const effectiveMs = new Date(r.completed_at ?? r.end_time).getTime();
      return effectiveMs >= windowStartMs && effectiveMs <= windowEndMs;
    });

  if (rows.length === 0) return [];

  // Anti-duplicate: drop appointments already logged with reviews-followup source
  const ids = rows.map((r) => r.id);
  const sourceMarkers = ids.map((id) => `reviews-followup:${id}`);
  const { data: existingLogs } = await admin
    .from('whatsapp_logs')
    .select('source')
    .in('source', sourceMarkers);

  const sentIds = new Set(
    (existingLogs ?? [])
      .map((l: { source: string | null }) => l.source?.split(':')[1])
      .filter(Boolean),
  );

  const pending = rows.filter((r) => !sentIds.has(r.id));
  if (pending.length === 0) return [];

  const meta = await loadCompanyAndProfessionalMeta(
    pending.map((r) => ({ company_id: r.company_id, professional_id: r.professional_id })),
  );

  return pending.map((row) => {
    const company = meta.getCompany(row.company_id);
    const professionalName =
      row.profiles?.full_name ?? meta.getProfessionalName(row.professional_id) ?? null;
    const professionalSlug = meta.getProfessionalSlug(row.company_id, row.professional_id);
    const url = buildBookingUrl(company.slug, professionalSlug);

    // Existing review page is shared (single route), keyed by appointment id.
    const reviewUrl = `${APP_BASE_URL}/review/${row.id}`;

    return {
      appointment_id: row.id,
      company_id: row.company_id,
      client_id: row.client_id,
      client_name: row.clients?.name ?? row.client_name ?? null,
      client_phone: row.clients?.whatsapp ?? row.client_whatsapp ?? null,
      professional_name: professionalName,
      professional_slug: professionalSlug,
      company_name: company.name,
      company_slug: company.slug,
      appointment_date: formatDateBR(row.start_time),
      appointment_time: formatTimeBR(row.start_time),
      review_professional_url: reviewUrl,
      review_company_url: reviewUrl,
      booking_url: url.booking_url,
      booking_url_type: url.booking_url_type,
    };
  });
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
      case 'reviews-followup':
        payload = await handleReviewsFollowup();
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
              'reviews-followup',
            ],
          },
          404,
        );
    }

    return json(payload, 200);
  } catch (err) {
    console.error('[automations-api] error:', err);
    return json({ error: 'internal_error' }, 500);
  }
});
