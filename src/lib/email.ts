// Email service — Me Agendaê (premium templates v3)
// - Always invokes the `send-email` edge function (server-side, secure).
// - Never imports Resend SDK on the client; the API key stays in the backend.
// - Default sender: "Me Agendaê <naoresponda@agendae.com.br>"
// - Default reply-to: "suporte@agendae.com.br"
// - Structured to scale to new automation types (reminders, cashback, promos…).

import { supabase } from "@/integrations/supabase/client";

// ─── Brand tokens ──────────────────────────────────────────────────────────
const BRAND = {
  bg: "#f4f6fb",
  card: "#ffffff",
  text: "#0f172a",
  textSoft: "#334155",
  muted: "#64748b",
  primary: "#2563eb",
  primaryDark: "#1d4ed8",
  primaryText: "#ffffff",
  border: "#e6eaf2",
  surface: "#f8fafc",
  success: "#059669",
  danger: "#dc2626",
  amber: "#d97706",
};

// ─── Sender defaults (also enforced server-side) ───────────────────────────
export const EMAIL_DEFAULTS = {
  from: "Me Agendaê <naoresponda@agendae.com.br>",
  replyTo: "suporte@agendae.com.br",
  tagline: "Seu negócio, sua agenda, no controle.",
} as const;

interface TemplateOpts {
  title: string;
  /** Inner HTML — paragraphs, custom blocks, etc. */
  body: string;
  /** Optional CTA button */
  cta?: { label: string; url: string };
  /** Preview text shown in inbox preview */
  preview?: string;
  /** Optional small text under the CTA, e.g. "Equipe Me Agendaê 🚀" */
  signature?: string;
}

