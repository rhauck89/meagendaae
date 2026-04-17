// Edge Function: automation-inactive-clients
// Sends reminder emails to clients with no appointment in the last 15 days.
// Called daily by pg_cron.

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
  text: "#0f172a",
  textSoft: "#334155",
  muted: "#64748b",
  primary: "#2563eb",
  primaryDark: "#1d4ed8",
  bg: "#f4f6fb",
  card: "#ffffff",
  surface: "#f8fafc",
  border: "#e6eaf2",
};

const escapeHtml = (s: string) =>
  String(s).replace(/[&<>"']/g, (c) => ({
    "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;",
  }[c]!));

function renderTemplate(opts: { title: string; body: string; cta: { label: string; url: string }; preview?: string }) {
  return `<!doctype html><html lang="pt-BR"><head><meta charset="utf-8"/><meta name="viewport" content="width=device-width,initial-scale=1"/><title>${opts.title}</title></head>
<body style="margin:0;padding:0;background:${BRAND.bg};font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Arial,sans-serif;color:${BRAND.text};">
${opts.preview ? `<div style="display:none;max-height:0;overflow:hidden;opacity:0;">${opts.preview}</div>` : ""}
<table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background:${BRAND.bg};padding:40px 16px;"><tr><td align="center">
<table role="presentation" width="520" cellspacing="0" cellpadding="0" style="max-width:520px;width:100%;background:${BRAND.card};border-radius:16px;border:1px solid ${BRAND.border};overflow:hidden;">
<tr><td style="padding:32px 32px 28px;background:linear-gradient(135deg,${BRAND.primary} 0%,${BRAND.primaryDark} 100%);">
<div style="font-size:24px;font-weight:700;color:#fff;letter-spacing:-0.02em;">meagendaê</div>
<div style="margin-top:8px;font-size:13px;color:rgba(255,255,255,0.92);font-weight:500;">Seu negócio, sua agenda, no controle.</div>
</td></tr>
<tr><td style="padding:36px 32px 32px;">
<h1 style="margin:0 0 20px;font-size:24px;font-weight:700;line-height:1.3;color:${BRAND.text};letter-spacing:-0.02em;">${opts.title}</h1>
<div style="font-size:15px;line-height:1.65;color:${BRAND.textSoft};">${opts.body}</div>
<table role="presentation" cellspacing="0" cellpadding="0" style="margin:32px 0 8px;"><tr>
<td align="center" style="border-radius:10px;background:${BRAND.primary};box-shadow:0 4px 14px rgba(37,99,235,0.25);">
<a href="${opts.cta.url}" target="_blank" style="display:inline-block;padding:14px 28px;font-size:15px;font-weight:600;color:#fff;text-decoration:none;border-radius:10px;">${opts.cta.label}</a>
</td></tr></table>
<p style="margin:32px 0 0;font-size:14px;color:${BRAND.textSoft};">Equipe Agendaê 🚀</p>
</td></tr>
<tr><td style="padding:20px 32px 28px;border-top:1px solid ${BRAND.border};background:${BRAND.surface};">
<p style="margin:0;font-size:12px;line-height:1.6;color:${BRAND.muted};text-align:center;">© Agendaê — Agendamento inteligente para seu negócio</p>
</td></tr>
</table></td></tr></table></body></html>`;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

  try {
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - 15);
    const cutoffIso = cutoffDate.toISOString();

    // Get last appointment per client
    const { data: clients, error: clientsErr } = await supabase
      .from("clients")
      .select("id, name, email, company_id, is_blocked")
      .eq("is_blocked", false)
      .not("email", "is", null);

    if (clientsErr) throw clientsErr;

    let sent = 0;
    let skipped = 0;
    let failed = 0;

    // Build map of last appointment per client
    const clientIds = (clients ?? []).map((c: any) => c.id);
    if (clientIds.length === 0) {
      console.log("[EMAIL AUTO] inactive-clients no_clients");
      return new Response(JSON.stringify({ success: true, sent: 0, skipped: 0 }), {
        status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { data: lastAppts } = await supabase
      .from("appointments")
      .select("client_id, start_time")
      .in("client_id", clientIds)
      .order("start_time", { ascending: false });

    const lastByClient = new Map<string, string>();
    for (const a of (lastAppts ?? []) as any[]) {
      if (!lastByClient.has(a.client_id)) lastByClient.set(a.client_id, a.start_time);
    }

    // Cache company slugs
    const companyIds = [...new Set((clients ?? []).map((c: any) => c.company_id))];
    const { data: companies } = await supabase
      .from("companies")
      .select("id, slug, name")
      .in("id", companyIds);
    const companyMap = new Map<string, { slug: string; name: string }>();
    for (const c of (companies ?? []) as any[]) companyMap.set(c.id, { slug: c.slug, name: c.name });

    for (const client of (clients ?? []) as any[]) {
      if (!client.email) { skipped++; continue; }
      const lastAppt = lastByClient.get(client.id);
      // Only send if last appt > 15 days ago, OR if client has never had one (skip never-clients to avoid spam)
      if (!lastAppt || lastAppt > cutoffIso) { skipped++; continue; }

      const company = companyMap.get(client.company_id);
      if (!company) { skipped++; continue; }

      const bookingUrl = `${APP_BASE_URL}/${company.slug}`;
      const html = renderTemplate({
        title: "Já está na hora de cuidar do visual 😎",
        preview: `${company.name} preparou um horário pra você.`,
        body: `<p style="margin:0 0 16px;">Olá, <strong>${escapeHtml(client.name)}</strong>!</p>
<p style="margin:0 0 16px;">Faz mais de 15 dias desde sua última visita à <strong>${escapeHtml(company.name)}</strong>. Que tal reservar um horário agora?</p>
<p style="margin:0;color:${BRAND.muted};font-size:14px;">Leva menos de 1 minuto pra escolher o melhor dia.</p>`,
        cta: { label: "Agendar agora", url: bookingUrl },
      });

      const { error: sendErr } = await supabase.functions.invoke("send-email", {
        body: { to: client.email, subject: "Já está na hora de cuidar do visual 😎", html },
      });

      if (sendErr) {
        failed++;
        console.log("[EMAIL AUTO] inactive_client failed", client.email, sendErr.message);
      } else {
        sent++;
        console.log("[EMAIL AUTO] inactive_client sent", client.email);
      }
    }

    console.log("[EMAIL AUTO] inactive-clients done", { sent, skipped, failed });
    return new Response(JSON.stringify({ success: true, sent, skipped, failed }), {
      status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Unknown error";
    console.error("[EMAIL AUTO] inactive-clients error", msg);
    return new Response(JSON.stringify({ error: msg }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
