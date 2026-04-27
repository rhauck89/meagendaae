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
    
    // 2. Fetch enabled automations
    const { data: automations } = await supabase
      .from("whatsapp_automations")
      .select("company_id, trigger, enabled")
      .in("company_id", companyIds)
      .eq("enabled", true);

    const isAutomationEnabled = (companyId: string, trigger: string) => {
      return automations?.some(a => a.company_id === companyId && a.trigger === trigger);
    };

    let totalProcessed = 0;

    // --- REMINDERS (2h before) ---
    // Look for appointments starting in 1h 45m to 2h 15m
    const now = new Date();
    const minStart = new Date(now.getTime() + 105 * 60 * 1000);
    const maxStart = new Date(now.getTime() + 135 * 60 * 1000);

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
      .gte("start_time", minStart.toISOString())
      .lt("start_time", maxStart.toISOString());

    if (reminderAppts && reminderAppts.length > 0) {
      console.log(`[SCHEDULER] Found ${reminderAppts.length} appointments for 2h reminder.`);
      for (const apt of reminderAppts) {
        if (!isAutomationEnabled(apt.company_id, 'appointment_reminder')) continue;
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
    // Look for appointments completed 30m to 1h 30m ago
    const minCompleted = new Date(now.getTime() - 90 * 60 * 1000);
    const maxCompleted = new Date(now.getTime() - 30 * 60 * 1000);

    const { data: reviewAppts } = await supabase
      .from("appointments")
      .select(`
        *,
        company:companies(slug, timezone)
      `)
      .in("company_id", companyIds)
      .eq("status", "completed")
      .eq("whatsapp_review_sent", false)
      .gte("completed_at", minCompleted.toISOString())
      .lt("completed_at", maxCompleted.toISOString());

    if (reviewAppts && reviewAppts.length > 0) {
      console.log(`[SCHEDULER] Found ${reviewAppts.length} appointments for post-service review.`);
      for (const apt of reviewAppts) {
        if (!isAutomationEnabled(apt.company_id, 'post_service_review')) continue;
        if (!apt.client_whatsapp) continue;

        // Build review link - using actual app domain
        const baseUrl = Deno.env.get("SITE_URL") || `https://app.agendae.io`;
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
