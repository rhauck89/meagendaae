import { createClient } from 'npm:@supabase/supabase-js@2';
import { corsHeaders, stripeRequest } from '../_shared/stripe.ts';

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
      { global: { headers: { Authorization: authHeader } } },
    );

    const token = authHeader.replace('Bearer ', '');
    const { data: claimsData, error: claimsError } = await supabase.auth.getClaims(token);
    if (claimsError || !claimsData?.claims) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401, ...responseHeaders });
    }

    const userId = claimsData.claims.sub as string;
    const { companyId } = await req.json().catch(() => ({}));

    const admin = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!);
    const { data: company } = await admin
      .from('companies')
      .select('id, user_id, stripe_customer_id')
      .eq('id', companyId)
      .maybeSingle();

    if (!company || (company as any).user_id !== userId) {
      return new Response(JSON.stringify({ error: 'Forbidden' }), { status: 403, ...responseHeaders });
    }
    if (!(company as any).stripe_customer_id) {
      return new Response(JSON.stringify({ error: 'No active Stripe customer' }), { status: 400, ...responseHeaders });
    }

    const returnUrl = Deno.env.get('APP_URL') || req.headers.get('origin') || 'https://meagendae.com.br';
    const body = new URLSearchParams();
    body.set('customer', (company as any).stripe_customer_id);
    body.set('return_url', `${returnUrl}/dashboard/settings/plan`);

    const portalSession = await stripeRequest<{ url: string }>('/billing_portal/sessions', {
      method: 'POST',
      body,
    });

    return new Response(JSON.stringify({ url: portalSession.url }), responseHeaders);
  } catch (error) {
    console.error('customer-portal error', error);
    return new Response(JSON.stringify({ error: String(error?.message || error) }), { status: 500, ...responseHeaders });
  }
});
