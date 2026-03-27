import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, serviceRoleKey);

    const body = await req.json();
    const { company_id, professional_id, cancelled_start, cancelled_end, cancelled_date } = body;

    if (!company_id || !cancelled_date) {
      return new Response(
        JSON.stringify({ error: "company_id and cancelled_date required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Get professional name
    let professionalName = "";
    if (professional_id) {
      const { data: prof } = await supabase
        .from("profiles")
        .select("full_name")
        .eq("id", professional_id)
        .single();
      professionalName = prof?.full_name || "";
    }

    // Find waiting clients
    let query = supabase
      .from("waiting_list")
      .select("*, client:profiles!waiting_list_client_id_fkey(full_name, whatsapp, email)")
      .eq("company_id", company_id)
      .eq("desired_date", cancelled_date)
      .eq("status", "waiting")
      .order("created_at", { ascending: true });

    if (professional_id) {
      query = query.or(`professional_id.eq.${professional_id},professional_id.is.null`);
    }

    const { data: waitingClients, error: wErr } = await query;
    if (wErr) throw wErr;

    if (!waitingClients || waitingClients.length === 0) {
      return new Response(
        JSON.stringify({ success: true, notified: 0 }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    let notifiedCount = 0;

    const { data: webhookConfigs } = await supabase
      .from("webhook_configs")
      .select("url")
      .eq("company_id", company_id)
      .eq("event_type", "slot_available")
      .eq("active", true);

    for (const entry of waitingClients) {
      await supabase
        .from("waiting_list")
        .update({ status: "notified" })
        .eq("id", entry.id);

      // Resolve service names
      let serviceNames = "";
      if (entry.service_ids && entry.service_ids.length > 0) {
        const { data: svcs } = await supabase
          .from("services")
          .select("name")
          .in("id", entry.service_ids);
        serviceNames = (svcs || []).map((s: any) => s.name).join(", ");
      }

      const payload = {
        event: "slot_available",
        company_id,
        waiting_list_id: entry.id,
        client_id: entry.client_id,
        client_name: entry.client?.full_name || "",
        client_whatsapp: entry.client?.whatsapp || "",
        client_email: entry.client?.email || "",
        professional_name: professionalName,
        service_name: serviceNames,
        appointment_date: entry.desired_date,
        appointment_time: cancelled_start ? cancelled_start.split("T")[1]?.substring(0, 5) || "" : "",
        desired_date: entry.desired_date,
        service_ids: entry.service_ids,
        cancelled_start,
        cancelled_end,
      };

      await supabase.from("webhook_events").insert({
        company_id,
        event_type: "slot_available",
        payload,
        status: webhookConfigs && webhookConfigs.length > 0 ? "sent" : "no_config",
      });

      for (const config of webhookConfigs || []) {
        try {
          await fetch(config.url, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(payload),
          });
        } catch (err) {
          console.error(`Webhook failed: ${config.url}`, err);
        }
      }

      notifiedCount++;
    }

    return new Response(
      JSON.stringify({ success: true, notified: notifiedCount }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("Error:", error);
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
