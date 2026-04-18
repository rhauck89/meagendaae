import { gatewayFetch, type PaddleEnv, corsHeaders } from '../_shared/paddle.ts';

const responseHeaders = {
  headers: { ...corsHeaders, 'Content-Type': 'application/json' },
};

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { priceId, environment } = await req.json();
    if (!priceId) {
      return new Response(JSON.stringify({ error: 'priceId required' }), { status: 400, ...responseHeaders });
    }

    const env = (environment === 'live' ? 'live' : 'sandbox') as PaddleEnv;
    const response = await gatewayFetch(env, `/prices?external_id=${encodeURIComponent(priceId)}`);
    const data = await response.json();

    if (!data.data?.length) {
      return new Response(JSON.stringify({ error: 'Price not found' }), { status: 404, ...responseHeaders });
    }

    return new Response(JSON.stringify({ paddleId: data.data[0].id }), responseHeaders);
  } catch (e) {
    console.error('get-paddle-price error', e);
    return new Response(JSON.stringify({ error: String(e) }), { status: 500, ...responseHeaders });
  }
});
