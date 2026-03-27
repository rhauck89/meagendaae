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

    const now = new Date();
    const in3h = new Date(now.getTime() + 3 * 60 * 60 * 1000);
    const in24h = new Date(now.getTime() + 24 * 60 * 60 * 1000);
    const in25h = new Date(now.getTime() + 25 * 60 * 60 * 1000);

    // Get companies with reminders enabled
    const { data: companies } = await supabase
      .from("companies")
      .select("id")
      .eq("reminders_enabled", true);

    if (!companies || companies.length === 0) {
      return new Response(
        JSON.stringify({ success: true, reminders_sent: 0 }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const companyIds = companies.map((c) => c.id);
    let totalSent = 0;

    // --- 24h reminders: appointments between 24h and 25h from now ---
    const { data: appts24h } = await supabase
      .from("appointments")
      .select(
        "*, client:profiles!appointments_client_id_fkey(full_name, whatsapp, email), professional:profiles!appointments_professional_id_fkey(full_name)"
      )
      .in("company_id", companyIds)
      .in("status", ["pending", "confirmed"])
      .gte("start_time", in24h.toISOString())
      .lt("start_time", in25h.toISOString());

    if (appts24h) {
      for (const apt of appts24h) {
        // Check if already sent
        const { count } = await supabase
          .from("webhook_events")
          .select("*", { count: "exact", head: true })
          .eq("company_id", apt.company_id)
          .eq("event_type", "appointment_reminder_24h")
          .containedBy("payload", { appointment_id: apt.id });

        if (count && count > 0) continue;

        await fireReminderWebhook(supabase, apt, "appointment_reminder_24h");
        totalSent++;
      }
    }

    // --- 3h reminders: appointments between now and 3h from now ---
    const { data: appts3h } = await supabase
      .from("appointments")
      .select(
        "*, client:profiles!appointments_client_id_fkey(full_name, whatsapp, email), professional:profiles!appointments_professional_id_fkey(full_name)"
      )
      .in("company_id", companyIds)
      .in("status", ["pending", "confirmed"])
      .gte("start_time", now.toISOString())
      .lt("start_time", in3h.toISOString());

    if (appts3h) {
      for (const apt of appts3h) {
        const { count } = await supabase
          .from("webhook_events")
          .select("*", { count: "exact", head: true })
          .eq("company_id", apt.company_id)
          .eq("event_type", "appointment_reminder_3h")
          .containedBy("payload", { appointment_id: apt.id });

        if (count && count > 0) continue;

        await fireReminderWebhook(supabase, apt, "appointment_reminder_3h");
        totalSent++;
      }
    }

    return new Response(
      JSON.stringify({ success: true, reminders_sent: totalSent }),
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

async function fireReminderWebhook(
  supabase: any,
  apt: any,
  eventType: string
) {
  const payload = {
    event: eventType,
    appointment_id: apt.id,
    company_id: apt.company_id,
    client_id: apt.client_id,
    client_name: apt.client?.full_name,
    client_whatsapp: apt.client?.whatsapp,
    client_email: apt.client?.email,
    professional_name: apt.professional?.full_name,
    start_time: apt.start_time,
    end_time: apt.end_time,
    total_price: apt.total_price,
  };

  // Get webhook configs for this event type (and also generic appointment_reminder)
  const { data: configs } = await supabase
    .from("webhook_configs")
    .select("url")
    .eq("company_id", apt.company_id)
    .in("event_type", [eventType, "appointment_reminder"])
    .eq("active", true);

  const status = configs && configs.length > 0 ? "sent" : "no_config";

  await supabase.from("webhook_events").insert({
    company_id: apt.company_id,
    event_type: eventType,
    payload,
    status,
  });

  for (const config of configs || []) {
    try {
      const resp = await fetch(config.url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      await supabase
        .from("webhook_events")
        .update({ response_code: resp.status, status: "sent" })
        .eq("company_id", apt.company_id)
        .eq("event_type", eventType)
        .containedBy("payload", { appointment_id: apt.id });
    } catch (err) {
      console.error(`Webhook failed: ${config.url}`, err);
    }
  }
}
