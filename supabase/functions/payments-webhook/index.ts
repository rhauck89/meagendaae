import { createClient } from 'npm:@supabase/supabase-js@2';
import { verifyWebhook, EventName, type PaddleEnv } from '../_shared/paddle.ts';

const supabase = createClient(
  Deno.env.get('SUPABASE_URL')!,
  Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
);

const GRACE_DAYS = 7;

Deno.serve(async (req) => {
  if (req.method !== 'POST') {
    return new Response('Method not allowed', { status: 405 });
  }

  const url = new URL(req.url);
  const env = (url.searchParams.get('env') || 'sandbox') as PaddleEnv;

  let event;
  try {
    event = await verifyWebhook(req, env);
  } catch (e) {
    console.error('Webhook verify failed:', e);
    return new Response('Invalid signature', { status: 400 });
  }

  console.log('paddle event:', event.eventType, 'id:', (event as any).eventId, 'env:', env);

  try {
    // Idempotency: skip if event already processed
    const eventId = (event as any).eventId;
    if (eventId) {
      const { data: existing } = await supabase
        .from('subscription_events')
        .select('id')
        .eq('paddle_event_id', eventId)
        .maybeSingle();
      if (existing) {
        console.log('Event already processed:', eventId);
        return new Response(JSON.stringify({ received: true, duplicate: true }), {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        });
      }
    }

    switch (event.eventType) {
      case EventName.SubscriptionCreated:
      case EventName.SubscriptionUpdated:
        await handleSubscription(event.data, env, eventId, event.eventType);
        break;
      case EventName.SubscriptionCanceled:
        await handleCanceled(event.data, env, eventId);
        break;
      case EventName.TransactionCompleted:
        await handlePaymentSuccess(event.data, env, eventId);
        break;
      case EventName.TransactionPaymentFailed:
        await handlePaymentFailed(event.data, env, eventId);
        break;
      default:
        console.log('Unhandled:', event.eventType);
    }

    return new Response(JSON.stringify({ received: true }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    });
  } catch (e) {
    console.error('Webhook handler error:', e);
    return new Response('Webhook error', { status: 500 });
  }
});

async function findCompanyId(data: any): Promise<string | null> {
  const fromCustomData = data.customData?.companyId;
  if (fromCustomData) return fromCustomData;

  if (data.id) {
    const { data: byPaddleSub } = await supabase
      .from('companies')
      .select('id')
      .eq('paddle_subscription_id', data.id)
      .maybeSingle();
    if (byPaddleSub) return byPaddleSub.id;
  }

  if (data.subscriptionId) {
    const { data: bySub } = await supabase
      .from('companies')
      .select('id')
      .eq('paddle_subscription_id', data.subscriptionId)
      .maybeSingle();
    if (bySub) return bySub.id;
  }

  if (data.customerId) {
    const { data: byCust } = await supabase
      .from('companies')
      .select('id')
      .eq('paddle_customer_id', data.customerId)
      .maybeSingle();
    if (byCust) return byCust.id;
  }
  return null;
}

async function findPlanIdByPriceExternalId(priceExternalId: string, cycle: 'monthly' | 'yearly'): Promise<string | null> {
  const col = cycle === 'monthly' ? 'paddle_monthly_price_id' : 'paddle_yearly_price_id';
  const { data } = await supabase.from('plans').select('id').eq(col, priceExternalId).maybeSingle();
  return data?.id ?? null;
}

async function handleSubscription(data: any, env: PaddleEnv, eventId: string | undefined, eventType: string) {
  const companyId = await findCompanyId(data);
  if (!companyId) {
    console.error('No company found for subscription', data.id);
    return;
  }

  const item = data.items?.[0];
  const priceExt: string = item?.price?.importMeta?.externalId ?? item?.price?.id ?? '';
  const cycle: 'monthly' | 'yearly' = item?.price?.billingCycle?.interval === 'year' ? 'yearly' : 'monthly';
  const planId = priceExt ? await findPlanIdByPriceExternalId(priceExt, cycle) : null;

  const status = data.status; // active | trialing | past_due | paused | canceled
  const currentPeriodEnd = data.currentBillingPeriod?.endsAt ?? null;
  const cancelAtPeriodEnd = data.scheduledChange?.action === 'cancel';

  const update: any = {
    paddle_subscription_id: data.id,
    paddle_customer_id: data.customerId,
    subscription_status: status,
    billing_cycle: cycle,
    current_period_end: currentPeriodEnd,
    cancel_at_period_end: cancelAtPeriodEnd,
    updated_at: new Date().toISOString(),
  };

  // Activating subscription clears trial and grace period
  if (status === 'active') {
    update.trial_active = false;
    update.grace_period_until = null;
  }
  if (planId) update.plan_id = planId;

  await supabase.from('companies').update(update).eq('id', companyId);

  await supabase.from('subscription_events').insert({
    company_id: companyId,
    event_type: eventType,
    paddle_event_id: eventId,
    paddle_subscription_id: data.id,
    paddle_customer_id: data.customerId,
    status,
    environment: env,
    payload: data as any,
  });
}

async function handleCanceled(data: any, env: PaddleEnv, eventId: string | undefined) {
  const companyId = await findCompanyId(data);
  if (!companyId) return;

  await supabase.from('companies').update({
    subscription_status: 'canceled',
    cancel_at_period_end: true,
    updated_at: new Date().toISOString(),
  }).eq('id', companyId);

  await supabase.from('subscription_events').insert({
    company_id: companyId,
    event_type: 'subscription.canceled',
    paddle_event_id: eventId,
    paddle_subscription_id: data.id,
    status: 'canceled',
    environment: env,
    payload: data as any,
  });
}

async function handlePaymentSuccess(data: any, env: PaddleEnv, eventId: string | undefined) {
  const companyId = await findCompanyId(data);
  if (!companyId) return;

  // Successful payment clears past_due / grace
  await supabase.from('companies').update({
    subscription_status: 'active',
    grace_period_until: null,
    updated_at: new Date().toISOString(),
  }).eq('id', companyId).in('subscription_status', ['past_due', 'unpaid', 'trialing', 'expired_trial']);

  await supabase.from('subscription_events').insert({
    company_id: companyId,
    event_type: 'transaction.completed',
    paddle_event_id: eventId,
    paddle_subscription_id: data.subscriptionId,
    paddle_customer_id: data.customerId,
    status: 'paid',
    environment: env,
    payload: data as any,
  });
}

async function handlePaymentFailed(data: any, env: PaddleEnv, eventId: string | undefined) {
  const companyId = await findCompanyId(data);
  if (!companyId) return;

  // Set 7-day grace period
  const grace = new Date(Date.now() + GRACE_DAYS * 24 * 60 * 60 * 1000).toISOString();

  await supabase.from('companies').update({
    subscription_status: 'past_due',
    grace_period_until: grace,
    updated_at: new Date().toISOString(),
  }).eq('id', companyId);

  await supabase.from('subscription_events').insert({
    company_id: companyId,
    event_type: 'transaction.payment_failed',
    paddle_event_id: eventId,
    paddle_subscription_id: data.subscriptionId,
    paddle_customer_id: data.customerId,
    status: 'past_due',
    environment: env,
    payload: data as any,
  });
}
