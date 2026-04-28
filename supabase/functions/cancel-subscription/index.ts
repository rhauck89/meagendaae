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
    const { data: claimsData, error } = await supabase.auth.getClaims(token);
    if (error || !claimsData?.claims) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401, ...responseHeaders });
    }
    const userId = claimsData.claims.sub as string;
    const { companyId, environment } = await req.json();

    const admin = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!);
    const { data: company } = await admin
      .from('companies')
      .select('id, user_id, paddle_subscription_id')
      .eq('id', companyId)
      .maybeSingle();

    if (!company || company.user_id !== userId) {
      return new Response(JSON.stringify({ error: 'Forbidden' }), { status: 403, ...responseHeaders });
    }
    if (!company.paddle_subscription_id) {
      return new Response(JSON.stringify({ error: 'No active subscription' }), { status: 400, ...responseHeaders });
    }

    const env = (environment === 'live' ? 'live' : 'sandbox') as PaddleEnv;
    const paddle = getPaddleClient(env);
    // Cancel at end of period (graceful)
    await paddle.subscriptions.cancel(company.paddle_subscription_id, { effectiveFrom: 'next_billing_period' });

    // Webhook will update subscription_status; reflect immediately too
    await admin.from('companies').update({
      cancel_at_period_end: true,
      updated_at: new Date().toISOString(),
    }).eq('id', companyId);

    return new Response(JSON.stringify({ success: true }), responseHeaders);
  } catch (e) {
    console.error('cancel-subscription error', e);
    return new Response(JSON.stringify({ error: String(e) }), { status: 500, ...responseHeaders });
  }
});
