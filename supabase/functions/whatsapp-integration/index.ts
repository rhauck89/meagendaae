import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from "https://esm.sh/@supabase/supabase-js@2"

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

// Utility to sleep
const delay = (ms: number) => new Promise(res => setTimeout(res, ms));

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
    
    console.log("ACTION RECEBIDA:", action);

    const EVOLUTION_API_URL = Deno.env.get('EVOLUTION_API_BASE_URL') || Deno.env.get('EVOLUTION_API_URL')
    const EVOLUTION_API_KEY = Deno.env.get('EVOLUTION_API_KEY')

    if (!EVOLUTION_API_URL) {
      console.log("ERRO: BASE_URL_UNDEFINED");
      return new Response(JSON.stringify({ success: false, error: "BASE_URL_UNDEFINED" }), { 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200 
      })
    }

    if (!EVOLUTION_API_KEY) {
      console.log("ERRO: API_KEY_UNDEFINED");
      return new Response(JSON.stringify({ success: false, error: "API_KEY_UNDEFINED" }), { 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200 
      })
    }

    const baseUrl = EVOLUTION_API_URL.replace(/\/$/, '')
    const instanceName = `company_${companyId}`

    // LOGS CRÍTICOS ANTES DE QUALQUER FETCH
    console.log("BASE URL:", baseUrl)
    console.log("API KEY:", EVOLUTION_API_KEY ? "OK" : "MISSING")
    console.log("INSTANCE NAME:", instanceName)

    const callEvolution = async (endpoint: string, method = 'GET', body: any = null) => {
      const url = `${baseUrl}${endpoint}`
      
      // LOGS CRÍTICOS DENTRO DO callEvolution
      console.log("CHAMANDO:", url)
      console.log("METHOD:", method)
      
      try {
        const response = await fetch(url, {
          method,
          headers: {
            'Content-Type': 'application/json', // AJUSTE OBRIGATÓRIO 1
            'apikey': EVOLUTION_API_KEY // AJUSTE OBRIGATÓRIO 1
          },
          body: body ? JSON.stringify(body) : null
        })

        const rawText = await response.text()
        console.log(`RESPONSE STATUS (${endpoint}):`, response.status);
        console.log(`RAW RESPONSE (${endpoint}):`, rawText.substring(0, 500));

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

    const extractQr = (res: any) => {
      const data = res?.data || res;
      if (!data) return null;
      
      let qr = data.qrcode || 
               data.qr || 
               data.base64 || 
               data.code || 
               data.instance?.qrcode || 
               data.data?.qrcode || 
               data.qrcode?.base64;

      if (qr && typeof qr === 'string') {
        // AJUSTE OBRIGATÓRIO: PREFIXO BASE64
        if (!qr.startsWith("data:image")) {
          qr = `data:image/png;base64,${qr}`;
        }
        console.log("QR DETECTADO:", qr.slice(0, 50));
        return qr;
      }
      return null;
    }

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
            console.log(`INSTÂNCIA OK OU JÁ EXISTENTE: ${route.path}`);
            qrBase64 = extractQr(res);
            break;
          }
        }
      }

      // 1. INICIAR CONEXÃO (FALLBACK OBRIGATÓRIO)
      console.log("TRIGGERING CONNECTION...");
      const tryConnect = async () => {
        let res = await callEvolution(`/instance/connect/${instanceName}`, 'GET');
        if (!res.ok) {
          console.log("GET CONNECT FAILED, TRYING POST...");
          res = await callEvolution(`/instance/connect/${instanceName}`, 'POST', {});
        }
        console.log("CONNECT FINAL RESPONSE STATUS:", res.status);
        return res;
      };
      
      await tryConnect();

      // 2. POLLING REAL (20 tentativas x 3s = 60s)
      if (!qrBase64) {
        const qrRoutes = [
          `/instance/qrcode/${instanceName}`,
          `/instance/qr/${instanceName}`,
          `/instance/connect/${instanceName}`
        ];

        console.log("INICIANDO POLLING DE 60 SEGUNDOS...");
        for (let i = 0; i < 20; i++) {
          console.log(`Tentativa ${i + 1}/20`);
          
          for (const route of qrRoutes) {
            const res = await callEvolution(route);
            qrBase64 = extractQr(res);
            if (qrBase64) break;
          }
          
          if (qrBase64) break;
          console.log(`Tentativa ${i + 1} sem QR, aguardando 3s...`);
          await delay(3000);
        }
      }

      if (!qrBase64) {
        return new Response(JSON.stringify({ 
          success: false, 
          error: "QR_TIMEOUT",
          detail: "Evolution não gerou QR em tempo hábil (60s)"
        }), { 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          status: 200 
        });
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
        qrcode: qrBase64
      }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200
      });
    }

    // Outras ações (get-status, send-message, logout) mantidas para integridade
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