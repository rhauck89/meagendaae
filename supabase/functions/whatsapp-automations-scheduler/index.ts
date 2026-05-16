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

          const { data: response } = await supabase.functions.invoke('whatsapp-integration', {
            body: {
              action: 'send-message',
              companyId: apt.company_id,
              appointmentId: apt.id,
              type: trigger
            }
          });
          
          if (response?.success) {
            const updateObj: any = {};
            updateObj[trigger === 'appointment_reminder_1d' ? "whatsapp_reminder_1d_sent" : "whatsapp_reminder_sent"] = true;
            await supabase.from("appointments").update(updateObj).eq("id", apt.id);
            totalProcessed++;
          } else {
            console.log(`[SCHEDULER] Failed to send ${trigger} for appt ${apt.id}: ${response?.error || 'Unknown error'}`);
          }
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

        const { data: response } = await supabase.functions.invoke('whatsapp-integration', {
          body: { action: 'send-message', companyId: apt.company_id, appointmentId: apt.id, type: 'post_service_review' }
        });

        if (response?.success) {
          await supabase.from("appointments").update({ whatsapp_review_sent: true }).eq("id", apt.id);
          totalProcessed++;
        }
      }
    }

    // 4. Abandonment Recovery
    const fifteenMinsAgo = new Date(Date.now() - 15 * 60 * 1000).toISOString();
    const { data: abandonments } = await supabase
      .from('booking_abandonments')
      .select('*')
      .eq('status', 'pending')
      .lt('created_at', fifteenMinsAgo);

    for (const ab of abandonments || []) {
      const { data: instance } = await supabase
        .from('whatsapp_instances')
        .select('*')
        .eq('company_id', ab.company_id)
        .eq('status', 'connected')
        .maybeSingle();

      if (instance) {
        const message = `Oi ${ab.customer_name}, notamos que você não finalizou seu agendamento. Quer garantir seu horário?`;
        await supabase.functions.invoke('whatsapp-integration', {
          body: { action: 'send-message', companyId: ab.company_id, phone: ab.customer_phone, message }
        });
      }
      await supabase.from('booking_abandonments').update({ status: 'notified', last_sent_at: new Date().toISOString() }).eq('id', ab.id);
      totalProcessed++;
    }

    // 5. Subscription Reminders (2 days before due date)
    console.log("[SCHEDULER] Checking for subscription reminders (2 days before)...");
    const twoDaysFromNow = new Date(now.getTime() + 2 * 24 * 60 * 60 * 1000);
    const twoDaysStr = twoDaysFromNow.toISOString().split('T')[0];

    const { data: subscriptionCharges } = await supabase
      .from("subscription_charges")
      .select(`
        id, 
        company_id, 
        amount, 
        due_date,
        subscription:client_subscriptions(
          clients(name, whatsapp),
          subscription_plans(name)
        ),
        company:companies(
          name,
          payment_pix_key,
          payment_bank_name,
          payment_bank_agency,
          payment_bank_account,
          payment_holder_name,
          payment_document,
          subscription_payment_notes
        )
      `)
      .eq("status", "pending")
      .eq("due_date", twoDaysStr)
      .eq("whatsapp_reminder_2d_sent", false)
      .in("company_id", companyIds);

    if (subscriptionCharges && subscriptionCharges.length > 0) {
      console.log(`[SCHEDULER] Found ${subscriptionCharges.length} subscription charges to notify`);
      for (const charge of subscriptionCharges) {
        const client = (charge.subscription as any)?.clients;
        if (!client?.whatsapp) continue;

        const company = charge.company as any;
        const planName = (charge.subscription as any)?.subscription_plans?.name || 'Assinatura';
        const amount = `R$ ${Number(charge.amount).toFixed(2)}`;
        const dueDate = new Date(charge.due_date).toLocaleDateString('pt-BR');

        let paymentData = '';
        if (company?.payment_pix_key) paymentData += `PIX: ${company.payment_pix_key}\n`;
        if (company?.payment_bank_name) {
          paymentData += `Banco: ${company.payment_bank_name}\n`;
          paymentData += `Ag: ${company.payment_bank_agency} C/C: ${company.payment_bank_account}\n`;
          paymentData += `Titular: ${company.payment_holder_name}\n`;
          paymentData += `Documento: ${company.payment_document}\n`;
        }
        if (company?.subscription_payment_notes) {
          paymentData += `\nObs: ${company.subscription_payment_notes}`;
        }

        const message = `Olá ${client.name}, tudo bem? Identificamos que a fatura da sua assinatura está em aberto.\n\nEmpresa: ${company?.name || ''}\nPlano: ${planName}\nVencimento: ${dueDate}\nValor: ${amount}\n\nDados para pagamento:\n${paymentData || 'Por favor, entre em contato para os dados de pagamento.'}\n\nAssim que realizar o pagamento, por favor envie o comprovante por aqui.`;

        const { data: response } = await supabase.functions.invoke('whatsapp-integration', {
          body: {
            action: 'send-message',
            companyId: charge.company_id,
            phone: client.whatsapp,
            message: message
          }
        });

        if (response?.success) {
          await supabase.from("subscription_charges").update({
            whatsapp_reminder_2d_sent: true,
            whatsapp_reminder_2d_sent_at: new Date().toISOString()
          }).eq("id", charge.id);

          await supabase.from("whatsapp_logs").insert({
            company_id: charge.company_id,
            client_name: client.name,
            whatsapp_number: client.whatsapp,
            message: message,
            status: 'sent',
            source: `subscription_payment_2d:${charge.id}`
          });

          totalProcessed++;
        }
      }
    }

    return new Response(JSON.stringify({ success: true, processed: totalProcessed }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
  } catch (error) {
    return new Response(JSON.stringify({ error: error.message }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  }
});
