
import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";
import { templates } from "../_shared/email-templates.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const GATEWAY_URL = "https://connector-gateway.lovable.dev/resend";

interface EmailRequest {
  to: string;
  type: keyof typeof templates;
  data: any;
  company_id?: string;
  user_id?: string;
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  const supabase = createClient(
    Deno.env.get("SUPABASE_URL") ?? "",
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? ""
  );

  try {
    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    const RESEND_API_KEY = Deno.env.get("RESEND_API_KEY");

    if (!RESEND_API_KEY) {
      throw new Error("RESEND_API_KEY missing");
    }

    const body: EmailRequest = await req.json();
    const { to, type, data, company_id, user_id } = body;

    if (!templates[type]) {
      throw new Error(`Invalid email type: ${type}`);
    }

    const template = templates[type](data);
    
    // Configurar remetente baseado no tipo
    let from = "Agendaê <naoresponda@meagendae.com.br>";
    if (type.startsWith("ticket")) {
      from = "Suporte Agendaê <suporte@meagendae.com.br>";
    } else if (type.startsWith("subscription") || type.startsWith("payment")) {
      from = "Financeiro Agendaê <financeiro@meagendae.com.br>";
    }

    // Enviar via Resend Gateway
    const res = await fetch(`${GATEWAY_URL}/emails`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "X-Connection-Api-Key": RESEND_API_KEY,
      },
      body: JSON.stringify({
        from,
        to: [to],
        subject: template.subject,
        html: template.html,
      }),
    });

    const resData = await res.json();
    const status = res.ok ? "sent" : "failed";

    // Registrar Log
    await supabase.from("email_logs").insert({
      company_id,
      user_id,
      to_email: to,
      from_email: from,
      subject: template.subject,
      email_type: type,
      status,
      resend_id: resData?.id,
      error_message: res.ok ? null : JSON.stringify(resData),
    });

    if (!res.ok) {
      console.error("Resend error:", resData);
      return new Response(JSON.stringify({ error: "Failed to send email", details: resData }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    return new Response(JSON.stringify({ success: true, id: resData.id }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });

  } catch (error) {
    console.error("Email function error:", error);
    return new Response(JSON.stringify({ error: error.message }), {
      status: 400,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
