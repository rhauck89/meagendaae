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
      console.log("TESTANDO ROTA:", url)
      
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
        console.log("RESPONSE STATUS:", response.status);
        console.log(`RESPOSTA ${endpoint} RAW:`, rawText.substring(0, 1000))

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

    const extractQr = (data: any) => {
      if (!data) return null;
      // Accept multiple formats
      return data.qrcode || 
             data.qr || 
             data.base64 || 
             data.code || 
             data.instance?.qrcode || 
             data.qrcode?.base64;
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

          // Check if QR is already in the creation response
          if (res.ok && res.data) {
            qrBase64 = extractQr(res.data);
          }

          if (res.ok || res.status === 403 || res.text?.includes("already exists")) {
            console.log(`INSTÂNCIA OK OU JÁ EXISTENTE: ${route.path}`);
            break;
          }
        }
      }

      // 1. INICIAR CONEXÃO (OBRIGATÓRIO PARA GERAR QR)
      console.log("INICIANDO CONEXÃO DA INSTÂNCIA...");
      const connectRes = await callEvolution(`/instance/connect/${instanceName}`, 'GET');
      console.log("CONNECT RESPONSE (GET):", connectRes.status);
      
      if (!connectRes.ok) {
        console.log("TENTANDO CONNECT VIA POST...");
        const connectResPost = await callEvolution(`/instance/connect/${instanceName}`, 'POST');
        console.log("CONNECT RESPONSE (POST):", connectResPost.status);
      }

      // 2. BUSCAR QR COM LOOP DE ESPERA (OBRIGATÓRIO)
      if (!qrBase64) {
        const qrRoutes = [
          `/instance/qrcode/${instanceName}`,
          `/instance/qr/${instanceName}`,
          `/instance/connect/${instanceName}`
        ];

        console.log("INICIANDO LOOP DE BUSCA DE QR CODE...");
        for (let i = 0; i < 10; i++) {
          console.log(`QR TRY: ${i + 1}`);
          for (const route of qrRoutes) {
            const res = await callEvolution(route);
            if (res.ok && res.data) {
              qrBase64 = extractQr(res.data);
              if (qrBase64) {
                console.log(`QR CODE ENCONTRADO NA TENTATIVA ${i+1} ROTA: ${route}`);
                break;
              }
            }
          }
          if (qrBase64) break;
          console.log(`TENTATIVA ${i+1} SEM QR CODE, AGUARDANDO 2S...`);
          await delay(2000);
        }
      }

      console.log("QR FINAL CAPTURADO:", qrBase64 ? "ENCONTRADO (BASE64)" : "NULL");

      if (!qrBase64) {
        return new Response(JSON.stringify({ 
          success: false, 
          error: "INSTANCE_NOT_CONNECTED",
          detail: "Instância criada mas não iniciou sessão ou não retornou QR"
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
        qrcode: qrBase64 || null
      }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200
      });
    }

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