import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_ANON_KEY')!,
      { global: { headers: { Authorization: authHeader } } }
    );

    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const { domain_id } = await req.json();
    if (!domain_id || typeof domain_id !== 'string') {
      return new Response(JSON.stringify({ error: 'domain_id is required' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Use service role to update domain
    const serviceClient = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    );

    // Fetch domain record
    const { data: domainRecord, error: fetchErr } = await serviceClient
      .from('company_domains')
      .select('*')
      .eq('id', domain_id)
      .single();

    if (fetchErr || !domainRecord) {
      return new Response(JSON.stringify({ error: 'Domain not found' }), {
        status: 404,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Verify user belongs to the company
    const { data: profile } = await serviceClient
      .from('profiles')
      .select('company_id')
      .eq('user_id', user.id)
      .single();

    if (!profile || profile.company_id !== domainRecord.company_id) {
      return new Response(JSON.stringify({ error: 'Forbidden' }), {
        status: 403,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const domain = domainRecord.domain;

    // DNS verification: check if domain resolves via DNS lookup
    let verified = false;
    try {
      const dnsResponse = await fetch(
        `https://dns.google/resolve?name=${encodeURIComponent(domain)}&type=CNAME`
      );
      const dnsData = await dnsResponse.json();

      if (dnsData.Answer) {
        const hasCname = dnsData.Answer.some(
          (record: any) =>
            record.type === 5 &&
            record.data &&
            record.data.toLowerCase().includes('agendapro.com')
        );
        verified = hasCname;
      }
    } catch (dnsErr) {
      console.error('DNS lookup failed:', dnsErr);
    }

    // Update domain verification status
    await serviceClient
      .from('company_domains')
      .update({
        verified,
        ssl_status: verified ? 'active' : 'pending',
      })
      .eq('id', domain_id);

    return new Response(
      JSON.stringify({
        verified,
        message: verified
          ? 'Domínio verificado com sucesso!'
          : 'CNAME ainda não aponta para app.agendapro.com. Aguarde a propagação DNS (até 48h).',
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  } catch (err) {
    console.error('Error:', err);
    return new Response(JSON.stringify({ error: 'Internal server error' }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
