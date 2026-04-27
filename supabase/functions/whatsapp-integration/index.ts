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
          // Return the full error body for debugging
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

    if (action === 'create') {
      console.log(`[CREATE] Starting instance creation for company ${companyId}`);
      
      const { data: company } = await adminClient
        .from('companies')
        .select('slug')
        .eq('id', companyId)
        .single();

      if (!company) {
        console.error('[CREATE ERROR] Company not found');
        return new Response(JSON.stringify({ error: 'company not found' }), {
          status: 404,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      // 1. Cleanup old instance if it exists
      if (instanceData?.instance_name) {
        console.log(`[CREATE] Cleaning up existing instance: ${instanceData.instance_name}`);
        try {
          await fetchEvolution(`/instance/delete/${instanceData.instance_name}`, { method: 'DELETE' });
        } catch (e) {
          console.warn('[CREATE] Failed to delete old instance (may not exist in Evolution)', e.message);
        }
      }

      const cleanSlug = company.slug.toLowerCase().replace(/[^a-z0-9]/g, '');
      const instanceName = `agendae-${cleanSlug}-${Math.random().toString(36).substring(2, 7)}`.toLowerCase();
      console.log(`[CREATE] Creating new instance: ${instanceName}`);

      let result;
      try {
        result = await fetchEvolution('/instance/create', {
          method: 'POST',
          body: JSON.stringify({
            instanceName,
            qrcode: true,
            integration: 'WHATSAPP-BAILEYS'
          }),
        });
      } catch (e: any) {
        console.error('[CREATE ERROR] Evolution API failed', e.message);
        let errorDetails;
        try {
          errorDetails = JSON.parse(e.message);
        } catch {
          errorDetails = { message: e.message };
        }
        
        return new Response(JSON.stringify({ 
          error: 'create failed', 
          details: errorDetails.message || 'Unknown error',
          fullError: errorDetails
        }), {
          status: errorDetails.status || 502,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      console.log('[CREATE] Evolution instance created, updating database...');

      const { data: newInstance, error: dbError } = await adminClient
        .from('whatsapp_instances')
        .upsert({
          company_id: companyId,
          instance_name: instanceName,
          instance_id: result.instance?.instanceId || instanceName,
          status: 'pending',
          qr_code: null,
          phone: null,
          profile_name: null,
          updated_at: new Date().toISOString(),
        }, { onConflict: 'company_id' })
        .select()
        .single();

      if (dbError) {
        console.error('[CREATE ERROR] Database insert failed', dbError);
        return new Response(JSON.stringify({ error: 'db insert failed', details: dbError.message }), {
          status: 500,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      console.log('[CREATE] Success');
      return new Response(JSON.stringify(newInstance), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    if (action === 'get-qr') {
      if (!instanceData?.instance_name) {
        console.warn('[GET-QR] No instance name found in DB for company', companyId);
        return new Response(JSON.stringify({ error: 'qr fetch failed', details: 'No instance name found. Please reconnect.' }), {
          status: 404,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      try {
        const result = await fetchEvolution(`/instance/connect/${instanceData.instance_name}`);

        if (result.base64 || (result.code && typeof result.code === 'string' && result.code.startsWith('data:image'))) {
          const qr = result.base64 || result.code;
          
          await adminClient
            .from('whatsapp_instances')
            .update({ qr_code: qr, status: 'connecting', updated_at: new Date().toISOString() })
            .eq('company_id', companyId);
          
          return new Response(JSON.stringify({ qr_code: qr }), {
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          });
        }

        console.warn('[GET-QR] No QR base64 in response', result);
        return new Response(JSON.stringify({ error: 'qr fetch failed', details: 'Evolution API did not return a QR code yet.' }), {
          status: 404,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      } catch (e) {
        console.error('[GET-QR ERROR]', e.message);
        return new Response(JSON.stringify({ error: 'qr fetch failed', details: e.message }), {
          status: 502,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }
    }

    if (action === 'get-status') {
      if (!instanceData?.instance_name) {
        return new Response(JSON.stringify({ error: 'status fetch failed', details: 'No instance name found. Please reconnect.' }), {
          status: 404,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      try {
        const result = await fetchEvolution(`/instance/connectionState/${instanceData.instance_name}`);
        const evolutionStatus = result.instance?.state; // open, close, connecting, etc.

        let status: 'disconnected' | 'connecting' | 'connected' | 'error' | 'pending' | 'closed' = 'disconnected';
        if (evolutionStatus === 'open') status = 'connected';
        else if (evolutionStatus === 'connecting') status = 'connecting';
        else if (evolutionStatus === 'close') status = 'closed';

        const updateData: any = { 
          status,
          updated_at: new Date().toISOString()
        };
        
        if (status === 'connected') {
          updateData.last_seen_at = new Date().toISOString();
        }

        if (status === 'connected') {
          try {
            // Fetch detailed instance info to get phone/name
            // In v2.3.7, /instance/fetchInstances returns an array. 
            // We can also try /instance/connectionState as it sometimes contains the owner info in some sub-versions.
            console.log(`[STATUS] Fetching detailed info for ${instanceData.instance_name}`);
            const infoResult = await fetchEvolution(`/instance/fetchInstances?instanceName=${instanceData.instance_name}`);
            
            let inst = null;
            if (Array.isArray(infoResult)) {
              inst = infoResult.find((i: any) => i.instanceName === instanceData.instance_name || i.name === instanceData.instance_name);
            } else if (infoResult && typeof infoResult === 'object') {
              // Some versions might return a single object if instanceName is specified
              inst = infoResult;
            }
            
            if (inst) {
              console.log(`[STATUS] Found instance details:`, { profileName: inst.profileName, owner: inst.owner });
              if (inst.owner) {
                // Evolution returns owner as "number@s.whatsapp.net" or just "number"
                updateData.phone = inst.owner.split('@')[0];
              } else if (inst.number) {
                updateData.phone = inst.number;
              }
              
              if (inst.profileName) {
                updateData.profile_name = inst.profileName;
              } else if (inst.profilePicture) {
                // If we have a picture but no name, maybe we can at least know it's active
                console.log(`[STATUS] Profile name missing but found picture/other data`);
              }
              
              updateData.connected_at = new Date().toISOString();
            } else {
              console.warn(`[STATUS] Instance ${instanceData.instance_name} not found in fetchInstances response`);
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
      } catch (e) {
        console.error('[GET-STATUS ERROR]', e.message);
        return new Response(JSON.stringify({ error: 'status fetch failed', details: e.message }), {
          status: 502,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }
    }

    if (action === 'logout' || action === 'delete') {
      if (!instanceData?.instance_name) {
        return new Response(JSON.stringify({ error: 'No instance found to disconnect' }), {
          status: 404,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      console.log(`[DISCONNECT] Logging out and deleting instance ${instanceData.instance_name}`);
      
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
          updated_at: new Date().toISOString(),
        })
        .eq('company_id', companyId);

      return new Response(JSON.stringify({ success: true }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    if (action === 'send-test') {
      const { phone, body, text } = params;
      const messageText = text || body;

      if (!phone || !messageText) {
        return new Response(JSON.stringify({ error: 'phone and text/body required' }), {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }
      
      if (!instanceData?.instance_name) {
        return new Response(JSON.stringify({ error: 'No active instance found for sending messages' }), {
          status: 404,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      console.log(`[SEND-TEST] Sending message to ${phone} from ${instanceData.instance_name}`);
      
      try {
        const result = await fetchEvolution(`/message/sendText/${instanceData.instance_name}`, {
          method: 'POST',
          body: JSON.stringify({
            number: phone,
            text: messageText,
          }),
        });

        return new Response(JSON.stringify(result), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      } catch (e) {
        console.error('[SEND-TEST ERROR]', e.message);
        return new Response(JSON.stringify({ error: 'send failed', details: e.message }), {
          status: 502,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }
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
