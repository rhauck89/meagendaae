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

    // Get companies with birthday messages enabled
    const { data: companies } = await supabase
      .from("companies")
      .select("id, birthday_discount_type, birthday_discount_value")
      .eq("birthday_enabled", true);

    if (!companies || companies.length === 0) {
      return new Response(
        JSON.stringify({ success: true, notified: 0 }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const today = new Date();
    const todayMonth = today.getMonth() + 1;
    const todayDay = today.getDate();

    let totalNotified = 0;

    for (const company of companies) {
      // Get clients with birthdays in the next 3 days
      const { data: clients } = await supabase
        .from("profiles")
        .select("id, full_name, birth_date, whatsapp, email, opt_in_whatsapp")
        .eq("company_id", company.id)
        .eq("opt_in_whatsapp", true)
        .not("birth_date", "is", null);

      if (!clients) continue;

      for (const client of clients) {
        if (!client.birth_date) continue;

        const bday = new Date(client.birth_date);
        const bdayThisYear = new Date(today.getFullYear(), bday.getMonth(), bday.getDate());
        
        // If birthday already passed this year, check next year
        if (bdayThisYear < today) {
          bdayThisYear.setFullYear(today.getFullYear() + 1);
        }

        const daysUntil = Math.ceil((bdayThisYear.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));

        if (daysUntil > 3) continue;

        // Check if already notified this year
        const yearKey = `${today.getFullYear()}-${client.id}`;
        const { count } = await supabase
          .from("webhook_events")
          .select("*", { count: "exact", head: true })
          .eq("company_id", company.id)
          .eq("event_type", "birthday_message")
          .gte("created_at", `${today.getFullYear()}-01-01`)
          .containedBy("payload", { client_id: client.id });

        if (count && count > 0) continue;

        const payload: Record<string, any> = {
          event: "birthday_message",
          company_id: company.id,
          client_id: client.id,
          client_name: client.full_name,
          client_whatsapp: client.whatsapp,
          client_email: client.email,
          birthday_date: client.birth_date,
          days_until: daysUntil,
        };

        if (company.birthday_discount_type !== "none") {
          payload.discount_type = company.birthday_discount_type;
          payload.discount_value = company.birthday_discount_value;
        }

        // Get webhook configs
        const { data: configs } = await supabase
          .from("webhook_configs")
          .select("url")
          .eq("company_id", company.id)
          .eq("event_type", "birthday_message")
          .eq("active", true);

        const status = configs && configs.length > 0 ? "sent" : "no_config";

        await supabase.from("webhook_events").insert({
          company_id: company.id,
          event_type: "birthday_message",
          payload,
          status,
        });

        for (const config of configs || []) {
          try {
            await fetch(config.url, {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify(payload),
            });
          } catch (err) {
            console.error(`Birthday webhook failed: ${config.url}`, err);
          }
        }

        totalNotified++;
      }
    }

    return new Response(
      JSON.stringify({ success: true, notified: totalNotified }),
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
