import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from "https://esm.sh/@supabase/supabase-js@2"

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, GET, OPTIONS',
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    )

    const requestBody = await req.json()
    const { action, phone, text, type, companyId, userId } = requestBody

    const EVOLUTION_API_URL = Deno.env.get('EVOLUTION_API_URL') || "https://apiwpp.meagendae.com.br"
    const EVOLUTION_API_KEY = Deno.env.get('EVOLUTION_API_KEY')
    const instanceName = "platform_main"

    const callEvolution = async (endpoint: string, method = 'GET', body: any = null) => {
      const baseUrl = EVOLUTION_API_URL.replace(/\/+$/, '')
      const finalUrl = `${baseUrl}${endpoint}`
      try {
        const response = await fetch(finalUrl, {
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
          ok: response.ok,
          data: rawText.trim().startsWith('{') ? JSON.parse(rawText) : null
        }
      } catch (e) {
        return { status: 500, error: e.message, ok: false }
      }
    }

    if (action === 'create' || action === 'get-qr') {
      // 1. Ensure settings exist
      await supabaseClient.from('platform_whatsapp_settings').upsert({
        instance_name: instanceName,
        status: 'connecting',
        updated_at: new Date().toISOString()
      }, { onConflict: 'instance_name' });

      // 2. Try to create/init
      const createRes = await callEvolution(`/instance/create`, 'POST', {
        instanceName,
        qrcode: true,
        integration: "WHATSAPP-BAILEYS"
      });

      // 3. Get QR
      let qrBase64 = createRes.data?.qrcode?.base64 || createRes.data?.qrcode;
      
      if (!qrBase64) {
        const qrRes = await callEvolution(`/instance/qrcode/${instanceName}`);
        qrBase64 = qrRes.data?.qrcode?.base64 || qrRes.data?.qrcode;
      }

      if (qrBase64 && !qrBase64.startsWith("data:image")) qrBase64 = `data:image/png;base64,${qrBase64}`;

      if (qrBase64) {
        await supabaseClient.from('platform_whatsapp_settings').update({
          qr_code: qrBase64,
          status: 'pending'
        }).eq('instance_name', instanceName);
      }

      return new Response(JSON.stringify({ success: true, qrcode: qrBase64 }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    if (action === 'get-status') {
      const res = await callEvolution(`/instance/connectionState/${instanceName}`);
      const rawState = res.data?.instance?.state || res.data?.state || res.data?.status;
      const state = String(rawState || '').toLowerCase();
      const isConnected = ['open', 'connected'].includes(state);
      
      if (isConnected) {
        // Get instance info to save phone
        const infoRes = await callEvolution(`/instance/fetchInstances?instanceName=${instanceName}`);
        const instanceInfo = infoRes.data?.[0] || infoRes.data;
        const phone = instanceInfo?.owner || instanceInfo?.number;

        await supabaseClient.from('platform_whatsapp_settings').update({
          status: 'connected',
          qr_code: null,
          connected_phone: phone,
          last_connected_at: new Date().toISOString(),
          updated_at: new Date().toISOString()
        }).eq('instance_name', instanceName);
      } else {
        await supabaseClient.from('platform_whatsapp_settings').update({
          status: state === 'connecting' ? 'connecting' : (state === 'pending' ? 'pending' : 'disconnected'),
          updated_at: new Date().toISOString()
        }).eq('instance_name', instanceName);
      }

      return new Response(JSON.stringify({ success: true, connected: isConnected, state }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    if (action === 'disconnect' || action === 'logout') {
      await callEvolution(`/instance/logout/${instanceName}`, 'DELETE');
      await supabaseClient.from('platform_whatsapp_settings').update({
        status: 'disconnected',
        qr_code: null,
        connected_phone: null
      }).eq('instance_name', instanceName);
      return new Response(JSON.stringify({ success: true }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    if (action === 'send-test' || action === 'trigger-automation') {
      const targetPhone = String(phone || "").replace(/\D/g, '');
      let messageText = text;

      if (action === 'trigger-automation' && type) {
        const { data: automation } = await supabaseClient
          .from('platform_whatsapp_automations')
          .select('*, platform_whatsapp_templates(*)')
          .eq('type', type)
          .single();
        
        if (automation && automation.enabled && automation.platform_whatsapp_templates) {
          messageText = automation.platform_whatsapp_templates.content;
          
          const { data: company } = companyId ? await supabaseClient.from('companies').select('*').eq('id', companyId).single() : { data: null };
          const { data: userProfile } = userId ? await supabaseClient.from('profiles').select('*').eq('id', userId).single() : { data: null };
          
          const vars: Record<string, string> = {
            '{{nome}}': userProfile?.full_name || 'Admin',
            '{{empresa}}': company?.name || 'Sua Empresa',
            '{{plano}}': company?.subscription_status || 'Trial',
            '{{data}}': new Date().toLocaleDateString('pt-BR'),
            '{{link_dashboard}}': "https://meagendae.com.br/dashboard"
          };

          Object.entries(vars).forEach(([k, v]) => {
            messageText = messageText.split(k).join(v);
          });
        }
      }

      const res = await callEvolution(`/message/sendText/${instanceName}`, 'POST', {
        number: targetPhone,
        text: messageText
      });

      await supabaseClient.from('platform_whatsapp_logs').insert({
        company_id: companyId || null,
        recipient_user_id: userId || null,
        recipient_phone: targetPhone,
        type: type || 'manual_test',
        message: messageText,
        status: res.ok ? 'sent' : 'error',
        error: res.ok ? null : JSON.stringify(res.data || res.error)
      });

      return new Response(JSON.stringify({ success: res.ok, data: res.data }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    return new Response(JSON.stringify({ success: false, error: "Ação inválida" }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 400 });

  } catch (error) {
    console.error(error);
    return new Response(JSON.stringify({ success: false, error: error.message }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 500 })
  }
})
