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
    const admin = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!);

    const token = authHeader.replace('Bearer ', '');
    const { data: claimsData, error: claimsError } = await supabase.auth.getClaims(token);
    if (claimsError || !claimsData?.claims) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401, ...responseHeaders });
    }

    const userId = claimsData.claims.sub as string;
    const { companyId, moduleId } = await req.json();
    if (!companyId || !moduleId) {
      return new Response(JSON.stringify({ error: 'Dados inválidos' }), { status: 400, ...responseHeaders });
    }

    const { data: company } = await admin
      .from('companies')
      .select('id, user_id, stripe_subscription_id')
      .eq('id', companyId)
      .maybeSingle();

    if (!company || (company as any).user_id !== userId) {
      return new Response(JSON.stringify({ error: 'Forbidden' }), { status: 403, ...responseHeaders });
    }

    const { data: module } = await admin
      .from('plan_modules')
      .select('id, stripe_monthly_price_id')
      .eq('id', moduleId)
      .eq('active', true)
      .maybeSingle();

    if (!module?.stripe_monthly_price_id) {
      return new Response(JSON.stringify({ error: 'Upgrade sem preço configurado no Stripe' }), { status: 400, ...responseHeaders });
    }

    if (!(company as any).stripe_subscription_id) {
      await admin.from('company_modules').upsert({
        company_id: companyId,
        module_id: moduleId,
        status: 'interested',
        billing_cycle: 'monthly',
      } as any, { onConflict: 'company_id,module_id' });

      return new Response(JSON.stringify({ interested: true }), responseHeaders);
    }

    const body = new URLSearchParams();
    body.set('subscription', (company as any).stripe_subscription_id);
    body.set('price', module.stripe_monthly_price_id);
    body.set('quantity', '1');
    body.set('proration_behavior', 'none');

    const item = await stripeRequest<any>('/subscription_items', {
      method: 'POST',
      body,
    });

    await admin.from('company_modules').upsert({
      company_id: companyId,
      module_id: moduleId,
      status: 'active',
      billing_cycle: 'monthly',
      stripe_subscription_item_id: item.id,
    } as any, { onConflict: 'company_id,module_id' });

    return new Response(JSON.stringify({ active: true }), responseHeaders);
  } catch (error) {
    console.error('activate-marketplace-upgrade error', error);
    return new Response(JSON.stringify({ error: String(error?.message || error) }), { status: 500, ...responseHeaders });
  }
});
