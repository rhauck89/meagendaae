import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const supabase = createClient(supabaseUrl, supabaseKey);

  const { data } = await supabase
    .from("platform_settings")
    .select("system_name, pwa_icon_192, pwa_icon_512, splash_background_color")
    .limit(1)
    .single();

  const name = data?.system_name || "Me Agendaê";
  const bgColor = data?.splash_background_color || "#0f2a5c";
  
  // Use stored URLs from platform_settings, fallback to default storage paths
  const icon192 = data?.pwa_icon_192 || `${supabaseUrl}/storage/v1/object/public/platform-assets/icone-192x192.png`;
  const icon512 = data?.pwa_icon_512 || `${supabaseUrl}/storage/v1/object/public/platform-assets/icone-512x512.png`;

  const manifest = {
    name,
    short_name: name,
    start_url: "/app",
    display: "standalone",
    background_color: bgColor,
    theme_color: bgColor,
    orientation: "portrait",
    icons: [
      { src: icon192, sizes: "192x192", type: "image/png" },
      { src: icon512, sizes: "512x512", type: "image/png" },
      { src: icon512, sizes: "512x512", type: "image/png", purpose: "maskable" },
    ],
  };

  return new Response(JSON.stringify(manifest), {
    headers: {
      ...corsHeaders,
      "Content-Type": "application/manifest+json",
      "Cache-Control": "public, max-age=3600",
    },
  });
});
