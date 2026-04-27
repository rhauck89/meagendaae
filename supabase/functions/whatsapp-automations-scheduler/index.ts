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

    console.log("[SCHEDULER] Starting WhatsApp professional automations run...");

    const { data: activeInstances } = await supabase
      .from("whatsapp_instances")
      .select("company_id")
      .eq("status", "connected");

    if (!activeInstances || activeInstances.length === 0) {
      return new Response(JSON.stringify({ success: true, processed: 0 }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    const companyIds = activeInstances.map(i => i.company_id);
    const { data: automations } = await supabase
      .from("whatsapp_automations")
      .select("company_id, trigger, enabled")
      .in("company_id", companyIds)
      .eq("enabled", true);

    const isAutomationEnabled = (companyId: string, trigger: string) => {
      return automations?.some(a => a.company_id === companyId && a.trigger === trigger);
    };

    let totalProcessed = 0;
    const now = new Date();

    // Helper to process reminders
    const processReminders = async (trigger: string, minMinutes: number, maxMinutes: number) => {
      const minStart = new Date(now.getTime() + minMinutes * 60 * 1000);
      const maxStart = new Date(now.getTime() + maxMinutes * 60 * 1000);

      const { data: appts } = await supabase
        .from("appointments")
        .select(`id, company_id, client_whatsapp, client_name, start_time`)
        .in("company_id", companyIds)
        .in("status", ["pending", "confirmed"])
        .eq(trigger === 'appointment_reminder_1d' ? "whatsapp_reminder_1d_sent" : "whatsapp_reminder_sent", false)
        .gte("start_time", minStart.toISOString())
        .lt("start_time", maxStart.toISOString());

      if (appts && appts.length > 0) {
        for (const apt of appts) {
          if (!isAutomationEnabled(apt.company_id, trigger)) continue;
          if (!apt.client_whatsapp) continue;

          await supabase.functions.invoke('whatsapp-integration', {
            body: {
              action: 'send-message',
              companyId: apt.company_id,
              appointmentId: apt.id,
              type: trigger
            }
          });
          
          const updateObj: any = {};
          updateObj[trigger === 'appointment_reminder_1d' ? "whatsapp_reminder_1d_sent" : "whatsapp_reminder_sent"] = true;
          await supabase.from("appointments").update(updateObj).eq("id", apt.id);
          totalProcessed++;
        }
      }
    };

    // 1. Reminders 1d (24h)
    await processReminders('appointment_reminder_1d', 1425, 1455);
    
    // 2. Reminders 2h (120m)
    await processReminders('appointment_reminder_2h', 105, 135);

    // 3. Reviews (completed 1h ago)
    const minCompleted = new Date(now.getTime() - 90 * 60 * 1000);
    const maxCompleted = new Date(now.getTime() - 30 * 60 * 1000);
    const { data: reviewAppts } = await supabase
      .from("appointments")
      .select(`id, company_id, client_whatsapp, client_name`)
      .in("company_id", companyIds)
      .eq("status", "completed")
      .eq("whatsapp_review_sent", false)
      .gte("completed_at", minCompleted.toISOString())
      .lt("completed_at", maxCompleted.toISOString());

    if (reviewAppts && reviewAppts.length > 0) {
      for (const apt of reviewAppts) {
        if (!isAutomationEnabled(apt.company_id, 'post_service_review')) continue;
        if (!apt.client_whatsapp) continue;

        await supabase.functions.invoke('whatsapp-integration', {
          body: { action: 'send-message', companyId: apt.company_id, appointmentId: apt.id, type: 'post_service_review' }
        });
        await supabase.from("appointments").update({ whatsapp_review_sent: true }).eq("id", apt.id);
        totalProcessed++;
      }
    }

    return new Response(JSON.stringify({ success: true, processed: totalProcessed }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
  } catch (error) {
    return new Response(JSON.stringify({ error: error.message }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  }
});
