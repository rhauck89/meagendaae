import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, serviceRoleKey);

    console.log("[SCHEDULER] Starting WhatsApp automations run...");

    // 1. Fetch all companies with connected WhatsApp
    const { data: activeInstances } = await supabase
      .from("whatsapp_instances")
      .select("company_id, instance_name")
      .eq("status", "connected");

    if (!activeInstances || activeInstances.length === 0) {
      console.log("[SCHEDULER] No active WhatsApp instances found.");
      return new Response(JSON.stringify({ success: true, processed: 0 }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const companyIds = activeInstances.map(i => i.company_id);
    let totalProcessed = 0;

    // --- REMINDERS (2h before) ---
    const now = new Date();
    const in2h = new Date(now.getTime() + 2 * 60 * 60 * 1000);
    const in2h15m = new Date(now.getTime() + (2 * 60 + 15) * 60 * 1000);

    const { data: reminderAppts } = await supabase
      .from("appointments")
      .select(`
        *,
        company:companies(slug, timezone),
        professional:profiles!appointments_professional_id_fkey(full_name),
        appointment_services(service:services(name))
      `)
      .in("company_id", companyIds)
      .in("status", ["pending", "confirmed"])
      .eq("whatsapp_reminder_sent", false)
      .gte("start_time", in2h.toISOString())
      .lt("start_time", in2h15m.toISOString());

    if (reminderAppts && reminderAppts.length > 0) {
      console.log(`[SCHEDULER] Found ${reminderAppts.length} appointments for 2h reminder.`);
      for (const apt of reminderAppts) {
        if (!apt.client_whatsapp) continue;

        const tz = apt.company?.timezone || "America/Sao_Paulo";
        const timeStr = new Date(apt.start_time).toLocaleTimeString("pt-BR", { timeZone: tz, hour: "2-digit", minute: "2-digit" });
        const serviceNames = apt.appointment_services?.map((as: any) => as.service?.name).join(", ") || "";
        
        const message = `Lembrete de agendamento! ⏰\n\nOlá ${apt.client_name}, passando para lembrar do seu horário hoje:\n\n🕐 às ${timeStr}\n✂️ ${serviceNames}\n👤 com ${apt.professional?.full_name}\n\nAté logo!`;

        await supabase.functions.invoke('whatsapp-integration', {
          body: {
            action: 'send-message',
            companyId: apt.company_id,
            phone: apt.client_whatsapp,
            message,
            type: 'appointment_reminder',
            appointmentId: apt.id,
            clientName: apt.client_name
          }
        });
        totalProcessed++;
      }
    }

    // --- REVIEWS (Post-service) ---
    // Look for appointments that ended between 30m and 1h ago
    const thirtyMinsAgo = new Date(now.getTime() - 30 * 60 * 1000);
    const oneHourAgo = new Date(now.getTime() - 60 * 60 * 1000);

    const { data: reviewAppts } = await supabase
      .from("appointments")
      .select(`
        *,
        company:companies(slug, timezone)
      `)
      .in("company_id", companyIds)
      .eq("status", "completed")
      .eq("whatsapp_review_sent", false)
      .lte("completed_at", thirtyMinsAgo.toISOString())
      .gte("completed_at", oneHourAgo.toISOString());

    if (reviewAppts && reviewAppts.length > 0) {
      console.log(`[SCHEDULER] Found ${reviewAppts.length} appointments for post-service review.`);
      for (const apt of reviewAppts) {
        if (!apt.client_whatsapp) continue;

        // Build review link
        const baseUrl = Deno.env.get("SITE_URL") || `https://${apt.company?.slug || 'app'}.agendae.io`;
        const reviewUrl = `${baseUrl}/review/${apt.id}`;

        const message = `Obrigado pela visita hoje 💛\nSua opinião é muito importante para nós!\n\nAvalie seu atendimento aqui:\n${reviewUrl}`;

        await supabase.functions.invoke('whatsapp-integration', {
          body: {
            action: 'send-message',
            companyId: apt.company_id,
            phone: apt.client_whatsapp,
            message,
            type: 'post_service_review',
            appointmentId: apt.id,
            clientName: apt.client_name
          }
        });
        totalProcessed++;
      }
    }

    return new Response(JSON.stringify({ success: true, processed: totalProcessed }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    console.error("[SCHEDULER ERROR]", error);
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
