import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const jsonResponse = (body: Record<string, unknown>, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });

const isAlreadyRegisteredError = (message = "") => {
  const normalized = message.toLowerCase();
  return (
    normalized.includes("already registered") ||
    normalized.includes("already exists") ||
    normalized.includes("user exists") ||
    normalized.includes("user already")
  );
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
    const { email, password, fullName, type, redirectTo } = await req.json();

    if (!email || !type) {
      return jsonResponse({ error: "Email and type are required", code: "missing_fields" }, 400);
    }

    let link = "";
    const userName = fullName || email.split("@")[0];

    if (type === "signup") {
      if (!password) {
        return jsonResponse({ error: "Password is required", code: "password_required" }, 400);
      }

      const { data: signupLink, error: linkError } =
        await supabaseAdmin.auth.admin.generateLink({
          type: "signup",
          email,
          password,
          options: {
            data: { full_name: fullName },
            redirectTo:
              redirectTo ||
              `${Deno.env.get("SITE_URL") || "https://meagendae.com.br"}/auth`,
          },
        });

      if (linkError) {
        if (isAlreadyRegisteredError(linkError.message)) {
          return jsonResponse(
            {
              error:
                "Ja existe uma conta com este email. Tente fazer login ou recupere sua senha.",
              code: "user_already_exists",
            },
            409
          );
        }
        throw linkError;
      }

      link = signupLink?.properties?.action_link || "";
      if (!link) throw new Error("Could not generate signup confirmation link");
    } else if (type === "reset") {
      const { data, error } = await supabaseAdmin.auth.admin.generateLink({
        type: "recovery",
        email,
        options: {
          redirectTo:
            redirectTo ||
            `${Deno.env.get("SITE_URL") || "https://meagendae.com.br"}/reset-password`,
        },
      });
      if (error) throw error;
      link = data.properties.action_link;
    } else {
      return jsonResponse({ error: "Invalid auth request type", code: "invalid_type" }, 400);
    }

    const emailResp = await fetch(`${Deno.env.get("SUPABASE_URL")}/functions/v1/send-email`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")}`,
      },
      body: JSON.stringify({
        to: email,
        type: type === "reset" ? "password_reset" : "email_confirmation",
        data: {
          link,
          name: userName,
        },
      }),
    });

    if (!emailResp.ok) {
      const errorData = await emailResp.json().catch(() => null);
      throw new Error(`Failed to send email: ${JSON.stringify(errorData)}`);
    }

    return jsonResponse({ success: true });
  } catch (error: any) {
    console.error("Auth handler error:", error);
    return jsonResponse(
      {
        error: error?.message || "Auth request failed",
        code: error?.code || "auth_handler_error",
      },
      400
    );
  }
});
