import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { SEOHead } from '@/components/SEOHead';
import { usePlatformSettings } from '@/hooks/usePlatformSettings';
import { useGeolocation, calculateDistance, formatDistance } from '@/hooks/useGeolocation';
import { getAvailableSlots } from '@/lib/availability-service';
import {
  Scissors, ArrowRight, Star, MapPin, Search, Sparkles,
  Calendar, Users, ChevronRight, Heart, Shield, Navigation, Loader2,
  Zap, Clock, Filter, Crown,
} from 'lucide-react';

const categories = [
  { slug: 'barbeiros', title: 'Barbeiros', description: 'Corte, barba e tratamentos masculinos', icon: Scissors, gradient: 'from-blue-500/10 to-blue-600/5', iconColor: 'text-blue-600', businessType: 'barbershop' },
  { slug: 'esteticistas', title: 'Esteticistas', description: 'Tratamentos faciais e bem-estar', icon: Sparkles, gradient: 'from-pink-500/10 to-pink-600/5', iconColor: 'text-pink-600', businessType: 'aesthetics' },
  { slug: 'salao-de-beleza', title: 'Salões de Beleza', description: 'Corte, coloração e tratamentos', icon: Heart, gradient: 'from-purple-500/10 to-purple-600/5', iconColor: 'text-purple-600', businessType: 'salon' },
  { slug: 'clinica-estetica', title: 'Clínicas de Estética', description: 'Procedimentos estéticos avançados', icon: Shield, gradient: 'from-emerald-500/10 to-emerald-600/5', iconColor: 'text-emerald-600', businessType: 'clinic' },
];

interface MarketCompany {
  id: string;
  name: string;
  slug: string;
  logo_url: string | null;
  city: string | null;
  state: string | null;
  average_rating: number | null;
  review_count: number | null;
  business_type: string;
  latitude: number | null;
  longitude: number | null;
  distance?: number;
  available_now?: boolean;
}

const StarRating = ({ rating, size = 14 }: { rating: number; size?: number }) => (
  <div className="flex items-center gap-0.5">
    {[1, 2, 3, 4, 5].map((s) => {
      const fill = rating >= s ? 1 : rating >= s - 0.5 ? 0.5 : 0;
      return (
        <svg key={s} width={size} height={size} viewBox="0 0 24 24" fill="none">
          <defs>
            <linearGradient id={`home-star-${s}-${size}`}>
              <stop offset={`${fill * 100}%`} stopColor="#FDBA2D" />
              <stop offset={`${fill * 100}%`} stopColor="#D1D5DB" />
            </linearGradient>
          </defs>
          <path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z" fill={`url(#home-star-${s}-${size})`} />
        </svg>
      );
    })}
  </div>
);

const getProfileRoute = (company: MarketCompany) => {
  const bt = company.business_type === 'barbershop' ? 'barbearia' : 'estetica';
  return `/${bt}/${company.slug}`;
};

