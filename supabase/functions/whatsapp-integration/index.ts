
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.45.0';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL') ?? '';
    const supabaseAnonKey = Deno.env.get('SUPABASE_ANON_KEY') ?? '';
    const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '';
    const adminClient = createClient(supabaseUrl, serviceRoleKey);

    const authHeader = req.headers.get('Authorization')!;
    const token = authHeader?.replace('Bearer ', '');
    
    let user = null;
    let isServiceRole = false;

    if (token === serviceRoleKey) {
      isServiceRole = true;
    } else if (authHeader) {
      const supabaseClient = createClient(supabaseUrl, supabaseAnonKey, {
        global: { headers: { Authorization: authHeader } }
      });
      const { data: { user: authUser }, error: authError } = await supabaseClient.auth.getUser();
      if (!authError && authUser) {
        user = authUser;
      }
    }

    const body = await req.json();
    const { action, companyId, ...params } = body;
    console.log(`[ACTION: ${action}] [COMPANY: ${companyId}]`, params);

    // Skip validation for certain actions or internal calls
    if (!companyId && !['process-reminders', 'process-reviews', 'process-abandonment'].includes(action)) {
      return new Response(JSON.stringify({ error: 'Missing companyId' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    if (!isServiceRole && user && companyId) {
      const { data: profile } = await adminClient
        .from('profiles')
        .select('company_id, role')
        .eq('user_id', user.id)
        .single();

      if (profile) {
        const isSuperAdmin = profile.role === 'super_admin';
        const belongsToCompany = profile.company_id === companyId;

        if (!isSuperAdmin && !belongsToCompany) {
          return new Response(JSON.stringify({ error: 'Forbidden' }), {
            status: 403,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          });
        }
      }
    }

    const EVOLUTION_API_URL = Deno.env.get('EVOLUTION_API_BASE_URL')?.replace(/\/$/, '').replace('/manager', '');
    const EVOLUTION_API_KEY = Deno.env.get('EVOLUTION_API_KEY');

    const fetchEvolution = async (endpoint: string, options: RequestInit = {}) => {
      if (!EVOLUTION_API_URL || !EVOLUTION_API_KEY) {
        throw new Error('Evolution API configuration missing');
      }
      const url = `${EVOLUTION_API_URL}${endpoint}`;
      const headers = { 'Content-Type': 'application/json', 'apikey': EVOLUTION_API_KEY, ...(options.headers || {}) };
      const response = await fetch(url, { ...options, headers });
      const text = await response.text();
      let json;
      try { json = JSON.parse(text); } catch (e) { json = { message: text }; }
      
      if (!response.ok) {
        throw new Error(JSON.stringify({ status: response.status, message: json.message || text }));
      }
      return json;
    };

    const getInstance = async (id?: string) => {
      if (!id) return null;
      const { data } = await adminClient.from('whatsapp_instances').select('*').eq('company_id', id).maybeSingle();
      return data;
    };

    const getEffectiveInstance = async (companyId?: string) => {
      const SYSTEM_INSTANCE_NAME = Deno.env.get('SYSTEM_WHATSAPP_INSTANCE') || 'agendae';
      
      // 1. Tenta instância da empresa
      const companyInstance = await getInstance(companyId);
      if (companyInstance && companyInstance.status === 'connected') {
        return { instance: companyInstance, isFallback: false };
      }

      // 2. FALLBACK: Tenta instância global do sistema
      const { data: systemInstance } = await adminClient
        .from('whatsapp_instances')
        .select('*')
        .eq('instance_name', SYSTEM_INSTANCE_NAME)
        .eq('status', 'connected')
        .maybeSingle();

      if (systemInstance) {
        console.log(`[FALLBACK] Usando instância do sistema: ${SYSTEM_INSTANCE_NAME} para empresa ${companyId}`);
        return { instance: systemInstance, isFallback: true };
      }

      console.log(`[NO_INSTANCE] Nenhuma instância conectada encontrada para empresa ${companyId} ou sistema ${SYSTEM_INSTANCE_NAME}`);
      return { instance: null, isFallback: false };
    };

    const formatPhone = (phone: string) => {
      const clean = phone.replace(/\D/g, '');
      return clean.startsWith('55') ? clean : '55' + clean;
    };

    const sendWhatsApp = async (instanceName: string, phone: string, text: string, imageUrl?: string) => {
      const number = formatPhone(phone);
      if (imageUrl && (text.includes('{{logo}}') || imageUrl)) {
        const bodyText = text.replace('{{logo}}', '');
        return await fetchEvolution(`/message/sendImage/${instanceName}`, {
          method: 'POST',
          body: JSON.stringify({ number, image: imageUrl, caption: bodyText })
        });
      }
      return await fetchEvolution(`/message/sendText/${instanceName}`, {
        method: 'POST',
        body: JSON.stringify({ number, text })
      });
    };

    // --- ACTIONS ---

    if (action === 'create') {
      const instanceName = `company-${companyId.split('-')[0]}-${Math.floor(Math.random() * 1000)}`;
      console.log(`[CREATE_INSTANCE] name: ${instanceName}`);

      try {
        // 1. Create in Evolution API
        const evolution = await fetchEvolution('/instance/create', {
          method: 'POST',
          body: JSON.stringify({
            instanceName,
            token: EVOLUTION_API_KEY, // Optional: use the same key or generate one
            qrcode: true,
            number: null
          })
        });

        const instanceData = evolution.instance || evolution;

        // 2. Save to DB
        const { data: instance, error: dbError } = await adminClient
          .from('whatsapp_instances')
          .upsert({
            company_id: companyId,
            instance_name: instanceName,
            instance_id: instanceData.instanceId || instanceData.id,
            status: 'connecting',
            qr_code: null,
            updated_at: new Date().toISOString()
          }, { onConflict: 'company_id' })
          .select()
          .single();

        if (dbError) throw dbError;

        return new Response(JSON.stringify({ success: true, instance }), { headers: corsHeaders });
      } catch (err: any) {
        console.error(`[CREATE_ERROR] ${err.message}`);
        return new Response(JSON.stringify({ success: false, error: err.message }), { headers: corsHeaders });
      }
    }

    if (action === 'get-qr') {
      const instance = await getInstance(companyId);
      if (!instance || !instance.instance_name) {
        return new Response(JSON.stringify({ success: false, message: 'Instance not found' }), { headers: corsHeaders });
      }

      try {
        console.log(`[GET_QR] instance: ${instance.instance_name}`);
        // Evolution API usually returns base64 in the 'code' or 'base64' field
        const res = await fetchEvolution(`/instance/connect/${instance.instance_name}`);
        
        const qrcode = res.base64 || res.code || res.qrcode;

        if (qrcode) {
          // Update DB with the QR code
          await adminClient
            .from('whatsapp_instances')
            .update({ 
              qr_code: qrcode,
              status: 'connecting',
              updated_at: new Date().toISOString()
            })
            .eq('company_id', companyId);

          return new Response(JSON.stringify({ success: true, qrcode }), { headers: corsHeaders });
        }

        return new Response(JSON.stringify({ success: false, message: 'QR Code not generated yet' }), { headers: corsHeaders });
      } catch (err: any) {
        console.error(`[QR_ERROR] ${err.message}`);
        return new Response(JSON.stringify({ success: false, error: err.message }), { headers: corsHeaders });
      }
    }

    if (action === 'get-status') {
      const instance = await getInstance(companyId);
      if (!instance || !instance.instance_name) {
        return new Response(JSON.stringify({ success: false, message: 'Instance not found' }), { headers: corsHeaders });
      }

      try {
        const res = await fetchEvolution(`/instance/connectionState/${instance.instance_name}`);
        const evolutionStatus = res.instance?.state || res.state; // connected, disconnected, connecting
        
        let mappedStatus: string = 'disconnected';
        if (evolutionStatus === 'open' || evolutionStatus === 'connected') mappedStatus = 'connected';
        else if (evolutionStatus === 'connecting' || evolutionStatus === 'pairing') mappedStatus = 'connecting';
        else if (evolutionStatus === 'close' || evolutionStatus === 'disconnected') mappedStatus = 'disconnected';

        const updateData: any = { 
          status: mappedStatus,
          updated_at: new Date().toISOString()
        };

        if (mappedStatus === 'connected') {
          updateData.connected_at = new Date().toISOString();
          updateData.qr_code = null;
        }

        const { data: updated } = await adminClient
          .from('whatsapp_instances')
          .update(updateData)
          .eq('company_id', companyId)
          .select()
          .single();

        return new Response(JSON.stringify({ 
          success: true, 
          ...updated,
          mappedStatus 
        }), { headers: corsHeaders });
      } catch (err: any) {
        return new Response(JSON.stringify({ success: false, error: err.message }), { headers: corsHeaders });
      }
    }

    if (action === 'logout') {
      const instance = await getInstance(companyId);
      if (instance && instance.instance_name) {
        try {
          await fetchEvolution(`/instance/logout/${instance.instance_name}`, { method: 'DELETE' });
          await fetchEvolution(`/instance/delete/${instance.instance_name}`, { method: 'DELETE' });
        } catch (e) {
          console.warn(`[LOGOUT_WARN] Could not delete from Evolution: ${e.message}`);
        }
      }

      await adminClient
        .from('whatsapp_instances')
        .update({ 
          status: 'disconnected', 
          qr_code: null,
          instance_name: null,
          instance_id: null,
          updated_at: new Date().toISOString()
        })
        .eq('company_id', companyId);

      return new Response(JSON.stringify({ success: true }), { headers: corsHeaders });
    }

    if (action === 'send-test') {
      const { phone, text } = params;
      const { instance } = await getEffectiveInstance(companyId);
      if (!instance) throw new Error('No instance available');
      
      await sendWhatsApp(instance.instance_name, phone, text || 'Teste de conexão Agendae');
      return new Response(JSON.stringify({ success: true }), { headers: corsHeaders });
    }


    if (action === 'send-otp') {
      const { phone, email: targetEmail } = params;
      const targetCompanyId = companyId;
      
      if (!targetCompanyId) {
        console.error('[OTP_ERROR_REAL] send-otp: Missing companyId');
        return new Response(JSON.stringify({ success: false, reason: 'MISSING_PARAMS', message: 'ID da empresa não informado.' }), { headers: corsHeaders });
      }
      
      console.log(`[OTP_GENERATE] Phone: ${phone}, Email: ${targetEmail}, Company: ${targetCompanyId}`);
      
      const code = Math.floor(100000 + Math.random() * 900000).toString();
      const expiresAt = new Date(Date.now() + 5 * 60 * 1000).toISOString();
      const userIp = req.headers.get('x-real-ip') || req.headers.get('cf-connecting-ip') || 'unknown';

      // Check for abuse (max 10 attempts in last hour for this IP/Phone)
      const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000).toISOString();
      const cleanPhone = phone ? formatPhone(phone) : null;
      
      const { count: recentAttempts } = await adminClient
        .from('auth_otps')
        .select('*', { count: 'exact', head: true })
        .or(`phone.eq.${cleanPhone},ip_address.eq.${userIp}`)
        .gt('created_at', oneHourAgo);

      if (recentAttempts && recentAttempts >= 10) {
        console.warn(`[OTP_GENERATE] Rate limit hit for ${cleanPhone || userIp}`);
        return new Response(JSON.stringify({ success: false, reason: 'RATE_LIMIT', message: 'Muitas tentativas em curto período. Tente novamente em 1 hora.' }), { headers: corsHeaders });
      }

      // Invalidate old UNUSED codes for this phone in this company
      await adminClient
        .from('auth_otps')
        .update({ used: true, metadata: { invalidated_by_new_request: true } })
        .match({ company_id: targetCompanyId, phone: cleanPhone, used: false });

      const { error: insertError } = await adminClient.from('auth_otps').insert({
        company_id: targetCompanyId,
        phone: cleanPhone,
        email: targetEmail || null,
        code,
        used: false,
        expires_at: expiresAt,
        ip_address: userIp,
        metadata: { user_agent: req.headers.get('user-agent') }
      });

      if (insertError) {
        console.error('[OTP_ERROR_REAL] Database insert error:', insertError);
        return new Response(JSON.stringify({ success: false, reason: 'DB_ERROR', error: insertError.message }), { headers: corsHeaders });
      }

      const { instance, isFallback } = await getEffectiveInstance(targetCompanyId);
      
      if (phone && instance) {
        try {
          const message = `Seu código de acesso para Agendae é: *${code}*\n\nEste código expira em 5 minutos.`;
          await sendWhatsApp(instance.instance_name, phone, message);
          console.log(`[OTP] Enviado via WhatsApp (${instance.instance_name}) para ${phone}. Fallback: ${isFallback}`);
          return new Response(JSON.stringify({ 
            success: true, 
            method: 'whatsapp', 
            isFallback,
            instance: instance.instance_name 
          }), { headers: corsHeaders });
        } catch (waError: any) {
          console.error('[OTP] Falha no envio WhatsApp:', waError.message);
          // Continua para o fallback de e-mail se o WhatsApp falhar
        }
      } 
      
      if (targetEmail) {
        console.log(`[OTP] Seguindo para Magic Link para ${targetEmail}`);
        const { data, error: linkError } = await adminClient.auth.admin.generateLink({
          type: 'magiclink',
          email: targetEmail,
          options: { redirectTo: params.redirectTo || 'https://app.agendae.io/' }
        });
        if (linkError) {
          console.error('[OTP] Erro no Magic Link:', linkError);
          return new Response(JSON.stringify({ 
            success: false, 
            reason: 'EMAIL_ERROR', 
            error: linkError.message 
          }), { headers: corsHeaders });
        }
        return new Response(JSON.stringify({ success: true, method: 'email' }), { headers: corsHeaders });
      } else {
        const reason = !instance ? 'NO_INSTANCE' : 'SEND_FAILURE';
        console.error(`[OTP] Nenhum método de entrega disponível: ${reason}`);
        return new Response(JSON.stringify({ 
          success: false, 
          reason,
          message: 'Não foi possível enviar o código. WhatsApp indisponível e e-mail não informado.'
        }), { headers: corsHeaders });
      }
    }

    if (action === 'verify-otp') {
      const { phone, email: targetEmail, code: rawCode, redirectTo } = params;
      const targetCompanyId = companyId; // Use companyId from body destructuring
      const code = rawCode?.toString().trim();
      
      console.log(`[OTP_VERIFY_START] phone=${phone}, email=${targetEmail}, code=${code}, companyId=${targetCompanyId}`);

      if (!code || code.length !== 6) {
        console.error(`[OTP_ERROR_REAL] Invalid code format: ${code}`);
        return new Response(JSON.stringify({ success: false, reason: 'INVALID_FORMAT', message: 'Código deve ter 6 dígitos.' }), { headers: corsHeaders });
      }

      if (!targetCompanyId) {
        console.error(`[OTP_ERROR_REAL] Missing company_id in verify-otp request`);
        return new Response(JSON.stringify({ success: false, reason: 'MISSING_COMPANY', message: 'ID da empresa não informado.' }), { headers: corsHeaders });
      }

      const cleanPhone = phone ? formatPhone(phone) : null;

      // Find the most recent active OTP for this phone/company
      console.log(`[OTP_QUERY] Looking for unused OTP: company=${targetCompanyId}, phone=${cleanPhone}, code=${code}`);
      
      const { data: otp, error: fetchError } = await adminClient
        .from('auth_otps')
        .select('*')
        .eq('code', code)
        .eq('company_id', targetCompanyId)
        .eq('phone', cleanPhone)
        .eq('used', false)
        .gt('expires_at', new Date().toISOString())
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle();

      if (fetchError) {
        console.error('[OTP_ERROR_REAL] DB Fetch Error:', fetchError);
        return new Response(JSON.stringify({ success: false, reason: 'DB_ERROR', error: fetchError.message }), { headers: corsHeaders });
      }

      if (!otp) {
        console.warn(`[OTP_ERROR_REAL] No valid/unused/non-expired OTP found for ${cleanPhone} with code ${code} in company ${targetCompanyId}`);
        // Log if there was ANY otp found regardless of expiration/used status to give better feedback
        const { data: anyOtp } = await adminClient
          .from('auth_otps')
          .select('used, expires_at, code')
          .eq('phone', cleanPhone)
          .eq('company_id', targetCompanyId)
          .order('created_at', { ascending: false })
          .limit(1)
          .maybeSingle();
        
        if (anyOtp) {
          console.log(`[OTP_ROW_FOUND] But invalid state: code_match=${anyOtp.code === code}, used=${anyOtp.used}, expired=${new Date(anyOtp.expires_at) < new Date()}`);
          if (anyOtp.used) return new Response(JSON.stringify({ success: false, reason: 'ALREADY_USED', message: 'Este código já foi utilizado.' }), { headers: corsHeaders });
          if (new Date(anyOtp.expires_at) < new Date()) return new Response(JSON.stringify({ success: false, reason: 'EXPIRED', message: 'Este código expirou.' }), { headers: corsHeaders });
          if (anyOtp.code !== code) return new Response(JSON.stringify({ success: false, reason: 'INCORRECT_CODE', message: 'Código incorreto.' }), { headers: corsHeaders });
        }
        
        return new Response(JSON.stringify({ success: false, reason: 'NOT_FOUND', message: 'Código inválido ou não encontrado.' }), { headers: corsHeaders });
      }

      console.log(`[OTP_ROW_FOUND] ID: ${otp.id}, attempts: ${otp.attempts}`);

      if (otp.attempts >= (otp.max_attempts || 5)) {
        console.warn(`[OTP_ERROR_REAL] Max attempts reached for OTP ${otp.id}`);
        return new Response(JSON.stringify({ success: false, reason: 'MAX_ATTEMPTS', message: 'Máximo de tentativas excedido. Solicite um novo código.' }), { headers: corsHeaders });
      }

      // Mark as used immediately
      console.log(`[OTP_MARK_USED] Marking OTP ${otp.id} as used...`);
      const { error: updateError } = await adminClient.from('auth_otps').update({ 
        used: true,
        attempts: (otp.attempts || 0) + 1
      }).eq('id', otp.id);

      if (updateError) {
        console.error(`[OTP_ERROR_REAL] Failed to mark OTP as used:`, updateError);
        return new Response(JSON.stringify({ success: false, reason: 'UPDATE_ERROR', message: 'Erro ao atualizar estado do código.' }), { headers: corsHeaders });
      }

      console.log(`[OTP_SUCCESS] OTP ${otp.id} verified. Starting login process...`);

      // Track metric
      await adminClient.rpc('track_booking_metric', { 
        p_company_id: otp.company_id, 
        p_metric_type: 'otp_login' 
      });

      // Find user email ONLY for this company
      let userEmail = targetEmail || otp.email;
      if (!userEmail && cleanPhone) {
        console.log(`[OTP_LOGIN_CREATE] Searching for client email for phone ${cleanPhone}...`);
        const { data: client } = await adminClient
          .from('clients')
          .select('email, name')
          .eq('phone', cleanPhone)
          .eq('company_id', targetCompanyId)
          .not('email', 'is', null)
          .maybeSingle();
        
        if (client?.email) {
          userEmail = client.email;
          console.log(`[OTP_LOGIN_CREATE] Found client: ${client.name} (${userEmail})`);
        } else {
            console.log(`[OTP_LOGIN_CREATE] No client email found in table. Checking auth.users...`);
            const { data: { users }, error: listError } = await adminClient.auth.admin.listUsers();
            if (listError) {
              console.error(`[OTP_ERROR_REAL] Error listing users:`, listError);
            } else {
              const foundUser = users.find(u => u.phone === cleanPhone || u.user_metadata?.whatsapp === cleanPhone);
              if (foundUser?.email) {
                  userEmail = foundUser.email;
                  console.log(`[OTP_LOGIN_CREATE] Found auth email: ${userEmail}`);
              }
            }
        }
      }

      if (userEmail) {
        console.log(`[OTP_LOGIN_CREATE] Generating magic link for ${userEmail}...`);
        const { data, error: linkError } = await adminClient.auth.admin.generateLink({
          type: 'magiclink',
          email: userEmail,
          options: { redirectTo: redirectTo || 'https://app.agendae.io/booking' }
        });

        if (linkError) {
          console.error('[OTP_ERROR_REAL] Magic Link generation error:', linkError);
          // Don't fail the whole request if only the link generation fails but OTP was correct
          return new Response(JSON.stringify({ 
            success: true, 
            email: userEmail,
            message: 'Código verificado, mas houve erro ao gerar sessão automática.' 
          }), { headers: corsHeaders });
        }

        const verificationToken = data.properties.verification_token;
        console.log(`[OTP_LOGIN_CREATE] Link generated. Exchanging token...`);
        
        try {
          const { data: sessionData, error: verifyError } = await adminClient.auth.verifyOtp({
            email: userEmail,
            token: verificationToken,
            type: 'magiclink'
          });

          if (verifyError) {
            console.error('[OTP_ERROR_REAL] verifyOtp error:', verifyError);
            throw verifyError;
          }

          console.log(`[OTP_SUCCESS] Session generated successfully for ${userEmail}`);
          return new Response(JSON.stringify({ 
            success: true, 
            email: userEmail, 
            session: sessionData.session
          }), { headers: corsHeaders });
        } catch (exchangeError: any) {
          console.error('[OTP_ERROR_REAL] Token exchange error:', exchangeError.message);
          return new Response(JSON.stringify({ 
            success: true, 
            email: userEmail, 
            loginUrl: data.properties.action_link 
          }), { headers: corsHeaders });
        }
      }
      
      console.log(`[OTP_SUCCESS] Verified but no email associated with this phone yet.`);
      return new Response(JSON.stringify({ success: true, needsEmail: true }), { headers: corsHeaders });
    }

    if (action === 'send-message') {
      const { phone, message, imageUrl } = params;
      
      if (!phone || !message) {
        return new Response(JSON.stringify({ success: false, reason: 'INVALID_PARAMS', message: 'Telefone e mensagem são obrigatórios.' }), { headers: corsHeaders });
      }

      const { instance, isFallback } = await getEffectiveInstance(companyId);
      
      if (!instance) {
        return new Response(JSON.stringify({ 
          success: false, 
          reason: 'NO_INSTANCE',
          message: 'Nenhuma instância de WhatsApp disponível (empresa ou sistema).' 
        }), { headers: corsHeaders });
      }

      console.log(`[SEND_MESSAGE] Usando instância: ${instance.instance_name} (Fallback: ${isFallback}) para ${phone}`);
      
      try {
        await sendWhatsApp(instance.instance_name, phone, message, imageUrl);
        return new Response(JSON.stringify({ 
          success: true, 
          instance: instance.instance_name, 
          isFallback 
        }), { headers: corsHeaders });
      } catch (err: any) {
        console.error(`[SEND_MESSAGE] Erro no envio: ${err.message}`);
        return new Response(JSON.stringify({ 
          success: false, 
          reason: 'SEND_FAILURE', 
          error: err.message 
        }), { headers: corsHeaders });
      }
    }

    if (action === 'track-abandonment') {
      const { companyId, clientData, slotData, sessionId } = params;
      
      const { data: abandonment } = await adminClient.from('booking_abandonments').upsert({
        company_id: companyId,
        session_id: sessionId,
        customer_name: clientData.name,
        customer_phone: clientData.phone,
        customer_email: clientData.email,
        service_ids: slotData.serviceIds,
        professional_id: slotData.professionalId,
        start_time: slotData.startTime,
        status: 'pending'
      }, { onConflict: 'session_id, company_id' }).select().single();

      await adminClient.rpc('track_booking_metric', { 
        p_company_id: companyId, 
        p_metric_type: 'abandonment' 
      });

      return new Response(JSON.stringify({ success: true, id: abandonment.id }), { headers: corsHeaders });
    }

    return new Response(JSON.stringify({ 
      success: false, 
      reason: 'NOT_IMPLEMENTED',
      message: `Ação '${action}' não implementada.` 
    }), { 
      status: 200, 
      headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
    });

  } catch (error: any) {
    console.error(`[FATAL_ERROR] ${error.message}`);
    return new Response(JSON.stringify({ 
      success: false, 
      reason: 'SERVER_ERROR',
      error: error.message 
    }), { 
      status: 200, // Nunca retorna 500 conforme solicitado
      headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
    });
  }
});
