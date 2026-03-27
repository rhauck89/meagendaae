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

    // Get all active companies
    const { data: companies, error: compErr } = await supabase
      .from("companies")
      .select("id")
      .in("subscription_status", ["active", "trial"]);

    if (compErr) throw compErr;

    let totalEventsCreated = 0;

    for (const company of companies || []) {
      // Recalculate return stats
      await supabase.rpc("recalculate_client_return_stats", {
        _company_id: company.id,
      });

      // Find clients approaching or past expected_return_date
      const today = new Date();
      const thresholdDate = new Date(today);
      thresholdDate.setDate(thresholdDate.getDate() + 5);

      const { data: dueClients } = await supabase
        .from("profiles")
        .select("id, full_name, whatsapp, expected_return_date, average_return_days, last_visit_date")
        .eq("company_id", company.id)
        .not("expected_return_date", "is", null)
        .lte("expected_return_date", thresholdDate.toISOString().split("T")[0]);

      if (!dueClients || dueClients.length === 0) continue;

      // Check which webhook configs are active for client_return_due
      const { data: webhookConfigs } = await supabase
        .from("webhook_configs")
        .select("url")
        .eq("company_id", company.id)
        .eq("event_type", "client_return_due")
        .eq("active", true);

      for (const client of dueClients) {
        const payload = {
          event: "client_return_due",
          company_id: company.id,
          client_id: client.id,
          client_name: client.full_name,
          client_whatsapp: client.whatsapp,
          average_return_days: client.average_return_days,
          last_visit_date: client.last_visit_date,
          expected_return_date: client.expected_return_date,
        };

        // Log webhook event
        await supabase.from("webhook_events").insert({
          company_id: company.id,
          event_type: "client_return_due",
          payload,
          status: webhookConfigs && webhookConfigs.length > 0 ? "sent" : "no_config",
        });

        // Fire webhooks
        for (const config of webhookConfigs || []) {
          try {
            const resp = await fetch(config.url, {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify(payload),
            });
            console.log(`Webhook sent to ${config.url}: ${resp.status}`);
          } catch (err) {
            console.error(`Webhook failed for ${config.url}:`, err);
          }
        }

        totalEventsCreated++;
      }
    }

    return new Response(
      JSON.stringify({ success: true, events_created: totalEventsCreated }),
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
