import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Content-Type': 'application/xml; charset=utf-8',
  'Cache-Control': 'public, max-age=3600',
};

Deno.serve(async (req) => {
  const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
  const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
  const supabase = createClient(supabaseUrl, supabaseKey);

  const origin = req.headers.get('origin') || supabaseUrl.replace('/rest/v1', '').replace('https://', 'https://');
  // Use the app's public URL
  const baseUrl = Deno.env.get('PUBLIC_SITE_URL') || 'https://agendapro.com';

  // Fetch all active companies
  const { data: companies } = await supabase
    .from('companies')
    .select('slug, updated_at')
    .in('subscription_status', ['active', 'trial']);

  // Fetch all active professionals with their company slugs
  const { data: professionals } = await supabase
    .from('collaborators')
    .select('slug, company_id')
    .eq('active', true)
    .not('slug', 'is', null);

  let companySlugsMap: Record<string, string> = {};
  if (companies) {
    for (const c of companies) {
      companySlugsMap[c.slug] = c.updated_at;
    }
  }

  // Get company slugs for professionals
  const companyIds = [...new Set((professionals || []).map(p => p.company_id))];
  let companyIdToSlug: Record<string, string> = {};
  if (companyIds.length > 0) {
    const { data: compList } = await supabase
      .from('companies')
      .select('id, slug')
      .in('id', companyIds);
    if (compList) {
      for (const c of compList) {
        companyIdToSlug[c.id] = c.slug;
      }
    }
  }

  const now = new Date().toISOString().split('T')[0];

  let urls = `  <url>
    <loc>${baseUrl}/</loc>
    <lastmod>${now}</lastmod>
    <changefreq>weekly</changefreq>
    <priority>1.0</priority>
  </url>`;

  // Company pages
  if (companies) {
    for (const c of companies) {
      urls += `
  <url>
    <loc>${baseUrl}/barbearia/${c.slug}</loc>
    <lastmod>${c.updated_at?.split('T')[0] || now}</lastmod>
    <changefreq>weekly</changefreq>
    <priority>0.8</priority>
  </url>`;
    }
  }

  // Professional pages
  if (professionals) {
    for (const p of professionals) {
      const compSlug = companyIdToSlug[p.company_id];
      if (compSlug && p.slug) {
        urls += `
  <url>
    <loc>${baseUrl}/barbearia/${compSlug}/${p.slug}</loc>
    <changefreq>weekly</changefreq>
    <priority>0.7</priority>
  </url>`;
      }
    }
  }

  const xml = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${urls}
</urlset>`;

  return new Response(xml, { headers: corsHeaders });
});
