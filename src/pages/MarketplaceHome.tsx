import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { SEOHead } from '@/components/SEOHead';
import { usePlatformSettings } from '@/hooks/usePlatformSettings';
import { useGeolocation, calculateDistance, formatDistance } from '@/hooks/useGeolocation';
import { MarketplaceBanner } from '@/components/marketplace/MarketplaceBanner';
import {
  Scissors, ArrowRight, Star, MapPin, Search, Sparkles,
  Users, Heart, Shield, Loader2, Crown, Calendar, ShieldCheck,
  Tag, Navigation as NavIcon, ChevronDown, Hand, Eye, Smile,
  CalendarCheck, Bell, MessageCircle, CreditCard, ChevronLeft, ChevronRight,
} from 'lucide-react';

import heroImg from '@/assets/marketplace-hero.jpg';
import offersBg from '@/assets/marketplace-offers.jpg';
import adPurple from '@/assets/marketplace-ad-purple.jpg';
import adBarber from '@/assets/marketplace-ad-barber.jpg';
import ctaProImg from '@/assets/marketplace-cta-pro.jpg';

const categories = [
  { slug: 'barbeiros', title: 'Barbearias', icon: Scissors, businessType: 'barbershop' },
  { slug: 'salao-de-beleza', title: 'Salões de Beleza', icon: Heart, businessType: 'salon' },
  { slug: 'esteticistas', title: 'Esteticistas', icon: Sparkles, businessType: 'aesthetics' },
  { slug: 'sobrancelhas', title: 'Sobrancelhas', icon: Eye, businessType: 'brows' },
  { slug: 'massagens', title: 'Massagens', icon: Hand, businessType: 'massage' },
  { slug: 'manicure', title: 'Manicure & Pedicure', icon: Smile, businessType: 'nails' },
];

interface MarketCompany {
  id: string;
  name: string;
  slug: string;
  logo_url: string | null;
  cover_url?: string | null;
  city: string | null;
  state: string | null;
  average_rating: number | null;
  review_count: number | null;
  business_type: string;
  latitude: number | null;
  longitude: number | null;
  distance?: number;
  min_price?: number | null;
}

const StarRating = ({ rating, size = 12 }: { rating: number; size?: number }) => (
  <div className="flex items-center gap-0.5">
    {[1, 2, 3, 4, 5].map((s) => {
      const fill = rating >= s ? 1 : rating >= s - 0.5 ? 0.5 : 0;
      return (
        <svg key={s} width={size} height={size} viewBox="0 0 24 24" fill="none">
          <defs>
            <linearGradient id={`mhstar-${s}-${size}`}>
              <stop offset={`${fill * 100}%`} stopColor="#FDBA2D" />
              <stop offset={`${fill * 100}%`} stopColor="#D1D5DB" />
            </linearGradient>
          </defs>
          <path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z" fill={`url(#mhstar-${s}-${size})`} />
        </svg>
      );
    })}
  </div>
);

const getProfileRoute = (company: MarketCompany) => {
  const bt = company.business_type === 'barbershop' ? 'barbearia' : 'estetica';
  return `/${bt}/${company.slug}`;
};

const withTimeout = <T,>(promise: PromiseLike<T>, timeoutMs = 12000, label = 'carregamento') =>
  Promise.race<T>([
    promise,
    new Promise<T>((_, reject) => {
      window.setTimeout(() => reject(new Error(`Tempo esgotado no ${label}.`)), timeoutMs);
    }),
  ]);

