// Edge Function: send-email
// Sends emails through Resend via Lovable Connector Gateway.
// Server-side only — RESEND_API_KEY is never exposed to the client.

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const GATEWAY_URL = "https://connector-gateway.lovable.dev/resend";

const FROM_DEFAULT = "Agendaê <onboarding@resend.dev>";
// Once your domain "agendae.com.br" is verified in Resend, set FROM_DOMAIN_VERIFIED=true
// and the function will use "Agendaê <naoresponda@agendae.com.br>" automatically.
const FROM_VERIFIED = "Agendaê <naoresponda@agendae.com.br>";
const USE_VERIFIED_DOMAIN =
  (Deno.env.get("AGENDAE_FROM_VERIFIED") ?? "false").toLowerCase() === "true";

interface SendEmailBody {
  to: string | string[];
  subject: string;
  html: string;
  from?: string;
  reply_to?: string;
}

function isValidEmail(email: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

function validateBody(body: unknown): { ok: true; data: SendEmailBody } | { ok: false; error: string } {
  if (!body || typeof body !== "object") return { ok: false, error: "Invalid body" };
  const b = body as Record<string, unknown>;

  if (!b.subject || typeof b.subject !== "string" || b.subject.length > 200) {
    return { ok: false, error: "subject is required (max 200 chars)" };
  }
  if (!b.html || typeof b.html !== "string" || b.html.length > 200_000) {
    return { ok: false, error: "html is required (max 200KB)" };
  }

  const toRaw = b.to;
  let toList: string[] = [];
  if (typeof toRaw === "string") toList = [toRaw];
  else if (Array.isArray(toRaw)) toList = toRaw.filter((x): x is string => typeof x === "string");
  else return { ok: false, error: "to must be a string or array of strings" };

  if (toList.length === 0 || toList.length > 50) {
    return { ok: false, error: "to must contain 1 to 50 addresses" };
  }
  for (const addr of toList) {
    if (!isValidEmail(addr)) return { ok: false, error: `Invalid email: ${addr}` };
  }

  if (b.from && (typeof b.from !== "string" || b.from.length > 200)) {
    return { ok: false, error: "from must be a string" };
  }
  if (b.reply_to && (typeof b.reply_to !== "string" || !isValidEmail(b.reply_to))) {
    return { ok: false, error: "reply_to must be a valid email" };
  }

  return {
    ok: true,
    data: {
      to: toList,
      subject: b.subject,
      html: b.html,
      from: b.from as string | undefined,
      reply_to: b.reply_to as string | undefined,
    },
  };
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  if (req.method !== "POST") {
    return new Response(JSON.stringify({ error: "Method not allowed" }), {
      status: 405,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
  const RESEND_API_KEY = Deno.env.get("RESEND_API_KEY");
  if (!LOVABLE_API_KEY) {
    return new Response(JSON.stringify({ error: "LOVABLE_API_KEY missing" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
  if (!RESEND_API_KEY) {
    return new Response(JSON.stringify({ error: "RESEND_API_KEY missing — connect Resend in Cloud" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  let parsed: SendEmailBody;
  try {
    const body = await req.json();
    const validation = validateBody(body);
    if (!validation.ok) {
      return new Response(JSON.stringify({ error: validation.error }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    parsed = validation.data;
  } catch {
    return new Response(JSON.stringify({ error: "Invalid JSON body" }), {
      status: 400,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  const from = parsed.from ?? (USE_VERIFIED_DOMAIN ? FROM_VERIFIED : FROM_DEFAULT);
  const toArray = Array.isArray(parsed.to) ? parsed.to : [parsed.to];

  try {
    const resp = await fetch(`${GATEWAY_URL}/emails`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "X-Connection-Api-Key": RESEND_API_KEY,
      },
      body: JSON.stringify({
        from,
        to: toArray,
        subject: parsed.subject,
        html: parsed.html,
        ...(parsed.reply_to ? { reply_to: parsed.reply_to } : {}),
      }),
    });

    const data = await resp.json().catch(() => ({}));

    if (!resp.ok) {
      console.error("[send-email] Resend error", resp.status, data);
      return new Response(
        JSON.stringify({ error: "Email send failed", status: resp.status, details: data }),
        { status: 502, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    console.log("[send-email] sent", { to: toArray, subject: parsed.subject, id: data?.id });
    return new Response(JSON.stringify({ success: true, id: data?.id ?? null }), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    console.error("[send-email] exception", message);
    return new Response(JSON.stringify({ error: message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
