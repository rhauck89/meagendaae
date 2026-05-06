import { useEffect, useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { SEOHead } from '@/components/SEOHead';
import { usePlatformSettings } from '@/hooks/usePlatformSettings';
import { useGeolocation, calculateDistance, formatDistance } from '@/hooks/useGeolocation';
import {
  Star, MapPin, Search, Scissors, ArrowRight, ChevronRight, Sparkles,
  Navigation, Loader2
} from 'lucide-react';
import { AmenitiesDisplay } from '@/components/AmenitiesDisplay';

interface CategoryConfig {
  slug: string;
  label: string;
  businessType: 'barbershop' | 'esthetic';
  seoTitle: string;
  seoDescription: string;
  heroTitle: string;
  heroSubtitle: string;
  profilePrefix: string;
}

const CATEGORIES: Record<string, CategoryConfig> = {
  barbeiros: {
    slug: 'barbeiros',
    label: 'Barbeiros',
    businessType: 'barbershop',
    seoTitle: 'Barbeiros perto de você | Agendae',
    seoDescription: 'Encontre os melhores barbeiros da sua cidade e agende online. Corte de cabelo, barba e muito mais com profissionais avaliados.',
    heroTitle: 'Encontre barbeiros perto de você',
    heroSubtitle: 'Descubra os melhores barbeiros da sua cidade e agende online em segundos.',
    profilePrefix: 'barbeiro',
  },
  esteticistas: {
    slug: 'esteticistas',
    label: 'Esteticistas',
    businessType: 'esthetic',
    seoTitle: 'Esteticistas perto de você | Agendae',
    seoDescription: 'Encontre esteticistas e clínicas de estética na sua cidade. Agende tratamentos faciais, corporais e muito mais.',
    heroTitle: 'Encontre esteticistas perto de você',
    heroSubtitle: 'Profissionais de estética avaliados e prontos para atender você.',
    profilePrefix: 'esteticista',
  },
  'salao-de-beleza': {
    slug: 'salao-de-beleza',
    label: 'Salões de Beleza',
    businessType: 'esthetic',
    seoTitle: 'Salões de Beleza perto de você | Agendae',
    seoDescription: 'Encontre salões de beleza com os melhores profissionais da sua cidade. Corte, coloração, tratamentos e mais.',
    heroTitle: 'Encontre salões de beleza perto de você',
    heroSubtitle: 'Os melhores salões com agendamento online e avaliações reais.',
    profilePrefix: 'salao',
  },
  'clinica-estetica': {
    slug: 'clinica-estetica',
    label: 'Clínicas de Estética',
    businessType: 'esthetic',
    seoTitle: 'Clínicas de Estética perto de você | Agendae',
    seoDescription: 'Encontre clínicas de estética com profissionais qualificados. Tratamentos faciais, corporais e procedimentos estéticos.',
    heroTitle: 'Encontre clínicas de estética perto de você',
    heroSubtitle: 'Profissionais qualificados com agendamento online e avaliações reais.',
    profilePrefix: 'clinica',
  },
};

interface CompanyCard {
  id: string;
  name: string;
  slug: string;
  logo_url: string | null;
  cover_url: string | null;
  city: string | null;
  state: string | null;
  average_rating: number | null;
  review_count: number | null;
  business_type: string;
  latitude: number | null;
  longitude: number | null;
  distance?: number;
}

const StarRating = ({ rating, size = 14 }: { rating: number; size?: number }) => (
  <div className="flex items-center gap-0.5">
    {[1, 2, 3, 4, 5].map((s) => {
      const fill = rating >= s ? 1 : rating >= s - 0.5 ? 0.5 : 0;
      return (
        <svg key={s} width={size} height={size} viewBox="0 0 24 24" fill="none">
          <defs>
            <linearGradient id={`mp-star-${s}-${size}`}>
              <stop offset={`${fill * 100}%`} stopColor="#FDBA2D" />
              <stop offset={`${fill * 100}%`} stopColor="#D1D5DB" />
            </linearGradient>
          </defs>
          <path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z" fill={`url(#mp-star-${s}-${size})`} />
        </svg>
      );
    })}
  </div>
);

type SortOption = 'nearest' | 'rating' | 'popular' | 'recent';
type RadiusOption = '5' | '10' | '20' | 'all';

export default function MarketplaceCategory() {
  const location = useLocation();
  const category = location.pathname.replace('/', '');
  const config = category ? CATEGORIES[category] : null;
  const platform = usePlatformSettings();
  const headerLogo = platform?.logo_dark || platform?.system_logo || platform?.logo_light || null;
  const geo = useGeolocation();

  const [companies, setCompanies] = useState<CompanyCard[]>([]);
  const [filtered, setFiltered] = useState<CompanyCard[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchCity, setSearchCity] = useState('');
  const [ratingFilter, setRatingFilter] = useState('all');
  const [states, setStates] = useState<string[]>([]);
  const [stateFilter, setStateFilter] = useState('all');
  const [sortBy, setSortBy] = useState<SortOption>(geo.latitude ? 'nearest' : 'rating');
  const [radius, setRadius] = useState<RadiusOption>('10');
  const [companyAmenities, setCompanyAmenities] = useState<Record<string, any[]>>({});

  useEffect(() => {
    if (!config) return;
    loadCompanies();
  }, [category]);

  useEffect(() => {
    if (geo.latitude && sortBy !== 'nearest') {
      setSortBy('nearest');
    }
  }, [geo.latitude]);

  const loadCompanies = async () => {
    if (!config) return;
    setLoading(true);

    const { data } = await supabase
      .from('public_company' as any)
      .select('id, name, slug, logo_url, cover_url, city, state, average_rating, review_count, business_type, latitude, longitude')
      .eq('business_type', config.businessType)
      .order('average_rating', { ascending: false, nullsFirst: false });

    const items = (data as any[] || []) as CompanyCard[];
    setCompanies(items);

    const uniqueStates = [...new Set(items.map(c => c.state).filter(Boolean))] as string[];
    setStates(uniqueStates.sort());

    // Fetch amenities for all companies
    if (items.length > 0) {
      const ids = items.map(c => c.id);
      const { data: amData } = await supabase
        .from('company_amenities' as any)
        .select('company_id, amenity_id, is_featured, amenities(id, name, icon)')
        .in('company_id', ids);
      if (amData) {
        const grouped: Record<string, any[]> = {};
        (amData as any[]).forEach(ca => {
          if (!grouped[ca.company_id]) grouped[ca.company_id] = [];
          grouped[ca.company_id].push({
            id: ca.amenity_id,
            name: ca.amenities?.name ?? '',
            icon: ca.amenities?.icon ?? '',
            is_featured: ca.is_featured,
          });
        });
        // Sort each: featured first
        Object.keys(grouped).forEach(k => {
          grouped[k].sort((a: any, b: any) => (a.is_featured && !b.is_featured ? -1 : !a.is_featured && b.is_featured ? 1 : 0));
        });
        setCompanyAmenities(grouped);
      }
    }

    setLoading(false);
  };

  useEffect(() => {
    let result = [...companies];

    // Add distance if geo available
    if (geo.latitude && geo.longitude) {
      result = result.map(c => ({
        ...c,
        distance: c.latitude && c.longitude
          ? calculateDistance(geo.latitude!, geo.longitude!, c.latitude, c.longitude)
          : undefined,
      }));
    }

    // City/name filter
    if (searchCity.trim()) {
      const term = searchCity.toLowerCase();
      result = result.filter(c => c.city?.toLowerCase().includes(term) || c.name.toLowerCase().includes(term));
    }

    // State filter
    if (stateFilter !== 'all') {
      result = result.filter(c => c.state === stateFilter);
    }

    // Rating filter
    if (ratingFilter !== 'all') {
      const min = parseFloat(ratingFilter);
      result = result.filter(c => (c.average_rating || 0) >= min);
    }

    // Radius filter (only if geo available)
    if (geo.latitude && radius !== 'all') {
      const maxKm = parseFloat(radius);
      result = result.filter(c => c.distance !== undefined && c.distance <= maxKm);
    }

    // Sort
    switch (sortBy) {
      case 'nearest':
        result.sort((a, b) => (a.distance ?? 9999) - (b.distance ?? 9999));
        break;
      case 'rating':
        result.sort((a, b) => (b.average_rating || 0) - (a.average_rating || 0));
        break;
      case 'popular':
        result.sort((a, b) => (b.review_count || 0) - (a.review_count || 0));
        break;
      case 'recent':
        break;
    }

    setFiltered(result);
  }, [searchCity, ratingFilter, stateFilter, companies, geo.latitude, geo.longitude, sortBy, radius]);

  if (!config) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <p className="text-[hsl(var(--muted-foreground))]">Categoria não encontrada</p>
      </div>
    );
  }

  const getProfileRoute = (company: CompanyCard) => {
    const bt = company.business_type === 'barbershop' ? 'barbearia' : 'estetica';
    return `/${bt}/${company.slug}`;
  };

  return (
    <div className="min-h-screen bg-[hsl(var(--background))]">
      <SEOHead
        title={config.seoTitle}
        description={config.seoDescription}
        keywords={`${config.label.toLowerCase()}, agendamento online, beleza, ${config.label.toLowerCase()} perto de mim`}
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
            <Link to="/profissionais">
              <Button size="sm" className="bg-[hsl(var(--accent))] text-[hsl(var(--accent-foreground))] hover:bg-[hsl(var(--accent))]/90">
                Sou profissional
              </Button>
            </Link>
          </div>
        </div>
      </nav>

      {/* Hero */}
      <section className="bg-gradient-to-br from-[hsl(var(--primary))]/5 via-transparent to-[hsl(var(--accent))]/5 py-12 md:py-16">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
          <h1 className="text-3xl md:text-4xl lg:text-5xl font-display font-bold text-[hsl(var(--foreground))] mb-4">
            {config.heroTitle}
          </h1>
          <p className="text-lg text-[hsl(var(--muted-foreground))] max-w-2xl mx-auto mb-6">
            {config.heroSubtitle}
          </p>

          {/* Geo prompt */}
          {!geo.latitude && geo.permission !== 'denied' && (
            <Button
              variant="outline"
              size="sm"
              onClick={geo.requestLocation}
              disabled={geo.loading}
              className="gap-2"
            >
              {geo.loading ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Navigation className="h-4 w-4" />
              )}
              Usar minha localização para ver profissionais próximos
            </Button>
          )}
          {geo.latitude && (
            <p className="text-sm text-[hsl(var(--accent))] font-medium inline-flex items-center gap-1">
              <Navigation className="h-3.5 w-3.5" />
              Localização ativa — mostrando profissionais próximos
            </p>
          )}
        </div>
      </section>

      {/* Filters */}
      <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 -mt-6 relative z-10">
        <div className="bg-white rounded-2xl shadow-lg border border-[hsl(var(--border))] p-4 md:p-6">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-[hsl(var(--muted-foreground))]" />
              <Input
                placeholder="Buscar por cidade ou nome..."
                value={searchCity}
                onChange={(e) => setSearchCity(e.target.value)}
                className="pl-10"
              />
            </div>
            <Select value={stateFilter} onValueChange={setStateFilter}>
              <SelectTrigger>
                <SelectValue placeholder="Filtrar por estado" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos os estados</SelectItem>
                {states.map(s => (
                  <SelectItem key={s} value={s}>{s}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select value={ratingFilter} onValueChange={setRatingFilter}>
              <SelectTrigger>
                <SelectValue placeholder="Avaliação mínima" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todas as avaliações</SelectItem>
                <SelectItem value="4">4+ estrelas</SelectItem>
                <SelectItem value="4.5">4.5+ estrelas</SelectItem>
                <SelectItem value="5">5 estrelas</SelectItem>
              </SelectContent>
            </Select>
            <Select value={sortBy} onValueChange={(v) => setSortBy(v as SortOption)}>
              <SelectTrigger>
                <SelectValue placeholder="Ordenar por" />
              </SelectTrigger>
              <SelectContent>
                {geo.latitude && <SelectItem value="nearest">Mais próximos</SelectItem>}
                <SelectItem value="rating">Melhor avaliação</SelectItem>
                <SelectItem value="popular">Mais populares</SelectItem>
                <SelectItem value="recent">Mais recentes</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* Radius filter - only when geo is active */}
          {geo.latitude && (
            <div className="flex items-center gap-3 mt-4 pt-4 border-t border-[hsl(var(--border))]">
              <span className="text-sm text-[hsl(var(--muted-foreground))] whitespace-nowrap">Raio de busca:</span>
              <div className="flex gap-2 flex-wrap">
                {([
                  { value: '5', label: '5 km' },
                  { value: '10', label: '10 km' },
                  { value: '20', label: '20 km' },
                  { value: 'all', label: 'Cidade inteira' },
                ] as { value: RadiusOption; label: string }[]).map(opt => (
                  <Button
                    key={opt.value}
                    variant={radius === opt.value ? 'default' : 'outline'}
                    size="sm"
                    onClick={() => setRadius(opt.value)}
                    className={radius === opt.value
                      ? 'bg-[hsl(var(--primary))] text-[hsl(var(--primary-foreground))]'
                      : ''
                    }
                  >
                    {opt.label}
                  </Button>
                ))}
              </div>
            </div>
          )}
        </div>
      </section>

      {/* Results */}
      <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-10">
        <div className="flex items-center justify-between mb-6">
          <p className="text-sm text-[hsl(var(--muted-foreground))]">
            {filtered.length} {filtered.length === 1 ? 'profissional encontrado' : 'profissionais encontrados'}
          </p>
        </div>

        {loading ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
            {[1, 2, 3, 4, 5, 6].map(i => (
              <div key={i} className="h-72 bg-[hsl(var(--muted))]/30 rounded-2xl animate-pulse" />
            ))}
          </div>
        ) : filtered.length === 0 ? (
          <div className="text-center py-16">
            <Search className="h-12 w-12 text-[hsl(var(--muted-foreground))]/40 mx-auto mb-4" />
            <h3 className="text-lg font-semibold text-[hsl(var(--foreground))] mb-2">Nenhum profissional encontrado</h3>
            <p className="text-[hsl(var(--muted-foreground))] mb-4">Tente alterar os filtros de busca.</p>
            {geo.latitude && radius !== 'all' && (
              <Button variant="outline" size="sm" onClick={() => setRadius('all')}>
                Expandir para cidade inteira
              </Button>
            )}
            {!geo.latitude && geo.permission !== 'denied' && (
              <Button variant="outline" size="sm" onClick={geo.requestLocation} className="gap-2">
                <Navigation className="h-4 w-4" />
                Usar minha localização
              </Button>
            )}
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
            {filtered.map(company => (
              <Link key={company.id} to={getProfileRoute(company)}>
                <Card className="overflow-hidden hover:shadow-xl transition-all duration-300 hover:-translate-y-1 border-[hsl(var(--border))] group cursor-pointer h-full relative">
                  {/* Cover image */}
                  <div className="h-36 bg-gradient-to-br from-[hsl(var(--primary))]/10 to-[hsl(var(--accent))]/10 relative">
                    {company.cover_url ? (
                      <img src={company.cover_url} alt={company.name} className="w-full h-full object-cover rounded-t-2xl" />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center rounded-t-2xl">
                        <Scissors className="h-10 w-10 text-[hsl(var(--primary))]/20" />
                      </div>
                    )}
                    {company.logo_url && (
                      <div className="absolute bottom-0 left-4 translate-y-1/2 z-20">
                        <div className="w-16 h-16 rounded-full border-4 border-white bg-white shadow-md overflow-hidden flex items-center justify-center">
                          <img src={company.logo_url} alt={company.name} className="w-full h-full object-contain p-1" />
                        </div>
                      </div>
                    )}
                    {/* Distance badge */}
                    {company.distance !== undefined && (
                      <div className="absolute top-3 right-3 bg-white/90 backdrop-blur-sm text-xs font-medium text-[hsl(var(--foreground))] px-2.5 py-1 rounded-full shadow-sm flex items-center gap-1 z-10">
                        <MapPin className="h-3 w-3 text-[hsl(var(--accent))]" />
                        {formatDistance(company.distance)}
                      </div>
                    )}
                  </div>
                  <CardContent className={`p-4 ${company.logo_url ? 'pt-10' : 'pt-4'}`}>
                    <h3 className="font-semibold text-lg text-[hsl(var(--foreground))] group-hover:text-[hsl(var(--primary))] transition-colors line-clamp-1">
                      {company.name}
                    </h3>
                    {(company.city || company.state) && (
                      <div className="flex items-center gap-1 mt-1 text-sm text-[hsl(var(--muted-foreground))]">
                        <MapPin className="h-3.5 w-3.5 flex-shrink-0" />
                        <span className="line-clamp-1">
                          {[company.city, company.state].filter(Boolean).join(', ')}
                        </span>
                      </div>
                    )}
                    <div className="flex items-center gap-2 mt-3">
                      {company.average_rating && company.average_rating > 0 ? (
                        <div className="flex items-center gap-1.5">
                          <StarRating rating={company.average_rating} size={14} />
                          <span className="text-sm font-medium text-[hsl(var(--foreground))]">{company.average_rating.toFixed(1)}</span>
                          {company.review_count ? (
                            <span className="text-xs text-[hsl(var(--muted-foreground))]">({company.review_count})</span>
                          ) : null}
                        </div>
                      ) : (
                        <span className="text-xs text-[hsl(var(--muted-foreground))]">Novo no Agendae</span>
                      )}
                    </div>
                    {companyAmenities[company.id]?.length > 0 && (
                      <div className="mt-3">
                        <AmenitiesDisplay amenities={companyAmenities[company.id]} compact maxVisible={4} />
                      </div>
                    )}
                    <div className="mt-4">
                      <Button size="sm" className="w-full bg-[hsl(var(--primary))] text-[hsl(var(--primary-foreground))] hover:bg-[hsl(var(--primary))]/90">
                        Ver perfil
                        <ChevronRight className="h-4 w-4 ml-1" />
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              </Link>
            ))}
          </div>
        )}
      </section>

      {/* CTA for professionals */}
      <section className="bg-gradient-to-r from-[hsl(var(--primary))] to-[hsl(var(--primary))]/80 py-16">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
          <Sparkles className="h-10 w-10 text-white/80 mx-auto mb-4" />
          <h2 className="text-2xl md:text-3xl font-display font-bold text-white mb-4">
            Você é profissional de beleza?
          </h2>
          <p className="text-lg text-white/80 mb-8 max-w-xl mx-auto">
            Crie seu perfil gratuito no Agendae e receba agendamentos de novos clientes.
          </p>
          <Link to="/profissionais">
            <Button size="lg" className="bg-white text-[hsl(var(--primary))] hover:bg-white/90 shadow-lg text-base px-8">
              Criar perfil profissional
              <ArrowRight className="h-5 w-5 ml-2" />
            </Button>
          </Link>
        </div>
      </section>

      {/* SEO Content */}
      <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        <div className="prose prose-sm max-w-3xl mx-auto text-[hsl(var(--muted-foreground))]">
          <h2 className="text-xl font-semibold text-[hsl(var(--foreground))]">
            {config.label} com agendamento online
          </h2>
          <p>
            No Agendae, você encontra {config.label.toLowerCase()} avaliados por clientes reais.
            Todos os profissionais listados aqui possuem agendamento online, facilitando a marcação
            de horários sem precisar ligar ou enviar mensagens.
          </p>
          <p>
            Filtre por cidade, avaliação e encontre o profissional ideal para você.
            Cada perfil possui informações detalhadas sobre serviços, preços, localização e avaliações
            de outros clientes.
          </p>
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
