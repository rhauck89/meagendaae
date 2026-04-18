import { createClient } from 'npm:@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-cron-secret',
};

const supabase = createClient(
  Deno.env.get('SUPABASE_URL')!,
  Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
);

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: corsHeaders });

  // 🔒 Validate shared cron secret
  const expected = Deno.env.get('CRON_SECRET');
  const provided = req.headers.get('x-cron-secret');

  if (!expected) {
    console.error('CRON_SECRET not configured in edge function environment');
    return new Response(JSON.stringify({ error: 'Server misconfiguration' }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }

  if (!provided || provided !== expected) {
    console.warn('apply-pending-plans: rejected request without valid X-Cron-Secret');
    return new Response(JSON.stringify({ error: 'Unauthorized' }), {
      status: 401,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }

  try {
    const { data: pending, error: e1 } = await supabase.rpc('apply_pending_plan_changes');
    if (e1) throw e1;
    const { data: expired, error: e2 } = await supabase.rpc('expire_trials_and_grace');
    if (e2) throw e2;

    return new Response(JSON.stringify({ pending, expired }), {
      status: 200,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (e) {
    console.error('apply-pending-plans error', e);
    return new Response(JSON.stringify({ error: String(e) }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
