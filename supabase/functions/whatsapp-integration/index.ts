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

    // Initialize adminClient early to avoid ReferenceError
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

    // Some actions don't require companyId initially or handle it themselves (like scheduler)
    if (!companyId && !['process-reminders', 'process-reviews'].includes(action)) {
      return new Response(JSON.stringify({ error: 'Missing companyId' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Verify user access (if not service role and not internal action)
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
      return new Response(JSON.stringify({ error: 'Evolution API configuration missing' }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const fetchEvolution = async (endpoint: string, options: RequestInit = {}) => {
      const url = `${EVOLUTION_API_URL}${endpoint}`;
      const headers = { 'Content-Type': 'application/json', 'apikey': EVOLUTION_API_KEY, ...(options.headers || {}) };
      const response = await fetch(url, { ...options, headers });
      const text = await response.text();
      let json;
      try { json = JSON.parse(text); } catch (e) { json = { message: text }; }
      if (!response.ok) throw new Error(JSON.stringify({ status: response.status, message: json.message || text }));
      return json;
    };

    // --- Helper to get instance name for a company ---
    const getInstance = async (id: string) => {
      const { data } = await adminClient.from('whatsapp_instances').select('*').eq('company_id', id).maybeSingle();
      return data;
    };

    // ACTION: send-confirmation (called by Trigger)
    if (action === 'send-confirmation') {
      const { appointmentId } = params;
      const { data: appt, error: apptError } = await adminClient
        .from('appointments')
        .select(`
          *,
          client:clients(name, whatsapp),
          appointment_services(service:services(name)),
          professional:profiles(full_name)
        `)
        .eq('id', appointmentId).single();

      if (apptError) {
        console.error(`[ERROR] Database error fetching appointment ${appointmentId}:`, apptError);
        return new Response(JSON.stringify({ error: 'Appointment fetch error', details: apptError }), { status: 500 });
      }

      if (!appt) {
        console.error(`[ERROR] Appointment ${appointmentId} not found`);
        return new Response(JSON.stringify({ error: 'Appointment not found' }), { status: 404 });
      }

      const clientPhone = appt.client?.whatsapp || appt.client_whatsapp;
      const clientName = appt.client?.name || appt.client_name || 'Cliente';
      const serviceName = appt.appointment_services?.[0]?.service?.name || 'Serviço';

      if (!clientPhone) {
        console.warn(`[WARN] No phone found for appointment ${appointmentId}`);
        await adminClient.from('whatsapp_logs').insert({ 
          company_id: companyId, 
          appointment_id: appointmentId, 
          client_name: clientName,
          message_type: 'appointment_confirmed', 
          status: 'failed', 
          error_message: 'Telefone do cliente não encontrado' 
        });
        return new Response(JSON.stringify({ success: true, warning: 'No phone' }));
      }

      if (appt.whatsapp_confirmation_sent) {
        console.log(`[INFO] Confirmation already sent for appointment ${appointmentId}`);
        return new Response(JSON.stringify({ success: true }));
      }

      const instanceData = await getInstance(companyId);
      if (!instanceData || instanceData.status !== 'connected') {
        const status = instanceData?.status || 'none';
        console.warn(`[WARN] Instance for company ${companyId} is in status: ${status}`);
        await adminClient.from('whatsapp_logs').insert({ 
          company_id: companyId, 
          appointment_id: appointmentId, 
          client_name: clientName,
          phone: clientPhone,
          message_type: 'appointment_confirmed', 
          status: 'failed', 
          error_message: `WhatsApp não conectado (Status: ${status})` 
        });
        return new Response(JSON.stringify({ error: 'Not connected', status }));
      }

      const date = new Date(appt.start_time);
      const day = String(date.getDate()).padStart(2, '0');
      const month = String(date.getMonth() + 1).padStart(2, '0');
      const hours = String(date.getHours()).padStart(2, '0');
      const minutes = String(date.getMinutes()).padStart(2, '0');
      
      const message = `Olá ${clientName} 👋\nSeu horário foi confirmado:\n\n📅 ${day}/${month}\n🕐 ${hours}:${minutes}\n✂️ ${serviceName}\n👤 ${appt.professional?.full_name || 'Profissional'}`;
      const phone = clientPhone.replace(/\D/g, '').startsWith('55') ? clientPhone.replace(/\D/g, '') : '55' + clientPhone.replace(/\D/g, '');

      try {
        console.log(`[INFO] Sending confirmation to ${phone} via instance ${instanceData.instance_name}`);
        await fetchEvolution(`/message/sendText/${instanceData.instance_name}`, { 
          method: 'POST', 
          body: JSON.stringify({ number: phone, text: message }) 
        });
        
        await adminClient.from('whatsapp_logs').insert({ 
          company_id: companyId, 
          appointment_id: appointmentId, 
          client_id: appt.client_id, 
          client_name: clientName, 
          phone, 
          message_type: 'appointment_confirmed', 
          body: message, 
          status: 'sent', 
          delivered_at: new Date().toISOString() 
        });
        
        await adminClient.from('appointments').update({ whatsapp_confirmation_sent: true }).eq('id', appointmentId);
        return new Response(JSON.stringify({ success: true }));
      } catch (e: any) {
        console.error(`[ERROR] Failed to send WhatsApp: ${e.message}`);
        await adminClient.from('whatsapp_logs').insert({ 
          company_id: companyId, 
          appointment_id: appointmentId, 
          client_name: clientName, 
          phone, 
          message_type: 'appointment_confirmed', 
          body: message, 
          status: 'failed', 
          error_message: e.message 
        });
        return new Response(JSON.stringify({ error: e.message }), { status: 502 });
      }
    }

    // ACTION: process-reminders (called by Cron)
    if (action === 'process-reminders') {
      const tomorrow = new Date();
      tomorrow.setDate(tomorrow.getDate() + 1);
      const tomorrowStr = tomorrow.toISOString().split('T')[0];

      const { data: appts } = await adminClient
        .from('appointments')
        .select(`
          *,
          client:clients(name, whatsapp),
          appointment_services(service:services(name)),
          professional:profiles(full_name)
        `)
        .eq('whatsapp_reminder_sent', false)
        .gte('start_time', `${tomorrowStr}T00:00:00`)
        .lte('start_time', `${tomorrowStr}T23:59:59`);

      if (!appts) return new Response(JSON.stringify({ count: 0 }));

      for (const appt of appts) {
        const clientPhone = appt.client?.whatsapp || appt.client_whatsapp;
        if (!clientPhone) continue;
        
        const inst = await getInstance(appt.company_id);
        if (!inst || inst.status !== 'connected') continue;

        const date = new Date(appt.start_time);
        const day = String(date.getDate()).padStart(2, '0');
        const month = String(date.getMonth() + 1).padStart(2, '0');
        const hours = String(date.getHours()).padStart(2, '0');
        const minutes = String(date.getMinutes()).padStart(2, '0');

        const serviceName = appt.appointment_services?.[0]?.service?.name || 'Serviço';
        const message = `Lembrete de amanhã! ⏰\nOlá ${appt.client?.name || 'Cliente'}, tudo bem?\n\nConfirmando seu horário:\n📅 Amanhã, ${day}/${month}\n🕐 ${hours}:${minutes}\n✂️ ${serviceName}\n\nAté lá! 🚀`;
        const phone = clientPhone.replace(/\D/g, '').startsWith('55') ? clientPhone.replace(/\D/g, '') : '55' + clientPhone.replace(/\D/g, '');

        try {
          await fetchEvolution(`/message/sendText/${inst.instance_name}`, { method: 'POST', body: JSON.stringify({ number: phone, text: message }) });
          await adminClient.from('whatsapp_logs').insert({ company_id: appt.company_id, appointment_id: appt.id, client_name: appt.client?.name || 'Cliente', phone, message_type: 'appointment_reminder', body: message, status: 'sent', delivered_at: new Date().toISOString() });
          await adminClient.from('appointments').update({ whatsapp_reminder_sent: true }).eq('id', appt.id);
        } catch (e) {}
      }
      return new Response(JSON.stringify({ count: appts.length }));
    }

    // ACTION: process-reviews (called by Cron)
    if (action === 'process-reviews') {
      const { data: appts } = await adminClient
        .from('appointments')
        .select(`*, client:clients(name, whatsapp), company:companies(review_url)`)
        .eq('status', 'completed')
        .eq('whatsapp_review_sent', false)
        .lt('end_time', new Date().toISOString());

      if (!appts) return new Response(JSON.stringify({ count: 0 }));

      for (const appt of appts) {
        const clientPhone = appt.client?.whatsapp || appt.client_whatsapp;
        if (!clientPhone) continue;
        
        const inst = await getInstance(appt.company_id);
        if (!inst || inst.status !== 'connected') continue;

        const message = `Obrigado pela visita hoje, ${appt.client?.name || 'Cliente'}! 💛\nSua opinião é muito importante para nós.\n\nComo foi sua experiência?\n${appt.company?.review_url || 'Deixe sua avaliação!'}`;
        const phone = clientPhone.replace(/\D/g, '').startsWith('55') ? clientPhone.replace(/\D/g, '') : '55' + clientPhone.replace(/\D/g, '');

        try {
          await fetchEvolution(`/message/sendText/${inst.instance_name}`, { method: 'POST', body: JSON.stringify({ number: phone, text: message }) });
          await adminClient.from('whatsapp_logs').insert({ company_id: appt.company_id, appointment_id: appt.id, client_name: appt.client?.name || 'Cliente', phone, message_type: 'post_service_review', body: message, status: 'sent', delivered_at: new Date().toISOString() });
          await adminClient.from('appointments').update({ whatsapp_review_sent: true }).eq('id', appt.id);
        } catch (e) {}
      }
      return new Response(JSON.stringify({ count: appts.length }));
    }

    // --- Standard Instance Actions ---
    const instanceData = await getInstance(companyId);

    if (action === 'create') {
      const { data: company } = await adminClient.from('companies').select('slug').eq('id', companyId).single();
      if (instanceData?.instance_name) try { await fetchEvolution(`/instance/delete/${instanceData.instance_name}`, { method: 'DELETE' }); } catch (e) {}
      const instanceName = `agendae-${company.slug.toLowerCase().replace(/[^a-z0-9]/g, '')}-${Math.random().toString(36).substring(2, 7)}`.toLowerCase();
      const result = await fetchEvolution('/instance/create', { method: 'POST', body: JSON.stringify({ instanceName, qrcode: true, integration: 'WHATSAPP-BAILEYS' }) });
      const { data: newInst } = await adminClient.from('whatsapp_instances').upsert({ company_id: companyId, instance_name: instanceName, instance_id: result.instance?.instanceId || instanceName, status: 'pending', updated_at: new Date().toISOString() }, { onConflict: 'company_id' }).select().single();
      return new Response(JSON.stringify(newInst));
    }

    if (action === 'get-qr') {
      const result = await fetchEvolution(`/instance/connect/${instanceData.instance_name}`);
      const qr = result.base64 || result.code;
      if (qr) await adminClient.from('whatsapp_instances').update({ qr_code: qr, status: 'connecting' }).eq('company_id', companyId);
      return new Response(JSON.stringify({ qr_code: qr }));
    }

    if (action === 'get-status') {
      const result = await fetchEvolution(`/instance/connectionState/${instanceData.instance_name}`);
      const status = result.instance?.state === 'open' ? 'connected' : (result.instance?.state === 'connecting' ? 'connecting' : 'disconnected');
      const updateData: any = { status, updated_at: new Date().toISOString() };
      if (status === 'connected') {
        const info = await fetchEvolution(`/instance/fetchInstances?instanceName=${instanceData.instance_name}`);
        const inst = Array.isArray(info) ? info[0] : info;
        if (inst) { updateData.phone = inst.owner?.split('@')[0] || inst.number; updateData.profile_name = inst.profileName; updateData.connected_at = new Date().toISOString(); }
      }
      await adminClient.from('whatsapp_instances').update(updateData).eq('company_id', companyId);
      return new Response(JSON.stringify({ mappedStatus: status, ...updateData }));
    }

    if (action === 'logout' || action === 'delete') {
      if (instanceData?.instance_name) { try { await fetchEvolution(`/instance/logout/${instanceData.instance_name}`, { method: 'DELETE' }); } catch (e) {} try { await fetchEvolution(`/instance/delete/${instanceData.instance_name}`, { method: 'DELETE' }); } catch (e) {} }
      await adminClient.from('whatsapp_instances').update({ status: 'disconnected', qr_code: null, phone: null, profile_name: null, connected_at: null, instance_name: null }).eq('company_id', companyId);
      return new Response(JSON.stringify({ success: true }));
    }

    if (action === 'send-test') {
      const result = await fetchEvolution(`/message/sendText/${instanceData.instance_name}`, { method: 'POST', body: JSON.stringify({ number: params.phone, text: params.text || params.body }) });
      return new Response(JSON.stringify(result));
    }

    return new Response(JSON.stringify({ error: 'Invalid action' }), { status: 400 });

  } catch (error: any) {
    return new Response(JSON.stringify({ error: error.message }), { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
  }
});