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
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const { action, companyId, ...params } = await req.json();

    if (!companyId) {
      return new Response(JSON.stringify({ error: 'Missing companyId' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Verify user belongs to company
    const { data: profile, error: profileError } = await supabaseClient
      .from('profiles')
      .select('company_id, role')
      .eq('id', user.id)
      .single();

    if (profileError || !profile || (profile.company_id !== companyId && profile.role !== 'super_admin')) {
      return new Response(JSON.stringify({ error: 'Forbidden' }), {
        status: 403,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const EVOLUTION_API_URL = Deno.env.get('EVOLUTION_API_BASE_URL')?.replace(/\/$/, '');
    const EVOLUTION_API_KEY = Deno.env.get('EVOLUTION_API_KEY');

    if (!EVOLUTION_API_URL || !EVOLUTION_API_KEY) {
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

    if (action === 'create') {
      // 1. Get company slug
      const { data: company } = await adminClient
        .from('companies')
        .select('slug')
        .eq('id', companyId)
        .single();

      if (!company) throw new Error('Company not found');

      const instanceName = `${company.slug}-${Math.random().toString(36).substring(2, 7)}`;

      // 2. Create instance in Evolution API
      const response = await fetch(`${EVOLUTION_API_URL}/instance/create`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'apikey': EVOLUTION_API_KEY,
        },
        body: JSON.stringify({
          instanceName,
          token: Math.random().toString(36).substring(2, 15),
          qrcode: true,
        }),
      });

      const result = await response.json();
      if (!response.ok) throw new Error(result.message || 'Failed to create instance');

      // 3. Save to DB
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

      const response = await fetch(`${EVOLUTION_API_URL}/instance/connect/${instanceData.instance_name}`, {
        headers: { 'apikey': EVOLUTION_API_KEY },
      });

      const result = await response.json();
      // Evolution returns base64 in some format, or error if already connected
      if (result.base64) {
        // Update DB with QR code
        await adminClient
          .from('whatsapp_instances')
          .update({ qr_code: result.base64, status: 'connecting' })
          .eq('company_id', companyId);
        
        return new Response(JSON.stringify({ qr_code: result.base64 }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      return new Response(JSON.stringify(result), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    if (action === 'get-status') {
      if (!instanceData?.instance_name) throw new Error('No instance found for this company');

      const response = await fetch(`${EVOLUTION_API_URL}/instance/connectionState/${instanceData.instance_name}`, {
        headers: { 'apikey': EVOLUTION_API_KEY },
      });

      const result = await response.json();
      const evolutionStatus = result.instance?.state; // open, close, connecting, etc.

      // Map Evolution status to our WhatsAppStatus
      let status: 'disconnected' | 'connecting' | 'connected' | 'error' | 'pending' | 'closed' = 'disconnected';
      if (evolutionStatus === 'open') status = 'connected';
      else if (evolutionStatus === 'connecting') status = 'connecting';
      else if (evolutionStatus === 'close') status = 'closed';

      const updateData: any = { status };

      // If connected, try to get more info (phone, profile name)
      if (status === 'connected') {
        // Some Evolution versions return profile info in connectionState or we might need another call
        // For now, let's assume we can get basic info or it will be updated via webhook later
        // But the user wants it now, so let's try to fetch instance info
        const infoRes = await fetch(`${EVOLUTION_API_URL}/instance/fetchInstances?instanceName=${instanceData.instance_name}`, {
          headers: { 'apikey': EVOLUTION_API_KEY },
        });
        const infoResult = await infoRes.json();
        const inst = Array.isArray(infoResult) ? infoResult.find((i: any) => i.instanceName === instanceData.instance_name) : null;
        
        if (inst) {
          if (inst.owner) updateData.phone = inst.owner;
          if (inst.profileName) updateData.profile_name = inst.profileName;
          updateData.connected_at = new Date().toISOString();
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

      // Logout
      await fetch(`${EVOLUTION_API_URL}/instance/logout/${instanceData.instance_name}`, {
        method: 'DELETE',
        headers: { 'apikey': EVOLUTION_API_KEY },
      });

      // Delete instance from Evolution to be clean
      await fetch(`${EVOLUTION_API_URL}/instance/delete/${instanceData.instance_name}`, {
        method: 'DELETE',
        headers: { 'apikey': EVOLUTION_API_KEY },
      });

      // Update DB
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

      const response = await fetch(`${EVOLUTION_API_URL}/message/sendText/${instanceData.instance_name}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'apikey': EVOLUTION_API_KEY,
        },
        body: JSON.stringify({
          number: phone,
          text: body,
        }),
      });

      const result = await response.json();
      if (!response.ok) throw new Error(result.message || 'Failed to send message');

      return new Response(JSON.stringify(result), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    return new Response(JSON.stringify({ error: 'Invalid action' }), {
      status: 400,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error: any) {
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