export function renderEmailTemplate({
  title,
  body,
  cta,
  preview,
  signature = "Equipe Me Agendaê 🚀",
}: TemplateOpts): string {
  const ctaHtml = cta
    ? `
    <table role="presentation" cellspacing="0" cellpadding="0" border="0" style="margin:32px 0 8px;">
      <tr>
        <td align="center" style="border-radius:10px;background:${BRAND.primary};box-shadow:0 4px 14px rgba(37,99,235,0.25);">
          <a href="${cta.url}" target="_blank"
             style="display:inline-block;padding:14px 28px;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Arial,sans-serif;font-size:15px;font-weight:600;color:${BRAND.primaryText};text-decoration:none;border-radius:10px;letter-spacing:-0.01em;">
            ${cta.label}
          </a>
        </td>
      </tr>
    </table>`
    : "";

  const previewHtml = preview
    ? `<div style="display:none;max-height:0;overflow:hidden;opacity:0;line-height:0;">${preview}</div>`
    : "";

  const signatureHtml = signature
    ? `<p style="margin:32px 0 0;font-size:14px;color:${BRAND.textSoft};line-height:1.5;">${signature}</p>`
    : "";

  return `<!doctype html>
<html lang="pt-BR">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width,initial-scale=1" />
    <title>${title}</title>
  </head>
  <body style="margin:0;padding:0;background:${BRAND.bg};font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,'Helvetica Neue',Arial,sans-serif;color:${BRAND.text};-webkit-font-smoothing:antialiased;">
    ${previewHtml}
    <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="background:${BRAND.bg};padding:40px 16px;">
      <tr>
        <td align="center">
          <table role="presentation" width="520" cellspacing="0" cellpadding="0" border="0" style="max-width:520px;width:100%;background:${BRAND.card};border-radius:16px;border:1px solid ${BRAND.border};overflow:hidden;box-shadow:0 1px 3px rgba(15,23,42,0.04);">
            <!-- Gradient header with tagline -->
            <tr>
              <td style="padding:0;background:linear-gradient(135deg, ${BRAND.primary} 0%, ${BRAND.primaryDark} 100%);">
                <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0">
                  <tr>
                    <td style="padding:32px 32px 28px;">
                      <div style="font-size:24px;font-weight:700;color:#ffffff;letter-spacing:-0.02em;line-height:1;">
                        me agendaê
                      </div>
                      <div style="margin-top:8px;font-size:13px;color:rgba(255,255,255,0.92);letter-spacing:0.01em;font-weight:500;">
                        ${EMAIL_DEFAULTS.tagline}
                      </div>
                    </td>
                  </tr>
                </table>
              </td>
            </tr>
            <!-- Body -->
            <tr>
              <td style="padding:36px 32px 32px;">
                <h1 style="margin:0 0 20px;font-size:24px;font-weight:700;line-height:1.3;color:${BRAND.text};letter-spacing:-0.02em;">
                  ${title}
                </h1>
                <div style="font-size:15px;line-height:1.65;color:${BRAND.textSoft};">
                  ${body}
                </div>
                ${ctaHtml}
                ${signatureHtml}
              </td>
            </tr>
            <!-- Footer -->
            <tr>
              <td style="padding:20px 32px 28px;border-top:1px solid ${BRAND.border};background:${BRAND.surface};">
                <p style="margin:0;font-size:12px;line-height:1.6;color:${BRAND.muted};text-align:center;">
                  © Agendaê — Agendamento inteligente para seu negócio<br/>
                  <span style="color:#94a3b8;">Você recebeu este e-mail porque tem uma conta no Agendaê.</span><br/>
                  <span style="color:#94a3b8;">Dúvidas? Responda este e-mail ou escreva para <a href="mailto:${EMAIL_DEFAULTS.replyTo}" style="color:${BRAND.primary};text-decoration:none;">${EMAIL_DEFAULTS.replyTo}</a>.</span>
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
/**
 * Known automation types — used for logging/telemetry and to keep call sites
 * consistent. Extend here as new flows are added.
 */
export type EmailType =
  | "welcome_company"
  | "welcome_client"
  | "monthly_report"
  | "reminder_inactive_client"
  | "cashback_available"
  | "promo_campaign"
  | "generic";

export interface SendEmailParams {
  to: string | string[];
  subject: string;
  html: string;
  /** Override default sender (rarely needed). */
  from?: string;
  /** Override default reply-to (rarely needed). */
  reply_to?: string;
  /** Optional logical type for logging/telemetry. */
  type?: EmailType;
}

export async function sendEmail(
  params: SendEmailParams,
): Promise<{ ok: boolean; id?: string; error?: string }> {
  // Always inject defaults if caller didn't override.
  const payload: SendEmailParams = {
    ...params,
    from: params.from ?? EMAIL_DEFAULTS.from,
    reply_to: params.reply_to ?? EMAIL_DEFAULTS.replyTo,
  };

  try {
    const { data, error } = await supabase.functions.invoke("send-email", { body: payload });
    if (error) {
      console.warn(`[email:${params.type ?? "generic"}] failed:`, error.message);
      return { ok: false, error: error.message };
    }
    console.log(`[email:${params.type ?? "generic"}] sent:`, params.subject, params.to);
    return { ok: true, id: (data as any)?.id };
  } catch (err: any) {
    console.warn(`[email:${params.type ?? "generic"}] exception:`, err?.message);
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
    preview: `${opts.companyName} está pronta para receber agendamentos online.`,
    body: `
      <p style="margin:0 0 16px;">Olá, <strong style="color:${BRAND.text};">${escapeHtml(opts.name)}</strong>!</p>
      <p style="margin:0 0 16px;">
        Que bom ter você por aqui 👋 Sua empresa <strong style="color:${BRAND.text};">"${escapeHtml(opts.companyName)}"</strong> já está no ar.
      </p>
      <p style="margin:0 0 16px;">
        Agora ela já pode <strong>receber agendamentos online</strong>, organizar a agenda e <strong>fidelizar clientes</strong> com facilidade — tudo em um só lugar.
      </p>
      <p style="margin:0;color:${BRAND.muted};font-size:14px;">
        Comece configurando seus serviços, equipe e horários. Em poucos minutos, sua agenda estará pronta para vender mais.
      </p>
    `,
    cta: { label: "Acessar meu painel", url: dashboardUrl },
  });

  return sendEmail({
    to: opts.email,
    subject: "Bem-vindo ao Agendaê 🚀",
    html,
    type: "welcome_company",
  });
}

// ─── Welcome — Client ──────────────────────────────────────────────────────
export async function sendWelcomeClientEmail(opts: { email: string; name: string }) {
  const portalUrl = `${window.location.origin}/minha-conta`;
  const html = renderEmailTemplate({
    title: "Agora ficou fácil agendar ✂️",
    preview: "Agende seus serviços em segundos, sem ligar e sem esperar.",
    body: `
      <p style="margin:0 0 16px;">Olá, <strong style="color:${BRAND.text};">${escapeHtml(opts.name)}</strong>!</p>
      <p style="margin:0 0 16px;">
        Agora você pode <strong>agendar seus serviços de forma rápida</strong>, sem precisar esperar ou ligar. É só escolher o horário que combina com você 💙
      </p>
      <p style="margin:0;color:${BRAND.muted};font-size:14px;">
        No seu painel você acompanha agendamentos, cashback e pontos de fidelidade — tudo em um só lugar.
      </p>
    `,
    cta: { label: "Acessar minha conta", url: portalUrl },
  });

  return sendEmail({
    to: opts.email,
    subject: "Agora ficou fácil agendar ✂️",
    html,
    type: "welcome_client",
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

/** Pick an interpretation message based on revenue + profit + volume. */
function getInsight(data: MonthlyReportData): {
  emoji: string;
  title: string;
  text: string;
  tone: "good" | "neutral" | "low";
} {
  const { totalRevenue, totalAppointments, profit } = data;

  if (totalAppointments === 0) {
    return {
      emoji: "🌱",
      title: "Mês de plantio",
      text: "Ainda não houve atendimentos registrados. Que tal divulgar seu link de agendamento e criar uma promoção para atrair os primeiros clientes?",
      tone: "low",
    };
  }
  if (totalRevenue >= 5000 && profit > 0) {
    return {
      emoji: "🔥",
      title: "Mês excelente!",
      text: "Seu negócio teve um desempenho muito acima da média este mês. Continue com a estratégia — está funcionando!",
      tone: "good",
    };
  }
  if (totalRevenue >= 1500) {
    return {
      emoji: "💪",
      title: "Mês consistente",
      text: "Bom volume de atendimentos. Para subir um nível, ative o cashback e lembretes automáticos para reduzir faltas.",
      tone: "neutral",
    };
  }
  return {
    emoji: "📈",
    title: "Ainda dá pra crescer",
    text: "Que tal ativar promoções, ajustar horários de pico e divulgar seu link nas redes sociais? Pequenos passos geram grandes resultados.",
    tone: "low",
  };
}

export function renderMonthlyReportEmail(opts: {
  companyName: string;
  monthLabel: string;
  data: MonthlyReportData;
}): string {
  const card = (label: string, value: string, color = BRAND.text, emoji = "") => `
    <td style="padding:6px;" width="50%" valign="top">
      <div style="background:${BRAND.surface};border:1px solid ${BRAND.border};border-radius:12px;padding:18px;">
        <div style="font-size:12px;color:${BRAND.muted};margin-bottom:6px;font-weight:500;letter-spacing:0.01em;text-transform:uppercase;">
          ${emoji ? `${emoji} ` : ""}${label}
        </div>
        <div style="font-size:22px;font-weight:700;color:${color};letter-spacing:-0.02em;line-height:1.2;">${value}</div>
      </div>
    </td>`;

  const insight = getInsight(opts.data);
  const insightBg =
    insight.tone === "good" ? "#ecfdf5" : insight.tone === "low" ? "#fef3c7" : "#eff6ff";
  const insightBorder =
    insight.tone === "good" ? "#a7f3d0" : insight.tone === "low" ? "#fde68a" : "#bfdbfe";
  const insightColor =
    insight.tone === "good" ? "#065f46" : insight.tone === "low" ? "#92400e" : "#1e40af";

  const body = `
    <p style="margin:0 0 20px;">
      Aqui está o resumo de <strong style="color:${BRAND.text};">${escapeHtml(opts.monthLabel)}</strong> da
      <strong style="color:${BRAND.text};">${escapeHtml(opts.companyName)}</strong> 📊
    </p>

    <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="margin:0 -6px;">
      <tr>
        ${card("Atendimentos", String(opts.data.totalAppointments), BRAND.text, "📅")}
        ${card("Faturamento", fmtBRL(opts.data.totalRevenue), BRAND.primary, "💰")}
      </tr>
      <tr>
        ${card("Novos clientes", String(opts.data.newClients), BRAND.text, "✨")}
        ${card("Lucro", fmtBRL(opts.data.profit), opts.data.profit >= 0 ? BRAND.success : BRAND.danger, opts.data.profit >= 0 ? "📈" : "📉")}
      </tr>
      <tr>
        ${card("Reagendamentos", String(opts.data.reschedules), BRAND.text, "🔁")}
        ${card("Comissões", fmtBRL(opts.data.commissions), BRAND.text, "💼")}
      </tr>
    </table>

    <div style="margin:28px 0 8px;padding:18px 20px;background:${insightBg};border:1px solid ${insightBorder};border-radius:12px;">
      <div style="font-size:14px;font-weight:700;color:${insightColor};margin-bottom:4px;letter-spacing:-0.01em;">
        ${insight.emoji} ${insight.title}
      </div>
      <div style="font-size:14px;line-height:1.55;color:${insightColor};">
        ${insight.text}
      </div>
    </div>
  `;

  return renderEmailTemplate({
    title: "Seu resumo do mês 📊",
    preview: `${opts.data.totalAppointments} atendimentos · ${fmtBRL(opts.data.totalRevenue)}`,
    body,
    cta: { label: "Ver painel completo", url: `${window.location.origin}/dashboard` },
  });
}

// ─── Future automation scaffolds (ready to wire) ───────────────────────────
// These helpers are intentionally simple wrappers so new triggers can plug in
// without touching the renderer. Call sites can be added later (cron / hooks).

export async function sendInactiveClientReminder(opts: {
  email: string;
  name: string;
  companyName: string;
  bookingUrl: string;
}) {
  const html = renderEmailTemplate({
    title: "Sentimos sua falta 💙",
    preview: `${opts.companyName} preparou um horário pra você.`,
    body: `
      <p style="margin:0 0 16px;">Olá, <strong style="color:${BRAND.text};">${escapeHtml(opts.name)}</strong>!</p>
      <p style="margin:0 0 16px;">
        Faz um tempinho desde sua última visita à <strong>${escapeHtml(opts.companyName)}</strong>. Que tal reservar um horário agora mesmo?
      </p>
      <p style="margin:0;color:${BRAND.muted};font-size:14px;">
        Leva menos de 1 minuto pra escolher o melhor dia.
      </p>
    `,
    cta: { label: "Agendar agora", url: opts.bookingUrl },
  });
  return sendEmail({
    to: opts.email,
    subject: "Sentimos sua falta 💙",
    html,
    type: "reminder_inactive_client",
  });
}

export async function sendCashbackAvailableEmail(opts: {
  email: string;
  name: string;
  amount: number;
  expiresLabel: string;
  bookingUrl: string;
}) {
  const html = renderEmailTemplate({
    title: `Você tem ${fmtBRL(opts.amount)} de cashback 💸`,
    preview: `Use até ${opts.expiresLabel} no seu próximo agendamento.`,
    body: `
      <p style="margin:0 0 16px;">Olá, <strong style="color:${BRAND.text};">${escapeHtml(opts.name)}</strong>!</p>
      <p style="margin:0 0 16px;">
        Boa notícia: você tem <strong style="color:${BRAND.success};">${fmtBRL(opts.amount)}</strong> de cashback disponível para usar no seu próximo agendamento.
      </p>
      <p style="margin:0;color:${BRAND.muted};font-size:14px;">
        Válido até <strong>${escapeHtml(opts.expiresLabel)}</strong>. Não deixe expirar 😉
      </p>
    `,
    cta: { label: "Usar cashback agora", url: opts.bookingUrl },
  });
  return sendEmail({
    to: opts.email,
    subject: `Você tem ${fmtBRL(opts.amount)} de cashback 💸`,
    html,
    type: "cashback_available",
  });
}

export async function sendPromoCampaignEmail(opts: {
  email: string;
  name: string;
  promoTitle: string;
  promoDescription: string;
  bookingUrl: string;
}) {
  const html = renderEmailTemplate({
    title: opts.promoTitle,
    preview: opts.promoDescription,
    body: `
      <p style="margin:0 0 16px;">Olá, <strong style="color:${BRAND.text};">${escapeHtml(opts.name)}</strong>!</p>
      <p style="margin:0 0 16px;">${escapeHtml(opts.promoDescription)}</p>
    `,
    cta: { label: "Aproveitar agora", url: opts.bookingUrl },
  });
  return sendEmail({
    to: opts.email,
    subject: opts.promoTitle,
    html,
    type: "promo_campaign",
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
