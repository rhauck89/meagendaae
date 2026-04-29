import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from "https://esm.sh/@supabase/supabase-js@2"

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, GET, OPTIONS',
}

const delay = (ms: number) => new Promise(res => setTimeout(res, ms));

serve(async (req) => {
  const debugLogs: string[] = [];
  const log = (msg: any) => {
    const message = typeof msg === 'object' ? JSON.stringify(msg, null, 2) : String(msg);
    console.log(message);
    debugLogs.push(message);
  };

  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    )

    const requestBody = await req.json()
    const { action, companyId, phone, message, text, appointmentId, type } = requestBody
    log(`ACTION: ${action}, TYPE: ${type}, APPT_ID: ${appointmentId}`);

    const EVOLUTION_API_URL = "https://apiwpp.meagendae.com.br"
    const EVOLUTION_API_KEY = Deno.env.get('EVOLUTION_API_KEY')
    const baseUrl = EVOLUTION_API_URL?.replace(/\/+$/, '')
    const instanceName = `company_${companyId}`

    const callEvolution = async (endpoint: string, method = 'GET', body: any = null) => {
      const url = `${baseUrl}${endpoint}`
      try {
        const response = await fetch(url, {
          method,
          headers: {
            'Content-Type': 'application/json',
            'apikey': EVOLUTION_API_KEY ?? ''
          },
          body: body ? JSON.stringify(body) : null
        })
        const rawText = await response.text()
        return {
          status: response.status,
          text: rawText,
          ok: response.ok,
          data: rawText.trim().startsWith('{') ? JSON.parse(rawText) : null
        }
      } catch (e) {
        return { status: 500, error: e.message, ok: false }
      }
    }

    // New logic for automatic rendering
    if (action === 'send-message' && appointmentId && type) {
      log("Iniciando fluxo de automação renderizada...");
      
      // 1. Check automation status
      const { data: automation, error: autoError } = await supabaseClient
        .from('whatsapp_automations')
        .select('*, whatsapp_templates(*)')
        .eq('company_id', companyId)
        .eq('trigger', type)
        .single();

      if (autoError || !automation) {
        log(`Automação não encontrada ou erro: ${autoError?.message}`);
        return new Response(JSON.stringify({ success: false, error: "AUTOMATION_NOT_FOUND" }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
      }

      if (!automation.enabled) {
        log("Automação desativada pelo usuário.");
        return new Response(JSON.stringify({ success: false, skipped: true, reason: "AUTOMATION_DISABLED" }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
      }

      // 2. Fetch data for rendering
      const { data: appointment, error: apptError } = await supabaseClient
        .from('appointments')
        .select(`
          *,
          company:companies(*),
          professional:profiles!appointments_professional_id_fkey(*),
          client:clients(*)
        `)
        .eq('id', appointmentId)
        .single();

      if (apptError || !appointment) {
        log(`Agendamento não encontrado: ${apptError?.message}`);
        return new Response(JSON.stringify({ success: false, error: "APPOINTMENT_NOT_FOUND" }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
      }

      // 3. Get services
      const { data: services } = await supabaseClient
        .from('appointment_services')
        .select('services(name)')
        .eq('appointment_id', appointmentId);
      
      const serviceNames = services?.map(s => s.services?.name).join(', ') || 'Serviço';

      // 4. Render Template
      const template = automation.whatsapp_templates;
      if (!template) {
        log("Template não vinculado à automação.");
        return new Response(JSON.stringify({ success: false, error: "TEMPLATE_MISSING" }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
      }

      let renderedBody = template.body;
      const apptDate = new Date(appointment.start_time);
      const formattedDate = apptDate.toLocaleDateString('pt-BR');
      const formattedTime = apptDate.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
      
      const { data: platform } = await supabaseClient.from('platform_settings').select('system_url').single();
      const webBaseUrl = platform?.system_url || "https://meagendae.com.br";
      const companySlug = appointment.company?.slug;

      const variables: Record<string, string> = {
        '{{nome}}': appointment.client?.name || appointment.client_name || 'Cliente',
        '{{empresa}}': appointment.company?.name || 'Empresa',
        '{{data}}': formattedDate,
        '{{hora}}': formattedTime,
        '{{servico}}': serviceNames,
        '{{profissional}}': appointment.professional?.full_name || 'Profissional',
        '{{link_agendamento}}': `${webBaseUrl}/${companySlug}`,
        '{{link_cancelamento}}': `${webBaseUrl}/${companySlug}/meus-agendamentos`,
        '{{link_reagendamento}}': `${webBaseUrl}/${companySlug}/meus-agendamentos`,
        '{{link_avaliacao}}': `${webBaseUrl}/${companySlug}/avaliar/${appointmentId}`,
        '{{cashback}}': 'R$ 0,00' // Placeholder for now
      };

      Object.entries(variables).forEach(([key, val]) => {
        renderedBody = renderedBody.split(key).join(val);
      });

      // 5. Send Message
      const targetPhone = String(appointment.client_whatsapp || appointment.client?.whatsapp || "").replace(/\D/g, '');
      if (!targetPhone) {
        log("Telefone do cliente não encontrado.");
        return new Response(JSON.stringify({ success: false, error: "PHONE_NOT_FOUND" }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
      }

      const res = await callEvolution(`/message/sendText/${instanceName}`, 'POST', {
        number: targetPhone,
        text: renderedBody
      });

      // 6. Log
      await supabaseClient.from('whatsapp_logs').insert({
        company_id: companyId,
        client_id: appointment.client_id,
        appointment_id: appointmentId,
        automation_id: automation.id,
        template_id: template.id,
        phone: targetPhone,
        body: renderedBody,
        status: res.ok ? 'sent' : 'failed',
        error_message: res.ok ? null : res.text,
        message_type: 'automation',
        source: `automation_${type}`
      });

      return new Response(JSON.stringify({ 
        success: res.ok, 
        data: res.data, 
        renderedBody,
        debug: debugLogs 
      }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    // --- Original code for other actions ---
    if (action === 'create' || action === 'get-qr') {
      let qrBase64 = null;
      if (action === 'create') {
        const createRoutes = [
          { path: '/instance/create', method: 'POST' },
          { path: '/instance/init', method: 'POST' },
          { path: '/instance', method: 'POST' }
        ];

        for (const route of createRoutes) {
          const res = await callEvolution(route.path, route.method, {
            instanceName: instanceName,
            qrcode: true,
            integration: "WHATSAPP-BAILEYS"
          });
          if (res.ok || res.status === 403 || res.text?.includes("already exists")) {
            qrBase64 = res.data?.qrcode?.base64 || res.data?.qrcode || res.data?.instance?.qrcode;
            break;
          }
        }
      }

      await callEvolution(`/instance/connect/${instanceName}`, 'GET');
      
      if (!qrBase64) {
        for (let i = 0; i < 15; i++) {
          const res = await callEvolution(`/instance/qrcode/${instanceName}`);
          qrBase64 = res.data?.qrcode?.base64 || res.data?.qrcode;
          if (qrBase64) break;
          await delay(3000);
        }
      }

      if (qrBase64 && !qrBase64.startsWith("data:image")) qrBase64 = `data:image/png;base64,${qrBase64}`;

      await supabaseClient.from('whatsapp_instances').upsert({
        company_id: companyId,
        instance_name: instanceName,
        status: 'connecting',
        updated_at: new Date().toISOString()
      });

      return new Response(JSON.stringify({ success: !!qrBase64, instanceName, qrcode: qrBase64 }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    if (action === 'get-status') {
      const res = await callEvolution(`/instance/connectionState/${instanceName}`);
      const rawState = res.data?.instance?.state || res.data?.state || res.data?.status;
      const state = String(rawState || '').toLowerCase();
      const isConnected = ['open', 'connected'].includes(state);
      
      if (isConnected) {
        await supabaseClient.from('whatsapp_instances').update({
          status: 'connected',
          qr_code: null,
          updated_at: new Date().toISOString()
        }).eq('company_id', companyId);
      }

      return new Response(JSON.stringify({ success: true, connected: isConnected, state }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    if (action === 'send-message' || action === 'send-test' || action === 'send-otp') {
      const targetPhone = String(phone || "").replace(/\D/g, '');
      let targetMessage = message || text;

      if (action === 'send-otp') {
        const code = Math.floor(100000 + Math.random() * 900000).toString();
        targetMessage = `Seu código de acesso para MeAgendae é: ${code}`;
        await supabaseClient.from('whatsapp_otp_codes').insert({
          phone: targetPhone,
          code,
          company_id: companyId || null,
          expires_at: new Date(Date.now() + 5 * 60 * 1000).toISOString()
        });
      }

      const res = await callEvolution(`/message/sendText/${instanceName}`, 'POST', {
        number: targetPhone,
        text: targetMessage
      });

      return new Response(JSON.stringify({ success: res.ok, data: res.data }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    if (action === 'logout') {
      await callEvolution(`/instance/logout/${instanceName}`, 'DELETE');
      await supabaseClient.from('whatsapp_instances').delete().eq('company_id', companyId);
      return new Response(JSON.stringify({ success: true }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    return new Response(JSON.stringify({ success: false, error: "INVALID_ACTION" }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });

  } catch (error) {
    return new Response(JSON.stringify({ success: false, error: error.message }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 500 })
  }
})