export default function MarketplaceHome() {
  const platform = usePlatformSettings();
  const headerLogo = platform?.logo_dark || platform?.system_logo || platform?.logo_light || null;
  const geo = useGeolocation();

  const [allCompanies, setAllCompanies] = useState<MarketCompany[]>([]);
  const [homeSettings, setHomeSettings] = useState<any>(null);
  const [banners, setBanners] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  const [search, setSearch] = useState('');
  const [filterCategory, setFilterCategory] = useState<string>('all');
  const [filterCity, setFilterCity] = useState<string>('');
  const [filterRating, setFilterRating] = useState<string>('all');

  useEffect(() => { 
    loadCompanies(); 
    loadMarketplaceSettings();
  }, []);

  const loadMarketplaceSettings = async () => {
    try {
      const [settingsRes, bannersRes] = await Promise.all([
        supabase.from('marketplace_home_settings').select('*').single(),
        supabase.from('marketplace_banners')
          .select('*')
          .eq('status', 'active')
          .is('deleted_at', null)
          .lte('start_date', new Date().toISOString())
          .gte('end_date', new Date().toISOString())
      ]);
      
      if (settingsRes.data) setHomeSettings(settingsRes.data);
      if (bannersRes.data) setBanners(bannersRes.data);
    } catch (err) {
      console.error('[MARKETPLACE] Error loading settings:', err);
    }
  };

  const selectBanner = (position: string) => {
    const validBanners = banners.filter(b => b.position === position);
    if (validBanners.length === 0) return null;

    // Filter by category and region
    const filteredBanners = validBanners.filter(b => {
      // If banner has a category, it must match the selected filterCategory
      if (b.category && filterCategory !== 'all' && b.category !== filterCategory) return false;
      if (b.category && filterCategory === 'all') return false; // Category-specific banners only show when category is selected
      
      // If banner has a city, it must match the filterCity
      if (b.city) {
        if (!filterCity.trim()) return false; // City-specific banners only show when city is filtered
        if (!b.city.toLowerCase().includes(filterCity.trim().toLowerCase())) return false;
      }
      
      return true;
    });

    const sourceBanners = filteredBanners.length > 0 
      ? filteredBanners 
      : validBanners.filter(b => !b.category && !b.city); // Fallback to global banners

    if (sourceBanners.length === 0) return null;

    // Sort by priority (descending)
    const maxPriority = Math.max(...sourceBanners.map(b => b.priority || 0));
    const topPriorityBanners = sourceBanners.filter(b => (b.priority || 0) === maxPriority);

    if (topPriorityBanners.length === 1) return topPriorityBanners[0];

    // Simple weighted rotation for same priority
    const totalWeight = topPriorityBanners.reduce((sum, b) => sum + (b.rotation_weight || 1), 0);
    let random = Math.random() * totalWeight;
    
    for (const banner of topPriorityBanners) {
      random -= (banner.rotation_weight || 1);
      if (random <= 0) return banner;
    }

    return topPriorityBanners[0];
  };

  const heroSecondaryBanner = useMemo(() => selectBanner('hero_secondary'), [banners, filterCategory, filterCity]);
  const betweenSectionsBanner = useMemo(() => selectBanner('between_sections'), [banners, filterCategory, filterCity]);
  const footerBanner = useMemo(() => selectBanner('footer'), [banners, filterCategory, filterCity]);
  const categoryBanner = useMemo(() => selectBanner('category_page'), [banners, filterCategory, filterCity]);

  useEffect(() => {
    if (geo.latitude && geo.longitude) {
      setAllCompanies(prev =>
        prev.map(c => ({
          ...c,
          distance:
            c.latitude && c.longitude
              ? calculateDistance(geo.latitude!, geo.longitude!, c.latitude, c.longitude)
              : undefined,
        })),
      );
    }
  }, [geo.latitude, geo.longitude]);

  const loadCompanies = async () => {
    setLoading(true);
    try {
      // Prioridade para destaques manuais (Fase 1)
      const { data: featuredManual } = await supabase
        .from('marketplace_featured_items')
        .select('company_id, professional_id')
        .eq('status', 'active');

      const { data, error } = await withTimeout(supabase
        .from('public_company' as any)
        .select('id, name, slug, logo_url, cover_url, city, state, average_rating, review_count, business_type, latitude, longitude')
        .order('average_rating', { ascending: false, nullsFirst: false })
        .limit(60), 12000, 'marketplace');

      if (error) throw error;
      if (data) setAllCompanies(data as any);
    } catch (err) {
      console.error('[MARKETPLACE] Error loading companies:', err);
    } finally {
      setLoading(false);
    }
  };

  const filtered = useMemo(() => {
    return allCompanies.filter(c => {
      if (search.trim()) {
        const q = search.trim().toLowerCase();
        if (!c.name.toLowerCase().includes(q)) return false;
      }
      if (filterCategory !== 'all') {
        const cat = categories.find(x => x.slug === filterCategory);
        if (cat && c.business_type !== cat.businessType) return false;
      }
      if (filterCity.trim() && !(c.city ?? '').toLowerCase().includes(filterCity.trim().toLowerCase())) return false;
      if (filterRating !== 'all') {
        const min = parseFloat(filterRating);
        if ((c.average_rating ?? 0) < min) return false;
      }
      return true;
    });
  }, [allCompanies, search, filterCategory, filterCity, filterRating]);

  const tiered = useMemo(() => {
    const featured: MarketCompany[] = [];
    const recommended: MarketCompany[] = [];
    [...filtered]
      .sort((a, b) => (b.average_rating ?? 0) - (a.average_rating ?? 0))
      .forEach(c => {
        const rating = c.average_rating ?? 0;
        const reviews = c.review_count ?? 0;
        if (rating >= 4.5 && reviews >= 3 && featured.length < 10) featured.push(c);
        else if (recommended.length < 12) recommended.push(c);
      });
    return { featured, recommended };
  }, [filtered]);

  const scrollToResults = () => {
    document.getElementById('marketplace-results')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  };

  const categoryCounts = useMemo(() => {
    const map: Record<string, number> = {};
    allCompanies.forEach(c => {
      map[c.business_type] = (map[c.business_type] ?? 0) + 1;
    });
    return map;
  }, [allCompanies]);

  return (
    <div className="min-h-screen bg-background">
      <SEOHead
        title="Agendaê — O maior marketplace de beleza e bem-estar"
        description="Encontre os melhores profissionais perto de você. Agende online com praticidade, segurança e os melhores profissionais de beleza, estética e bem-estar."
        keywords="barbeiro, esteticista, salão de beleza, agendamento online, marketplace beleza"
      />

      {/* Navbar */}
      <nav className="sticky top-0 z-50 bg-background/95 backdrop-blur-lg border-b border-border">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-3 flex items-center justify-between gap-4">
          <Link to="/" className="flex items-center gap-2 flex-shrink-0">
            {headerLogo ? (
              <img src={headerLogo} alt="Agendaê" className="h-9 max-w-[150px] object-contain" />
            ) : (
              <span className="text-xl font-display font-bold text-primary">meagenda<span className="text-accent">ê!</span></span>
            )}
          </Link>
          <div className="hidden lg:flex items-center gap-7 text-sm font-medium text-foreground/80">
            <Link to="/barbeiros" className="hover:text-primary transition-colors">Barbearias</Link>
            <Link to="/salao-de-beleza" className="hover:text-primary transition-colors">Salões de Beleza</Link>
            <Link to="/esteticistas" className="hover:text-primary transition-colors">Esteticistas</Link>
            <Link to="/sobrancelhas" className="hover:text-primary transition-colors">Sobrancelhas</Link>
            <Link to="/massagens" className="hover:text-primary transition-colors">Massagens</Link>
            <button onClick={scrollToResults} className="flex items-center gap-1 hover:text-primary transition-colors">
              Mais categorias <ChevronDown className="h-3.5 w-3.5" />
            </button>
          </div>
          <div className="flex items-center gap-2 flex-shrink-0">
            <Link to="/auth"><Button variant="ghost" size="sm">Entrar</Button></Link>
            <Link to="/profissionais">
              <Button size="sm" className="bg-primary text-primary-foreground hover:bg-primary/90 rounded-md">
                Sou profissional
              </Button>
            </Link>
          </div>
        </div>
      </nav>

      {/* HERO */}
      <section className="relative bg-slate-900 text-white overflow-hidden">
        <div className="absolute inset-0">
          <img src={homeSettings?.hero_image_url || heroImg} alt="" className="w-full h-full object-cover object-right opacity-90" />
          <div className="absolute inset-0 bg-gradient-to-r from-slate-950 via-slate-950/85 to-transparent" />
        </div>

        <div className="relative max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-16 md:py-24">
          <div className="max-w-2xl">
            {homeSettings?.hero_badge && (
              <div className="inline-flex items-center gap-2 bg-amber-500/10 border border-amber-500/30 text-amber-400 px-4 py-1.5 rounded-md text-xs font-semibold uppercase tracking-wide mb-6">
                <Sparkles className="h-3.5 w-3.5" />
                {homeSettings.hero_badge}
              </div>
            )}
            <h1 className="text-4xl md:text-5xl lg:text-6xl font-display font-bold leading-tight mb-5">
              {homeSettings?.hero_title || 'Encontre os melhores profissionais perto de você'}
            </h1>
            <p className="text-base md:text-lg text-white/80 max-w-xl mb-8">
              {homeSettings?.hero_subtitle || 'Agende online com praticidade, segurança e os melhores profissionais de beleza, estética e bem-estar.'}
            </p>

            {/* Search bar */}
            <div className="bg-white rounded-xl shadow-2xl p-2 flex flex-col md:flex-row items-stretch gap-2 md:gap-0 md:divide-x divide-border">
              <div className="flex items-center gap-2 px-3 flex-1 min-w-0">
                <Search className="h-4 w-4 text-muted-foreground flex-shrink-0" />
                <input
                  value={search}
                  onChange={e => setSearch(e.target.value)}
                  placeholder="Buscar por serviços ou profissionais"
                  className="bg-transparent text-sm text-foreground placeholder:text-muted-foreground py-2.5 w-full outline-none"
                />
              </div>
              <div className="flex items-center gap-2 px-3 md:w-48">
                <MapPin className="h-4 w-4 text-muted-foreground flex-shrink-0" />
                <div className="flex-1 min-w-0">
                  <p className="text-[10px] text-muted-foreground leading-none mb-0.5">Sua localização</p>
                  <input
                    value={filterCity}
                    onChange={e => setFilterCity(e.target.value)}
                    placeholder="Cidade"
                    className="bg-transparent text-sm text-foreground placeholder:text-muted-foreground w-full outline-none leading-tight"
                  />
                </div>
              </div>
              <div className="px-1 md:w-44">
                <Select value={filterCategory} onValueChange={setFilterCategory}>
                  <SelectTrigger className="border-0 shadow-none h-full bg-transparent text-foreground">
                    <div className="flex items-center gap-2 text-left">
                      <Tag className="h-4 w-4 text-muted-foreground" />
                      <div>
                        <p className="text-[10px] text-muted-foreground leading-none mb-0.5">Categoria</p>
                        <SelectValue placeholder="Todas" />
                      </div>
                    </div>
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Todas</SelectItem>
                    {categories.map(c => <SelectItem key={c.slug} value={c.slug}>{c.title}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div className="px-1 md:w-44">
                <Select value={filterRating} onValueChange={setFilterRating}>
                  <SelectTrigger className="border-0 shadow-none h-full bg-transparent text-foreground">
                    <div className="flex items-center gap-2 text-left">
                      <Star className="h-4 w-4 text-muted-foreground" />
                      <div>
                        <p className="text-[10px] text-muted-foreground leading-none mb-0.5">Avaliação</p>
                        <SelectValue placeholder="Todas" />
                      </div>
                    </div>
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Todas</SelectItem>
                    <SelectItem value="4.5">4,5+ estrelas</SelectItem>
                    <SelectItem value="4">4+ estrelas</SelectItem>
                    <SelectItem value="3">3+ estrelas</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <Button
                onClick={scrollToResults}
                className="bg-slate-900 hover:bg-slate-800 text-white rounded-lg px-6 md:px-8 h-auto"
              >
                <Search className="h-4 w-4 mr-2" />
                Buscar
              </Button>
            </div>

            {/* Trust badges */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mt-8">
              {[
                { icon: CalendarCheck, label: 'Agendamento online', sub: 'rápido e seguro' },
                { icon: ShieldCheck, label: 'Profissionais avaliados', sub: 'e verificados' },
                { icon: Tag, label: 'Melhores preços', sub: 'e ofertas' },
                { icon: NavIcon, label: 'Atendimento', sub: 'próximo de você' },
              ].map((b, i) => (
                <div key={i} className="flex items-center gap-2.5">
                  <div className="w-9 h-9 rounded-md border border-amber-500/30 bg-amber-500/5 flex items-center justify-center flex-shrink-0">
                    <b.icon className="h-4 w-4 text-amber-400" />
                  </div>
                  <div className="text-xs leading-tight">
                    <p className="font-semibold text-white">{b.label}</p>
                    <p className="text-white/60">{b.sub}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      <div id="marketplace-results" />

      {/* Hero Secondary Banner */}
      {heroSecondaryBanner && (
        <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 mt-6">
          <MarketplaceBanner banner={heroSecondaryBanner} className="h-40 md:h-48" />
        </section>
      )}

      {/* Special offers banner */}
      <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 mt-8">
        <div className="relative rounded-2xl overflow-hidden border border-border shadow-sm" style={{ background: 'linear-gradient(90deg, #3a2410 0%, #5a3a1f 30%, #f5e6c5 70%, #f0d9a8 100%)' }}>
          <div className="absolute inset-y-0 right-0 w-1/3 hidden md:block opacity-90">
            <img src={offersBg} alt="" className="w-full h-full object-cover" loading="lazy" />
          </div>
          <div className="relative flex flex-col md:flex-row items-center gap-6 px-6 md:px-10 py-6 md:py-8">
            <div className="flex items-center gap-4 flex-1">
              <div className="text-amber-200">
                <p className="text-xs font-bold uppercase tracking-widest">Ofertas</p>
                <p className="text-2xl md:text-3xl font-display font-bold leading-none">ESPECIAIS</p>
              </div>
              <div className="text-white/95">
                <p className="text-base md:text-lg font-semibold leading-tight">Descontos imperdíveis</p>
                <p className="text-sm md:text-base text-white/80">em serviços selecionados</p>
              </div>
              <Button variant="outline" size="sm" className="ml-auto md:ml-4 bg-transparent border-white/60 text-white hover:bg-white hover:text-slate-900">
                Ver ofertas
              </Button>
            </div>
            <div className="hidden md:flex items-center gap-3 text-slate-900 z-10">
              <div className="text-right">
                <p className="text-xs font-medium">até</p>
              </div>
              <p className="text-5xl lg:text-6xl font-display font-extrabold">50%</p>
              <div>
                <p className="text-2xl font-bold leading-none">OFF</p>
                <p className="text-xs text-slate-700 max-w-[140px] mt-1">Em serviços de beleza e bem-estar</p>
              </div>
            </div>
          </div>
        </div>
      </section>

      {loading && (
        <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-16 text-center">
          <Loader2 className="h-8 w-8 animate-spin text-primary mx-auto mb-4" />
          <p className="text-muted-foreground">Carregando profissionais...</p>
        </section>
      )}

      {!loading && filtered.length === 0 && (
        <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-16 text-center">
          <p className="text-muted-foreground">Nenhum profissional encontrado.</p>
        </section>
      )}

      {/* Featured (Plano Premium) */}
      {!loading && tiered.featured.length > 0 && (
        <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
          <div className="flex items-end justify-between gap-4 mb-6">
            <div>
              <div className="flex items-center gap-3 mb-1">
                <Crown className="h-5 w-5 text-amber-500" />
                <h2 className="text-2xl md:text-3xl font-display font-bold text-foreground">
                  Profissionais em destaque
                </h2>
                <span className="hidden sm:inline-flex items-center gap-1 bg-amber-100 text-amber-800 px-2.5 py-1 rounded-full text-xs font-semibold">
                  Plano Premium
                </span>
              </div>
              <p className="text-sm text-muted-foreground">Os melhores profissionais com o nosso plano mais completo</p>
            </div>
            <Button variant="outline" size="sm" className="rounded-lg flex-shrink-0">Ver todos</Button>
          </div>

          <div className="relative">
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-4">
              {tiered.featured.slice(0, 5).map(c => (
                <Link key={c.id} to={getProfileRoute(c)} className="group">
                  <Card className="overflow-hidden border-border hover:shadow-xl hover:-translate-y-0.5 transition-all rounded-xl">
                    <div className="relative aspect-[4/3] bg-muted overflow-hidden">
                      {c.cover_url || c.logo_url ? (
                        <img src={c.cover_url || c.logo_url || ''} alt={c.name} className="w-full h-full object-cover" loading="lazy" />
                      ) : (
                        <div className="w-full h-full bg-gradient-to-br from-slate-200 to-slate-300 flex items-center justify-center">
                          <Scissors className="h-10 w-10 text-slate-400" />
                        </div>
                      )}
                      {c.average_rating ? (
                        <div className="absolute top-2 left-2 bg-amber-400 text-slate-900 px-2 py-0.5 rounded-md text-xs font-bold flex items-center gap-1 shadow-md">
                          <Star className="h-3 w-3 fill-slate-900" />
                          {c.average_rating.toFixed(1)}
                        </div>
                      ) : null}
                      {c.logo_url && (
                        <div className="absolute -bottom-5 left-3 w-12 h-12 rounded-full bg-white shadow-lg ring-2 ring-white overflow-hidden">
                          <img src={c.logo_url} alt={c.name} className="w-full h-full object-cover" loading="lazy" />
                        </div>
                      )}
                    </div>
                    <CardContent className="p-3 pt-7">
                      <h3 className="font-semibold text-sm text-foreground line-clamp-1 group-hover:text-primary transition-colors">{c.name}</h3>
                      <p className="text-xs text-muted-foreground line-clamp-1 mt-0.5">
                        {[categories.find(cat => cat.businessType === c.business_type)?.title, c.city].filter(Boolean).join(' • ')}
                      </p>
                      <div className="flex items-center gap-1 mt-1.5">
                        <StarRating rating={c.average_rating ?? 0} size={11} />
                        {c.review_count ? <span className="text-[11px] text-muted-foreground">({c.review_count})</span> : null}
                      </div>
                      {c.distance !== undefined && (
                        <p className="text-[11px] text-accent font-medium mt-1">{formatDistance(c.distance)}</p>
                      )}
                    </CardContent>
                  </Card>
                </Link>
              ))}
            </div>

            {/* Carousel arrows (decorative for now) */}
            <button className="hidden md:flex absolute -left-4 top-1/2 -translate-y-1/2 w-9 h-9 bg-white border border-border rounded-full shadow-md items-center justify-center hover:bg-muted transition-colors">
              <ChevronLeft className="h-4 w-4 text-foreground" />
            </button>
            <button className="hidden md:flex absolute -right-4 top-1/2 -translate-y-1/2 w-9 h-9 bg-white border border-border rounded-full shadow-md items-center justify-center hover:bg-muted transition-colors">
              <ChevronRight className="h-4 w-4 text-foreground" />
            </button>
          </div>
        </section>
      )}

      {/* Recommended (Plano Intermediário) */}
      {!loading && tiered.recommended.length > 0 && (
        <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          <div className="flex items-end justify-between gap-4 mb-6">
            <div>
              <div className="flex items-center gap-3 mb-1">
                <h2 className="text-xl md:text-2xl font-display font-bold text-foreground">
                  Mais profissionais para você
                </h2>
                <span className="hidden sm:inline-flex items-center gap-1 bg-blue-50 text-blue-700 px-2.5 py-1 rounded-full text-xs font-semibold">
                  Plano Intermediário
                </span>
              </div>
              <p className="text-sm text-muted-foreground">Excelentes profissionais com nossos planos intermediários</p>
            </div>
            <Button variant="outline" size="sm" className="rounded-lg flex-shrink-0">Ver todos</Button>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5 gap-3">
            {tiered.recommended.slice(0, 5).map(c => (
              <Link key={c.id} to={getProfileRoute(c)} className="group">
                <Card className="overflow-hidden border-border hover:shadow-md transition-all rounded-xl">
                  <CardContent className="p-3 flex items-start gap-3">
                    <div className="w-16 h-16 rounded-lg bg-muted overflow-hidden flex-shrink-0">
                      {c.cover_url || c.logo_url ? (
                        <img src={c.cover_url || c.logo_url || ''} alt={c.name} className="w-full h-full object-cover" loading="lazy" />
                      ) : (
                        <div className="w-full h-full flex items-center justify-center">
                          <Scissors className="h-5 w-5 text-muted-foreground" />
                        </div>
                      )}
                    </div>
                    <div className="min-w-0 flex-1">
                      <h3 className="font-semibold text-sm text-foreground line-clamp-1 group-hover:text-primary transition-colors">{c.name}</h3>
                      <p className="text-[11px] text-muted-foreground line-clamp-1 mt-0.5">
                        {[categories.find(cat => cat.businessType === c.business_type)?.title, c.city].filter(Boolean).join(' • ')}
                      </p>
                      <div className="flex items-center gap-1 mt-1">
                        <StarRating rating={c.average_rating ?? 0} size={10} />
                        {c.review_count ? <span className="text-[10px] text-muted-foreground">({c.review_count})</span> : null}
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </Link>
            ))}
          </div>
        </section>
      )}

      {/* Dynamic or static between sections banner */}
      <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {betweenSectionsBanner ? (
          <MarketplaceBanner banner={betweenSectionsBanner} className="h-32 md:h-36" />
        ) : (
          <div className="relative rounded-2xl overflow-hidden border border-border shadow-sm h-32 md:h-36">
            <img src={adPurple} alt="" className="absolute inset-0 w-full h-full object-cover" loading="lazy" />
            <div className="absolute inset-0 bg-gradient-to-r from-purple-900/90 via-purple-800/70 to-purple-900/40" />
            <div className="relative h-full flex items-center justify-between px-6 md:px-10">
              <div>
                <span className="inline-block bg-white/15 text-white/90 text-[10px] font-bold uppercase tracking-widest px-2 py-0.5 rounded mb-2">Publicidade</span>
                <p className="text-white text-lg md:text-2xl font-display font-bold leading-tight max-w-md">
                  Destaque sua marca<br />para milhares de clientes
                </p>
              </div>
              <Button variant="outline" className="bg-transparent border-white text-white hover:bg-white hover:text-purple-900 rounded-md">
                Anuncie aqui
              </Button>
            </div>
          </div>
        )}
      </section>

      {/* Category Specific Banner */}
      {categoryBanner && filterCategory !== 'all' && (
        <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
          <MarketplaceBanner banner={categoryBanner} className="h-32 md:h-40" />
        </section>
      )}

      {/* Categories grid */}
      <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-10">
        <h2 className="text-2xl font-display font-bold text-foreground mb-6">Explore por categoria</h2>
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-7 gap-3">
          {categories.map(cat => (
            <Link key={cat.slug} to={`/${cat.slug}`}>
              <Card className="border-border hover:shadow-md hover:-translate-y-0.5 transition-all rounded-xl cursor-pointer h-full">
                <CardContent className="p-4 flex flex-col items-center text-center">
                  <cat.icon className="h-7 w-7 text-foreground mb-2" strokeWidth={1.5} />
                  <p className="text-sm font-semibold text-foreground line-clamp-1">{cat.title}</p>
                  <p className="text-[11px] text-muted-foreground mt-0.5">
                    {categoryCounts[cat.businessType] ?? 0} profissionais
                  </p>
                </CardContent>
              </Card>
            </Link>
          ))}
          <Card className="border-border hover:shadow-md hover:-translate-y-0.5 transition-all rounded-xl cursor-pointer">
            <CardContent className="p-4 flex flex-col items-center text-center">
              <div className="grid grid-cols-2 gap-0.5 mb-2">
                {[0,1,2,3].map(i => <div key={i} className="w-2.5 h-2.5 border border-foreground rounded-sm" />)}
              </div>
              <p className="text-sm font-semibold text-foreground">Ver todas</p>
              <p className="text-[11px] text-muted-foreground mt-0.5">12+ categorias</p>
            </CardContent>
          </Card>
        </div>
      </section>

      {/* Publicidade barbearia */}
      <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
        <div className="relative rounded-2xl overflow-hidden border border-border shadow-sm h-32 md:h-36">
          <img src={adBarber} alt="" className="absolute inset-0 w-full h-full object-cover" loading="lazy" />
          <div className="absolute inset-0 bg-gradient-to-r from-slate-950/95 via-slate-950/70 to-slate-950/40" />
          <div className="relative h-full flex items-center justify-between px-6 md:px-10 text-white">
            <div>
              <span className="inline-block bg-white/15 text-white/90 text-[10px] font-bold uppercase tracking-widest px-2 py-0.5 rounded mb-2">Publicidade</span>
              <p className="font-display text-xl md:text-2xl font-bold leading-tight tracking-wide">BARBER SHOP</p>
              <p className="text-xs md:text-sm text-white/70 tracking-widest">TRADIÇÃO E ESTILO</p>
            </div>
            <div className="hidden md:flex flex-col items-center gap-2">
              <p className="text-xs text-white/80">Agende seu horário agora mesmo</p>
              <Button size="sm" className="bg-white text-slate-900 hover:bg-white/90 rounded-md">Agendar agora</Button>
            </div>
            <div className="text-right">
              <p className="text-[10px] text-white/70 font-semibold tracking-wide">CORTE + BARBA</p>
              <p className="text-2xl md:text-3xl font-display font-bold text-amber-400">R$ 79<span className="text-sm align-top">,90</span></p>
            </div>
          </div>
        </div>
      </section>

      {/* Trust strip */}
      <section className="bg-emerald-50/40 border-y border-emerald-100">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 grid grid-cols-2 md:grid-cols-5 gap-5">
          {[
            { icon: Calendar, label: 'Agende 24h por dia', sub: 'quando quiser' },
            { icon: Bell, label: 'Lembretes automáticos', sub: 'do seu compromisso' },
            { icon: Star, label: 'Avalie e escolha os', sub: 'melhores profissionais' },
            { icon: CreditCard, label: 'Pagamento seguro', sub: 'e facilitado' },
            { icon: MessageCircle, label: 'Atendimento rápido', sub: 'via WhatsApp' },
          ].map((t, i) => (
            <div key={i} className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-lg bg-emerald-100 flex items-center justify-center flex-shrink-0">
                <t.icon className="h-4 w-4 text-emerald-700" />
              </div>
              <div className="text-xs leading-tight">
                <p className="font-semibold text-foreground">{t.label}</p>
                <p className="text-muted-foreground">{t.sub}</p>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* CTA Profissional */}
      <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-10">
        <div className="relative rounded-2xl overflow-hidden bg-slate-900 text-white">
          <div className="grid md:grid-cols-2 items-center">
            <div className="px-8 md:px-12 py-10 md:py-12">
              <h2 className="text-2xl md:text-3xl font-display font-bold mb-3">
                {homeSettings?.cta_professional_title || 'É profissional de beleza?'}
              </h2>
              <p className="text-white/80 mb-6 text-sm md:text-base">
                {homeSettings?.cta_professional_subtitle || 'Cadastre-se gratuitamente e receba agendamentos todos os dias'}
              </p>
              <Link to="/profissionais">
                <Button className="bg-emerald-500 hover:bg-emerald-600 text-white rounded-md">
                  {homeSettings?.cta_professional_button_text || 'Criar perfil profissional'}
                  <ArrowRight className="h-4 w-4 ml-2" />
                </Button>
              </Link>
            </div>
            <div className="hidden md:block relative h-full min-h-[220px]">
              <img src={homeSettings?.cta_professional_image_url || ctaProImg} alt="Profissional" className="absolute inset-0 w-full h-full object-cover object-top" loading="lazy" />
            </div>
          </div>
        </div>
      </section>

      {/* Marketplace Footer Banner */}
      {footerBanner && (
        <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          <MarketplaceBanner banner={footerBanner} className="h-24 md:h-32" />
        </section>
      )}

      {/* Footer */}
      <footer className="border-t border-border py-8">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 flex flex-col md:flex-row items-center justify-between gap-4">
          {headerLogo ? (
            <img src={headerLogo} alt="Agendaê" className="h-7 max-w-[120px] object-contain" />
          ) : (
            <span className="text-base font-display font-bold text-primary">meagenda<span className="text-accent">ê!</span></span>
          )}
          <div className="flex items-center gap-5 text-xs text-muted-foreground">
            <Link to="/barbeiros" className="hover:text-foreground">Barbearias</Link>
            <Link to="/esteticistas" className="hover:text-foreground">Esteticistas</Link>
            <Link to="/salao-de-beleza" className="hover:text-foreground">Salões</Link>
            <Link to="/profissionais" className="hover:text-foreground">Para profissionais</Link>
          </div>
          <p className="text-[11px] text-muted-foreground">
            © {new Date().getFullYear()} Agendaê. Todos os direitos reservados.
          </p>
        </div>
      </footer>
    </div>
  );
}
