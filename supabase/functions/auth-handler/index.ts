
import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  const supabaseAdmin = createClient(
    Deno.env.get("SUPABASE_URL") ?? "",
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? ""
  );

  try {
    const { email, type } = await req.json();

    if (!email || !type) {
      throw new Error("Email and type are required");
    }

    // Gerar o link oficial do Supabase Auth sem enviar o e-mail automático
    const { data, error } = await supabaseAdmin.auth.admin.generateLink({
      type: type === 'reset' ? 'recovery' : 'signup',
      email: email,
    });

    if (error) throw error;

    const link = data.properties.action_link;

    // Disparar o e-mail via nossa função send-email centralizada
    const emailResp = await fetch(`${Deno.env.get("SUPABASE_URL")}/functions/v1/send-email`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")}`,
      },
      body: JSON.stringify({
        to: email,
        type: type === 'reset' ? 'password_reset' : 'email_confirmation',
        data: { 
          link: link,
          name: email.split('@')[0] // Fallback para nome
        }
      }),
    });

    if (!emailResp.ok) {
      const errorData = await emailResp.json();
      throw new Error(`Failed to send email: ${JSON.stringify(errorData)}`);
    }

    return new Response(JSON.stringify({ success: true }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });

  } catch (error) {
    return new Response(JSON.stringify({ error: error.message }), {
      status: 400,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
