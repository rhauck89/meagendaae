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
    const token = authHeader.replace('Bearer ', '');
    
    let user = null;
    let isServiceRole = false;

    if (token === serviceRoleKey) {
      isServiceRole = true;
    } else {
      const supabaseClient = createClient(supabaseUrl, supabaseAnonKey, {
        global: { headers: { Authorization: authHeader } }
      });
      const { data: { user: authUser }, error: authError } = await supabaseClient.auth.getUser();
      if (authError || !authUser) {
        console.error('[AUTH ERROR]', authError);
        return new Response(JSON.stringify({ error: 'Unauthorized', details: authError?.message }), {
          status: 401,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }
      user = authUser;
    }

    const body = await req.json();
    const { action, companyId, ...params } = body;
    console.log(`[ACTION: ${action}] [COMPANY: ${companyId}]`, params);

    if (!companyId) {
      return new Response(JSON.stringify({ error: 'Missing companyId' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Verify user access (if not service role)
    if (!isServiceRole && user) {
      const { data: profile, error: profileError } = await adminClient
        .from('profiles')
        .select('company_id, role')
        .eq('user_id', user.id)
        .single();

      if (profileError || !profile) {
        console.error('[PROFILE ERROR]', profileError, user?.id);
        return new Response(JSON.stringify({ error: 'Forbidden', details: 'Profile not found or inaccessible' }), {
          status: 403,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      const isSuperAdmin = profile.role === 'super_admin';
      const belongsToCompany = profile.company_id === companyId;

      if (!isSuperAdmin && !belongsToCompany) {
        console.warn(`[FORBIDDEN] User ${user?.id} tried to access company ${companyId}. Profile company: ${profile.company_id}, Role: ${profile.role}`);
        return new Response(JSON.stringify({ 
          error: 'Forbidden', 
          details: 'User does not belong to this company',
          debug: { profileCompany: profile.company_id, requestedCompany: companyId, role: profile.role } 
        }), {
          status: 403,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }
    }

    let EVOLUTION_API_URL = Deno.env.get('EVOLUTION_API_BASE_URL')?.replace(/\/$/, '');
    if (EVOLUTION_API_URL?.endsWith('/manager')) {
      EVOLUTION_API_URL = EVOLUTION_API_URL.replace('/manager', '');
    }
    const EVOLUTION_API_KEY = Deno.env.get('EVOLUTION_API_KEY');

    if (!EVOLUTION_API_URL || !EVOLUTION_API_KEY) {
      console.error('[CONFIG ERROR] Missing EVOLUTION_API_BASE_URL or EVOLUTION_API_KEY');
      return new Response(JSON.stringify({ error: 'Evolution API configuration missing' }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Get current instance data
    const { data: instanceData } = await adminClient
      .from('whatsapp_instances')
      .select('*')
      .eq('company_id', companyId)
      .maybeSingle();

    const fetchEvolution = async (endpoint: string, options: RequestInit = {}) => {
      const url = `${EVOLUTION_API_URL}${endpoint}`;
      const headers = {
        'Content-Type': 'application/json',
        'apikey': EVOLUTION_API_KEY,
        ...(options.headers || {}),
      };
      
      console.log(`[EVOLUTION REQ] ${options.method || 'GET'} ${url}`);
      
      try {
        const response = await fetch(url, { ...options, headers });
        const text = await response.text();
        console.log(`[EVOLUTION RES] ${response.status} ${url}`, text.substring(0, 2000));
        
        let json;
        try {
          json = JSON.parse(text);
        } catch (e) {
          json = { message: text };
        }
        
        if (!response.ok) {
          const errMsg = json.message || json.error || `HTTP ${response.status}`;
          console.error(`[EVOLUTION API ERROR] ${url} -> ${response.status}`, json);
          throw new Error(JSON.stringify({ 
            status: response.status, 
            message: errMsg,
            details: json 
          }));
        }
        return json;
      } catch (e: any) {
        console.error(`[EVOLUTION FETCH ERROR] ${url}`, e.message);
        throw e;
      }
    };

    // Action: process-new-appointment (called by trigger)
    if (action === 'send-confirmation') {
      const { appointmentId } = params;
      console.log(`[CONFIRMATION] Starting for appointment ${appointmentId}`);

      // 1. Fetch detailed appointment data
      const { data: appt, error: apptError } = await adminClient
        .from('appointments')
        .select(`
          *,
          client:clients(name, phone),
          service:services(name),
          professional:profiles!appointments_professional_id_fkey(full_name)
        `)
        .eq('id', appointmentId)
        .single();

      if (apptError || !appt) {
        console.error('[CONFIRMATION ERROR] Appointment not found', apptError);
        return new Response(JSON.stringify({ error: 'appointment not found' }), {
          status: 404,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      if (!appt.client?.phone) {
        console.warn('[CONFIRMATION] No client phone, skipping');
        return new Response(JSON.stringify({ success: true, message: 'no phone' }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      // 2. Check if already sent
      if (appt.whatsapp_confirmation_sent) {
        console.log('[CONFIRMATION] Already sent, skipping');
        return new Response(JSON.stringify({ success: true, message: 'already sent' }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      // 3. Format phone (ensure +55 and no non-digits)
      let phone = appt.client.phone.replace(/\D/g, '');
      if (phone.length === 11 && !phone.startsWith('55')) {
        phone = '55' + phone;
      } else if (phone.length === 9 || phone.length === 10) {
        // Assume missing country code if too short
        phone = '55' + phone;
      }

      // 4. Format message
      const date = new Date(appt.start_time);
      const displayDate = date.toLocaleDateString('pt-BR');
      const displayTime = date.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
      
      const message = `Olá ${appt.client.name} 👋\nSeu horário foi confirmado:\n\n📅 ${displayDate}\n🕐 ${displayTime}\n✂️ ${appt.service?.name}\n👤 ${appt.professional?.full_name}`;

      // 5. Check connection and send
      if (!instanceData?.instance_name || instanceData.status !== 'connected') {
        await adminClient.from('whatsapp_logs').insert({
          company_id: companyId,
          appointment_id: appointmentId,
          client_id: appt.client_id,
          client_name: appt.client.name,
          phone: phone,
          message_type: 'appointment_confirmed',
          body: message,
          status: 'failed',
          error_message: 'WhatsApp not connected'
        });
        return new Response(JSON.stringify({ error: 'WhatsApp not connected' }), {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      try {
        await fetchEvolution(`/message/sendText/${instanceData.instance_name}`, {
          method: 'POST',
          body: JSON.stringify({ number: phone, text: message }),
        });

        await adminClient.from('whatsapp_logs').insert({
          company_id: companyId,
          appointment_id: appointmentId,
          client_id: appt.client_id,
          client_name: appt.client.name,
          phone: phone,
          message_type: 'appointment_confirmed',
          body: message,
          status: 'sent',
          delivered_at: new Date().toISOString()
        });

        await adminClient.from('appointments').update({ whatsapp_confirmation_sent: true }).eq('id', appointmentId);

        return new Response(JSON.stringify({ success: true }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      } catch (e: any) {
        console.error('[CONFIRMATION SEND ERROR]', e.message);
        await adminClient.from('whatsapp_logs').insert({
          company_id: companyId,
          appointment_id: appointmentId,
          client_id: appt.client_id,
          client_name: appt.client.name,
          phone: phone,
          message_type: 'appointment_confirmed',
          body: message,
          status: 'error',
          error_message: e.message
        });
        return new Response(JSON.stringify({ error: 'send failed' }), {
          status: 502,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }
    }

    if (action === 'create') {
      const { data: company } = await adminClient.from('companies').select('slug').eq('id', companyId).single();
      if (!company) return new Response(JSON.stringify({ error: 'company not found' }), { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });

      if (instanceData?.instance_name) {
        try { await fetchEvolution(`/instance/delete/${instanceData.instance_name}`, { method: 'DELETE' }); } catch (e) {}
      }

      const cleanSlug = company.slug.toLowerCase().replace(/[^a-z0-9]/g, '');
      const instanceName = `agendae-${cleanSlug}-${Math.random().toString(36).substring(2, 7)}`.toLowerCase();

      const result = await fetchEvolution('/instance/create', {
        method: 'POST',
        body: JSON.stringify({ instanceName, qrcode: true, integration: 'WHATSAPP-BAILEYS' }),
      });

      const { data: newInstance, error: dbError } = await adminClient
        .from('whatsapp_instances')
        .upsert({
          company_id: companyId,
          instance_name: instanceName,
          instance_id: result.instance?.instanceId || instanceName,
          status: 'pending',
          updated_at: new Date().toISOString(),
        }, { onConflict: 'company_id' })
        .select().single();

      if (dbError) return new Response(JSON.stringify({ error: 'db insert failed' }), { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
      return new Response(JSON.stringify(newInstance), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    if (action === 'get-qr') {
      if (!instanceData?.instance_name) return new Response(JSON.stringify({ error: 'No instance' }), { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
      const result = await fetchEvolution(`/instance/connect/${instanceData.instance_name}`);
      const qr = result.base64 || result.code;
      if (qr) {
        await adminClient.from('whatsapp_instances').update({ qr_code: qr, status: 'connecting' }).eq('company_id', companyId);
        return new Response(JSON.stringify({ qr_code: qr }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
      }
      return new Response(JSON.stringify({ error: 'qr fetch failed' }), { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    if (action === 'get-status') {
      if (!instanceData?.instance_name) return new Response(JSON.stringify({ error: 'No instance' }), { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
      const result = await fetchEvolution(`/instance/connectionState/${instanceData.instance_name}`);
      const evolutionStatus = result.instance?.state;
      let status = 'disconnected';
      if (evolutionStatus === 'open') status = 'connected';
      else if (evolutionStatus === 'connecting') status = 'connecting';
      
      const updateData: any = { status, updated_at: new Date().toISOString() };
      if (status === 'connected') {
        const infoResult = await fetchEvolution(`/instance/fetchInstances?instanceName=${instanceData.instance_name}`);
        const inst = Array.isArray(infoResult) ? infoResult[0] : infoResult;
        if (inst) {
          updateData.phone = inst.owner?.split('@')[0] || inst.number;
          updateData.profile_name = inst.profileName;
          updateData.connected_at = new Date().toISOString();
        }
      }
      await adminClient.from('whatsapp_instances').update(updateData).eq('company_id', companyId);
      return new Response(JSON.stringify({ mappedStatus: status, ...updateData }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    if (action === 'logout' || action === 'delete') {
      if (instanceData?.instance_name) {
        try { await fetchEvolution(`/instance/logout/${instanceData.instance_name}`, { method: 'DELETE' }); } catch (e) {}
        try { await fetchEvolution(`/instance/delete/${instanceData.instance_name}`, { method: 'DELETE' }); } catch (e) {}
      }
      await adminClient.from('whatsapp_instances').update({ status: 'disconnected', qr_code: null, phone: null, profile_name: null, connected_at: null, instance_name: null }).eq('company_id', companyId);
      return new Response(JSON.stringify({ success: true }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    if (action === 'send-test') {
      const { phone, body, text } = params;
      const result = await fetchEvolution(`/message/sendText/${instanceData.instance_name}`, {
        method: 'POST',
        body: JSON.stringify({ number: phone, text: text || body }),
      });
      return new Response(JSON.stringify(result), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    if (action === 'send-message') {
      const { phone, message, type, appointmentId, clientName, clientId } = params;
      if (!instanceData?.instance_name || instanceData.status !== 'connected') {
        await adminClient.from('whatsapp_logs').insert({ company_id: companyId, appointment_id: appointmentId, client_id: clientId, client_name: clientName, phone, message_type: type || 'other', body: message, status: 'failed', error_message: 'Not connected' });
        return new Response(JSON.stringify({ error: 'Not connected' }), { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
      }
      const result = await fetchEvolution(`/message/sendText/${instanceData.instance_name}`, { method: 'POST', body: JSON.stringify({ number: phone, text: message }) });
      await adminClient.from('whatsapp_logs').insert({ company_id: companyId, appointment_id: appointmentId, client_id: clientId, client_name: clientName, phone, message_type: type || 'other', body: message, status: 'sent', delivered_at: new Date().toISOString() });
      return new Response(JSON.stringify(result), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    return new Response(JSON.stringify({ error: 'Invalid action' }), { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });

  } catch (error: any) {
    console.error('[RUNTIME ERROR]', error.message);
    return new Response(JSON.stringify({ error: error.message }), { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
  }
});
