// Email service — Agendaê
// Always invokes the `send-email` edge function (server-side, secure).
// Never imports Resend SDK on the client; the API key stays in the backend.

import { supabase } from "@/integrations/supabase/client";

// ─── Brand template ────────────────────────────────────────────────────────
const BRAND = {
  bg: "#f9fafb",
  card: "#ffffff",
  text: "#111827",
  muted: "#6b7280",
  primary: "#2563eb",
  primaryText: "#ffffff",
  border: "#e5e7eb",
};

interface TemplateOpts {
  title: string;
  /** Inner HTML — paragraphs, custom blocks, etc. */
  body: string;
  /** Optional CTA button */
  cta?: { label: string; url: string };
  /** Preview text shown in inbox preview */
  preview?: string;
}

export function renderEmailTemplate({ title, body, cta, preview }: TemplateOpts): string {
  const ctaHtml = cta
    ? `
    <table role="presentation" cellspacing="0" cellpadding="0" border="0" style="margin:24px 0 8px;">
      <tr>
        <td align="center" style="border-radius:8px;background:${BRAND.primary};">
          <a href="${cta.url}" target="_blank" style="display:inline-block;padding:12px 24px;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Arial,sans-serif;font-size:15px;font-weight:600;color:${BRAND.primaryText};text-decoration:none;border-radius:8px;">
            ${cta.label}
          </a>
        </td>
      </tr>
    </table>`
    : "";

  const previewHtml = preview
    ? `<div style="display:none;max-height:0;overflow:hidden;opacity:0;">${preview}</div>`
    : "";

  return `<!doctype html>
<html lang="pt-BR">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width,initial-scale=1" />
    <title>${title}</title>
  </head>
  <body style="margin:0;padding:0;background:${BRAND.bg};font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Arial,sans-serif;color:${BRAND.text};">
    ${previewHtml}
    <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="background:${BRAND.bg};padding:32px 16px;">
      <tr>
        <td align="center">
          <table role="presentation" width="480" cellspacing="0" cellpadding="0" border="0" style="max-width:480px;width:100%;background:${BRAND.card};border-radius:12px;border:1px solid ${BRAND.border};overflow:hidden;">
            <tr>
              <td style="padding:24px 24px 0;">
                <div style="font-size:18px;font-weight:700;color:${BRAND.primary};letter-spacing:-0.01em;">
                  meagendaê
                </div>
              </td>
            </tr>
            <tr>
              <td style="padding:16px 24px 24px;">
                <h1 style="margin:0 0 12px;font-size:22px;font-weight:700;line-height:1.3;color:${BRAND.text};">
                  ${title}
                </h1>
                <div style="font-size:15px;line-height:1.6;color:${BRAND.text};">
                  ${body}
                </div>
                ${ctaHtml}
              </td>
            </tr>
            <tr>
              <td style="padding:16px 24px 24px;border-top:1px solid ${BRAND.border};">
                <p style="margin:0;font-size:12px;line-height:1.5;color:${BRAND.muted};text-align:center;">
                  © Agendaê — Agendamento inteligente para seu negócio
                </p>
              </td>
            </tr>
          </table>
        </td>
      </tr>
    </table>
  </body>
</html>`;
}

// ─── Generic sender ────────────────────────────────────────────────────────
export interface SendEmailParams {
  to: string | string[];
  subject: string;
  html: string;
  reply_to?: string;
}

export async function sendEmail(params: SendEmailParams): Promise<{ ok: boolean; id?: string; error?: string }> {
  try {
    const { data, error } = await supabase.functions.invoke("send-email", { body: params });
    if (error) {
      console.warn("[email] failed:", error.message);
      return { ok: false, error: error.message };
    }
    console.log("[email] enviado:", params.subject, params.to);
    return { ok: true, id: (data as any)?.id };
  } catch (err: any) {
    console.warn("[email] exception:", err?.message);
    return { ok: false, error: err?.message };
  }
}

