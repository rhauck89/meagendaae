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

  log("WHATSAPP FUNCTION VERSION: V2 - FULL DEBUG");
  
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    log("Iniciando criação do cliente Supabase...");
    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    )
    log("Cliente Supabase criado.");

    log("Executando TESTE SELECT inicial...");
    const testSelect = await supabaseClient.from('whatsapp_otp_codes').select('*').limit(1);
    log({ testSelect });

    const requestBody = await req.json()
    log({ requestBody });

    
    const { action, companyId, phone, message, text } = requestBody
    log(`ACTION RECEBIDA: ${action}`);

    const EVOLUTION_API_URL = "https://apiwpp.meagendae.com.br"
    const EVOLUTION_API_KEY = Deno.env.get('EVOLUTION_API_KEY')

    if (!EVOLUTION_API_URL) {
      log("ERRO: BASE_URL_UNDEFINED");
      return new Response(JSON.stringify({ success: false, error: "BASE_URL_UNDEFINED", debug: debugLogs }), { 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200 
      })
    }

    if (!EVOLUTION_API_KEY) {
      log("ERRO: API_KEY_UNDEFINED");
      return new Response(JSON.stringify({ success: false, error: "API_KEY_UNDEFINED", debug: debugLogs }), { 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200 
      })
    }

    const baseUrl = EVOLUTION_API_URL.replace(/\/+$/, '')
    const instanceName = `company_${companyId}`

    log(`BASE URL FINAL: ${baseUrl}`);
    log(`INSTANCE NAME: ${instanceName}`);


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
      console.log("CHECKING STATUS FOR:", instanceName);
      let res = await callEvolution(`/instance/connectionState/${instanceName}`);
      
      // Fallback if the first route fails or doesn't return state
      if (!res.ok || (!res.data?.instance?.state && !res.data?.state)) {
        console.log("RETRYING WITH STATUS ROUTE...");
        res = await callEvolution(`/instance/status/${instanceName}`);
      }

      const rawState = res.data?.instance?.state || res.data?.state || res.data?.status;
      const state = String(rawState || '').toLowerCase();
      
      console.log("ESTADO BRUTO DA EVOLUTION:", rawState);

      const isConnected = ['open', 'connected', 'connected'].includes(state);
      
      let mappedStatus = 'disconnected';
      if (isConnected) {
        mappedStatus = 'connected';
      } else if (state === 'connecting' || state === 'pending') {
        mappedStatus = 'connecting';
      } else if (state === 'closed' || state === 'disconnected') {
        mappedStatus = 'disconnected';
      }

      // ATUALIZAÇÃO CRÍTICA DO BANCO
      if (isConnected) {
        console.log("INSTÂNCIA CONECTADA! ATUALIZANDO BANCO...");
        await supabaseClient.from('whatsapp_instances').update({
          status: 'connected',
          qr_code: null,
          updated_at: new Date().toISOString()
        }).eq('company_id', companyId);
      }

      return new Response(JSON.stringify({ 
        success: true, 
        instanceName, 
        mappedStatus, 
        connected: isConnected,
        data: res.data 
      }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200
      });
    }

    const normalizePhone = (p: string) => String(p || "").replace(/\D/g, '');

    if (action === 'send-message' || action === 'send-test' || action === 'send-otp') {
      const targetPhone = normalizePhone(phone);
      const isOtp = action === 'send-otp' || requestBody.type === 'otp'
      let targetMessage = message || text || requestBody.message

      if (isOtp) console.log("INICIANDO ENVIO OTP");
      console.log("ENVIANDO PARA:", targetPhone);
      
      // Validar instância antes de enviar
      console.log("VALIDANDO INSTÂNCIA ANTES DE ENVIAR...");
      const statusRes = await callEvolution(`/instance/connectionState/${instanceName}`);
      const rawState = statusRes.data?.instance?.state || statusRes.data?.state || statusRes.data?.status;
      const state = String(rawState || '').toLowerCase();
      
      if (!['open', 'connected'].includes(state)) {
        console.log(`ERRO: INSTÂNCIA NÃO ESTÁ PRONTA (${state})`);
        return new Response(JSON.stringify({ 
          success: false, 
          error: "INSTANCE_NOT_CONNECTED",
          detail: `Instância está no estado: ${state}`
        }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          status: 200
        });
      }

      if (isOtp) {
        log("INICIANDO FLUXO OTP...");

        log(`PHONE: ${phone}`);
        log(`COMPANY_ID: ${companyId}`);
        
        const code = Math.floor(100000 + Math.random() * 900000).toString();
        log(`CODIGO GERADO: ${code}`);
        targetMessage = `Seu código de acesso para MeAgendae é: ${code}`;
        
        const otpPayload = {
          phone: targetPhone,
          code,
          company_id: companyId || null,
          expires_at: new Date(Date.now() + 5 * 60 * 1000).toISOString(),
          email: requestBody.email || null,
          verified: false
        };

        log("PAYLOAD OTP:");
        log(otpPayload);

        const { data: savedOtp, error: otpError } = await supabaseClient
          .from('whatsapp_otp_codes')
          .insert(otpPayload)
          .select()
          .single();

        if (otpError) {
          log("ERRO REAL DO SUPABASE:");
          log(otpError);

          return new Response(JSON.stringify({
            success: false,
            error: "OTP_SAVE_FAILED",
            supabase_error: otpError,
            debug: debugLogs
          }), { 
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
            status: 200 
          });
        }
        
        log("OTP SALVO COM SUCESSO");
      }

      console.log("MENSAGEM FINAL:", targetMessage);

      const payload = {
        number: targetPhone,
        text: targetMessage
      };

      log("ENVIANDO WHATSAPP OTP/MESSAGE...");
      const res = await callEvolution(`/message/sendText/${instanceName}`, 'POST', payload);
      
      log(`WHATSAPP ENVIADO. RESPOSTA EVOLUTION: ${JSON.stringify(res.data)}`);

      return new Response(JSON.stringify({ 
        success: true,
        message: isOtp ? "OTP enviado" : "Mensagem enviada",
        data: res.data,
        state: state,
        debug: debugLogs
      }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200
      });
    }

    if (action === 'verify-otp') {
      const targetPhone = normalizePhone(phone);
      const { code } = requestBody

      log(`PHONE BUSCADO: ${targetPhone}`);
      log(`COMPANY_ID: ${companyId}`);
      log(`OTP DIGITADO: ${code}`);

      const { data: otpData, error: otpError } = await supabaseClient
        .from('whatsapp_otp_codes')
        .select('*')
        .eq('phone', targetPhone)
        .eq('company_id', companyId)
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle();

      log("OTP ENCONTRADO NO BANCO:");
      log(otpData);

      if (otpError || !otpData) {
        log("ERRO: OTP_NOT_FOUND");
        return new Response(JSON.stringify({ 
          success: false, 
          error: "OTP_NOT_FOUND",
          detail: "Nenhum código encontrado para esse telefone e empresa",
          debug: debugLogs
        }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          status: 200
        });
      }

      if (otpData.verified) {
        return new Response(JSON.stringify({ success: false, error: "Código já utilizado" }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          status: 200
        });
      }

      if (otpData.code !== String(code)) {
        return new Response(JSON.stringify({ success: false, error: "Código inválido" }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          status: 200
        });
      }

      if (new Date(otpData.expires_at) < new Date()) {
        return new Response(JSON.stringify({ success: false, error: "Código expirado" }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          status: 200
        });
      }

      // Marcar como verificado
      await supabaseClient.from('whatsapp_otp_codes').update({ verified: true }).eq('id', otpData.id);

      // Buscar usuário pelo WhatsApp nos metadados ou email
      let user;
      const { data: users, error: userError } = await supabaseClient.auth.admin.listUsers();
      
      if (!userError) {
        user = users.users.find(u => normalizePhone(u.user_metadata?.whatsapp) === targetPhone || u.email === otpData.email);
      }

      if (!user && otpData.email) {
        const { data: userByEmail } = await supabaseClient.auth.admin.getUserByEmail(otpData.email);
        if (userByEmail?.user) user = userByEmail.user;
      }

      if (!user) {
        return new Response(JSON.stringify({ success: false, error: "Usuário não encontrado. Por favor, crie uma conta primeiro." }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          status: 200
        });
      }

      // Criar link de login (magic link)
      const { data: linkData, error: linkError } = await supabaseClient.auth.admin.generateLink({
        type: 'magiclink',
        email: user.email!,
        options: { redirectTo: requestBody.redirectTo }
      });

      if (linkError) {
        return new Response(JSON.stringify({ success: false, error: "Erro ao gerar link de acesso" }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          status: 200
        });
      }

      return new Response(JSON.stringify({ 
        success: true, 
        session: linkData.session,
        email: user.email,
        token_hash: linkData.properties?.hashed_token,
        otp_type: 'magiclink',
        loginUrl: linkData.properties?.action_link
      }), {
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
