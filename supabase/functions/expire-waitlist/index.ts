import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

    // Validate authorization
    const authHeader = req.headers.get("authorization") || "";
    const token = authHeader.replace("Bearer ", "");
    if (token !== serviceRoleKey) {
      const supabaseAuth = createClient(supabaseUrl, Deno.env.get("SUPABASE_ANON_KEY") || serviceRoleKey);
      const { data: { user }, error } = await supabaseAuth.auth.getUser(token);
      if (error || !user) {
        return new Response(
          JSON.stringify({ error: "Unauthorized" }),
          { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
    }

    const supabase = createClient(supabaseUrl, serviceRoleKey);

    // Expire waiting_list entries where desired_date < today
    const { data: wlExpired, error: wlErr } = await supabase
      .from("waiting_list")
      .update({ status: "expired" })
      .eq("status", "waiting")
      .lt("desired_date", new Date().toISOString().split("T")[0])
      .select("id");
    if (wlErr) console.error("waiting_list expire error:", wlErr);

    // Expire waitlist entries where desired_date < today
    const { data: wExpired, error: wErr } = await supabase
      .from("waitlist")
      .update({ status: "expired" })
      .eq("status", "active")
      .lt("desired_date", new Date().toISOString().split("T")[0])
      .select("id");
    if (wErr) console.error("waitlist expire error:", wErr);

    const expiredCount = (wlExpired?.length || 0) + (wExpired?.length || 0);
    console.log(`Expired ${expiredCount} waitlist entries`);

    return new Response(
      JSON.stringify({ success: true, expired: expiredCount }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("Error:", error);
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
