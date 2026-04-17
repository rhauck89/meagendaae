// Edge Function: monthly-report
// Generates monthly report data for a company. Can be invoked manually
// or scheduled later via pg_cron (day 1 at 08:00).
//
// Body: { company_id: string, month?: string (YYYY-MM, default = previous month), send_email?: boolean }

import { corsHeaders } from "@supabase/supabase-js/cors";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

interface ReportData {
  totalAppointments: number;
  totalRevenue: number;
  newClients: number;
  reschedules: number;
  commissions: number;
  profit: number;
}

function getMonthRange(monthStr?: string): { start: string; end: string; label: string } {
  const now = new Date();
  let year: number, month: number;
  if (monthStr && /^\d{4}-\d{2}$/.test(monthStr)) {
    const [y, m] = monthStr.split("-").map(Number);
    year = y; month = m - 1;
  } else {
    // previous month
    year = now.getFullYear();
    month = now.getMonth() - 1;
    if (month < 0) { month = 11; year -= 1; }
  }
  const start = new Date(Date.UTC(year, month, 1, 0, 0, 0));
  const end = new Date(Date.UTC(year, month + 1, 1, 0, 0, 0));
  const label = start.toLocaleDateString("pt-BR", { month: "long", year: "numeric", timeZone: "UTC" });
  return { start: start.toISOString(), end: end.toISOString(), label };
}

async function generateReport(
  supabase: ReturnType<typeof createClient>,
  companyId: string,
  start: string,
  end: string,
): Promise<ReportData> {
  // Appointments in window
  const { data: appts } = await supabase
    .from("appointments")
    .select("id, status, total_price, client_id, rescheduled_from_id, professional_id")
    .eq("company_id", companyId)
    .gte("start_time", start)
    .lt("start_time", end);

  const list = appts ?? [];
  const completed = list.filter((a: any) => a.status === "completed");

  const totalAppointments = list.filter((a: any) =>
    !["cancelled", "no_show", "rescheduled"].includes(a.status)
  ).length;

  const totalRevenue = completed.reduce((s: number, a: any) => s + Number(a.total_price || 0), 0);
  const reschedules = list.filter((a: any) => a.status === "rescheduled" || a.rescheduled_from_id).length;

  // New clients (first appointment in window)
  const clientIds = [...new Set(list.map((a: any) => a.client_id).filter(Boolean))];
  let newClients = 0;
  if (clientIds.length > 0) {
    const { data: firstAppts } = await supabase
      .from("appointments")
      .select("client_id, start_time")
      .eq("company_id", companyId)
      .in("client_id", clientIds as string[])
      .order("start_time", { ascending: true });
    const firstByClient = new Map<string, string>();
    for (const row of (firstAppts ?? []) as any[]) {
      if (!firstByClient.has(row.client_id)) firstByClient.set(row.client_id, row.start_time);
    }
    newClients = [...firstByClient.values()].filter((t) => t >= start && t < end).length;
  }

  // Commissions — best-effort: sum from collaborators commission_percent over completed revenue
  let commissions = 0;
  const profIds = [...new Set(completed.map((a: any) => a.professional_id).filter(Boolean))];
  if (profIds.length > 0) {
    const { data: collabs } = await supabase
      .from("collaborators")
      .select("profile_id, commission_type, commission_value, commission_percent")
      .eq("company_id", companyId)
      .in("profile_id", profIds as string[]);
    const byProf = new Map<string, any>();
    for (const c of (collabs ?? []) as any[]) byProf.set(c.profile_id, c);
    for (const a of completed as any[]) {
      const c = byProf.get(a.professional_id);
      if (!c) continue;
      const pct = Number(c.commission_percent ?? c.commission_value ?? 0);
      if (c.commission_type === "percentage" || c.commission_percent != null) {
        commissions += (Number(a.total_price || 0) * pct) / 100;
      }
    }
  }

  // Expenses (best-effort, may not exist for every company)
  let expenses = 0;
  const { data: exp } = await supabase
    .from("company_expenses")
    .select("amount")
    .eq("company_id", companyId)
    .gte("expense_date", start.slice(0, 10))
    .lt("expense_date", end.slice(0, 10));
  expenses = (exp ?? []).reduce((s: number, e: any) => s + Number(e.amount || 0), 0);

  const profit = totalRevenue - commissions - expenses;

  return {
    totalAppointments,
    totalRevenue,
    newClients,
    reschedules,
    commissions,
    profit,
  };
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const body = await req.json().catch(() => ({}));
    const companyId = body?.company_id;
    if (!companyId || typeof companyId !== "string") {
      return new Response(JSON.stringify({ error: "company_id required" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);
    const { start, end, label } = getMonthRange(body?.month);
    const data = await generateReport(supabase, companyId, start, end);

    console.log("[monthly-report] generated", { companyId, label, ...data });

    return new Response(
      JSON.stringify({ success: true, company_id: companyId, month: label, data }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Unknown error";
    console.error("[monthly-report] error", msg);
    return new Response(JSON.stringify({ error: msg }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
