// Edge Function: automation-monthly-report
// Sends monthly report email to all active company owners. Called monthly by pg_cron.

import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const APP_BASE_URL = Deno.env.get("APP_BASE_URL") ?? "https://meagendae.com.br";

const BRAND = {
  text: "#0f172a", textSoft: "#334155", muted: "#64748b",
  primary: "#2563eb", primaryDark: "#1d4ed8", success: "#059669", danger: "#dc2626",
  bg: "#f4f6fb", card: "#ffffff", surface: "#f8fafc", border: "#e6eaf2",
};

const escapeHtml = (s: string) =>
  String(s).replace(/[&<>"']/g, (c) => ({
    "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;",
  }[c]!));

const fmtBRL = (n: number) =>
  new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(n || 0);

interface ReportData {
  totalAppointments: number;
  totalRevenue: number;
  newClients: number;
  reschedules: number;
  commissions: number;
  profit: number;
}

function getInsight(d: ReportData) {
  if (d.totalAppointments === 0) {
    return { emoji: "🌱", title: "Mês de plantio", text: "Ainda não houve atendimentos. Que tal divulgar seu link e criar uma promoção?", tone: "low" as const };
  }
  if (d.totalRevenue >= 5000 && d.profit > 0) {
    return { emoji: "🔥", title: "Mês excelente!", text: "Seu negócio teve um desempenho muito acima da média. Continue assim!", tone: "good" as const };
  }
  if (d.totalRevenue >= 1500) {
    return { emoji: "💪", title: "Mês consistente", text: "Bom volume! Para subir um nível, ative cashback e lembretes automáticos.", tone: "neutral" as const };
  }
  return { emoji: "📈", title: "Ainda dá pra crescer mais", text: "Que tal ativar promoções e divulgar seu link nas redes sociais?", tone: "low" as const };
}

function renderReport(opts: { companyName: string; monthLabel: string; data: ReportData }) {
  const card = (label: string, value: string, color = BRAND.text, emoji = "") => `
    <td style="padding:6px;" width="50%" valign="top">
      <div style="background:${BRAND.surface};border:1px solid ${BRAND.border};border-radius:12px;padding:18px;">
        <div style="font-size:12px;color:${BRAND.muted};margin-bottom:6px;font-weight:500;text-transform:uppercase;">${emoji ? `${emoji} ` : ""}${label}</div>
        <div style="font-size:22px;font-weight:700;color:${color};letter-spacing:-0.02em;line-height:1.2;">${value}</div>
      </div>
    </td>`;

  const insight = getInsight(opts.data);
  const insightBg = insight.tone === "good" ? "#ecfdf5" : insight.tone === "low" ? "#fef3c7" : "#eff6ff";
  const insightBorder = insight.tone === "good" ? "#a7f3d0" : insight.tone === "low" ? "#fde68a" : "#bfdbfe";
  const insightColor = insight.tone === "good" ? "#065f46" : insight.tone === "low" ? "#92400e" : "#1e40af";

  return `<!doctype html><html lang="pt-BR"><head><meta charset="utf-8"/><title>Resumo do mês</title></head>
<body style="margin:0;padding:0;background:${BRAND.bg};font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Arial,sans-serif;color:${BRAND.text};">
<table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background:${BRAND.bg};padding:40px 16px;"><tr><td align="center">
<table role="presentation" width="520" cellspacing="0" cellpadding="0" style="max-width:520px;width:100%;background:${BRAND.card};border-radius:16px;border:1px solid ${BRAND.border};overflow:hidden;">
<tr><td style="padding:32px 32px 28px;background:linear-gradient(135deg,${BRAND.primary} 0%,${BRAND.primaryDark} 100%);">
<div style="font-size:24px;font-weight:700;color:#fff;letter-spacing:-0.02em;">meagendaê</div>
<div style="margin-top:8px;font-size:13px;color:rgba(255,255,255,0.92);font-weight:500;">Seu negócio, sua agenda, no controle.</div>
</td></tr>
<tr><td style="padding:36px 32px 32px;">
<h1 style="margin:0 0 20px;font-size:24px;font-weight:700;line-height:1.3;color:${BRAND.text};letter-spacing:-0.02em;">Seu resumo do mês no Agendaê 📊</h1>
<div style="font-size:15px;line-height:1.65;color:${BRAND.textSoft};">
<p style="margin:0 0 20px;">Aqui está o resumo de <strong>${escapeHtml(opts.monthLabel)}</strong> da <strong>${escapeHtml(opts.companyName)}</strong>:</p>
<table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="margin:0 -6px;">
<tr>${card("Atendimentos", String(opts.data.totalAppointments), BRAND.text, "📅")}${card("Faturamento", fmtBRL(opts.data.totalRevenue), BRAND.primary, "💰")}</tr>
<tr>${card("Novos clientes", String(opts.data.newClients), BRAND.text, "✨")}${card("Lucro", fmtBRL(opts.data.profit), opts.data.profit >= 0 ? BRAND.success : BRAND.danger, opts.data.profit >= 0 ? "📈" : "📉")}</tr>
</table>
<div style="margin:28px 0 8px;padding:18px 20px;background:${insightBg};border:1px solid ${insightBorder};border-radius:12px;">
<div style="font-size:14px;font-weight:700;color:${insightColor};margin-bottom:4px;">${insight.emoji} ${insight.title}</div>
<div style="font-size:14px;line-height:1.55;color:${insightColor};">${insight.text}</div>
</div>
</div>
<table role="presentation" cellspacing="0" cellpadding="0" style="margin:32px 0 8px;"><tr>
<td align="center" style="border-radius:10px;background:${BRAND.primary};box-shadow:0 4px 14px rgba(37,99,235,0.25);">
<a href="${APP_BASE_URL}/dashboard" target="_blank" style="display:inline-block;padding:14px 28px;font-size:15px;font-weight:600;color:#fff;text-decoration:none;border-radius:10px;">Ver painel completo</a>
</td></tr></table>
<p style="margin:32px 0 0;font-size:14px;color:${BRAND.textSoft};">Equipe Agendaê 🚀</p>
</td></tr>
<tr><td style="padding:20px 32px 28px;border-top:1px solid ${BRAND.border};background:${BRAND.surface};">
<p style="margin:0;font-size:12px;line-height:1.6;color:${BRAND.muted};text-align:center;">© Agendaê — Agendamento inteligente para seu negócio</p>
</td></tr>
</table></td></tr></table></body></html>`;
}

