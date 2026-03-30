import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const jsonResponse = (body: Record<string, unknown>, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL");
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
    const anonKey = Deno.env.get("SUPABASE_ANON_KEY");

    if (!supabaseUrl || !serviceRoleKey || !anonKey) {
      return jsonResponse({ error: "Server configuration error" }, 500);
    }

    // Validate caller
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return jsonResponse({ error: "Not authenticated" }, 401);
    }

    const supabaseUser = createClient(supabaseUrl, anonKey, {
      global: { headers: { Authorization: authHeader } },
    });

    const { data: authData, error: authError } = await supabaseUser.auth.getUser();
    const caller = authData?.user;

    if (authError || !caller) {
      return jsonResponse({ error: "Invalid token" }, 401);
    }

    const supabaseAdmin = createClient(supabaseUrl, serviceRoleKey);

    // Get caller's company
    const { data: callerProfile } = await supabaseAdmin
      .from("profiles")
      .select("company_id")
      .eq("user_id", caller.id)
      .maybeSingle();

    if (!callerProfile?.company_id) {
      return jsonResponse({ error: "No company found" }, 403);
    }

    let body: any;
    try {
      body = await req.json();
    } catch {
      return jsonResponse({ error: "Invalid JSON body" }, 400);
    }

    const action = body.action; // "invite" or "reset_password"
    const targetUserId = typeof body.user_id === "string" ? body.user_id.trim() : "";
    const targetEmail = typeof body.email === "string" ? body.email.trim().toLowerCase() : "";

    if (!action || !["invite", "reset_password"].includes(action)) {
      return jsonResponse({ error: "Invalid action" }, 400);
    }

    if (!targetEmail) {
      return jsonResponse({ error: "Email is required" }, 400);
    }

    // Verify target belongs to same company
    if (targetUserId) {
      const { data: targetProfile } = await supabaseAdmin
        .from("profiles")
        .select("company_id")
        .eq("user_id", targetUserId)
        .maybeSingle();

      if (!targetProfile || targetProfile.company_id !== callerProfile.company_id) {
        return jsonResponse({ error: "User not in your company" }, 403);
      }
    }

    if (action === "invite") {
      // Generate a new temporary password and update the user
      const newTempPassword = `${crypto.randomUUID().slice(0, 8)}A1!`;

      // Find the user by email
      const { data: existingUsers } = await supabaseAdmin.auth.admin.listUsers();
      const targetUser = existingUsers?.users?.find((u: any) => u.email === targetEmail);

      if (!targetUser) {
        return jsonResponse({ error: "User not found" }, 404);
      }

      // Update password to a new temp one
      const { error: updateError } = await supabaseAdmin.auth.admin.updateUserById(
        targetUser.id,
        { password: newTempPassword }
      );

      if (updateError) {
        return jsonResponse({ error: `Failed to reset credentials: ${updateError.message}` }, 500);
      }

      return jsonResponse({
        success: true,
        temp_password: newTempPassword,
        message: "New temporary credentials generated",
      });
    }

    if (action === "reset_password") {
      // Send a password reset email via Supabase Auth
      const { error: resetError } = await supabaseAdmin.auth.admin.generateLink({
        type: "recovery",
        email: targetEmail,
      });

      if (resetError) {
        return jsonResponse({ error: `Failed to send reset: ${resetError.message}` }, 500);
      }

      return jsonResponse({
        success: true,
        message: "Password reset email sent",
      });
    }

    return jsonResponse({ error: "Unknown action" }, 400);
  } catch (error) {
    console.error("invite-team-member error", error);
    return jsonResponse({ error: "Internal server error" }, 500);
  }
});
