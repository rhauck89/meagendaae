// Edge Function: automation-cashback-available
// Notifies clients with active cashback balance. Called weekly by pg_cron.

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
  primary: "#2563eb", primaryDark: "#1d4ed8", success: "#059669",
  bg: "#f4f6fb", card: "#ffffff", surface: "#f8fafc", border: "#e6eaf2",
};

const escapeHtml = (s: string) =>
  String(s).replace(/[&<>"']/g, (c) => ({
    "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;",
  }[c]!));

const fmtBRL = (n: number) =>
  new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(n || 0);

function renderTemplate(opts: { title: string; body: string; cta: { label: string; url: string }; preview?: string }) {
  return `<!doctype html><html lang="pt-BR"><head><meta charset="utf-8"/><title>${opts.title}</title></head>
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
    const nowIso = new Date().toISOString();

    // Active cashback (not used, not expired)
    const { data: cashbacks, error } = await supabase
      .from("client_cashback")
      .select("client_id, company_id, amount, expires_at")
      .eq("status", "active")
      .gt("expires_at", nowIso);

    if (error) throw error;

    // Aggregate by client+company
    const balances = new Map<string, { client_id: string; company_id: string; amount: number; expires_at: string }>();
    for (const cb of (cashbacks ?? []) as any[]) {
      const key = `${cb.client_id}__${cb.company_id}`;
      const cur = balances.get(key);
      if (cur) {
        cur.amount += Number(cb.amount || 0);
        if (cb.expires_at < cur.expires_at) cur.expires_at = cb.expires_at;
      } else {
        balances.set(key, {
          client_id: cb.client_id,
          company_id: cb.company_id,
          amount: Number(cb.amount || 0),
          expires_at: cb.expires_at,
        });
      }
    }

    if (balances.size === 0) {
      console.log("[EMAIL AUTO] cashback no_balance");
      return new Response(JSON.stringify({ success: true, sent: 0 }), {
        status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const clientIds = [...new Set([...balances.values()].map((b) => b.client_id))];
    const companyIds = [...new Set([...balances.values()].map((b) => b.company_id))];

    const [{ data: clients }, { data: companies }] = await Promise.all([
      supabase.from("clients").select("id, name, email").in("id", clientIds).not("email", "is", null),
      supabase.from("companies").select("id, slug, name").in("id", companyIds),
    ]);

    const clientMap = new Map<string, { name: string; email: string }>();
    for (const c of (clients ?? []) as any[]) {
      if (c.email) clientMap.set(c.id, { name: c.name, email: c.email });
    }
    const companyMap = new Map<string, { slug: string; name: string }>();
    for (const c of (companies ?? []) as any[]) companyMap.set(c.id, { slug: c.slug, name: c.name });

    let sent = 0, skipped = 0, failed = 0;

    for (const balance of balances.values()) {
      if (balance.amount < 1) { skipped++; continue; }
      const client = clientMap.get(balance.client_id);
      const company = companyMap.get(balance.company_id);
      if (!client || !company) { skipped++; continue; }

      const expiresLabel = new Date(balance.expires_at).toLocaleDateString("pt-BR");
      const bookingUrl = `${APP_BASE_URL}/${company.slug}`;

      const html = renderTemplate({
        title: `Você tem ${fmtBRL(balance.amount)} de cashback 💰`,
        preview: `Saldo disponível em ${company.name} — válido até ${expiresLabel}.`,
        body: `<p style="margin:0 0 16px;">Olá, <strong>${escapeHtml(client.name)}</strong>!</p>
<p style="margin:0 0 16px;">Você tem saldo disponível para usar em <strong>${escapeHtml(company.name)}</strong>: <strong style="color:${BRAND.success};">${fmtBRL(balance.amount)}</strong>.</p>
<p style="margin:0;color:${BRAND.muted};font-size:14px;">Válido até <strong>${expiresLabel}</strong>. Não deixe expirar 😉</p>`,
        cta: { label: "Usar cashback agora", url: bookingUrl },
      });

      const { error: sendErr } = await supabase.functions.invoke("send-email", {
        body: { to: client.email, subject: "Você tem saldo disponível para usar 💰", html },
      });

      if (sendErr) {
        failed++;
        console.log("[EMAIL AUTO] cashback failed", client.email, sendErr.message);
      } else {
        sent++;
        console.log("[EMAIL AUTO] cashback sent", client.email, balance.amount);
      }
    }

    console.log("[EMAIL AUTO] cashback done", { sent, skipped, failed });
    return new Response(JSON.stringify({ success: true, sent, skipped, failed }), {
      status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Unknown error";
    console.error("[EMAIL AUTO] cashback error", msg);
    return new Response(JSON.stringify({ error: msg }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