function getMonthRange(): { start: string; end: string; label: string } {
  const now = new Date();
  let year = now.getFullYear();
  let month = now.getMonth() - 1;
  if (month < 0) { month = 11; year -= 1; }
  const start = new Date(Date.UTC(year, month, 1));
  const end = new Date(Date.UTC(year, month + 1, 1));
  const label = start.toLocaleDateString("pt-BR", { month: "long", year: "numeric", timeZone: "UTC" });
  return { start: start.toISOString(), end: end.toISOString(), label };
}

async function generateReport(supabase: any, companyId: string, start: string, end: string): Promise<ReportData> {
  const { data: appts } = await supabase
    .from("appointments")
    .select("id, status, total_price, client_id, rescheduled_from_id, professional_id")
    .eq("company_id", companyId)
    .gte("start_time", start).lt("start_time", end);

  const list = (appts ?? []) as any[];
  const completed = list.filter((a) => a.status === "completed");
  const totalAppointments = list.filter((a) => !["cancelled", "no_show", "rescheduled"].includes(a.status)).length;
  const totalRevenue = completed.reduce((s, a) => s + Number(a.total_price || 0), 0);
  const reschedules = list.filter((a) => a.status === "rescheduled" || a.rescheduled_from_id).length;

  const clientIds = [...new Set(list.map((a) => a.client_id).filter(Boolean))];
  let newClients = 0;
  if (clientIds.length > 0) {
    const { data: firstAppts } = await supabase
      .from("appointments")
      .select("client_id, start_time")
      .eq("company_id", companyId)
      .in("client_id", clientIds)
      .order("start_time", { ascending: true });
    const firstByClient = new Map<string, string>();
    for (const r of (firstAppts ?? []) as any[]) {
      if (!firstByClient.has(r.client_id)) firstByClient.set(r.client_id, r.start_time);
    }
    newClients = [...firstByClient.values()].filter((t) => t >= start && t < end).length;
  }

  let commissions = 0;
  const profIds = [...new Set(completed.map((a) => a.professional_id).filter(Boolean))];
  if (profIds.length > 0) {
    const { data: collabs } = await supabase
      .from("collaborators")
      .select("profile_id, commission_type, commission_value, commission_percent")
      .eq("company_id", companyId).in("profile_id", profIds);
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

  const { data: exp } = await supabase
    .from("company_expenses")
    .select("amount")
    .eq("company_id", companyId)
    .gte("expense_date", start.slice(0, 10))
    .lt("expense_date", end.slice(0, 10));
  const expenses = ((exp ?? []) as any[]).reduce((s, e) => s + Number(e.amount || 0), 0);

  return { totalAppointments, totalRevenue, newClients, reschedules, commissions, profit: totalRevenue - commissions - expenses };
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

  try {
    const { start, end, label } = getMonthRange();

    // Active companies with owner
    const { data: companies, error } = await supabase
      .from("companies")
      .select("id, name, slug, user_id")
      .not("user_id", "is", null);

    if (error) throw error;

    let sent = 0, skipped = 0, failed = 0;

    for (const company of (companies ?? []) as any[]) {
      // Get owner email via auth admin
      const { data: userData } = await supabase.auth.admin.getUserById(company.owner_id);
      const ownerEmail = userData?.user?.email;
      if (!ownerEmail) { skipped++; continue; }

      const data = await generateReport(supabase, company.id, start, end);
      const html = renderReport({ companyName: company.name, monthLabel: label, data });

      const { error: sendErr } = await supabase.functions.invoke("send-email", {
        body: { to: ownerEmail, subject: "Seu resumo do mês no Agendaê 📊", html },
      });

      if (sendErr) {
        failed++;
        console.log("[EMAIL AUTO] monthly_report failed", company.name, sendErr.message);
      } else {
        sent++;
        console.log("[EMAIL AUTO] monthly_report sent", company.name, ownerEmail);
      }
    }

    console.log("[EMAIL AUTO] monthly-report done", { sent, skipped, failed, month: label });
    return new Response(JSON.stringify({ success: true, sent, skipped, failed, month: label }), {
      status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Unknown error";
    console.error("[EMAIL AUTO] monthly-report error", msg);
    return new Response(JSON.stringify({ error: msg }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
