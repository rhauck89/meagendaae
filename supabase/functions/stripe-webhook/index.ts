import { createClient } from 'npm:@supabase/supabase-js@2';
import { stripeRequest, verifyStripeWebhook } from '../_shared/stripe.ts';

const supabase = createClient(
  Deno.env.get('SUPABASE_URL')!,
  Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
);

const GRACE_DAYS = 7;

Deno.serve(async (req) => {
  if (req.method !== 'POST') {
    return new Response('Method not allowed', { status: 405 });
  }

  let event: any;
  try {
    event = await verifyStripeWebhook(req);
  } catch (error) {
    console.error('Stripe webhook verify failed:', error);
    return new Response('Invalid signature', { status: 400 });
  }

  try {
    const { data: existing } = await supabase
      .from('subscription_events')
      .select('id')
      .eq('stripe_event_id', event.id)
      .maybeSingle();

    if (existing) {
      return new Response(JSON.stringify({ received: true, duplicate: true }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    switch (event.type) {
      case 'checkout.session.completed':
        await handleCheckoutCompleted(event);
        break;
      case 'customer.subscription.created':
      case 'customer.subscription.updated':
        await handleSubscription(event);
        break;
      case 'customer.subscription.deleted':
        await handleSubscriptionDeleted(event);
        break;
      case 'invoice.paid':
        await handleInvoicePaid(event);
        break;
      case 'invoice.payment_failed':
        await handleInvoicePaymentFailed(event);
        break;
      default:
        await logEvent(null, event, event.type, null);
    }

    return new Response(JSON.stringify({ received: true }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    });
  } catch (error) {
    console.error('Stripe webhook handler error:', error);
    return new Response('Webhook error', { status: 500 });
  }
});

async function retrieveSubscription(subscriptionId: string): Promise<any> {
  return await stripeRequest(`/subscriptions/${subscriptionId}?expand[]=items.data.price`, { method: 'GET' });
}

async function findCompanyId(payload: any): Promise<string | null> {
  const metadataCompanyId = payload?.metadata?.company_id || payload?.subscription_details?.metadata?.company_id;
  if (metadataCompanyId) return metadataCompanyId;

  if (payload?.client_reference_id) return payload.client_reference_id;

  const subscriptionId = typeof payload?.subscription === 'string' ? payload.subscription : payload?.id;
  if (subscriptionId) {
    const { data } = await supabase
      .from('companies')
      .select('id')
      .eq('stripe_subscription_id', subscriptionId)
      .maybeSingle();
    if (data?.id) return data.id;
  }

  const customerId = typeof payload?.customer === 'string' ? payload.customer : payload?.customer?.id;
  if (customerId) {
    const { data } = await supabase
      .from('companies')
      .select('id')
      .eq('stripe_customer_id', customerId)
      .maybeSingle();
    if (data?.id) return data.id;
  }

  return null;
}

async function findPlanByPrice(priceId: string): Promise<{ id: string; cycle: 'monthly' | 'yearly' } | null> {
  const { data: monthly } = await supabase
    .from('plans')
    .select('id')
    .eq('stripe_monthly_price_id', priceId)
    .maybeSingle();
  if (monthly?.id) return { id: monthly.id, cycle: 'monthly' };

  const { data: yearly } = await supabase
    .from('plans')
    .select('id')
    .eq('stripe_yearly_price_id', priceId)
    .maybeSingle();
  if (yearly?.id) return { id: yearly.id, cycle: 'yearly' };

  return null;
}

async function syncSubscriptionToCompany(subscription: any, companyIdHint?: string | null, event?: any) {
  const companyId = companyIdHint || await findCompanyId(subscription);
  if (!companyId) {
    console.error('No company found for Stripe subscription', subscription.id);
    return null;
  }

  const items = subscription.items?.data || [];
  let planMatch: { id: string; cycle: 'monthly' | 'yearly' } | null = null;

  for (const item of items) {
    const priceId = item?.price?.id;
    if (!priceId) continue;
    const match = await findPlanByPrice(priceId);
    if (match) {
      planMatch = match;
      break;
    }
  }

  const currentPeriodEnd = subscription.current_period_end
    ? new Date(subscription.current_period_end * 1000).toISOString()
    : null;
  const status = normalizeStatus(subscription.status);

  const update: any = {
    stripe_subscription_id: subscription.id,
    stripe_customer_id: typeof subscription.customer === 'string' ? subscription.customer : subscription.customer?.id,
    subscription_status: status,
    current_period_end: currentPeriodEnd,
    cancel_at_period_end: Boolean(subscription.cancel_at_period_end),
    updated_at: new Date().toISOString(),
  };

  if (planMatch) {
    update.plan_id = planMatch.id;
    update.billing_cycle = planMatch.cycle;
  }
  if (status === 'active' || status === 'trialing') {
    update.trial_active = false;
    update.grace_period_until = null;
  }

  await supabase.from('companies').update(update).eq('id', companyId);
  await syncMarketplaceModules(companyId, items);
  if (event) await logEvent(companyId, event, event.type, status, subscription);

  return companyId;
}

async function syncMarketplaceModules(companyId: string, items: any[]) {
  const priceIds = items.map((item) => item?.price?.id).filter(Boolean);
  if (priceIds.length === 0) return;

  const { data: modules } = await supabase
    .from('plan_modules')
    .select('id, stripe_monthly_price_id, stripe_yearly_price_id')
    .or(priceIds.map((id) => `stripe_monthly_price_id.eq.${id},stripe_yearly_price_id.eq.${id}`).join(','));

  for (const module of modules || []) {
    const item = items.find((entry) =>
      entry?.price?.id === (module as any).stripe_monthly_price_id ||
      entry?.price?.id === (module as any).stripe_yearly_price_id
    );
    if (!item) continue;

    await supabase.from('company_modules').upsert({
      company_id: companyId,
      module_id: (module as any).id,
      status: 'active',
      billing_cycle: item?.price?.recurring?.interval === 'year' ? 'yearly' : 'monthly',
      stripe_subscription_item_id: item.id,
    } as any, { onConflict: 'company_id,module_id' });
  }
}

function normalizeStatus(status: string): string {
  if (status === 'active') return 'active';
  if (status === 'trialing') return 'trialing';
  if (status === 'past_due') return 'past_due';
  if (status === 'unpaid') return 'unpaid';
  if (status === 'canceled') return 'canceled';
  return status || 'inactive';
}

async function handleCheckoutCompleted(event: any) {
  const session = event.data.object;
  const companyId = await findCompanyId(session);
  if (session.subscription) {
    const subscription = await retrieveSubscription(session.subscription);
    await syncSubscriptionToCompany(subscription, companyId, event);
    return;
  }
  await logEvent(companyId, event, event.type, session.payment_status);
}

async function handleSubscription(event: any) {
  await syncSubscriptionToCompany(event.data.object, null, event);
}

async function handleSubscriptionDeleted(event: any) {
  const subscription = event.data.object;
  const companyId = await findCompanyId(subscription);
  if (!companyId) return;

  await supabase.from('companies').update({
    subscription_status: 'canceled',
    cancel_at_period_end: false,
    updated_at: new Date().toISOString(),
  }).eq('id', companyId);

  await logEvent(companyId, event, event.type, 'canceled');
}

async function handleInvoicePaid(event: any) {
  const invoice = event.data.object;
  const companyId = await findCompanyId(invoice);
  if (!companyId) {
    await logEvent(null, event, event.type, 'paid');
    return;
  }

  if (invoice.subscription) {
    const subscription = await retrieveSubscription(invoice.subscription);
    await syncSubscriptionToCompany(subscription, companyId);
  }

  await supabase.from('companies').update({
    subscription_status: 'active',
    grace_period_until: null,
    updated_at: new Date().toISOString(),
  }).eq('id', companyId);

  await logEvent(companyId, event, event.type, 'paid');
}

async function handleInvoicePaymentFailed(event: any) {
  const invoice = event.data.object;
  const companyId = await findCompanyId(invoice);
  if (!companyId) {
    await logEvent(null, event, event.type, 'past_due');
    return;
  }

  const grace = new Date(Date.now() + GRACE_DAYS * 24 * 60 * 60 * 1000).toISOString();
  await supabase.from('companies').update({
    subscription_status: 'past_due',
    grace_period_until: grace,
    updated_at: new Date().toISOString(),
  }).eq('id', companyId);

  await logEvent(companyId, event, event.type, 'past_due');
}

async function logEvent(companyId: string | null, event: any, eventType: string, status: string | null, payloadOverride?: any) {
  await supabase.from('subscription_events').insert({
    company_id: companyId,
    event_type: eventType,
    stripe_event_id: event.id,
    stripe_subscription_id: event.data?.object?.subscription || event.data?.object?.id || null,
    stripe_customer_id: event.data?.object?.customer || null,
    status,
    environment: event.livemode ? 'live' : 'test',
    payload: payloadOverride || event.data?.object || event,
  } as any);
}
