import { createClient } from 'npm:@supabase/supabase-js@2';
import { getPaddleClient, type PaddleEnv, corsHeaders } from '../_shared/paddle.ts';

const responseHeaders = { headers: { ...corsHeaders, 'Content-Type': 'application/json' } };

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: corsHeaders });

  try {
    const authHeader = req.headers.get('Authorization');
    if (!authHeader?.startsWith('Bearer ')) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401, ...responseHeaders });
    }

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_ANON_KEY')!,
      { global: { headers: { Authorization: authHeader } } }
    );

    const token = authHeader.replace('Bearer ', '');
    const { data: claimsData, error: claimsErr } = await supabase.auth.getClaims(token);
    if (claimsErr || !claimsData?.claims) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401, ...responseHeaders });
    }

    const userId = claimsData.claims.sub as string;
    const { companyId, environment } = await req.json().catch(() => ({}));

    // Use service role to read company; but verify ownership
    const admin = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!);
    const { data: company } = await admin
      .from('companies')
      .select('id, user_id, paddle_customer_id, paddle_subscription_id')
      .eq('id', companyId)
      .maybeSingle();

    if (!company || company.user_id !== userId) {
      return new Response(JSON.stringify({ error: 'Forbidden' }), { status: 403, ...responseHeaders });
    }
    if (!company.paddle_customer_id) {
      return new Response(JSON.stringify({ error: 'No active subscription' }), { status: 400, ...responseHeaders });
    }

    const env = (environment === 'live' ? 'live' : 'sandbox') as PaddleEnv;
    const paddle = getPaddleClient(env);
    const subIds = company.paddle_subscription_id ? [company.paddle_subscription_id] : [];
    const portalSession = await paddle.customerPortalSessions.create(company.paddle_customer_id, subIds);

    return new Response(JSON.stringify({ url: portalSession.urls.general.overview, urls: portalSession.urls }), responseHeaders);
  } catch (e) {
    console.error('customer-portal error', e);
    return new Response(JSON.stringify({ error: String(e) }), { status: 500, ...responseHeaders });
  }
});
