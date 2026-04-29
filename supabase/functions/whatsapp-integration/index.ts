import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from "https://esm.sh/@supabase/supabase-js@2"

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders })
  }

  try {
    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    )

    const requestBody = await req.json()
    const { action, companyId, phone, message, text } = requestBody
    
    const EVOLUTION_API_URL = Deno.env.get('EVOLUTION_API_BASE_URL') || Deno.env.get('EVOLUTION_API_URL')
    const EVOLUTION_API_KEY = Deno.env.get('EVOLUTION_API_KEY')

    if (!EVOLUTION_API_URL || !EVOLUTION_API_KEY) {
      return new Response(JSON.stringify({ success: false, error: "ENV_NOT_CONFIGURED" }), { 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200 
      })
    }

    const baseUrl = EVOLUTION_API_URL.replace(/\/$/, '')
    const instanceName = `company_${companyId}`

    const callEvolution = async (endpoint: string, method = 'GET', body: any = null) => {
      const url = `${baseUrl}${endpoint}`
      console.log(`TESTANDO ROTA: ${method} ${url}`)
      
      try {
        const response = await fetch(url, {
          method,
          headers: {
            'Content-Type': 'application/json',
            'apikey': EVOLUTION_API_KEY
          },
          body: body ? JSON.stringify(body) : null
        })

        const rawText = await response.text()
        console.log(`RESPOSTA ${endpoint} (${response.status}):`, rawText.substring(0, 500))

        return {
          status: response.status,
          text: rawText,
          ok: response.ok,
          data: rawText.trim().startsWith('{') ? JSON.parse(rawText) : null
        }
      } catch (e) {
        console.error(`ERRO NA ROTA ${endpoint}:`, e.message)
        return { status: 500, error: e.message, ok: false }
      }
    }

    if (action === 'create' || action === 'get-qr') {
      // 1. TENTAR DESCOBRIR ROTA DE CRIAÇÃO SE NECESSÁRIO
      let createResult = null;
      
      if (action === 'create') {
        const createRoutes = [
          { path: '/instance/create', method: 'POST' },
          { path: '/instance/init', method: 'POST' },
          { path: '/instance', method: 'POST' }
        ];

        for (const route of createRoutes) {
          console.log(`TENTANDO CRIAR INSTÂNCIA VIA: ${route.path}`);
          const res = await callEvolution(route.path, route.method, {
            instanceName: instanceName,
            token: "agenda-e-token",
            qrcode: true
          });

          if (res.ok || res.status === 403 || res.text?.includes("already exists")) {
            createResult = res;
            console.log(`ROTA DE CRIAÇÃO ENCONTRADA OU INSTÂNCIA JÁ EXISTE: ${route.path}`);
            break;
          }
        }

        if (!createResult || (!createResult.ok && !createResult.text?.includes("already exists"))) {
          return new Response(JSON.stringify({ 
            success: false, 
            error: "EVOLUTION_CREATE_FAILED",
            details: createResult?.text || "Nenhuma rota de criação funcionou"
          }), { 
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
            status: 200 
          });
        }
      }

      // 6. DESCOBRIR ROTA DE QR CODE
      const qrRoutes = [
        `/instance/connect/${instanceName}`,
        `/instance/qrcode/${instanceName}`,
        `/instance/qr/${instanceName}`
      ];

      let qrBase64 = null;
      for (const route of qrRoutes) {
        const res = await callEvolution(route);
        if (res.ok && res.data) {
          qrBase64 = res.data.base64 || res.data.qrcode?.base64 || res.data.code;
          if (qrBase64) {
            console.log(`QR CODE ENCONTRADO NA ROTA: ${route}`);
            break;
          }
        }
      }

      // Update DB
      await supabaseClient.from('whatsapp_instances').upsert({
        company_id: companyId,
        instance_name: instanceName,
        status: 'connecting',
        updated_at: new Date().toISOString()
      });

      return new Response(JSON.stringify({
        success: true,
        instanceName,
        qrcode: qrBase64 || null,
        debug: { qr_found: !!qrBase64 }
      }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200
      });
    }

    // Outras ações mantidas com a lógica de descoberta de rotas simplificada se necessário
    if (action === 'get-status') {
      const res = await callEvolution(`/instance/connectionState/${instanceName}`);
      let mappedStatus = 'disconnected';
      if (res.data?.instance?.state === 'open') mappedStatus = 'connected';
      else if (res.data?.instance?.state === 'connecting') mappedStatus = 'connecting';

      return new Response(JSON.stringify({ success: true, instanceName, mappedStatus, data: res.data }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200
      });
    }

    if (action === 'send-message' || action === 'send-test') {
      const targetPhone = String(phone || "").replace(/\D/g, '')
      const targetMessage = message || text
      const res = await callEvolution(`/message/sendText/${instanceName}`, 'POST', {
        number: targetPhone,
        options: { delay: 1200, presence: "composing", linkPreview: false },
        textMessage: { text: targetMessage }
      });

      return new Response(JSON.stringify({ success: res.ok, data: res.data }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200
      });
    }

    if (action === 'logout') {
      await callEvolution(`/instance/logout/${instanceName}`, 'DELETE');
      await supabaseClient.from('whatsapp_instances').delete().eq('company_id', companyId);
      return new Response(JSON.stringify({ success: true }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200
      });
    }

    return new Response(JSON.stringify({ success: false, error: "INVALID_ACTION" }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 200
    });

  } catch (error) {
    console.error("GLOBAL ERROR:", error)
    return new Response(JSON.stringify({ success: false, error: error.message }), { 
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 200 
    })
  }
})
