import { createClient } from 'npm:@supabase/supabase-js@2';
import { corsHeaders, stripeRequest } from '../_shared/stripe.ts';

const responseHeaders = { headers: { ...corsHeaders, 'Content-Type': 'application/json' } };

const siteUrl = (origin?: string | null) =>
  Deno.env.get('APP_URL') || origin || 'https://meagendae.com.br';

async function findPrimarySubscriptionItem(admin: any, subscriptionId: string) {
  const subscription = await stripeRequest<any>(`/subscriptions/${subscriptionId}?expand[]=items.data.price`, { method: 'GET' });
  const { data: plans } = await admin
    .from('plans')
    .select('stripe_monthly_price_id, stripe_yearly_price_id')
    .eq('active', true);
  const planPriceIds = new Set<string>();
  for (const plan of plans || []) {
    if ((plan as any).stripe_monthly_price_id) planPriceIds.add((plan as any).stripe_monthly_price_id);
    if ((plan as any).stripe_yearly_price_id) planPriceIds.add((plan as any).stripe_yearly_price_id);
  }
  return subscription.items?.data?.find((item: any) => planPriceIds.has(item?.price?.id)) || subscription.items?.data?.[0] || null;
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: corsHeaders });
  if (req.method !== 'POST') {
    return new Response(JSON.stringify({ error: 'Method not allowed' }), { status: 405, ...responseHeaders });
  }

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
    const { companyId, planId, cycle = 'monthly', successUrl, cancelUrl, intentType } = await req.json();

    if (!companyId || !planId || !['monthly', 'yearly'].includes(cycle)) {
      return new Response(JSON.stringify({ error: 'Dados de checkout inválidos' }), { status: 400, ...responseHeaders });
    }

    const { data: company } = await admin
      .from('companies')
      .select('id, user_id, stripe_customer_id, stripe_subscription_id')
      .eq('id', companyId)
      .maybeSingle();

    if (!company || (company as any).user_id !== userId) {
      return new Response(JSON.stringify({ error: 'Forbidden' }), { status: 403, ...responseHeaders });
    }

    const { data: plan } = await admin
      .from('plans')
      .select('id, name, slug, stripe_monthly_price_id, stripe_yearly_price_id')
      .eq('id', planId)
      .eq('active', true)
      .maybeSingle();

    if (!plan) {
      return new Response(JSON.stringify({ error: 'Plano não encontrado' }), { status: 404, ...responseHeaders });
    }

    const priceId = cycle === 'yearly'
      ? (plan as any).stripe_yearly_price_id
      : (plan as any).stripe_monthly_price_id;

    if (!priceId) {
      return new Response(JSON.stringify({ error: 'Plano sem preço configurado no Stripe' }), { status: 400, ...responseHeaders });
    }

    const baseUrl = siteUrl(req.headers.get('origin'));
    if ((company as any).stripe_subscription_id) {
      const item = await findPrimarySubscriptionItem(admin, (company as any).stripe_subscription_id);
      if (!item?.id) {
        return new Response(JSON.stringify({ error: 'Assinatura Stripe sem item de plano para atualizar' }), { status: 400, ...responseHeaders });
      }

      const updateBody = new URLSearchParams();
      updateBody.set('items[0][id]', item.id);
      updateBody.set('items[0][price]', priceId);
      updateBody.set('metadata[company_id]', companyId);
      updateBody.set('metadata[plan_id]', (plan as any).id);
      updateBody.set('metadata[plan_slug]', (plan as any).slug || '');
      updateBody.set('metadata[billing_cycle]', cycle);
      updateBody.set('proration_behavior', intentType === 'downgrade' ? 'none' : 'create_prorations');

      await stripeRequest(`/subscriptions/${(company as any).stripe_subscription_id}`, {
        method: 'POST',
        body: updateBody,
      });

      await admin.from('companies').update({
        plan_id: (plan as any).id,
        billing_cycle: cycle,
        pending_plan_id: null,
        pending_billing_cycle: null,
        pending_change_at: null,
        updated_at: new Date().toISOString(),
      }).eq('id', companyId);

      return new Response(JSON.stringify({
        updated: true,
        url: successUrl || `${baseUrl}/checkout/success`,
      }), responseHeaders);
    }

    const body = new URLSearchParams();
    body.set('mode', 'subscription');
    body.set('success_url', successUrl || `${baseUrl}/checkout/success?session_id={CHECKOUT_SESSION_ID}`);
    body.set('cancel_url', cancelUrl || `${baseUrl}/settings/plans`);
    body.set('line_items[0][price]', priceId);
    body.set('line_items[0][quantity]', '1');
    body.set('client_reference_id', companyId);
    body.set('metadata[company_id]', companyId);
    body.set('metadata[user_id]', userId);
    body.set('metadata[plan_id]', (plan as any).id);
    body.set('metadata[plan_slug]', (plan as any).slug || '');
    body.set('metadata[billing_cycle]', cycle);
    body.set('metadata[intent_type]', intentType || 'subscribe');
    body.set('subscription_data[metadata][company_id]', companyId);
    body.set('subscription_data[metadata][plan_id]', (plan as any).id);
    body.set('subscription_data[metadata][plan_slug]', (plan as any).slug || '');
    body.set('subscription_data[metadata][billing_cycle]', cycle);
    body.set('allow_promotion_codes', 'true');

    if ((company as any).stripe_customer_id) {
      body.set('customer', (company as any).stripe_customer_id);
    } else {
      const email = claimsData.claims.email;
      if (email) body.set('customer_email', String(email));
    }

    const session = await stripeRequest<{ id: string; url: string }>('/checkout/sessions', {
      method: 'POST',
      body,
    });

    return new Response(JSON.stringify({ url: session.url, sessionId: session.id }), responseHeaders);
  } catch (error) {
    console.error('create-stripe-checkout error', error);
    return new Response(JSON.stringify({ error: String(error?.message || error) }), { status: 500, ...responseHeaders });
  }
});