// ─── Welcome — Company owner ───────────────────────────────────────────────
export async function sendWelcomeCompanyEmail(opts: {
  email: string;
  name: string;
  companyName: string;
}) {
  const dashboardUrl = `${window.location.origin}/dashboard`;
  const html = renderEmailTemplate({
    title: "Bem-vindo ao Agendaê 🚀",
    preview: `Sua empresa ${opts.companyName} está pronta para receber agendamentos.`,
    body: `
      <p style="margin:0 0 12px;">Olá, <strong>${escapeHtml(opts.name)}</strong>!</p>
      <p style="margin:0 0 12px;">
        Sua empresa <strong>"${escapeHtml(opts.companyName)}"</strong> já está pronta para receber agendamentos.
      </p>
      <p style="margin:0;color:#6b7280;">
        Acesse seu painel para configurar serviços, equipe e começar a vender mais.
      </p>
    `,
    cta: { label: "Acessar meu painel", url: dashboardUrl },
  });

  return sendEmail({
    to: opts.email,
    subject: "Bem-vindo ao Agendaê 🚀",
    html,
  });
}

// ─── Welcome — Client ──────────────────────────────────────────────────────
export async function sendWelcomeClientEmail(opts: { email: string; name: string }) {
  const portalUrl = `${window.location.origin}/minha-conta`;
  const html = renderEmailTemplate({
    title: "Agora ficou fácil agendar ✂️",
    preview: "Agende seus serviços de forma rápida e prática.",
    body: `
      <p style="margin:0 0 12px;">Olá, <strong>${escapeHtml(opts.name)}</strong>!</p>
      <p style="margin:0 0 12px;">
        Você já pode agendar seus serviços de forma rápida e prática pelo Agendaê.
      </p>
      <p style="margin:0;color:#6b7280;">
        Acompanhe seus agendamentos, cashback e pontos no seu painel.
      </p>
    `,
    cta: { label: "Acessar minha conta", url: portalUrl },
  });

  return sendEmail({
    to: opts.email,
    subject: "Agora ficou fácil agendar ✂️",
    html,
  });
}

// ─── Monthly report ────────────────────────────────────────────────────────
export interface MonthlyReportData {
  totalAppointments: number;
  totalRevenue: number;
  newClients: number;
  reschedules: number;
  commissions: number;
  profit: number;
}

const fmtBRL = (n: number) =>
  new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(n || 0);

export function renderMonthlyReportEmail(opts: {
  companyName: string;
  monthLabel: string;
  data: MonthlyReportData;
}): string {
  const card = (label: string, value: string, color = BRAND.text) => `
    <td style="padding:8px;" width="50%">
      <div style="background:#f9fafb;border:1px solid ${BRAND.border};border-radius:10px;padding:14px;">
        <div style="font-size:12px;color:${BRAND.muted};margin-bottom:4px;">${label}</div>
        <div style="font-size:18px;font-weight:700;color:${color};">${value}</div>
      </div>
    </td>`;

  const body = `
    <p style="margin:0 0 16px;">
      Aqui está o resumo de <strong>${escapeHtml(opts.monthLabel)}</strong> da sua empresa
      <strong>${escapeHtml(opts.companyName)}</strong>:
    </p>
    <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0">
      <tr>
        ${card("Atendimentos", String(opts.data.totalAppointments))}
        ${card("Faturamento", fmtBRL(opts.data.totalRevenue), BRAND.primary)}
      </tr>
      <tr>
        ${card("Novos clientes", String(opts.data.newClients))}
        ${card("Lucro", fmtBRL(opts.data.profit), opts.data.profit >= 0 ? "#059669" : "#dc2626")}
      </tr>
      <tr>
        ${card("Reagendamentos", String(opts.data.reschedules))}
        ${card("Comissões", fmtBRL(opts.data.commissions))}
      </tr>
    </table>
  `;

  return renderEmailTemplate({
    title: "Seu resumo do mês no Agendaê 📊",
    preview: `${opts.data.totalAppointments} atendimentos · ${fmtBRL(opts.data.totalRevenue)}`,
    body,
    cta: { label: "Ver painel completo", url: `${window.location.origin}/dashboard` },
  });
}

// ─── Helpers ───────────────────────────────────────────────────────────────
function escapeHtml(s: string): string {
  return String(s ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}
