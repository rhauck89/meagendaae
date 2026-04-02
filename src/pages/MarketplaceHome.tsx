import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { SEOHead } from '@/components/SEOHead';
import { usePlatformSettings } from '@/hooks/usePlatformSettings';
import { useGeolocation, calculateDistance, formatDistance } from '@/hooks/useGeolocation';
import {
  Scissors, ArrowRight, Star, MapPin, Search, Sparkles,
  Calendar, Users, ChevronRight, Heart, Shield, Navigation, Loader2
} from 'lucide-react';

const categories = [
  {
    slug: 'barbeiros',
    title: 'Barbeiros',
    description: 'Corte, barba e tratamentos masculinos',
    icon: Scissors,
    gradient: 'from-blue-500/10 to-blue-600/5',
    iconColor: 'text-blue-600',
  },
  {
    slug: 'esteticistas',
    title: 'Esteticistas',
    description: 'Tratamentos faciais, corporais e bem-estar',
    icon: Sparkles,
    gradient: 'from-pink-500/10 to-pink-600/5',
    iconColor: 'text-pink-600',
  },
  {
    slug: 'salao-de-beleza',
    title: 'Salões de Beleza',
    description: 'Corte, coloração, penteados e tratamentos',
    icon: Heart,
    gradient: 'from-purple-500/10 to-purple-600/5',
    iconColor: 'text-purple-600',
  },
  {
    slug: 'clinica-estetica',
    title: 'Clínicas de Estética',
    description: 'Procedimentos estéticos e tratamentos avançados',
    icon: Shield,
    gradient: 'from-emerald-500/10 to-emerald-600/5',
    iconColor: 'text-emerald-600',
  },
];

const benefits = [
  { icon: Search, title: 'Encontre profissionais', desc: 'Busque por cidade, categoria e avaliação' },
  { icon: Calendar, title: 'Agende online', desc: 'Marque seu horário sem precisar ligar' },
  { icon: Star, title: 'Avaliações reais', desc: 'Veja o que outros clientes acharam' },
  { icon: MapPin, title: 'Perto de você', desc: 'Profissionais na sua cidade' },
];

