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

    // 1. Read Authorization header
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return jsonResponse({ error: "Not authenticated" }, 401);
    }

    // 2. Create user-context client with the token
    const supabaseUser = createClient(supabaseUrl, anonKey, {
      global: { headers: { Authorization: authHeader } },
    });

    // 3. Validate the authenticated user
    const { data: authData, error: authError } = await supabaseUser.auth.getUser();
    const caller = authData?.user;

    if (authError || !caller) {
      return jsonResponse({ error: "Invalid token" }, 401);
    }

    // Admin client for privileged operations
    const supabaseAdmin = createClient(supabaseUrl, serviceRoleKey);

    // Parse body
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
    const whatsapp = typeof body.whatsapp === "string" ? body.whatsapp.trim() : null;

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

    // 4. Retrieve caller's company_id from profile
    const { data: callerProfile, error: profileError } = await supabaseAdmin
      .from("profiles")
      .select("company_id")
      .eq("user_id", caller.id)
      .maybeSingle();

    if (profileError || !callerProfile?.company_id) {
      // During onboarding the profile may not have company_id yet — return success with warning
      return jsonResponse({
        success: true,
        warning: "Collaborator creation skipped: no company found for user yet",
      });
    }

    // 5. Only allow if user belongs to the target company
    if (callerProfile.company_id !== companyId) {
      return jsonResponse({
        success: true,
        warning: "Collaborator creation skipped: company mismatch",
      });
    }

    // NOTE: We no longer require "professional" role here.
    // During onboarding the owner may not have any role yet — they are the company owner.
    // We verify ownership via company_id match above.

    // Check if user with this email already exists
    const { data: existingUsers } = await supabaseAdmin.auth.admin.listUsers();
    const existingUser = existingUsers?.users?.find((u: any) => u.email === email);

    let userId: string;

    if (existingUser) {
      userId = existingUser.id;
    } else {
      const { data: newUser, error: createError } = await supabaseAdmin.auth.admin.createUser({
        email,
        password: `${crypto.randomUUID().slice(0, 12)}A1!`,
        email_confirm: true,
        user_metadata: { full_name: name },
      });

      if (createError || !newUser.user) {
        return jsonResponse({
          success: true,
          warning: `Collaborator creation failed: ${createError?.message || "Failed to create user"}`,
        });
      }
      userId = newUser.user.id;
    }

    // Upsert profile
    const { data: existingProfile } = await supabaseAdmin
      .from("profiles")
      .select("id")
      .eq("user_id", userId)
      .maybeSingle();

    let profileId: string;

    if (!existingProfile) {
      const { data: insertedProfile, error: insertProfileError } = await supabaseAdmin
        .from("profiles")
        .insert({
          user_id: userId,
          full_name: name,
          email,
          company_id: companyId,
          whatsapp: whatsapp || null,
        })
        .select("id")
        .single();

      if (insertProfileError || !insertedProfile) {
        return jsonResponse({
          success: true,
          warning: `Profile creation failed: ${insertProfileError?.message}`,
        });
      }
      profileId = insertedProfile.id;
    } else {
      const updateData: Record<string, any> = {
        full_name: name,
        email,
        company_id: companyId,
      };
      if (whatsapp) updateData.whatsapp = whatsapp;

      const { error: updateProfileError } = await supabaseAdmin
        .from("profiles")
        .update(updateData)
        .eq("id", existingProfile.id);

      if (updateProfileError) {
        return jsonResponse({
          success: true,
          warning: `Profile update failed: ${updateProfileError.message}`,
        });
      }
      profileId = existingProfile.id;
    }

    // Insert role (ignore if already exists)
    const { data: existingRoleCheck } = await supabaseAdmin
      .from("user_roles")
      .select("id")
      .eq("user_id", userId)
      .eq("company_id", companyId)
      .eq("role", role)
      .maybeSingle();

    if (!existingRoleCheck) {
      const { error: roleInsertError } = await supabaseAdmin.from("user_roles").insert({
        user_id: userId,
        company_id: companyId,
        role,
      });

      if (roleInsertError) {
        return jsonResponse({
          success: true,
          warning: `Role assignment failed: ${roleInsertError.message}`,
        });
      }
    }

    // Insert collaborator (check if already exists)
    const { data: existingCollaborator } = await supabaseAdmin
      .from("collaborators")
      .select("id")
      .eq("company_id", companyId)
      .eq("profile_id", profileId)
      .maybeSingle();

    if (!existingCollaborator) {
      const { error: collaboratorError } = await supabaseAdmin.from("collaborators").insert({
        company_id: companyId,
        profile_id: profileId,
        collaborator_type: collaboratorType,
        commission_type: paymentType,
        commission_value: paymentType === "none" ? 0 : commissionValue,
        commission_percent: paymentType === "percentage" ? commissionValue : 0,
      });

      if (collaboratorError) {
        return jsonResponse({
          success: true,
          warning: `Collaborator insert failed: ${collaboratorError.message}`,
        });
      }
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
    // Never block onboarding
    return jsonResponse({
      success: true,
      warning: "Internal error during collaborator creation",
    });
  }
});
