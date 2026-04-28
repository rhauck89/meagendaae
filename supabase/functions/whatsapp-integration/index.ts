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

    if (!companyId && !['process-reminders', 'process-reviews'].includes(action)) {
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

    if (!EVOLUTION_API_URL || !EVOLUTION_API_KEY) {
      throw new Error('Evolution API configuration missing');
    }

    const fetchEvolution = async (endpoint: string, options: RequestInit = {}) => {
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

    const replaceVariables = (text: string, data: any) => {
      let result = text;
      const vars: any = {
        '{{nome}}': data.client_name || 'Cliente',
        '{{empresa}}': data.company_name || 'Nossa Empresa',
        '{{servico}}': data.service_name || 'Serviço',
        '{{data}}': data.date || '',
        '{{hora}}': data.time || '',
        '{{profissional}}': data.professional_name || 'Profissional',
        '{{link_agendamento}}': data.booking_link || '',
        '{{link_reagendar}}': data.reschedule_link || '',
        '{{link_cancelar}}': data.cancel_link || '',
        '{{link_avaliacao}}': data.review_link || '',
        '{{cashback}}': data.cashback || 'R$ 0,00',
        '{{pontos}}': data.points || '0',
        '{{tempo_atraso}}': data.delay_minutes || '0',
        '{{nova_previsao}}': data.new_time || '',
      };

      for (const [key, value] of Object.entries(vars)) {
        result = result.replace(new RegExp(key, 'g'), String(value));
      }
      return result;
    };

    const sendWhatsApp = async (instanceName: string, phone: string, text: string, imageUrl?: string) => {
      const number = formatPhone(phone);
      if (imageUrl && text.includes('{{logo}}')) {
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

    if (action === 'send-message' || action === 'send-confirmation' || action === 'send-delay-notification') {
      const targetCompanyId = companyId || params.company_id;
      const instance = await getInstance(targetCompanyId);
      if (!instance || instance.status !== 'connected') {
        throw new Error(`WhatsApp not connected for company ${targetCompanyId}`);
      }

      let message = params.message || '';
      let phone = params.phone || '';
      let appointmentId = params.appointmentId;
      let clientName = params.clientName || 'Cliente';
      let type = params.type || action;

      if (action === 'send-confirmation' || action === 'send-delay-notification' || !message) {
        const { data: appt } = await adminClient
          .from('appointments')
          .select(`
            *,
            client:clients(name, whatsapp),
            appointment_services(service:services(name)),
            professional:profiles(full_name),
            company:companies(name, slug, logo_url, review_url)
          `)
          .eq('id', appointmentId)
          .single();

        if (appt) {
          phone = phone || appt.client?.whatsapp || appt.client_whatsapp;
          clientName = clientName || appt.client?.name || appt.client_name;
          
          const trigger = action === 'send-confirmation' ? 'appointment_confirmed' : (action === 'send-delay-notification' ? 'professional_delay' : type);
          
          const { data: template } = await adminClient
            .from('whatsapp_templates')
            .select('*')
            .eq('company_id', targetCompanyId)
            .eq('category', trigger.replace('appointment_', '').replace('professional_', ''))
            .maybeSingle();

          const dateObj = new Date(appt.start_time);
          const context = {
            client_name: clientName,
            company_name: appt.company?.name,
            service_name: appt.appointment_services?.[0]?.service?.name || 'Serviço',
            date: dateObj.toLocaleDateString('pt-BR'),
            time: dateObj.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' }),
            professional_name: appt.professional?.full_name,
            booking_link: `https://app.agendae.io/b/${appt.company?.slug}`,
            review_link: appt.company?.review_url || `https://app.agendae.io/review/${appt.id}`,
            delay_minutes: params.delayMinutes || '0',
            new_time: params.newTime || '',
          };

          message = replaceVariables(template?.body || message || 'Olá!', context);
          
          await sendWhatsApp(instance.instance_name, phone, message, appt.company?.logo_url);
          
          await adminClient.from('whatsapp_logs').insert({
            company_id: targetCompanyId,
            appointment_id: appointmentId,
            client_name: clientName,
            phone: formatPhone(phone),
            message_type: trigger,
            body: message,
            status: 'sent',
            delivered_at: new Date().toISOString()
          });

          if (action === 'send-confirmation') {
            await adminClient.from('appointments').update({ whatsapp_confirmation_sent: true }).eq('id', appointmentId);
          }
        }
      } else {
        await sendWhatsApp(instance.instance_name, phone, message);
        await adminClient.from('whatsapp_logs').insert({
          company_id: targetCompanyId,
          appointment_id: appointmentId,
          client_name: clientName,
          phone: formatPhone(phone),
          message_type: type,
          body: message,
          status: 'sent',
          delivered_at: new Date().toISOString()
        });
      }

      return new Response(JSON.stringify({ success: true }), { headers: corsHeaders });
    }

    if (action === 'create') {
      const { data: company } = await adminClient.from('companies').select('slug').eq('id', companyId).single();
      const instanceName = `agendae-${company.slug.toLowerCase().replace(/[^a-z0-9]/g, '')}`;
      
      try {
        const result = await fetchEvolution('/instance/create', { 
          method: 'POST', 
          body: JSON.stringify({ instanceName, qrcode: true, integration: 'WHATSAPP-BAILEYS' }) 
        });
        await adminClient.from('whatsapp_instances').upsert({ company_id: companyId, instance_name: instanceName, status: 'pending' }, { onConflict: 'company_id' });
        return new Response(JSON.stringify({ instance_name: instanceName }), { headers: corsHeaders });
      } catch (e: any) {
        return new Response(JSON.stringify({ instance_name: instanceName, alreadyExists: true }), { headers: corsHeaders });
      }
    }

    if (action === 'get-qr') {
      const inst = await getInstance(companyId);
      const result = await fetchEvolution(`/instance/connect/${inst.instance_name}`);
      return new Response(JSON.stringify(result), { headers: corsHeaders });
    }

    if (action === 'get-status') {
      const inst = await getInstance(companyId);
      const result = await fetchEvolution(`/instance/connectionState/${inst.instance_name}`);
      const status = result.instance?.state === 'open' ? 'connected' : 'disconnected';
      await adminClient.from('whatsapp_instances').update({ status }).eq('company_id', companyId);
      return new Response(JSON.stringify({ mappedStatus: status }), { headers: corsHeaders });
    }

    if (action === 'logout') {
      const inst = await getInstance(companyId);
      await fetchEvolution(`/instance/logout/${inst.instance_name}`, { method: 'DELETE' });
      await adminClient.from('whatsapp_instances').update({ status: 'disconnected', qr_code: null }).eq('company_id', companyId);
      return new Response(JSON.stringify({ success: true }), { headers: corsHeaders });
    }

    if (action === 'send-otp') {
      const { phone, companyId: targetCompanyId } = params;
      if (!phone || !targetCompanyId) throw new Error('Missing phone or companyId');
      
      const { data: client } = await adminClient
        .from('clients')
        .select('email, name')
        .eq('company_id', targetCompanyId)
        .eq('whatsapp', phone.replace(/\D/g, '').startsWith('55') ? phone.replace(/\D/g, '') : '55' + phone.replace(/\D/g, ''))
        .maybeSingle();
      
      if (!client || !client.email) {
        throw new Error('Número não encontrado ou sem e-mail vinculado no cadastro desta empresa.');
      }

      const code = Math.floor(100000 + Math.random() * 900000).toString();
      const expiresAt = new Date(Date.now() + 5 * 60 * 1000).toISOString();

      await adminClient.from('whatsapp_otp_codes').insert({
        phone: formatPhone(phone),
        email: client.email,
        code,
        expires_at: expiresAt
      });

      const instance = await getInstance(targetCompanyId);
      if (instance && instance.status === 'connected') {
        const message = `Olá ${client.name}! Seu código de acesso para Agendae é: *${code}*\n\nEste código expira em 5 minutos.`;
        await sendWhatsApp(instance.instance_name, phone, message);
      } else {
        // Fallback or error
        throw new Error('O WhatsApp desta empresa não está conectado para enviar o código.');
      }

      return new Response(JSON.stringify({ success: true }), { headers: corsHeaders });
    }

    if (action === 'verify-otp') {
      const { phone, code, redirectTo } = params;
      if (!phone || !code) throw new Error('Missing phone or code');

      const { data: otp } = await adminClient
        .from('whatsapp_otp_codes')
        .select('*')
        .eq('phone', formatPhone(phone))
        .eq('code', code)
        .eq('verified', false)
        .gt('expires_at', new Date().toISOString())
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle();

      if (!otp) {
        throw new Error('Código inválido ou expirado.');
      }

      await adminClient.from('whatsapp_otp_codes').update({ verified: true }).eq('id', otp.id);

      const { data: linkData, error: linkError } = await adminClient.auth.admin.generateLink({
        type: 'magiclink',
        email: otp.email,
        options: { redirectTo: redirectTo || 'https://app.agendae.io/' }
      });

      if (linkError) throw linkError;

      return new Response(JSON.stringify({ success: true, loginUrl: linkData.properties.action_link }), { headers: corsHeaders });
    }

    return new Response(JSON.stringify({ error: 'Invalid action' }), { status: 400, headers: corsHeaders });

  } catch (error: any) {
    console.error(`[ERROR] ${error.message}`);
    return new Response(JSON.stringify({ error: error.message }), { status: 500, headers: corsHeaders });
  }
});