interface NearbyCompany {
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

export default function MarketplaceHome() {
  const platform = usePlatformSettings();
  const headerLogo = platform?.logo_dark || platform?.system_logo || platform?.logo_light || null;
  const geo = useGeolocation();
  const [nearbyCompanies, setNearbyCompanies] = useState<NearbyCompany[]>([]);
  const [loadingNearby, setLoadingNearby] = useState(false);

  useEffect(() => {
    if (geo.latitude && geo.longitude) {
      loadNearby(geo.latitude, geo.longitude);
    }
  }, [geo.latitude, geo.longitude]);

  const loadNearby = async (lat: number, lng: number) => {
    setLoadingNearby(true);
    const { data } = await supabase
      .from('public_company' as any)
      .select('id, name, slug, logo_url, city, state, average_rating, review_count, business_type, latitude, longitude')
      .not('latitude', 'is', null)
      .not('longitude', 'is', null);

    if (data) {
      const withDistance = (data as any[])
        .map((c: any) => ({
          ...c,
          distance: calculateDistance(lat, lng, c.latitude, c.longitude),
        }))
        .filter((c: any) => c.distance <= 20)
        .sort((a: any, b: any) => a.distance - b.distance)
        .slice(0, 6);
      setNearbyCompanies(withDistance);
    }
    setLoadingNearby(false);
  };

  const getProfileRoute = (company: NearbyCompany) => {
    const bt = company.business_type === 'barbershop' ? 'barbearia' : 'estetica';
    return `/${bt}/${company.slug}`;
  };

  return (
    <div className="min-h-screen bg-white">
      <SEOHead
        title="Agendae — Encontre profissionais de beleza e agende online"
        description="Encontre barbeiros, esteticistas e salões de beleza na sua cidade. Agende online com profissionais avaliados."
        keywords="barbeiro, esteticista, salão de beleza, agendamento online, beleza"
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
            <Link to="/auth">
              <Button variant="ghost" size="sm">Entrar</Button>
            </Link>
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
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-16 md:py-24 text-center">
          <h1 className="text-4xl md:text-5xl lg:text-6xl font-display font-bold text-[hsl(var(--foreground))] leading-tight mb-6">
            Encontre profissionais de beleza e{' '}
            <span className="text-[hsl(var(--accent))]">agende online</span>
          </h1>
          <p className="text-lg md:text-xl text-[hsl(var(--muted-foreground))] max-w-2xl mx-auto mb-10">
            Barbeiros, esteticistas e salões de beleza avaliados por clientes reais.
            Agende seu horário em segundos, sem precisar ligar.
          </p>
          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <Link to="/barbeiros">
              <Button size="lg" className="w-full sm:w-auto text-base px-8 bg-[hsl(var(--primary))] text-[hsl(var(--primary-foreground))]">
                <Search className="h-5 w-5 mr-2" />
                Buscar profissionais
              </Button>
            </Link>
            <Link to="/profissionais">
              <Button size="lg" variant="outline" className="w-full sm:w-auto text-base px-8">
                Sou profissional
                <ArrowRight className="h-5 w-5 ml-2" />
              </Button>
            </Link>
          </div>

          {/* Geolocation prompt */}
          {geo.permission === 'prompt' && !geo.latitude && (
            <div className="mt-8">
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
                Usar minha localização
              </Button>
            </div>
          )}
        </div>
      </section>

      {/* Nearby professionals */}
      {(geo.latitude && nearbyCompanies.length > 0) && (
        <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-16">
          <div className="text-center mb-12">
            <div className="inline-flex items-center gap-2 bg-[hsl(var(--accent))]/10 text-[hsl(var(--accent))] px-4 py-1.5 rounded-full text-sm font-medium mb-4">
              <Navigation className="h-4 w-4" />
              Baseado na sua localização
            </div>
            <h2 className="text-2xl md:text-3xl font-display font-bold text-[hsl(var(--foreground))] mb-3">
              Profissionais próximos de você
            </h2>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
            {nearbyCompanies.map(company => (
              <Link key={company.id} to={getProfileRoute(company)}>
                <Card className="overflow-hidden hover:shadow-xl transition-all duration-300 hover:-translate-y-1 border-[hsl(var(--border))] group cursor-pointer h-full">
                  <CardContent className="p-5">
                    <div className="flex items-start gap-4">
                      <div className="w-14 h-14 rounded-xl bg-[hsl(var(--muted))]/50 flex-shrink-0 overflow-hidden flex items-center justify-center">
                        {company.logo_url ? (
                          <img src={company.logo_url} alt={company.name} className="w-full h-full object-contain" />
                        ) : (
                          <Scissors className="h-6 w-6 text-[hsl(var(--primary))]/40" />
                        )}
                      </div>
                      <div className="min-w-0 flex-1">
                        <h3 className="font-semibold text-[hsl(var(--foreground))] group-hover:text-[hsl(var(--primary))] transition-colors line-clamp-1">
                          {company.name}
                        </h3>
                        {(company.city || company.state) && (
                          <div className="flex items-center gap-1 mt-0.5 text-sm text-[hsl(var(--muted-foreground))]">
                            <MapPin className="h-3 w-3 flex-shrink-0" />
                            <span className="line-clamp-1">{[company.city, company.state].filter(Boolean).join(', ')}</span>
                          </div>
                        )}
                        <div className="flex items-center gap-3 mt-2">
                          {company.average_rating && company.average_rating > 0 ? (
                            <div className="flex items-center gap-1">
                              <StarRating rating={company.average_rating} size={12} />
                              <span className="text-xs font-medium">{company.average_rating.toFixed(1)}</span>
                            </div>
                          ) : null}
                          {company.distance !== undefined && (
                            <span className="text-xs text-[hsl(var(--accent))] font-medium">
                              {formatDistance(company.distance)}
                            </span>
                          )}
                        </div>
                      </div>
                      <ChevronRight className="h-5 w-5 text-[hsl(var(--muted-foreground))] flex-shrink-0 mt-1" />
                    </div>
                  </CardContent>
                </Card>
              </Link>
            ))}
          </div>
        </section>
      )}

      {loadingNearby && (
        <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-16 text-center">
          <Loader2 className="h-8 w-8 animate-spin text-[hsl(var(--primary))] mx-auto mb-4" />
          <p className="text-[hsl(var(--muted-foreground))]">Buscando profissionais próximos...</p>
        </section>
      )}

      {/* Categories */}
      <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-16">
        <div className="text-center mb-12">
          <h2 className="text-2xl md:text-3xl font-display font-bold text-[hsl(var(--foreground))] mb-3">
            Explore por categoria
          </h2>
          <p className="text-[hsl(var(--muted-foreground))]">
            Escolha a categoria e encontre profissionais na sua cidade
          </p>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
          {categories.map(cat => (
            <Link key={cat.slug} to={`/${cat.slug}`}>
              <Card className="overflow-hidden hover:shadow-xl transition-all duration-300 hover:-translate-y-1 border-[hsl(var(--border))] group cursor-pointer h-full">
                <CardContent className="p-6 text-center">
                  <div className={`w-16 h-16 rounded-2xl bg-gradient-to-br ${cat.gradient} flex items-center justify-center mx-auto mb-4`}>
                    <cat.icon className={`h-8 w-8 ${cat.iconColor}`} />
                  </div>
                  <h3 className="font-semibold text-lg text-[hsl(var(--foreground))] mb-2 group-hover:text-[hsl(var(--primary))] transition-colors">
                    {cat.title}
                  </h3>
                  <p className="text-sm text-[hsl(var(--muted-foreground))]">
                    {cat.description}
                  </p>
                  <div className="mt-4 flex items-center justify-center text-sm font-medium text-[hsl(var(--primary))]">
                    Ver profissionais
                    <ChevronRight className="h-4 w-4 ml-1" />
                  </div>
                </CardContent>
              </Card>
            </Link>
          ))}
        </div>
      </section>

      {/* Benefits */}
      <section className="bg-[hsl(var(--muted))]/30 py-16">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-12">
            <h2 className="text-2xl md:text-3xl font-display font-bold text-[hsl(var(--foreground))] mb-3">
              Por que usar o Agendae?
            </h2>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-8">
            {benefits.map((b, i) => (
              <div key={i} className="text-center">
                <div className="w-12 h-12 rounded-xl bg-[hsl(var(--primary))]/10 flex items-center justify-center mx-auto mb-4">
                  <b.icon className="h-6 w-6 text-[hsl(var(--primary))]" />
                </div>
                <h3 className="font-semibold text-[hsl(var(--foreground))] mb-1">{b.title}</h3>
                <p className="text-sm text-[hsl(var(--muted-foreground))]">{b.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* CTA for professionals */}
      <section className="bg-gradient-to-r from-[hsl(var(--primary))] to-[hsl(var(--primary))]/80 py-16">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
          <Users className="h-10 w-10 text-white/80 mx-auto mb-4" />
          <h2 className="text-2xl md:text-3xl font-display font-bold text-white mb-4">
            Você é profissional de beleza?
          </h2>
          <p className="text-lg text-white/80 mb-8 max-w-xl mx-auto">
            Crie seu perfil gratuito no Agendae e receba agendamentos de novos clientes automaticamente.
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
