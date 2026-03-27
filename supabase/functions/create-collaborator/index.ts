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

    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return jsonResponse({ error: "Not authenticated" }, 401);
    }

    const supabaseAdmin = createClient(supabaseUrl, serviceRoleKey);
    const supabaseAuth = createClient(supabaseUrl, anonKey, {
      global: { headers: { Authorization: authHeader } },
    });

    const { data: authData, error: authError } = await supabaseAuth.auth.getUser();
    const caller = authData.user;

    if (authError || !caller) {
      return jsonResponse({ error: "Invalid token" }, 401);
    }

    let body: any;
    try {
      body = await req.json();
    } catch {
      return jsonResponse({ error: "Invalid JSON body" }, 400);
    }

    const name = typeof body.name === "string" ? body.name.trim() : "";
    const email = typeof body.email === "string" ? body.email.trim().toLowerCase() : "";
    const companyId = typeof body.company_id === "string" ? body.company_id.trim() : "";
    const collaboratorType = body.collaborator_type === "partner" ? "partner" : "commissioned";
    const paymentType = ["percentage", "fixed", "none"].includes(body.payment_type) ? body.payment_type : null;
    const role = body.role === "collaborator" ? "collaborator" : null;
    const rawCommissionValue = Number(body.commission_value);
    const commissionValue = Number.isFinite(rawCommissionValue) && rawCommissionValue >= 0 ? rawCommissionValue : NaN;

    if (!name || !email || !companyId || !paymentType || !role || Number.isNaN(commissionValue)) {
      return jsonResponse({
        error: "Missing or invalid fields",
        fields: {
          name: Boolean(name),
          email: Boolean(email),
          company_id: Boolean(companyId),
          payment_type: Boolean(paymentType),
          role: Boolean(role),
          commission_value: !Number.isNaN(commissionValue),
        },
      }, 400);
    }

    const emailIsValid = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
    if (!emailIsValid || name.length > 255 || email.length > 255) {
      return jsonResponse({ error: "Invalid name or email" }, 400);
    }

    const { data: callerProfile, error: profileError } = await supabaseAdmin
      .from("profiles")
      .select("company_id")
      .eq("user_id", caller.id)
      .maybeSingle();

    if (profileError || !callerProfile?.company_id) {
      return jsonResponse({ error: "No company found for authenticated user" }, 400);
    }

    if (callerProfile.company_id !== companyId) {
      return jsonResponse({ error: "Invalid company_id" }, 403);
    }

    const { data: roleCheck, error: roleError } = await supabaseAdmin
      .from("user_roles")
      .select("id")
      .eq("user_id", caller.id)
      .eq("company_id", companyId)
      .eq("role", "professional")
      .maybeSingle();

    if (roleError || !roleCheck) {
      return jsonResponse({ error: "Not authorized" }, 403);
    }

    const { data: newUser, error: createError } = await supabaseAdmin.auth.admin.createUser({
      email,
      password: `${crypto.randomUUID().slice(0, 12)}A1!`,
      email_confirm: true,
      user_metadata: { full_name: name },
    });

    if (createError || !newUser.user) {
      return jsonResponse({ error: createError?.message || "Failed to create user" }, 400);
    }

    const userId = newUser.user.id;

    const { data: existingProfile, error: existingProfileError } = await supabaseAdmin
      .from("profiles")
      .select("id")
      .eq("user_id", userId)
      .maybeSingle();

    if (existingProfileError) {
      return jsonResponse({ error: existingProfileError.message }, 500);
    }

    let profileId = existingProfile?.id as string | undefined;

    if (!profileId) {
      const { data: insertedProfile, error: insertProfileError } = await supabaseAdmin
        .from("profiles")
        .insert({
          user_id: userId,
          full_name: name,
          email,
          company_id: companyId,
        })
        .select("id")
        .single();

      if (insertProfileError || !insertedProfile) {
        return jsonResponse({ error: insertProfileError?.message || "Failed to create profile" }, 500);
      }

      profileId = insertedProfile.id;
    } else {
      const { error: updateProfileError } = await supabaseAdmin
        .from("profiles")
        .update({
          full_name: name,
          email,
          company_id: companyId,
        })
        .eq("id", profileId);

      if (updateProfileError) {
        return jsonResponse({ error: updateProfileError.message }, 500);
      }
    }

    const { error: roleInsertError } = await supabaseAdmin.from("user_roles").insert({
      user_id: userId,
      company_id: companyId,
      role,
    });

    if (roleInsertError) {
      return jsonResponse({ error: roleInsertError.message }, 500);
    }

    const { error: collaboratorError } = await supabaseAdmin.from("collaborators").insert({
      company_id: companyId,
      profile_id: profileId,
      collaborator_type: collaboratorType,
      commission_type: paymentType,
      commission_value: paymentType === "none" ? 0 : commissionValue,
      commission_percent: paymentType === "percentage" ? commissionValue : 0,
    });

    if (collaboratorError) {
      return jsonResponse({ error: collaboratorError.message }, 500);
    }

    return jsonResponse({
      success: true,
      collaborator: {
        user_id: userId,
        profile_id: profileId,
        company_id: companyId,
        payment_type: paymentType,
        commission_value: paymentType === "none" ? 0 : commissionValue,
      },
    });
  } catch (error) {
    console.error("create-collaborator error", error);
    return jsonResponse({ error: "Internal error" }, 500);
  }
});
