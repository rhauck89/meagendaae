import { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Star, MessageCircle, MapPin, Calendar, Clock, Scissors, Sparkles, Users } from 'lucide-react';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { cn } from '@/lib/utils';
import { formatWhatsApp } from '@/lib/whatsapp';
import { PlatformBranding } from '@/components/PlatformBranding';

type BusinessType = 'barbershop' | 'esthetic';

interface BarbershopLandingProps {
  routeBusinessType?: BusinessType;
}

const StarRating = ({ rating, size = 14 }: { rating: number; size?: number }) => (
  <div className="flex items-center gap-0.5">
    {[1, 2, 3, 4, 5].map((s) => {
      const fill = rating >= s ? 1 : rating >= s - 0.5 ? 0.5 : 0;
      return (
        <svg key={s} width={size} height={size} viewBox="0 0 24 24" fill="none">
          <defs>
            <linearGradient id={`land-star-${s}-${size}`}>
              <stop offset={`${fill * 100}%`} stopColor="#FDBA2D" />
              <stop offset={`${fill * 100}%`} stopColor="#374151" />
            </linearGradient>
          </defs>
          <path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z" fill={`url(#land-star-${s}-${size})`} />
        </svg>
      );
    })}
  </div>
);

export default function BarbershopLanding({ routeBusinessType }: BarbershopLandingProps) {
  const { slug } = useParams<{ slug: string }>();
  const navigate = useNavigate();

  const [company, setCompany] = useState<any>(null);
  const [professionals, setProfessionals] = useState<any[]>([]);
  const [services, setServices] = useState<any[]>([]);
  const [reviews, setReviews] = useState<any[]>([]);
  const [companyStats, setCompanyStats] = useState<{ avgRating: number; reviewCount: number } | null>(null);
  const [professionalRatings, setProfessionalRatings] = useState<Record<string, { avg: number; count: number }>>({});
  const [businessType, setBusinessType] = useState<BusinessType>('barbershop');
  const [loading, setLoading] = useState(true);
  const [companySettings, setCompanySettings] = useState<any>(null);
  const [galleryImages, setGalleryImages] = useState<any[]>([]);
  const [showAllReviews, setShowAllReviews] = useState(false);
  const [allReviewsList, setAllReviewsList] = useState<any[]>([]);

  const isDark = businessType === 'barbershop';

  const T = isDark
    ? { bg: '#0B132B', card: '#111827', accent: '#F59E0B', accentHover: '#D97706', text: '#FFFFFF', textSec: '#9CA3AF', border: '#1F2937' }
    : { bg: 'linear-gradient(180deg, #FFF7ED, #FFFFFF)', card: '#FFFFFF', accent: '#D97706', accentHover: '#B45309', text: '#1F2937', textSec: '#6B7280', border: '#E5E7EB' };

  useEffect(() => { if (slug) load(); }, [slug]);

  const load = async () => {
    setLoading(true);
    const { data: compArr } = await supabase.rpc('get_company_by_slug', { _slug: slug! });
    const comp = compArr?.[0];
    if (!comp) { setLoading(false); return; }
    setCompany(comp);
    const resolvedType: BusinessType = routeBusinessType || comp.business_type || 'barbershop';
    setBusinessType(resolvedType);

    const [servicesRes, profsRes, ratingsRes, reviewsRes, settingsRes, galleryRes] = await Promise.all([
      supabase.from('public_services' as any).select('*').eq('company_id', comp.id).order('name'),
      supabase.from('public_professionals' as any).select('*').eq('company_id', comp.id).eq('active', true),
      supabase.rpc('get_professional_ratings' as any, { p_company_id: comp.id }),
      supabase.from('reviews').select('rating, comment, created_at, professional_id, appointment_id').eq('company_id', comp.id).order('created_at', { ascending: false }),
      supabase.from('company_settings' as any).select('*').eq('company_id', comp.id).single(),
      supabase.from('company_gallery' as any).select('*').eq('company_id', comp.id).order('sort_order'),
    ]);

    if (servicesRes.data) setServices(servicesRes.data as any[]);
    if (profsRes.data) setProfessionals(profsRes.data as any[]);
    if (settingsRes.data) setCompanySettings(settingsRes.data);
    if (galleryRes.data) setGalleryImages(galleryRes.data as any[]);

    // Ratings map
    if (ratingsRes.data && Array.isArray(ratingsRes.data)) {
      const map: Record<string, { avg: number; count: number }> = {};
      for (const r of ratingsRes.data as any[]) {
        map[r.professional_id] = { avg: Number(r.avg_rating), count: Number(r.review_count) };
      }
      setProfessionalRatings(map);
    }

    // Enrich reviews with client names from appointments
    let enrichedReviews: any[] = [];
    if (reviewsRes.data && reviewsRes.data.length > 0) {
      const appointmentIds = reviewsRes.data
        .filter((r: any) => r.appointment_id)
        .map((r: any) => r.appointment_id);
      
      let clientNameMap: Record<string, string> = {};
      if (appointmentIds.length > 0) {
        const { data: appts } = await supabase
          .from('appointments')
          .select('id, client_name, client_id')
          .in('id', appointmentIds);
        
        if (appts) {
          // Get client names from clients table for those with client_id
          const clientIds = appts.filter((a: any) => a.client_id).map((a: any) => a.client_id);
          let clientNames: Record<string, string> = {};
          if (clientIds.length > 0) {
            const { data: clients } = await supabase
              .from('clients')
              .select('id, name')
              .in('id', clientIds);
            if (clients) {
              for (const c of clients) {
                clientNames[c.id] = c.name;
              }
            }
          }
          
          for (const a of appts) {
            const name = a.client_name || clientNames[a.client_id] || null;
            if (name) clientNameMap[a.id] = name;
          }
        }
      }
      
      enrichedReviews = reviewsRes.data.map((r: any) => ({
        ...r,
        client_display_name: r.appointment_id && clientNameMap[r.appointment_id]
          ? formatReviewerName(clientNameMap[r.appointment_id])
          : null,
      }));
    }

    // Company-level stats
    const revs = enrichedReviews;
    if (revs.length > 0) {
      const avg = revs.reduce((sum: number, r: any) => sum + Number(r.rating), 0) / revs.length;
      setCompanyStats({ avgRating: avg, reviewCount: revs.length });
    }

    setAllReviewsList(enrichedReviews);
    setReviews(enrichedReviews.slice(0, 3));
    setLoading(false);
  };

  const bookingBasePath = businessType === 'esthetic' ? 'estetica' : 'barbearia';
  const companyWhatsapp = company?.phone ? formatWhatsApp(company.phone) : null;

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center" style={{ background: isDark ? '#0B132B' : '#FFF7ED' }}>
        <div className="animate-pulse flex flex-col items-center gap-4">
          <div className="w-24 h-24 rounded-full" style={{ background: isDark ? '#1F2937' : '#FED7AA' }} />
          <div className="h-4 w-48 rounded" style={{ background: isDark ? '#1F2937' : '#FED7AA' }} />
        </div>
      </div>
    );
  }

  if (!company) {
    return (
      <div className="min-h-screen flex items-center justify-center" style={{ background: isDark ? '#0B132B' : '#FFF7ED' }}>
        <p className="text-lg" style={{ color: isDark ? '#9CA3AF' : '#6B7280' }}>Empresa não encontrada.</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen" style={{ background: isDark ? T.bg : T.bg }}>
      {/* 1) Cover Image */}
      {company.cover_url && (
        <div className="w-full h-44 sm:h-56 overflow-hidden">
          <img src={company.cover_url} alt={company.name} className="w-full h-full object-cover" />
        </div>
      )}

      {/* 2) Logo + 3) Company Name + 4) Rating */}
      <div className="max-w-lg mx-auto px-4 flex flex-col items-center gap-4" style={{ paddingTop: company.cover_url ? '1rem' : '2rem' }}>
        {/* Logo */}
        {company.logo_url && (
          <div style={{ marginTop: company.cover_url ? '-2.5rem' : '0' }}>
            <img
              src={company.logo_url}
              alt={company.name}
              className="max-h-[72px] max-w-[180px] object-contain drop-shadow-lg"
              style={{ background: isDark ? 'rgba(17,24,39,0.8)' : 'rgba(255,255,255,0.8)', borderRadius: '12px', padding: '8px' }}
            />
          </div>
        )}

        <div className="text-center">
          <h1 className="text-2xl font-bold" style={{ color: T.text }}>{company.name}</h1>
          {company.address && (
            <p className="text-sm mt-1" style={{ color: T.textSec }}>📍 {company.address}</p>
          )}
        </div>

        {/* Rating Summary */}
        {companyStats && companyStats.reviewCount > 0 && (
          <div className="flex items-center gap-2">
            <StarRating rating={companyStats.avgRating} size={16} />
            <span className="text-sm font-semibold" style={{ color: '#FDBA2D' }}>{companyStats.avgRating.toFixed(1)}</span>
            <span className="text-xs" style={{ color: T.textSec }}>({companyStats.reviewCount} avaliações)</span>
          </div>
        )}

        {/* 5) Primary Buttons */}
        <div className="w-full max-w-xs flex flex-col gap-3 mt-2">
          <Button
            onClick={() => navigate(`/${bookingBasePath}/${slug}/agendar`)}
            className="w-full h-12 text-base font-semibold rounded-xl shadow-lg transition-all hover:scale-105"
            style={{ background: T.accent, color: '#0B132B' }}
          >
            <Calendar className="w-5 h-5 mr-2" />
            Agendar horário
          </Button>

          {companyWhatsapp && (
            <a
              href={`https://wa.me/${companyWhatsapp}?text=${encodeURIComponent(`Olá! Vi a página da ${company.name} e gostaria de mais informações.`)}`}
              target="_blank"
              rel="noopener noreferrer"
              className="w-full flex items-center justify-center gap-2 h-11 rounded-xl border text-sm font-medium transition-colors hover:opacity-90"
              style={{
                borderColor: '#25D366',
                background: isDark ? 'rgba(37,211,102,0.1)' : 'rgba(37,211,102,0.08)',
                color: '#25D366',
              }}
            >
              <MessageCircle className="w-4 h-4" />
              Chamar no WhatsApp
            </a>
          )}
        </div>
      </div>

      <div className="max-w-lg mx-auto px-4 py-8 space-y-8">
        {/* 6) Team Section */}
        {professionals.length > 0 && (
          <section>
            <div className="flex items-center gap-2 mb-4">
              <Users className="w-5 h-5" style={{ color: T.accent }} />
              <h2 className="text-lg font-bold" style={{ color: T.text }}>Nossa Equipe</h2>
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
              {professionals.map((p: any) => {
                const rating = professionalRatings[p.id];
                return (
                  <div
                    key={p.id}
                    className="flex flex-col items-center gap-2 p-4 rounded-2xl transition-all hover:scale-[1.02]"
                    style={{ background: T.card, border: `1px solid ${T.border}` }}
                  >
                    {p.avatar_url ? (
                      <img src={p.avatar_url} alt={p.name} className="w-16 h-16 rounded-full object-cover" style={{ border: `2px solid ${T.accent}` }} />
                    ) : (
                      <div className="w-16 h-16 rounded-full flex items-center justify-center text-xl font-bold" style={{ background: `${T.accent}20`, color: T.accent }}>
                        {p.name?.charAt(0)?.toUpperCase()}
                      </div>
                    )}
                    <p className="text-sm font-semibold text-center truncate w-full" style={{ color: T.text }}>{p.name}</p>
                    {rating && rating.count > 0 && (
                      <div className="flex items-center gap-1">
                        <Star className="w-3 h-3 fill-yellow-400 text-yellow-400" />
                        <span className="text-xs font-medium" style={{ color: '#FDBA2D' }}>{rating.avg.toFixed(1)}</span>
                      </div>
                    )}
                    <Button
                      onClick={() => {
                        if (p.slug) {
                          navigate(`/${bookingBasePath}/${slug}/${p.slug}/agendar`);
                        } else {
                          navigate(`/${bookingBasePath}/${slug}/agendar`);
                        }
                      }}
                      className="w-full h-8 text-xs font-medium rounded-lg"
                      style={{ background: `${T.accent}20`, color: T.accent }}
                    >
                      Ver agenda
                    </Button>
                  </div>
                );
              })}
            </div>
          </section>
        )}

        {/* 7) Services List */}
        {services.length > 0 && (
          <section>
            <div className="flex items-center gap-2 mb-4">
              {isDark ? <Scissors className="w-5 h-5" style={{ color: T.accent }} /> : <Sparkles className="w-5 h-5" style={{ color: T.accent }} />}
              <h2 className="text-lg font-bold" style={{ color: T.text }}>Serviços</h2>
            </div>
            <div className="flex flex-col gap-2">
              {services.map((svc: any) => (
                <div
                  key={svc.id}
                  className="flex items-center justify-between p-3 rounded-xl"
                  style={{ background: T.card, border: `1px solid ${T.border}` }}
                >
                  <div>
                    <p className="text-sm font-medium" style={{ color: T.text }}>{svc.name}</p>
                    <div className="flex items-center gap-2 mt-0.5">
                      <Clock className="w-3 h-3" style={{ color: T.textSec }} />
                      <span className="text-xs" style={{ color: T.textSec }}>{svc.duration_minutes}min</span>
                    </div>
                  </div>
                  <span className="text-sm font-semibold" style={{ color: T.accent }}>
                    R$ {Number(svc.price).toFixed(2)}
                  </span>
                </div>
              ))}
            </div>
          </section>
        )}

        {/* 8) Reviews */}
        {reviews.length > 0 && (
          <section>
            <div className="flex items-center gap-2 mb-4">
              <Star className="w-5 h-5" style={{ color: '#FDBA2D' }} />
              <h2 className="text-lg font-bold" style={{ color: T.text }}>Avaliações</h2>
            </div>
            <div className="flex flex-col gap-3">
              {reviews.map((rev: any, i: number) => (
                <div
                  key={i}
                  className="p-3 rounded-xl"
                  style={{ background: T.card, border: `1px solid ${T.border}` }}
                >
                  <div className="flex items-center gap-1 mb-1">
                    {[1, 2, 3, 4, 5].map(s => (
                      <Star key={s} className={cn("w-3 h-3", s <= rev.rating ? "fill-yellow-400 text-yellow-400" : "text-gray-600")} />
                    ))}
                    <span className="text-xs ml-2" style={{ color: T.textSec }}>
                      {format(new Date(rev.created_at), 'dd/MM/yyyy')}
                    </span>
                  </div>
                  {rev.comment && (
                    <p className="text-xs leading-relaxed" style={{ color: isDark ? '#D1D5DB' : '#4B5563' }}>
                      "{rev.comment}"
                    </p>
                  )}
                </div>
              ))}
            </div>
          </section>
        )}

        {/* 9) Address & Map */}
        {company.address && (
          <section>
            <div className="flex items-center gap-2 mb-4">
              <MapPin className="w-5 h-5" style={{ color: '#EF4444' }} />
              <h2 className="text-lg font-bold" style={{ color: T.text }}>Localização</h2>
            </div>
            <a
              href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(company.address)}`}
              target="_blank"
              rel="noopener noreferrer"
              className="block rounded-xl overflow-hidden transition-transform hover:scale-[1.01]"
              style={{ border: `1px solid ${T.border}` }}
            >
              <img
                src={`https://maps.googleapis.com/maps/api/staticmap?center=${encodeURIComponent(company.address)}&zoom=15&size=400x180&scale=2&maptype=roadmap&markers=color:red%7C${encodeURIComponent(company.address)}&style=feature:all%7Celement:geometry%7Ccolor:${isDark ? '0x1a1a2e' : '0xf5f5f5'}&style=feature:water%7Celement:geometry%7Ccolor:${isDark ? '0x0d1b2a' : '0xc9d6ff'}&key=`}
                alt="Mapa"
                className="w-full h-[140px] object-cover"
                style={{ background: isDark ? '#1F2937' : '#F3F4F6' }}
                onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }}
              />
              <div className="p-3" style={{ background: T.card }}>
                <p className="text-sm font-medium" style={{ color: T.text }}>📍 {company.name}</p>
                <p className="text-xs mt-0.5" style={{ color: T.textSec }}>{company.address}</p>
                <p className="text-xs mt-2 font-medium" style={{ color: T.accent }}>Abrir no Google Maps →</p>
              </div>
            </a>
          </section>
        )}

        {/* 10) Photo Gallery - Placeholder */}
        {/* Gallery images would come from a company_photos table - shown as placeholder if cover exists */}
        {company.cover_url && (
          <section>
            <div className="flex items-center gap-2 mb-4">
              <Sparkles className="w-5 h-5" style={{ color: T.accent }} />
              <h2 className="text-lg font-bold" style={{ color: T.text }}>Galeria</h2>
            </div>
            <div className="grid grid-cols-2 gap-2">
              <div className="rounded-xl overflow-hidden aspect-square">
                <img src={company.cover_url} alt="Galeria" className="w-full h-full object-cover" />
              </div>
              {company.logo_url && (
                <div className="rounded-xl overflow-hidden aspect-square flex items-center justify-center" style={{ background: T.card, border: `1px solid ${T.border}` }}>
                  <img src={company.logo_url} alt="Logo" className="max-h-[60%] max-w-[80%] object-contain" />
                </div>
              )}
            </div>
          </section>
        )}

        {/* Footer */}
        <div className="flex flex-col items-center gap-3 pt-4">
          <Button
            onClick={() => navigate(`/${bookingBasePath}/${slug}/agendar`)}
            className="w-full max-w-xs h-12 text-base font-semibold rounded-xl shadow-lg"
            style={{ background: T.accent, color: '#0B132B' }}
          >
            <Calendar className="w-5 h-5 mr-2" />
            Agendar horário
          </Button>

          <div className="flex flex-col items-center gap-2 mt-4">
            {company.logo_url ? (
              <img src={company.logo_url} alt={company.name} className="max-h-[40px] object-contain" />
            ) : (
              <p className="text-xs font-medium" style={{ color: isDark ? '#4B5563' : '#9CA3AF' }}>{company.name}</p>
            )}
            <PlatformBranding isDark={isDark} />
          </div>
        </div>
      </div>

      {/* Floating WhatsApp */}
      {companyWhatsapp && (
        <a
          href={`https://wa.me/${companyWhatsapp}`}
          target="_blank"
          rel="noopener noreferrer"
          className="fixed bottom-6 right-6 w-14 h-14 rounded-full flex items-center justify-center shadow-xl z-50 transition-transform hover:scale-110"
          style={{ background: '#25D366' }}
        >
          <MessageCircle className="w-7 h-7 text-white" />
        </a>
      )}
    </div>
  );
}
