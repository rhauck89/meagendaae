import { Link } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { SEOHead } from '@/components/SEOHead';
import { usePlatformSettings } from '@/hooks/usePlatformSettings';
import {
  Scissors, ArrowRight, Star, MapPin, Search, Sparkles,
  Calendar, Users, ChevronRight, Heart, Shield
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

export default function MarketplaceHome() {
  const platform = usePlatformSettings();
  const headerLogo = platform?.logo_dark || platform?.system_logo || platform?.logo_light || null;

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
        </div>
      </section>

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
