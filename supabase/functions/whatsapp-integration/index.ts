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
    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_ANON_KEY') ?? '',
      { global: { headers: { Authorization: req.headers.get('Authorization')! } } }
    );

    const { data: { user }, error: authError } = await supabaseClient.auth.getUser();
    if (authError || !user) {
      console.error('[AUTH ERROR]', authError);
      return new Response(JSON.stringify({ error: 'Unauthorized', details: authError?.message }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
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

    // Verify user access
    const { data: profile, error: profileError } = await supabaseClient
      .from('profiles')
      .select('company_id, role')
      .eq('user_id', user.id)
      .single();

    if (profileError || !profile) {
      console.error('[PROFILE ERROR]', profileError, user.id);
      return new Response(JSON.stringify({ error: 'Forbidden', details: 'Profile not found or inaccessible' }), {
        status: 403,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const isSuperAdmin = profile.role === 'super_admin';
    const belongsToCompany = profile.company_id === companyId;

    if (!isSuperAdmin && !belongsToCompany) {
      console.warn(`[FORBIDDEN] User ${user.id} tried to access company ${companyId}. Profile company: ${profile.company_id}, Role: ${profile.role}`);
      return new Response(JSON.stringify({ 
        error: 'Forbidden', 
        details: 'User does not belong to this company',
        debug: { profileCompany: profile.company_id, requestedCompany: companyId, role: profile.role } 
      }), {
        status: 403,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const EVOLUTION_API_URL = Deno.env.get('EVOLUTION_API_BASE_URL')?.replace(/\/$/, '');
    const EVOLUTION_API_KEY = Deno.env.get('EVOLUTION_API_KEY');

    if (!EVOLUTION_API_URL || !EVOLUTION_API_KEY) {
      console.error('[CONFIG ERROR] Missing EVOLUTION_API_BASE_URL or EVOLUTION_API_KEY');
      return new Response(JSON.stringify({ error: 'Evolution API configuration missing' }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const adminClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

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
        console.log(`[EVOLUTION RES] ${response.status} ${url}`, text.substring(0, 500));
        
        let json;
        try {
          json = JSON.parse(text);
        } catch (e) {
          json = { message: text };
        }
        
        if (!response.ok) {
          throw new Error(json.message || json.error || `HTTP ${response.status}`);
        }
        return json;
      } catch (e: any) {
        console.error(`[EVOLUTION ERROR] ${url}`, e.message);
        throw e;
      }
    };

    if (action === 'create') {
      const { data: company } = await adminClient
        .from('companies')
        .select('slug')
        .eq('id', companyId)
        .single();

      if (!company) throw new Error('Company not found');

      const instanceName = `${company.slug}-${Math.random().toString(36).substring(2, 7)}`;

      const result = await fetchEvolution('/instance/create', {
        method: 'POST',
        body: JSON.stringify({
          instanceName,
          token: Math.random().toString(36).substring(2, 15),
          qrcode: true,
        }),
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
        .select()
        .single();

      if (dbError) throw dbError;

      return new Response(JSON.stringify(newInstance), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    if (action === 'get-qr') {
      if (!instanceData?.instance_name) throw new Error('No instance found for this company');

      const result = await fetchEvolution(`/instance/connect/${instanceData.instance_name}`);

      // Evolution returns base64 in some format
      if (result.base64 || (result.code && typeof result.code === 'string' && result.code.startsWith('data:image'))) {
        const qr = result.base64 || result.code;
        
        await adminClient
          .from('whatsapp_instances')
          .update({ qr_code: qr, status: 'connecting' })
          .eq('company_id', companyId);
        
        return new Response(JSON.stringify({ qr_code: qr }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      console.warn('[QR NOT FOUND] Response did not contain valid QR base64', result);
      return new Response(JSON.stringify({ error: 'QR Code not available yet. Try again in a few seconds.', original: result }), {
        status: 404,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    if (action === 'get-status') {
      if (!instanceData?.instance_name) throw new Error('No instance found for this company');

      const result = await fetchEvolution(`/instance/connectionState/${instanceData.instance_name}`);
      const evolutionStatus = result.instance?.state; // open, close, connecting, etc.

      let status: 'disconnected' | 'connecting' | 'connected' | 'error' | 'pending' | 'closed' = 'disconnected';
      if (evolutionStatus === 'open') status = 'connected';
      else if (evolutionStatus === 'connecting') status = 'connecting';
      else if (evolutionStatus === 'close') status = 'closed';

      const updateData: any = { status };

      if (status === 'connected') {
        try {
          // Fetch detailed instance info to get phone/name
          const infoResult = await fetchEvolution(`/instance/fetchInstances?instanceName=${instanceData.instance_name}`);
          const inst = Array.isArray(infoResult) ? infoResult.find((i: any) => i.instanceName === instanceData.instance_name) : null;
          
          if (inst) {
            if (inst.owner) updateData.phone = inst.owner.split('@')[0];
            if (inst.profileName) updateData.profile_name = inst.profileName;
            updateData.connected_at = new Date().toISOString();
          }
        } catch (e) {
          console.warn('[STATUS INFO ERROR] Could not fetch detailed instance info', e.message);
        }
      }

      await adminClient
        .from('whatsapp_instances')
        .update(updateData)
        .eq('company_id', companyId);

      return new Response(JSON.stringify({ ...result, mappedStatus: status, ...updateData }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    if (action === 'logout' || action === 'delete') {
      if (!instanceData?.instance_name) throw new Error('No instance found');

      try {
        await fetchEvolution(`/instance/logout/${instanceData.instance_name}`, { method: 'DELETE' });
      } catch (e) {
        console.warn('[LOGOUT ERROR] Instance might already be logged out', e.message);
      }

      try {
        await fetchEvolution(`/instance/delete/${instanceData.instance_name}`, { method: 'DELETE' });
      } catch (e) {
        console.warn('[DELETE ERROR] Instance might already be deleted', e.message);
      }

      await adminClient
        .from('whatsapp_instances')
        .update({
          status: 'disconnected',
          qr_code: null,
          phone: null,
          profile_name: null,
          connected_at: null,
          instance_name: null,
        })
        .eq('company_id', companyId);

      return new Response(JSON.stringify({ success: true }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    if (action === 'send-test') {
      const { phone, body } = params;
      if (!phone || !body) throw new Error('Phone and body are required');
      if (!instanceData?.instance_name) throw new Error('No instance found');

      const result = await fetchEvolution(`/message/sendText/${instanceData.instance_name}`, {
        method: 'POST',
        body: JSON.stringify({
          number: phone,
          text: body,
        }),
      });

      return new Response(JSON.stringify(result), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    return new Response(JSON.stringify({ error: 'Invalid action' }), {
      status: 400,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error: any) {
    console.error('[RUNTIME ERROR]', error.message);
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
