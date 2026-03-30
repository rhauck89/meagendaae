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

    const { data: companies } = await supabase
      .from("companies")
      .select("id, timezone, slug, business_type")
      .eq("reminders_enabled", true);

    if (!companies || companies.length === 0) {
      return new Response(
        JSON.stringify({ success: true, reminders_sent: 0 }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    let totalSent = 0;

    for (const company of companies) {
      const tz = company.timezone || "America/Sao_Paulo";
      const now = new Date();
      const in3h = new Date(now.getTime() + 3 * 60 * 60 * 1000);
      const in24h = new Date(now.getTime() + 24 * 60 * 60 * 1000);
      const in25h = new Date(now.getTime() + 25 * 60 * 60 * 1000);

      // --- 24h reminders ---
      const { data: appts24h } = await supabase
        .from("appointments")
        .select(
          "*, client:profiles!appointments_client_id_fkey(full_name, whatsapp, email, opt_in_whatsapp), professional:profiles!appointments_professional_id_fkey(full_name), appointment_services(service:services(name))"
        )
        .eq("company_id", company.id)
        .in("status", ["pending", "confirmed"])
        .gte("start_time", in24h.toISOString())
        .lt("start_time", in25h.toISOString());

      if (appts24h) {
        for (const apt of appts24h) {
          if (!apt.client?.opt_in_whatsapp) continue;
          const { count } = await supabase
            .from("webhook_events")
            .select("*", { count: "exact", head: true })
            .eq("company_id", apt.company_id)
            .eq("event_type", "appointment_reminder_24h")
            .containedBy("payload", { appointment_id: apt.id });

          if (count && count > 0) continue;
          await fireReminderWebhook(supabase, apt, "appointment_reminder_24h", tz);
          totalSent++;
        }
      }

      // --- 3h reminders ---
      const { data: appts3h } = await supabase
        .from("appointments")
        .select(
          "*, client:profiles!appointments_client_id_fkey(full_name, whatsapp, email, opt_in_whatsapp), professional:profiles!appointments_professional_id_fkey(full_name), appointment_services(service:services(name))"
        )
        .eq("company_id", company.id)
        .in("status", ["pending", "confirmed"])
        .gte("start_time", now.toISOString())
        .lt("start_time", in3h.toISOString());

      if (appts3h) {
        for (const apt of appts3h) {
          if (!apt.client?.opt_in_whatsapp) continue;
          const { count } = await supabase
            .from("webhook_events")
            .select("*", { count: "exact", head: true })
            .eq("company_id", apt.company_id)
            .eq("event_type", "appointment_reminder_3h")
            .containedBy("payload", { appointment_id: apt.id });

          if (count && count > 0) continue;
          await fireReminderWebhook(supabase, apt, "appointment_reminder_3h", tz);
          totalSent++;
        }
      }

      // --- Review requests (appointments completed or past end_time) ---
      // Find appointments that ended up to 2 hours ago OR were marked as completed
      const twoHoursAgo = new Date(now.getTime() - 2 * 60 * 60 * 1000);

      const { data: completedAppts } = await supabase
        .from("appointments")
        .select(
          "*, client:clients!appointments_client_id_fkey(name, whatsapp), professional:profiles!appointments_professional_id_fkey(full_name), appointment_services(service:services(name))"
        )
        .eq("company_id", company.id)
        .in("status", ["completed", "confirmed"])
        .lte("end_time", now.toISOString())
        .gte("end_time", twoHoursAgo.toISOString());

      if (completedAppts) {
        for (const apt of completedAppts) {
          // Skip if no client WhatsApp
          if (!apt.client?.whatsapp) continue;

          // Skip if already sent review_request for this appointment
          const { count: reviewCount } = await supabase
            .from("webhook_events")
            .select("*", { count: "exact", head: true })
            .eq("company_id", apt.company_id)
            .eq("event_type", "review_request")
            .containedBy("payload", { appointment_id: apt.id });

          if (reviewCount && reviewCount > 0) continue;

          // Skip if already reviewed
          const { count: existingReview } = await supabase
            .from("reviews")
            .select("*", { count: "exact", head: true })
            .eq("appointment_id", apt.id);

          if (existingReview && existingReview > 0) continue;

          // Build the review URL
          const baseUrl = Deno.env.get("SITE_URL") || `${supabaseUrl.replace('.supabase.co', '.lovable.app')}`;
          const reviewUrl = `${baseUrl}/review/${apt.id}`;

          const clientName = apt.client?.name || apt.client_name || "Cliente";
          const professionalName = apt.professional?.full_name || "Profissional";
          const companyName = company.slug || "nosso estabelecimento";

          const whatsappMessage = `Olá ${clientName}! 👋\n\nSeu atendimento na ${companyName} acabou de ser finalizado.\n\nComo foi sua experiência com ${professionalName}?\n\nAvalie seu atendimento:\n\n⭐ Avaliar agora\n${reviewUrl}`;

          const payload = {
            event: "review_request",
            appointment_id: apt.id,
            company_id: apt.company_id,
            client_id: apt.client_id,
            client_name: clientName,
            client_whatsapp: apt.client?.whatsapp || "",
            professional_name: professionalName,
            service_name: getServiceNames(apt),
            review_url: reviewUrl,
            whatsapp_message: whatsappMessage,
            appointment_date: formatDateInTz(apt.start_time, tz),
            appointment_time: formatTimeInTz(apt.start_time, tz),
            timezone: tz,
          };

          const { data: configs } = await supabase
            .from("webhook_configs")
            .select("url")
            .eq("company_id", apt.company_id)
            .eq("event_type", "review_request")
            .eq("active", true);

          const status = configs && configs.length > 0 ? "sent" : "no_config";

          await supabase.from("webhook_events").insert({
            company_id: apt.company_id,
            event_type: "review_request",
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
                .eq("event_type", "review_request")
                .containedBy("payload", { appointment_id: apt.id });
            } catch (err) {
              console.error(`Review webhook failed: ${config.url}`, err);
            }
          }

          totalSent++;
        }
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

function formatDateInTz(isoString: string, tz: string): string {
  try {
    const d = new Date(isoString);
    return d.toLocaleDateString("pt-BR", { timeZone: tz, year: "numeric", month: "2-digit", day: "2-digit" });
  } catch {
    return isoString.split("T")[0];
  }
}

function formatTimeInTz(isoString: string, tz: string): string {
  try {
    const d = new Date(isoString);
    return d.toLocaleTimeString("pt-BR", { timeZone: tz, hour: "2-digit", minute: "2-digit", hour12: false });
  } catch {
    return isoString.split("T")[1]?.substring(0, 5) || "";
  }
}

function getServiceNames(apt: any): string {
  if (!apt.appointment_services) return "";
  return apt.appointment_services
    .map((as: any) => as.service?.name)
    .filter(Boolean)
    .join(", ");
}

async function fireReminderWebhook(supabase: any, apt: any, eventType: string, tz: string) {
  const payload = {
    event: eventType,
    appointment_id: apt.id,
    company_id: apt.company_id,
    client_id: apt.client_id,
    client_name: apt.client?.full_name || "",
    client_whatsapp: apt.client?.whatsapp || "",
    client_email: apt.client?.email || "",
    professional_name: apt.professional?.full_name || "",
    service_name: getServiceNames(apt),
    appointment_date: formatDateInTz(apt.start_time, tz),
    appointment_time: formatTimeInTz(apt.start_time, tz),
    start_time: apt.start_time,
    end_time: apt.end_time,
    total_price: apt.total_price,
    timezone: tz,
  };

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
