import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const DEFAULT_IMAGE = "https://pub-bb2e103a32db4e198524a2e9ed8f35b4.r2.dev/d9b74549-3439-429c-8cc2-b589a7b32707/id-preview-40d3c60f--caa8a21d-fa67-4281-b989-a8731f9674aa.lovable.app-1775051349372.png";
const DEFAULT_TITLE = "Me Agendaê | Agendamento Online";
const DEFAULT_DESC = "Plataforma de agendamento online para barbearias e estéticas. Gerencie sua agenda, equipe e clientes.";

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  const url = new URL(req.url);
  const path = url.searchParams.get('path') || url.pathname;
  console.log(`Handling path: ${path}`);
  
  const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
  const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
  const supabase = createClient(supabaseUrl, supabaseKey);

  const baseUrl = Deno.env.get('PUBLIC_SITE_URL') || 'https://meagendae.com.br';

  let meta = {
    title: DEFAULT_TITLE,
    description: DEFAULT_DESC,
    image: DEFAULT_IMAGE,
    url: `${baseUrl}${path}`,
  };

  try {
    // 1. Review / Reschedule / Cancel (/review/:id, /reschedule/:id, /cancel/:id)
    const appointmentMatch = path.match(/^\/(review|reschedule|cancel)\/([^\/]+)$/);
    if (appointmentMatch) {
      const [_, type, id] = appointmentMatch;
      console.log(`Appointment match: ${type}, id: ${id}`);
      
      const { data: appointment, error: apptError } = await supabase
        .from('appointments')
        .select('id, company_id, professional_id')
        .eq('id', id)
        .maybeSingle();

      if (apptError) {
        console.error('Appointment query error:', apptError);
      } else if (appointment) {
        console.log(`Found appointment: ${appointment.id}, company_id: ${appointment.company_id}`);
        
        // Fetch company
        const { data: company } = await supabase
          .from('companies')
          .select('name, logo_url, cover_url')
          .eq('id', appointment.company_id)
          .maybeSingle();
          
        // Fetch professional profile
        let professionalProfile = null;
        if (appointment.professional_id) {
          const { data: collaborator } = await supabase
            .from('collaborators')
            .select('profile_id')
            .eq('id', appointment.professional_id)
            .maybeSingle();
            
          if (collaborator?.profile_id) {
            const { data: profile } = await supabase
              .from('profiles')
              .select('full_name, avatar_url')
              .eq('id', collaborator.profile_id)
              .maybeSingle();
            professionalProfile = profile;
          }
        }

        if (company) {
          if (type === 'review') {
            meta.title = company.name;
            meta.description = "Avalie sua experiência conosco ⭐";
          } else if (type === 'reschedule') {
            meta.title = `Reagendar • ${company.name}`;
            meta.description = "Escolha um novo horário para seu agendamento.";
          } else {
            meta.title = `Cancelar • ${company.name}`;
            meta.description = "Deseja realmente cancelar seu agendamento?";
          }
          meta.image = professionalProfile?.avatar_url || company.cover_url || company.logo_url || DEFAULT_IMAGE;
        }
      }
    }

    // 2. Professional Profile (/perfil/:tipo/:companySlug/:professionalSlug)
    const profMatch = path.match(/^\/perfil\/(barbearia|estetica|salao|clinica)\/([^\/]+)\/([^\/]+)(\/agendar)?$/);
    if (profMatch) {
      const [_, tipo, companySlug, professionalSlug, isBooking] = profMatch;
      console.log(`Professional match: ${professionalSlug} in company ${companySlug}`);
      
      const { data: collaborator } = await supabase
        .from('collaborators')
        .select('profile_id, company_id')
        .eq('slug', professionalSlug)
        .maybeSingle();

      if (collaborator) {
        const { data: profile } = await supabase
          .from('profiles')
          .select('full_name, avatar_url, bio')
          .eq('id', collaborator.profile_id)
          .maybeSingle();
          
        const { data: company } = await supabase
          .from('companies')
          .select('name, logo_url, cover_url')
          .eq('id', collaborator.company_id)
          .maybeSingle();

        if (profile && company) {
          meta.title = isBooking 
            ? `Agende com ${profile.full_name} • ${company.name}`
            : `${profile.full_name} • ${company.name}`;
          meta.description = isBooking
            ? `Escolha seu melhor horário com ${profile.full_name}.`
            : (profile.bio || `Profissional especializado em ${company.name}.`);
          meta.image = profile.avatar_url || company.cover_url || company.logo_url || DEFAULT_IMAGE;
        }
      }
    }

    // 3. Company Profile (/:tipo/:slug or /:tipo/:slug/agendar)
    const reservedRoutes = ['app', 'auth', 'dashboard', 'admin', 'super-admin', 'my-appointments', 'minha-conta', 'cliente'];
    const companyMatch = path.match(/^\/(barbearia|estetica|salao|clinica)\/([^\/]+)(\/agendar)?$/);
    if (companyMatch && !reservedRoutes.includes(companyMatch[2])) {
      const [_, tipo, slug, isBooking] = companyMatch;
      console.log(`Company match: ${slug}`);
      
      const { data: company } = await supabase
        .from('companies')
        .select('name, logo_url, cover_url')
        .eq('slug', slug)
        .maybeSingle();

      if (company) {
        console.log(`Found company: ${company.name}`);
        meta.title = isBooking
          ? `Agende seu horário • ${company.name}`
          : company.name;
        meta.description = isBooking
          ? "Escolha serviço, profissional e horário em poucos segundos."
          : `Bem-vindo ao ${company.name}. Confira nossos serviços e agende seu horário online.`;
        meta.image = company.cover_url || company.logo_url || DEFAULT_IMAGE;
      }
    }
  } catch (e) {
    console.error('Error fetching SEO data:', e);
  }

  // Fetch index.html from main site
  let html = "";
  try {
    const response = await fetch(baseUrl, {
      headers: {
        'User-Agent': 'Lovable-SEO-Bot/1.0',
      }
    });
    html = await response.text();
  } catch (e) {
    console.error('Error fetching base HTML:', e);
    html = `<!DOCTYPE html><html><head><title>${meta.title}</title></head><body><div id="root"></div></body></html>`;
  }

  // Inject meta tags
  const tags = `
    <title>${meta.title}</title>
    <meta name="description" content="${meta.description}">
    <meta property="og:title" content="${meta.title}">
    <meta property="og:description" content="${meta.description}">
    <meta property="og:image" content="${meta.image}">
    <meta property="og:url" content="${meta.url}">
    <meta property="og:type" content="website">
    <meta name="twitter:card" content="summary_large_image">
    <meta name="twitter:title" content="${meta.title}">
    <meta name="twitter:description" content="${meta.description}">
    <meta name="twitter:image" content="${meta.image}">
  `;

  // Remove existing to avoid duplicates
  const cleanHtml = html
    .replace(/<title>.*?<\/title>/gi, '')
    .replace(/<meta name="description" content=".*?">/gi, '')
    .replace(/<meta property="og:title" content=".*?">/gi, '')
    .replace(/<meta property="og:description" content=".*?">/gi, '')
    .replace(/<meta property="og:image" content=".*?">/gi, '')
    .replace(/<meta property="og:url" content=".*?">/gi, '')
    .replace(/<meta name="twitter:title" content=".*?">/gi, '')
    .replace(/<meta name="twitter:description" content=".*?">/gi, '')
    .replace(/<meta name="twitter:image" content=".*?">/gi, '')
    .replace(/<meta name="twitter:card" content=".*?">/gi, '');

  const finalHtml = cleanHtml.replace('<head>', `<head>${tags}`);

  return new Response(finalHtml, {
    headers: {
      ...corsHeaders,
      'Content-Type': 'text/html; charset=utf-8',
      'Cache-Control': 'public, max-age=300',
    },
  });
});
