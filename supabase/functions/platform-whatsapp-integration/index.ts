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
    const { action, instanceName, apiUrl, apiKey, phone, text, type, companyId, userId } = requestBody

    // ---------------------------------------------------------------------------
    // Helper: call Evolution API
    // ---------------------------------------------------------------------------
    const callEvolution = async (url: string, key: string, endpoint: string, method = 'GET', body: any = null) => {
      const baseUrl = url.replace(/\/+$/, '')
      const finalUrl = `${baseUrl}${endpoint}`
      try {
        const response = await fetch(finalUrl, {
          method,
          headers: {
            'Content-Type': 'application/json',
            'apikey': key
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

    // ---------------------------------------------------------------------------
    // Actions
    // ---------------------------------------------------------------------------

    if (action === 'connect') {
      // 1. Save settings
      await supabaseClient.from('platform_whatsapp_settings').upsert({
        instance_name: instanceName,
        api_url: apiUrl,
        api_key: apiKey,
        status: 'connecting'
      });

      // 2. Try to create/init instance in Evolution
      // For platform, we assume the instance might already exist or needs creation
      const res = await callEvolution(apiUrl, apiKey, `/instance/create`, 'POST', {
        instanceName,
        qrcode: true,
        integration: "WHATSAPP-BAILEYS"
      });

      // 3. Update status based on response
      const status = res.ok || res.status === 403 ? 'connected' : 'error'; // simplified for platform admin
      await supabaseClient.from('platform_whatsapp_settings').update({ status }).match({ instance_name: instanceName });

      return new Response(JSON.stringify({ success: true, status }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    if (action === 'disconnect') {
      const { data: settings } = await supabaseClient.from('platform_whatsapp_settings').select('*').single();
      if (settings) {
        await callEvolution(settings.api_url, settings.api_key, `/instance/logout/${settings.instance_name}`, 'DELETE');
        await supabaseClient.from('platform_whatsapp_settings').delete().eq('id', settings.id);
      }
      return new Response(JSON.stringify({ success: true }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    if (action === 'send-test' || action === 'trigger-automation') {
      const { data: settings } = await supabaseClient.from('platform_whatsapp_settings').select('*').single();
      if (!settings || settings.status !== 'connected') {
        throw new Error("Plataforma WhatsApp não configurada ou desconectada.");
      }

      const targetPhone = String(phone || "").replace(/\D/g, '');
      let messageText = text;

      // If it's an automation trigger, render template
      if (action === 'trigger-automation' && type) {
        const { data: automation } = await supabaseClient
          .from('platform_whatsapp_automations')
          .select('*, platform_whatsapp_templates(*)')
          .eq('type', type)
          .single();
        
        if (automation && automation.enabled && automation.platform_whatsapp_templates) {
          messageText = automation.platform_whatsapp_templates.content;
          
          // Render basic variables (this would be expanded based on event data)
          const { data: company } = companyId ? await supabaseClient.from('companies').select('*').eq('id', companyId).single() : { data: null };
          const { data: userProfile } = userId ? await supabaseClient.from('profiles').select('*').eq('id', userId).single() : { data: null };
          
          const vars: Record<string, string> = {
            '{{nome}}': userProfile?.full_name || 'Admin',
            '{{empresa}}': company?.name || 'Sua Empresa',
            '{{plano}}': company?.subscription_status || 'Trial',
            '{{data}}': new Date().toLocaleDateString('pt-BR'),
          };

          Object.entries(vars).forEach(([k, v]) => {
            messageText = messageText.split(k).join(v);
          });
        } else {
          return new Response(JSON.stringify({ success: false, reason: "AUTOMATION_DISABLED_OR_NO_TEMPLATE" }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
        }
      }

      const res = await callEvolution(settings.api_url, settings.api_key, `/message/sendText/${settings.instance_name}`, 'POST', {
        number: targetPhone,
        text: messageText
      });

      // Log the attempt
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
