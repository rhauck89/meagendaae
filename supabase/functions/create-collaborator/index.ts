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

    const supabaseUser = createClient(supabaseUrl, anonKey, {
      global: { headers: { Authorization: authHeader } },
    });

    const { data: authData, error: authError } = await supabaseUser.auth.getUser();
    const caller = authData?.user;

    if (authError || !caller) {
      return jsonResponse({ error: "Invalid token" }, 401);
    }

    const supabaseAdmin = createClient(supabaseUrl, serviceRoleKey);

    let body: any;
    try {
      body = await req.json();
    } catch {
      return jsonResponse({ error: "Invalid JSON body" }, 400);
    }

    const name = typeof body.name === "string" ? body.name.trim() : "";
    const email = typeof body.email === "string" ? body.email.trim().toLowerCase() : "";
    const companyId = typeof body.company_id === "string" ? body.company_id.trim() : "";
    const collaboratorType = ["partner", "commissioned", "independent"].includes(body.collaborator_type) ? body.collaborator_type : "commissioned";
    const paymentType = ["percentage", "fixed", "none", "own_revenue"].includes(body.payment_type) ? body.payment_type : null;
    const role = body.role === "collaborator" ? "collaborator" : null;
    const rawCommissionValue = Number(body.commission_value);
    const commissionValue = Number.isFinite(rawCommissionValue) && rawCommissionValue >= 0 ? rawCommissionValue : NaN;
    const whatsapp = typeof body.whatsapp === "string" ? body.whatsapp.trim() : null;
    const rawSlug = typeof body.slug === "string" ? body.slug.trim() : null;
    const slug = rawSlug || name.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '');
    const tempPassword = typeof body.temp_password === "string" ? body.temp_password : `${crypto.randomUUID().slice(0, 12)}A1!`;
    const hasSystemAccess = body.has_system_access !== false;
    const useCompanyBanner = body.use_company_banner !== false;
    const isAdminSelf = body.is_admin_self === true;

    // For own_revenue, commission_value defaults to 0
    const effectiveCommissionValue = paymentType === "own_revenue" ? 0 : commissionValue;

    if (!name || !companyId || !paymentType || !role || (paymentType !== "own_revenue" && paymentType !== "none" && Number.isNaN(commissionValue))) {
      // Email is only required if has system access and not admin-self
      if (hasSystemAccess && !isAdminSelf && !email) {
        return jsonResponse({ error: "Email is required for system access" }, 400);
      }
      if (!name || !companyId || !paymentType || !role) {
        return jsonResponse({
          error: "Missing or invalid fields",
          fields: {
            name: Boolean(name),
            company_id: Boolean(companyId),
            payment_type: Boolean(paymentType),
            role: Boolean(role),
          },
        }, 400);
      }
    }

    if (email) {
      const emailIsValid = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
      if (!emailIsValid || email.length > 255) {
        return jsonResponse({ error: "Invalid email" }, 400);
      }
    }

    if (name.length > 255) {
      return jsonResponse({ error: "Invalid name" }, 400);
    }

    // Retrieve caller's company_id from profile
    const { data: callerProfile, error: profileError } = await supabaseAdmin
      .from("profiles")
      .select("company_id")
      .eq("user_id", caller.id)
      .maybeSingle();

    if (profileError || !callerProfile?.company_id) {
      return jsonResponse({
        success: true,
        warning: "Collaborator creation skipped: no company found for user yet",
      });
    }

    if (callerProfile.company_id !== companyId) {
      return jsonResponse({
        success: true,
        warning: "Collaborator creation skipped: company mismatch",
      });
    }

    let userId: string;
    let profileId: string;

    if (isAdminSelf) {
      // Link to the admin's own user/profile
      userId = caller.id;

      const { data: adminProfile } = await supabaseAdmin
        .from("profiles")
        .select("id")
        .eq("user_id", caller.id)
        .maybeSingle();

      if (!adminProfile) {
        return jsonResponse({ error: "Admin profile not found" }, 400);
      }
      profileId = adminProfile.id;

      // Update profile name if needed
      await supabaseAdmin
        .from("profiles")
        .update({ full_name: name })
        .eq("id", profileId);
    } else if (hasSystemAccess && email) {
      // Create or find user with system access
      let existingUser: any = null;
      try {
        const { data: userData } = await supabaseAdmin.auth.admin.getUserByEmail(email);
        if (userData?.user) existingUser = userData.user;
      } catch {
        // User doesn't exist
      }

      if (existingUser) {
        userId = existingUser.id;
      } else {
        const { data: newUser, error: createError } = await supabaseAdmin.auth.admin.createUser({
          email,
          password: tempPassword,
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

      // Check/create profile
      const { data: existingProfile } = await supabaseAdmin
        .from("profiles")
        .select("id, company_id")
        .eq("user_id", userId)
        .maybeSingle();

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
        const updateData: Record<string, any> = {};
        if (!existingProfile.company_id) updateData.company_id = companyId;
        if (whatsapp) updateData.whatsapp = whatsapp;
        updateData.full_name = name;
        updateData.email = email;
        
        if (Object.keys(updateData).length > 0) {
          await supabaseAdmin
            .from("profiles")
            .update(updateData)
            .eq("id", existingProfile.id);
        }
        profileId = existingProfile.id;
      }

      // Insert role
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
    } else {
      // No system access - create a "ghost" profile with no auth user
      // Use the admin's userId as a placeholder owner but with a distinct profile
      // We'll create a profile without a real auth user - use a generated UUID
      const ghostUserId = crypto.randomUUID();

      const { data: insertedProfile, error: insertProfileError } = await supabaseAdmin
        .from("profiles")
        .insert({
          user_id: ghostUserId,
          full_name: name,
          email: email || null,
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
      userId = ghostUserId;
    }

    // Insert collaborator (check if already exists)
    const { data: existingCollaborator } = await supabaseAdmin
      .from("collaborators")
      .select("id")
      .eq("company_id", companyId)
      .eq("profile_id", profileId)
      .maybeSingle();

    if (!existingCollaborator) {
      const bookingMode = ["intelligent", "fixed_grid", "hybrid"].includes(body.booking_mode) ? body.booking_mode : "hybrid";
      const rawGridInterval = Number(body.grid_interval);
      const gridInterval = [15, 30, 45, 60].includes(rawGridInterval) ? rawGridInterval : 15;
      const rawBreakTime = Number(body.break_time);
      const breakTime = Number.isFinite(rawBreakTime) && rawBreakTime >= 0 && rawBreakTime <= 60 ? rawBreakTime : 0;

      // New unified business-model fields (validated)
      const allowedBusinessModels = ["employee", "partner_commission", "chair_rental", "investor_partner", "operating_partner", "external"];
      const businessModel = allowedBusinessModels.includes(body.business_model) ? body.business_model : null;
      const allowedRentCycles = ["daily", "weekly", "monthly"];
      const rentCycle = allowedRentCycles.includes(body.rent_cycle) ? body.rent_cycle : null;
      const allowedRevenueModes = ["individual", "shared", "percent_to_company"];
      const partnerRevenueMode = allowedRevenueModes.includes(body.partner_revenue_mode) ? body.partner_revenue_mode : null;
      const rawRentAmount = Number(body.rent_amount);
      const rentAmount = Number.isFinite(rawRentAmount) && rawRentAmount >= 0 ? rawRentAmount : 0;
      const rawEquity = Number(body.partner_equity_percent);
      const partnerEquityPercent = Number.isFinite(rawEquity) && rawEquity >= 0 && rawEquity <= 100 ? rawEquity : 0;

      const systemRole = typeof body.system_role === "string" ? body.system_role : "collaborator";

      const { error: collaboratorError } = await supabaseAdmin.from("collaborators").insert({
        company_id: companyId,
        profile_id: profileId,
        collaborator_type: collaboratorType,
        commission_type: paymentType === "own_revenue" ? "own_revenue" : paymentType,
        commission_value: paymentType === "none" || paymentType === "own_revenue" ? 0 : (Number.isNaN(commissionValue) ? 0 : commissionValue),
        commission_percent: paymentType === "percentage" ? (Number.isNaN(commissionValue) ? 0 : commissionValue) : 0,
        slug: slug || null,
        booking_mode: bookingMode,
        grid_interval: gridInterval,
        break_time: breakTime,
        has_system_access: hasSystemAccess,
        use_company_banner: useCompanyBanner,
        business_model: businessModel,
        rent_cycle: rentCycle,
        rent_amount: rentAmount,
        partner_revenue_mode: partnerRevenueMode,
        partner_equity_percent: partnerEquityPercent,
        system_role: systemRole,
      });

      if (collaboratorError) {
        return jsonResponse({
          success: true,
          warning: `Collaborator insert failed: ${collaboratorError.message}`,
        });
      }
    }

    // Copy company business hours to the new professional's working hours
    try {
      const { data: existingProfHours } = await supabaseAdmin
        .from("professional_working_hours")
        .select("id")
        .eq("professional_id", profileId)
        .eq("company_id", companyId)
        .limit(1);

      if (!existingProfHours || existingProfHours.length === 0) {
        const { data: companyHours } = await supabaseAdmin
          .from("business_hours")
          .select("day_of_week, open_time, close_time, lunch_start, lunch_end, is_closed")
          .eq("company_id", companyId)
          .order("day_of_week");

        if (companyHours && companyHours.length > 0) {
          const profHours = companyHours.map((h: any) => ({
            professional_id: profileId,
            company_id: companyId,
            day_of_week: h.day_of_week,
            open_time: h.open_time,
            close_time: h.close_time,
            lunch_start: h.lunch_start,
            lunch_end: h.lunch_end,
            is_closed: h.is_closed,
          }));
          await supabaseAdmin.from("professional_working_hours").insert(profHours);
        }
      }
    } catch (scheduleErr) {
      console.error("Failed to copy company hours to professional", scheduleErr);
    }

    // Link services if provided
    const serviceIds = Array.isArray(body.service_ids) ? body.service_ids.filter((id: any) => typeof id === "string" && id.length > 0) : [];
    if (serviceIds.length > 0) {
      const links = serviceIds.map((svcId: string) => ({
        service_id: svcId,
        professional_id: profileId,
        company_id: companyId,
      }));
      await supabaseAdmin.from("service_professionals").insert(links);
    }

    return jsonResponse({
      success: true,
      collaborator: {
        user_id: userId,
        profile_id: profileId,
        company_id: companyId,
        payment_type: paymentType,
        commission_value: paymentType === "none" || paymentType === "own_revenue" ? 0 : (Number.isNaN(commissionValue) ? 0 : commissionValue),
        has_system_access: hasSystemAccess,
        is_admin_self: isAdminSelf,
      },
    });
  } catch (error) {
    console.error("create-collaborator error", error);
    return jsonResponse({
      success: true,
      warning: "Internal error during collaborator creation",
    });
  }
});