export default function MarketplaceHome() {
  const platform = usePlatformSettings();
  const headerLogo = platform?.logo_dark || platform?.system_logo || platform?.logo_light || null;
  const geo = useGeolocation();

  const [allCompanies, setAllCompanies] = useState<MarketCompany[]>([]);
  const [loading, setLoading] = useState(true);
  const [availabilityLoading, setAvailabilityLoading] = useState(false);

  // Filters
  const [filterCategory, setFilterCategory] = useState<string>('all');
  const [filterCity, setFilterCity] = useState<string>('');
  const [filterRating, setFilterRating] = useState<string>('all');
  const [filterDistance, setFilterDistance] = useState<string>('all');
  const [whenWindow, setWhenWindow] = useState<string>('any'); // any | now | 2h | 6h | 24h

  useEffect(() => {
    loadCompanies();
  }, []);

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
    const { data } = await supabase
      .from('public_company' as any)
      .select('id, name, slug, logo_url, city, state, average_rating, review_count, business_type, latitude, longitude');
    if (data) {
      setAllCompanies(data as any);
    }
    setLoading(false);
  };

  // Compute availability when "when" window changes
  useEffect(() => {
    if (whenWindow === 'any' || allCompanies.length === 0) return;
    checkAvailability();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [whenWindow, allCompanies.length]);

  const checkAvailability = async () => {
    setAvailabilityLoading(true);
    const hours = whenWindow === 'now' ? 1 : whenWindow === '2h' ? 2 : whenWindow === '6h' ? 6 : 24;
    const now = new Date();
    const limit = new Date(now.getTime() + hours * 60 * 60 * 1000);

    // Pick top 12 by rating to avoid overloading the engine
    const candidates = [...allCompanies]
      .sort((a, b) => (b.average_rating ?? 0) - (a.average_rating ?? 0))
      .slice(0, 12);

    // Get one professional per company (cheapest signal of availability)
    const { data: profs } = await supabase
      .from('public_professionals' as any)
      .select('id, company_id')
      .in('company_id', candidates.map(c => c.id));

    const byCompany: Record<string, string> = {};
    (profs as any[] ?? []).forEach(p => {
      if (!byCompany[p.company_id]) byCompany[p.company_id] = p.id;
    });

    const results = await Promise.allSettled(
      candidates.map(async c => {
        const profId = byCompany[c.id];
        if (!profId) return { id: c.id, available: false };
        try {
          const res = await getAvailableSlots({
            source: 'public',
            companyId: c.id,
            professionalId: profId,
            date: now,
            totalDuration: 30,
          });
          const has = res.slots.some(slotStr => {
            const [h, m] = slotStr.split(':').map(Number);
            const slotDate = new Date(now);
            slotDate.setHours(h, m, 0, 0);
            return slotDate >= now && slotDate <= limit;
          });
          return { id: c.id, available: has };
        } catch {
          return { id: c.id, available: false };
        }
      }),
    );

    const availabilityMap: Record<string, boolean> = {};
    results.forEach(r => {
      if (r.status === 'fulfilled') availabilityMap[r.value.id] = r.value.available;
    });

    setAllCompanies(prev => prev.map(c => ({ ...c, available_now: availabilityMap[c.id] ?? false })));
    setAvailabilityLoading(false);
  };

  // Filtered + sorted companies
  const filtered = useMemo(() => {
    return allCompanies.filter(c => {
      if (filterCategory !== 'all') {
        const cat = categories.find(x => x.slug === filterCategory);
        if (cat && c.business_type !== cat.businessType) return false;
      }
      if (filterCity.trim() && !(c.city ?? '').toLowerCase().includes(filterCity.trim().toLowerCase())) return false;
      if (filterRating !== 'all') {
        const min = parseFloat(filterRating);
        if ((c.average_rating ?? 0) < min) return false;
      }
      if (filterDistance !== 'all' && c.distance !== undefined) {
        const max = parseFloat(filterDistance);
        if (c.distance > max) return false;
      }
      return true;
    });
  }, [allCompanies, filterCategory, filterCity, filterRating, filterDistance]);

  const availableNow = useMemo(() => {
    if (whenWindow === 'any') return [];
    return filtered
      .filter(c => c.available_now)
      .sort((a, b) => {
        const r = (b.average_rating ?? 0) - (a.average_rating ?? 0);
        if (r !== 0) return r;
        return (a.distance ?? 999) - (b.distance ?? 999);
      })
      .slice(0, 8);
  }, [filtered, whenWindow]);

  // Tier classification (premium proxy = top-rated with reviews; mid = decent rating)
  const tiered = useMemo(() => {
    const featured: MarketCompany[] = [];
    const recommended: MarketCompany[] = [];
    const basic: MarketCompany[] = [];
    [...filtered]
      .sort((a, b) => (b.average_rating ?? 0) - (a.average_rating ?? 0))
      .forEach(c => {
        const rating = c.average_rating ?? 0;
        const reviews = c.review_count ?? 0;
        if (rating >= 4.5 && reviews >= 3 && featured.length < 5) featured.push(c);
        else if (rating >= 4.0 && recommended.length < 9) recommended.push(c);
        else basic.push(c);
      });
    return { featured, recommended, basic };
  }, [filtered]);

  const scrollToResults = () => {
    document.getElementById('marketplace-results')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  };

  return (
    <div className="min-h-screen bg-white">
      <SEOHead
        title="Agendae — Agende com profissionais disponíveis perto de você"
        description="Veja horários em tempo real e agende em segundos com barbeiros, esteticistas e salões avaliados perto de você."
        keywords="barbeiro, esteticista, salão de beleza, agendamento online, horário disponível"
      />

      {/* Navbar */}
      <nav className="sticky top-0 z-50 bg-white/80 backdrop-blur-lg border-b border-[hsl(var(--border))]">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-3 flex items-center justify-between">
          <Link to="/" className="flex items-center gap-2">
            {headerLogo ? (
              <img src={headerLogo} alt="Agendae" className="h-10 max-w-[160px] object-contain" />
            ) : (
              <div className="w-9 h-9 rounded-xl bg-[hsl(var(--primary))] flex items-center justify-center">
                <Scissors className="h-5 w-5 text-white" />
              </div>
            )}
          </Link>
          <div className="hidden md:flex items-center gap-6 text-sm font-medium text-[hsl(var(--muted-foreground))]">
            <Link to="/barbeiros" className="hover:text-[hsl(var(--foreground))] transition-colors">Barbeiros</Link>
            <Link to="/esteticistas" className="hover:text-[hsl(var(--foreground))] transition-colors">Esteticistas</Link>
            <Link to="/salao-de-beleza" className="hover:text-[hsl(var(--foreground))] transition-colors">Salões</Link>
          </div>
          <div className="flex items-center gap-2">
            <Link to="/auth"><Button variant="ghost" size="sm">Entrar</Button></Link>
            <Link to="/profissionais">
              <Button size="sm" className="bg-[hsl(var(--accent))] text-[hsl(var(--accent-foreground))] hover:bg-[hsl(var(--accent))]/90">
                Sou profissional
              </Button>
            </Link>
          </div>
        </div>
      </nav>

      {/* Hero */}
      <section className="relative overflow-hidden bg-gradient-to-br from-[hsl(var(--primary))]/5 via-transparent to-[hsl(var(--accent))]/5">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-16 md:py-20 text-center">
          <h1 className="text-4xl md:text-5xl lg:text-6xl font-display font-bold text-[hsl(var(--foreground))] leading-tight mb-6">
            Agende agora com profissionais{' '}
            <span className="text-[hsl(var(--accent))]">disponíveis perto de você</span>
          </h1>
          <p className="text-lg md:text-xl text-[hsl(var(--muted-foreground))] max-w-2xl mx-auto mb-8">
            Veja horários em tempo real e agende em segundos.
          </p>
          <div className="flex flex-col sm:flex-row gap-3 justify-center">
            <Button
              size="lg"
              onClick={scrollToResults}
              className="w-full sm:w-auto text-base px-8 bg-[hsl(var(--primary))] text-[hsl(var(--primary-foreground))]"
            >
              <Search className="h-5 w-5 mr-2" />
              Buscar profissionais
            </Button>
            <Button
              size="lg"
              variant="outline"
              onClick={() => { setWhenWindow('now'); scrollToResults(); }}
              className="w-full sm:w-auto text-base px-8"
            >
              <Zap className="h-5 w-5 mr-2 text-[hsl(var(--accent))]" />
              Encontrar horário agora
            </Button>
          </div>

          {geo.permission === 'prompt' && !geo.latitude && (
            <div className="mt-6">
              <Button variant="ghost" size="sm" onClick={geo.requestLocation} disabled={geo.loading} className="gap-2">
                {geo.loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Navigation className="h-4 w-4" />}
                Usar minha localização
              </Button>
            </div>
          )}
        </div>
      </section>

      {/* Filter bar */}
      <section id="marketplace-results" className="border-b border-[hsl(var(--border))] bg-[hsl(var(--muted))]/20 sticky top-[60px] z-40 backdrop-blur-md">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
          <div className="flex items-center gap-2 mb-3">
            <Filter className="h-4 w-4 text-[hsl(var(--muted-foreground))]" />
            <h3 className="text-sm font-semibold text-[hsl(var(--foreground))]">Encontre profissionais perto de você</h3>
          </div>
          <div className="grid grid-cols-2 md:grid-cols-5 gap-2">
            <Select value={filterCategory} onValueChange={setFilterCategory}>
              <SelectTrigger className="h-9 text-sm"><SelectValue placeholder="Categoria" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todas categorias</SelectItem>
                {categories.map(c => <SelectItem key={c.slug} value={c.slug}>{c.title}</SelectItem>)}
              </SelectContent>
            </Select>
            <Input
              placeholder="Cidade"
              value={filterCity}
              onChange={e => setFilterCity(e.target.value)}
              className="h-9 text-sm"
            />
            <Select value={filterRating} onValueChange={setFilterRating}>
              <SelectTrigger className="h-9 text-sm"><SelectValue placeholder="Avaliação" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Qualquer avaliação</SelectItem>
                <SelectItem value="4.5">4,5+ estrelas</SelectItem>
                <SelectItem value="4">4+ estrelas</SelectItem>
                <SelectItem value="3">3+ estrelas</SelectItem>
              </SelectContent>
            </Select>
            <Select value={filterDistance} onValueChange={setFilterDistance} disabled={!geo.latitude}>
              <SelectTrigger className="h-9 text-sm">
                <SelectValue placeholder={geo.latitude ? 'Distância' : 'Sem localização'} />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Qualquer distância</SelectItem>
                <SelectItem value="2">Até 2 km</SelectItem>
                <SelectItem value="5">Até 5 km</SelectItem>
                <SelectItem value="10">Até 10 km</SelectItem>
                <SelectItem value="20">Até 20 km</SelectItem>
              </SelectContent>
            </Select>
            <Select value={whenWindow} onValueChange={setWhenWindow}>
              <SelectTrigger className="h-9 text-sm">
                <Clock className="h-3.5 w-3.5 mr-1 text-[hsl(var(--accent))]" />
                <SelectValue placeholder="Quando?" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="any">A qualquer momento</SelectItem>
                <SelectItem value="now">Agora (até 1h)</SelectItem>
                <SelectItem value="2h">Nas próximas 2h</SelectItem>
                <SelectItem value="6h">Nas próximas 6h</SelectItem>
                <SelectItem value="24h">Nas próximas 24h</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>
      </section>

      {loading && (
        <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-16 text-center">
          <Loader2 className="h-8 w-8 animate-spin text-[hsl(var(--primary))] mx-auto mb-4" />
          <p className="text-[hsl(var(--muted-foreground))]">Carregando profissionais...</p>
        </section>
      )}

      {/* Available now section */}
      {whenWindow !== 'any' && (
        <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
          <div className="flex items-center gap-3 mb-6">
            <div className="inline-flex items-center gap-2 bg-[hsl(var(--accent))]/10 text-[hsl(var(--accent))] px-4 py-1.5 rounded-full text-sm font-semibold">
              <Zap className="h-4 w-4" />
              Disponíveis agora
            </div>
            {availabilityLoading && <Loader2 className="h-4 w-4 animate-spin text-[hsl(var(--muted-foreground))]" />}
          </div>
          {availableNow.length === 0 && !availabilityLoading ? (
            <Card className="p-8 text-center">
              <Clock className="h-10 w-10 text-[hsl(var(--muted-foreground))]/40 mx-auto mb-3" />
              <p className="text-[hsl(var(--muted-foreground))]">
                Nenhum profissional disponível neste intervalo. Tente ampliar a janela de tempo.
              </p>
            </Card>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
              {availableNow.map(c => (
                <Link key={c.id} to={getProfileRoute(c)}>
                  <Card className="overflow-hidden hover:shadow-xl transition-all hover:-translate-y-0.5 border-[hsl(var(--accent))]/30 cursor-pointer h-full">
                    <CardContent className="p-4">
                      <div className="flex items-start gap-3 mb-2">
                        <div className="w-12 h-12 rounded-xl bg-[hsl(var(--muted))]/50 flex-shrink-0 overflow-hidden flex items-center justify-center">
                          {c.logo_url ? <img src={c.logo_url} alt={c.name} className="w-full h-full object-contain" /> : <Scissors className="h-5 w-5 text-[hsl(var(--primary))]/40" />}
                        </div>
                        <div className="min-w-0 flex-1">
                          <h3 className="font-semibold text-sm text-[hsl(var(--foreground))] line-clamp-1">{c.name}</h3>
                          {c.city && <p className="text-xs text-[hsl(var(--muted-foreground))] line-clamp-1">{c.city}</p>}
                        </div>
                      </div>
                      <Badge variant="outline" className="bg-[hsl(var(--accent))]/10 text-[hsl(var(--accent))] border-[hsl(var(--accent))]/30 text-xs">
                        <Zap className="h-3 w-3 mr-1" /> Horário livre
                      </Badge>
                    </CardContent>
                  </Card>
                </Link>
              ))}
            </div>
          )}
        </section>
      )}

      {/* Featured (premium proxy) */}
      {!loading && tiered.featured.length > 0 && (
        <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
          <div className="flex items-center justify-between mb-6">
            <div>
              <div className="inline-flex items-center gap-2 bg-amber-100 text-amber-800 px-3 py-1 rounded-full text-xs font-semibold mb-2">
                <Crown className="h-3.5 w-3.5" />
                Em destaque
              </div>
              <h2 className="text-2xl md:text-3xl font-display font-bold text-[hsl(var(--foreground))]">
                Em destaque na sua região ⭐
              </h2>
            </div>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
            {tiered.featured.map(c => (
              <Link key={c.id} to={getProfileRoute(c)}>
                <Card className="overflow-hidden hover:shadow-xl transition-all hover:-translate-y-1 border-amber-200 group cursor-pointer h-full bg-gradient-to-br from-amber-50/50 to-transparent">
                  <CardContent className="p-5">
                    <div className="flex items-start gap-4">
                      <div className="w-16 h-16 rounded-xl bg-white shadow-sm flex-shrink-0 overflow-hidden flex items-center justify-center ring-2 ring-amber-200">
                        {c.logo_url ? <img src={c.logo_url} alt={c.name} className="w-full h-full object-contain" /> : <Scissors className="h-7 w-7 text-[hsl(var(--primary))]/40" />}
                      </div>
                      <div className="min-w-0 flex-1">
                        <h3 className="font-semibold text-[hsl(var(--foreground))] group-hover:text-[hsl(var(--primary))] transition-colors line-clamp-1">
                          {c.name}
                        </h3>
                        {(c.city || c.state) && (
                          <div className="flex items-center gap-1 mt-0.5 text-sm text-[hsl(var(--muted-foreground))]">
                            <MapPin className="h-3 w-3 flex-shrink-0" />
                            <span className="line-clamp-1">{[c.city, c.state].filter(Boolean).join(', ')}</span>
                          </div>
                        )}
                        <div className="flex items-center gap-3 mt-2 flex-wrap">
                          {c.average_rating ? (
                            <div className="flex items-center gap-1">
                              <StarRating rating={c.average_rating} size={12} />
                              <span className="text-xs font-semibold">{c.average_rating.toFixed(1)}</span>
                              {c.review_count ? <span className="text-xs text-[hsl(var(--muted-foreground))]">({c.review_count})</span> : null}
                            </div>
                          ) : null}
                          {c.distance !== undefined && (
                            <span className="text-xs text-[hsl(var(--accent))] font-medium">{formatDistance(c.distance)}</span>
                          )}
                        </div>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </Link>
            ))}
          </div>
        </section>
      )}

      {/* Recommended (mid tier) */}
      {!loading && tiered.recommended.length > 0 && (
        <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
          <h2 className="text-2xl font-display font-bold text-[hsl(var(--foreground))] mb-6">
            Outros profissionais recomendados
          </h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {tiered.recommended.map(c => (
              <Link key={c.id} to={getProfileRoute(c)}>
                <Card className="overflow-hidden hover:shadow-md transition-all hover:-translate-y-0.5 border-[hsl(var(--border))] group cursor-pointer h-full">
                  <CardContent className="p-4">
                    <div className="flex items-start gap-3">
                      <div className="w-12 h-12 rounded-xl bg-[hsl(var(--muted))]/50 flex-shrink-0 overflow-hidden flex items-center justify-center">
                        {c.logo_url ? <img src={c.logo_url} alt={c.name} className="w-full h-full object-contain" /> : <Scissors className="h-5 w-5 text-[hsl(var(--primary))]/40" />}
                      </div>
                      <div className="min-w-0 flex-1">
                        <h3 className="font-semibold text-sm text-[hsl(var(--foreground))] group-hover:text-[hsl(var(--primary))] transition-colors line-clamp-1">
                          {c.name}
                        </h3>
                        {c.city && <p className="text-xs text-[hsl(var(--muted-foreground))] line-clamp-1 mt-0.5">{c.city}</p>}
                        <div className="flex items-center gap-2 mt-1.5">
                          {c.average_rating ? (
                            <div className="flex items-center gap-1">
                              <Star className="h-3 w-3 fill-amber-400 text-amber-400" />
                              <span className="text-xs font-medium">{c.average_rating.toFixed(1)}</span>
                            </div>
                          ) : null}
                          {c.distance !== undefined && (
                            <span className="text-xs text-[hsl(var(--muted-foreground))]">{formatDistance(c.distance)}</span>
                          )}
                        </div>
                      </div>
                      <ChevronRight className="h-4 w-4 text-[hsl(var(--muted-foreground))] flex-shrink-0" />
                    </div>
                  </CardContent>
                </Card>
              </Link>
            ))}
          </div>
        </section>
      )}

      {/* Basic grid */}
      {!loading && tiered.basic.length > 0 && (
        <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
          <h2 className="text-xl font-display font-semibold text-[hsl(var(--foreground))] mb-6">
            Mais profissionais
          </h2>
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-3">
            {tiered.basic.slice(0, 24).map(c => (
              <Link key={c.id} to={getProfileRoute(c)}>
                <Card className="hover:shadow-md transition-all border-[hsl(var(--border))] cursor-pointer h-full">
                  <CardContent className="p-3 flex flex-col items-center text-center">
                    <div className="w-12 h-12 rounded-xl bg-[hsl(var(--muted))]/50 overflow-hidden flex items-center justify-center mb-2">
                      {c.logo_url ? <img src={c.logo_url} alt={c.name} className="w-full h-full object-contain" /> : <Scissors className="h-5 w-5 text-[hsl(var(--primary))]/40" />}
                    </div>
                    <p className="text-xs font-medium text-[hsl(var(--foreground))] line-clamp-2">{c.name}</p>
                  </CardContent>
                </Card>
              </Link>
            ))}
          </div>
        </section>
      )}

      {/* Categories */}
      <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        <h2 className="text-2xl font-display font-bold text-[hsl(var(--foreground))] text-center mb-8">
          Explore por categoria
        </h2>
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          {categories.map(cat => (
            <Link key={cat.slug} to={`/${cat.slug}`}>
              <Card className="overflow-hidden hover:shadow-lg transition-all hover:-translate-y-1 border-[hsl(var(--border))] group cursor-pointer h-full">
                <CardContent className="p-5 text-center">
                  <div className={`w-14 h-14 rounded-2xl bg-gradient-to-br ${cat.gradient} flex items-center justify-center mx-auto mb-3`}>
                    <cat.icon className={`h-7 w-7 ${cat.iconColor}`} />
                  </div>
                  <h3 className="font-semibold text-[hsl(var(--foreground))] group-hover:text-[hsl(var(--primary))] transition-colors">{cat.title}</h3>
                  <p className="text-xs text-[hsl(var(--muted-foreground))] mt-1">{cat.description}</p>
                </CardContent>
              </Card>
            </Link>
          ))}
        </div>
      </section>

      {/* CTA for professionals */}
      <section className="bg-gradient-to-r from-[hsl(var(--primary))] to-[hsl(var(--primary))]/80 py-16 mt-8">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
          <Users className="h-10 w-10 text-white/80 mx-auto mb-4" />
          <h2 className="text-2xl md:text-3xl font-display font-bold text-white mb-4">
            Você é profissional de beleza?
          </h2>
          <p className="text-lg text-white/80 mb-8 max-w-xl mx-auto">
            Crie seu perfil gratuito e receba agendamentos de novos clientes automaticamente.
          </p>
          <Link to="/profissionais">
            <Button size="lg" className="bg-white text-[hsl(var(--primary))] hover:bg-white/90 shadow-lg text-base px-8">
              Criar perfil profissional
              <ArrowRight className="h-5 w-5 ml-2" />
            </Button>
          </Link>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-[hsl(var(--border))] py-8">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex flex-col md:flex-row items-center justify-between gap-4">
            {headerLogo ? (
              <img src={headerLogo} alt="Agendae" className="h-8 max-w-[120px] object-contain" />
            ) : (
              <div className="w-8 h-8 rounded-lg bg-[hsl(var(--primary))] flex items-center justify-center">
                <Scissors className="h-4 w-4 text-white" />
              </div>
            )}
            <div className="flex items-center gap-6 text-sm text-[hsl(var(--muted-foreground))]">
              <Link to="/barbeiros" className="hover:text-[hsl(var(--foreground))]">Barbeiros</Link>
              <Link to="/esteticistas" className="hover:text-[hsl(var(--foreground))]">Esteticistas</Link>
              <Link to="/salao-de-beleza" className="hover:text-[hsl(var(--foreground))]">Salões</Link>
              <Link to="/profissionais" className="hover:text-[hsl(var(--foreground))]">Para profissionais</Link>
            </div>
            <p className="text-xs text-[hsl(var(--muted-foreground))]">
              © {new Date().getFullYear()} Agendae. Todos os direitos reservados.
            </p>
          </div>
        </div>
      </footer>
    </div>
  );
}
