
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

    const getInstance = async (id: string) => {
      const { data } = await adminClient.from('whatsapp_instances').select('*').eq('company_id', id).maybeSingle();
      return data;
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

    if (action === 'send-otp') {
      const { phone, email: targetEmail } = params;
      const targetCompanyId = companyId;
      
      if (!targetCompanyId) {
        console.error('[ERROR] send-otp: Missing companyId');
        throw new Error('Missing companyId');
      }
      
      console.log(`[OTP] Generating for Phone: ${phone}, Email: ${targetEmail}, Company: ${targetCompanyId}`);
      
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
        console.warn(`[OTP] Rate limit hit for ${cleanPhone || userIp}`);
        throw new Error('Muitas tentativas em curto período. Tente novamente mais tarde.');
      }

      // Invalidate old codes for this phone/email in this company
      await adminClient
        .from('auth_otps')
        .update({ expires_at: new Date().toISOString() })
        .match({ company_id: targetCompanyId, phone: cleanPhone })
        .gt('expires_at', new Date().toISOString());

      const { error: insertError } = await adminClient.from('auth_otps').insert({
        company_id: targetCompanyId,
        phone: cleanPhone,
        email: targetEmail || null,
        code,
        expires_at: expiresAt,
        ip_address: userIp,
        metadata: { user_agent: req.headers.get('user-agent') }
      });

      if (insertError) {
        console.error('[OTP] Database insert error:', insertError);
        throw new Error('Erro ao registrar código de verificação.');
      }

      const instance = await getInstance(targetCompanyId);
      console.log(`[OTP] Instance for company ${targetCompanyId}:`, instance ? `${instance.instance_name} (${instance.status})` : 'None');

      if (phone && instance && instance.status === 'connected') {
        try {
          const message = `Seu código de acesso para Agendae é: *${code}*\n\nEste código expira em 5 minutos.`;
          await sendWhatsApp(instance.instance_name, phone, message);
          console.log(`[OTP] Sent via WhatsApp to ${phone}`);
          return new Response(JSON.stringify({ success: true, method: 'whatsapp' }), { headers: corsHeaders });
        } catch (waError: any) {
          console.error('[OTP] WhatsApp send failure:', waError.message);
        }
      } 
      
      if (targetEmail) {
        console.log(`[OTP] Falling back to Magic Link for ${targetEmail}`);
        const { data, error: linkError } = await adminClient.auth.admin.generateLink({
          type: 'magiclink',
          email: targetEmail,
          options: { redirectTo: params.redirectTo || 'https://app.agendae.io/' }
        });
        if (linkError) {
          console.error('[OTP] Magic Link error:', linkError);
          throw linkError;
        }
        return new Response(JSON.stringify({ success: true, method: 'email' }), { headers: corsHeaders });
      } else {
        const statusMsg = instance ? (instance.status !== 'connected' ? 'WhatsApp desconectado' : 'Falha no envio') : 'WhatsApp não configurado';
        console.error(`[OTP] No delivery method available: ${statusMsg}`);
        throw new Error(`Não foi possível enviar código via WhatsApp (${statusMsg}). Tente outro método ou entre em contato.`);
      }
    }

    if (action === 'verify-otp') {
      const { phone, email: targetEmail, code: rawCode, redirectTo, companyId: targetCompanyId } = params;
      const code = rawCode?.toString().trim();
      
      console.log(`[VERIFY] Checking OTP for Phone: ${phone}, Email: ${targetEmail}, Code: ${code}, Company: ${targetCompanyId}`);

      if (!code || code.length !== 6) {
        throw new Error('Código inválido.');
      }

      const cleanPhone = phone ? formatPhone(phone) : null;

      // Find the most recent active OTP for this phone/company
      const { data: otp, error: fetchError } = await adminClient
        .from('auth_otps')
        .select('*')
        .eq('code', code)
        .eq('company_id', targetCompanyId)
        .eq('phone', cleanPhone)
        .gt('expires_at', new Date().toISOString())
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle();

      if (fetchError) {
        console.error('[VERIFY] DB Error:', fetchError);
        throw new Error('Erro ao consultar código.');
      }

      if (!otp) {
        console.warn(`[VERIFY] Invalid/Expired code: ${code} for phone ${cleanPhone}`);
        throw new Error('Código inválido ou expirado.');
      }

      if (otp.attempts >= (otp.max_attempts || 5)) {
        console.warn(`[VERIFY] Max attempts reached for OTP ${otp.id}`);
        throw new Error('Máximo de tentativas excedido. Solicite um novo código.');
      }

      // Mark as used immediately by expiring it
      await adminClient.from('auth_otps').update({ 
        expires_at: new Date(0).toISOString(),
        attempts: (otp.attempts || 0) + 1
      }).eq('id', otp.id);

      console.log(`[VERIFY] Success for OTP ${otp.id}. Generating access link...`);

      // Track metric
      await adminClient.rpc('track_booking_metric', { 
        p_company_id: otp.company_id, 
        p_metric_type: 'otp_login' 
      });

      // Find user email ONLY for this company
      let userEmail = targetEmail || otp.email;
      if (!userEmail && cleanPhone) {
        const { data: client } = await adminClient
          .from('clients')
          .select('email')
          .eq('phone', cleanPhone)
          .eq('company_id', targetCompanyId)
          .not('email', 'is', null)
          .maybeSingle();
        
        if (client?.email) {
          userEmail = client.email;
          console.log(`[VERIFY] Found client email for phone ${cleanPhone} in company ${targetCompanyId}: ${userEmail}`);
        } else {
            // Fallback: check auth.users if metadata has it
            const { data: { users } } = await adminClient.auth.admin.listUsers();
            const foundUser = users.find(u => u.phone === cleanPhone || u.user_metadata?.whatsapp === cleanPhone);
            if (foundUser?.email) {
                userEmail = foundUser.email;
                console.log(`[VERIFY] Found auth email for phone ${cleanPhone}: ${userEmail}`);
            }
        }
      }

      if (userEmail) {
        const { data, error: linkError } = await adminClient.auth.admin.generateLink({
          type: 'magiclink',
          email: userEmail,
          options: { redirectTo: redirectTo || 'https://app.agendae.io/booking' }
        });

        if (linkError) {
          console.error('[VERIFY] Magic Link generation error:', linkError);
          return new Response(JSON.stringify({ success: true, email: userEmail }), { headers: corsHeaders });
        }

        // To avoid session contamination, we can try to exchange the link for tokens right here
        // or just return the link and let the client handle it.
        // Given the request for Nubank-style direct login, we'll return the tokens if possible.
        
        const loginUrl = data.properties.action_link;
        console.log(`[VERIFY] Login link generated for ${userEmail}. Exchanging for tokens...`);
        
        try {
          // Verify the token directly to get a session without redirecting the user's browser
          const { data: sessionData, error: verifyError } = await adminClient.auth.verifyOtp({
            email: userEmail,
            token: data.properties.verification_token,
            type: 'magiclink'
          });

          if (verifyError) {
            throw verifyError;
          }

          console.log(`[VERIFY] Session generated successfully for ${userEmail}`);
          return new Response(JSON.stringify({ 
            success: true, 
            email: userEmail, 
            session: sessionData.session
          }), { headers: corsHeaders });
        } catch (exchangeError: any) {
          console.error('[VERIFY] Token exchange error:', exchangeError.message);
          // Fallback to returning the loginUrl if direct exchange fails
          return new Response(JSON.stringify({ 
            success: true, 
            email: userEmail, 
            loginUrl: loginUrl 
          }), { headers: corsHeaders });
        }
      }
      
      return new Response(JSON.stringify({ success: true }), { headers: corsHeaders });
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

    return new Response(JSON.stringify({ error: 'Action not implemented' }), { 
      status: 400, 
      headers: corsHeaders 
    });

  } catch (error: any) {
    console.error(`[ERROR] ${error.message}`);
    return new Response(JSON.stringify({ error: error.message }), { status: 500, headers: corsHeaders });
  }
});
