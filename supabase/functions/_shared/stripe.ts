export const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, stripe-signature',
};

const STRIPE_API_BASE = 'https://api.stripe.com/v1';

export function getStripeSecretKey(): string {
  const key = Deno.env.get('STRIPE_SECRET_KEY');
  if (!key) throw new Error('STRIPE_SECRET_KEY is not configured');
  return key;
}

export async function stripeRequest<T>(
  path: string,
  init: RequestInit & { body?: URLSearchParams } = {},
): Promise<T> {
  const response = await fetch(`${STRIPE_API_BASE}${path}`, {
    ...init,
    headers: {
      Authorization: `Bearer ${getStripeSecretKey()}`,
      'Content-Type': 'application/x-www-form-urlencoded',
      ...(init.headers || {}),
    },
    body: init.body?.toString(),
  });

  const payload = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(payload?.error?.message || `Stripe request failed with ${response.status}`);
  }

  return payload as T;
}

function timingSafeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let mismatch = 0;
  for (let i = 0; i < a.length; i += 1) {
    mismatch |= a.charCodeAt(i) ^ b.charCodeAt(i);
  }
  return mismatch === 0;
}

async function hmacSha256Hex(secret: string, payload: string): Promise<string> {
  const encoder = new TextEncoder();
  const key = await crypto.subtle.importKey(
    'raw',
    encoder.encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign'],
  );
  const signature = await crypto.subtle.sign('HMAC', key, encoder.encode(payload));
  return [...new Uint8Array(signature)]
    .map((byte) => byte.toString(16).padStart(2, '0'))
    .join('');
}

export async function verifyStripeWebhook(req: Request): Promise<any> {
  const signatureHeader = req.headers.get('stripe-signature');
  const webhookSecret = Deno.env.get('STRIPE_WEBHOOK_SECRET');
  const rawBody = await req.text();

  if (!webhookSecret) {
    throw new Error('STRIPE_WEBHOOK_SECRET is not configured');
  }
  if (!signatureHeader) {
    throw new Error('Missing Stripe-Signature header');
  }

  const parts = signatureHeader.split(',').reduce<Record<string, string[]>>((acc, part) => {
    const [key, value] = part.split('=');
    if (!key || !value) return acc;
    acc[key] = [...(acc[key] || []), value];
    return acc;
  }, {});

  const timestamp = parts.t?.[0];
  const signatures = parts.v1 || [];
  if (!timestamp || signatures.length === 0) {
    throw new Error('Invalid Stripe-Signature header');
  }

  const expected = await hmacSha256Hex(webhookSecret, `${timestamp}.${rawBody}`);
  const isValid = signatures.some((signature) => timingSafeEqual(signature, expected));
  if (!isValid) {
    throw new Error('Invalid Stripe webhook signature');
  }

  return JSON.parse(rawBody);
}
