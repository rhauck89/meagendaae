import { Link } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { 
  Calendar, Users, Zap, BarChart3, Scissors, Check, Star, 
  ArrowRight, Sparkles, ShieldCheck, TrendingUp, Clock, Heart, 
  MessageCircle, ChevronRight, Play, Menu, X, DollarSign
} from 'lucide-react';
import { Reveal } from '@/components/landing/Reveal';
import { AnimatedCounter } from '@/components/landing/AnimatedCounter';
import { PlatformLogo } from '@/components/PlatformLogo';
import { SEOHead } from '@/components/SEOHead';
import testimonial1 from '@/assets/testimonial-1.jpg';
import testimonial2 from '@/assets/testimonial-2.jpg';
import testimonial3 from '@/assets/testimonial-3.jpg';
import heroProf from '@/assets/hero-prof.jpg';
// dashboardPreview import removed as the asset was missing

const testimonials = [
  {
    image: testimonial1,
    name: 'Rafael Souza',
    role: 'Barbeiro • São Paulo',
    quote: 'Depois que comecei a usar o Me Agendaê, minha agenda parou de depender do WhatsApp e meu faturamento subiu.',
  },
  {
    image: testimonial2,
    name: 'Camila Ribeiro',
    role: 'Cabeleireira • Rio de Janeiro',
    quote: 'A organização da equipe e o controle de comissões automáticas salvaram meu salão de muita dor de cabeça.',
  },
  {
    image: testimonial3,
    name: 'Aline Pereira',
    role: 'Manicure • Belo Horizonte',
    quote: 'Meus clientes amam a facilidade de agendar online. O Me Agendaê é indispensável para quem quer crescer.',
  },
];

export default function LandingProfissionais() {
  return (
    <div className="min-h-screen bg-background overflow-x-hidden">
      <SEOHead
        title="Me Agendaê — Agendamento online para barbeiros, salões e profissionais da beleza"
        description="Teste grátis por 7 dias. Organize agenda, equipe e faturamento com uma landing premium focada em conversão para o Me Agendaê."
        keywords="agendamento online, barbearia, salão de beleza, manicure, esteticista, sistema de agendamento"
      />

      <nav className="sticky top-0 z-50 border-b border-border/60 bg-background/85 backdrop-blur-xl">
        <div className="mx-auto flex max-w-7xl items-center justify-between px-4 py-3 sm:px-6">
          <Link to="/" className="flex items-center gap-3">
            <PlatformLogo compact className="shrink-0" onDarkBackground={false} />
            <span className="font-display text-lg font-bold text-foreground">Me Agendaê</span>
          </Link>
          <div className="hidden md:flex items-center gap-6 text-sm font-medium text-muted-foreground">
            <a href="#funcionalidades" className="hover:text-foreground transition-colors">Funcionalidades</a>
            <a href="#planos" className="hover:text-foreground transition-colors">Planos</a>
          </div>
          <div className="flex items-center gap-3">
            <Link to="/auth">
              <Button variant="ghost" size="sm">Entrar</Button>
            </Link>
            <Link to="/auth">
              <Button size="sm" className="bg-accent text-accent-foreground hover:bg-accent/90 shadow-lg shadow-accent/20 font-semibold">
                Começar grátis
              </Button>
            </Link>
          </div>
        </div>
      </nav>

      {/* Hero */}
      <section className="relative pt-16 pb-20 lg:pt-24 lg:pb-32">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 grid lg:grid-cols-2 gap-12 items-center">
          <Reveal>
            <Badge className="mb-6 bg-accent/10 text-accent-foreground border border-accent/30 px-3 py-1.5 font-semibold">
              <Sparkles className="h-3.5 w-3.5 mr-1.5 text-accent" />
              Sistema completo para profissionais
            </Badge>
            <h1 className="text-4xl sm:text-5xl lg:text-6xl font-display font-bold leading-[1.05] tracking-tight text-foreground mb-6">
              Profissionalize seu atendimento com o <span className="text-accent">Me Agendaê</span>
            </h1>
            <p className="mb-8 max-w-xl text-lg text-muted-foreground leading-relaxed">
              O Me Agendaê organiza sua operação e tira o caos do dia a dia para você focar no atendimento, no faturamento e na experiência do cliente.
            </p>
            <div className="flex flex-col sm:flex-row gap-3">
              <Link to="/auth">
                <Button size="lg" className="h-12 px-8 text-base font-semibold bg-accent text-accent-foreground hover:bg-accent/90 shadow-xl shadow-accent/30">
                  Testar 7 dias grátis
                  <ArrowRight className="h-4 w-4 ml-2" />
                </Button>
              </Link>
            </div>
          </Reveal>
          <Reveal delay={200}>
            <div className="relative rounded-3xl overflow-hidden shadow-2xl ring-1 ring-border">
              <img src={heroProf} alt="Profissional usando Me Agendaê" className="w-full h-[500px] object-cover" />
            </div>
          </Reveal>
        </div>
      </section>

      {/* Features Grid */}
      <section id="funcionalidades" className="py-20 bg-secondary/30">
        <div className="mx-auto max-w-7xl px-4 sm:px-6">
          <Reveal className="text-center mb-16">
            <h2 className="text-3xl sm:text-4xl font-display font-bold mb-4">Tudo o que você precisa</h2>
            <p className="text-muted-foreground max-w-2xl mx-auto">Ferramentas poderosas para gerenciar seu negócio de beleza.</p>
          </Reveal>
          <div className="grid md:grid-cols-3 gap-6">
            {[
              { icon: Calendar, title: 'Agenda Inteligente', desc: 'Agendamento online 24h com bloqueio automático de horários.' },
              { icon: DollarSign, title: 'Financeiro Completo', desc: 'Controle de entradas, saídas, comissões e lucro mensal.' },
              { icon: Users, title: 'Gestão de Equipe', desc: 'Gerencie profissionais, sócios e comissionados facilmente.' },
              { icon: Sparkles, title: 'Fidelidade e Promo', desc: 'Cashback, pontos e promoções para clientes voltarem.' },
              { icon: BarChart3, title: 'Relatórios', desc: 'Acompanhe o crescimento do seu negócio com dados reais.' },
              { icon: MessageCircle, title: 'WhatsApp Center', desc: 'Comunicação facilitada com seus clientes.' },
            ].map((f, i) => (
              <Reveal key={i} delay={i * 100}>
                <Card className="h-full border-border/60 shadow-sm hover:shadow-md transition-shadow">
                  <CardContent className="p-6">
                    <div className="w-12 h-12 rounded-xl bg-primary/10 flex items-center justify-center mb-4">
                      <f.icon className="h-6 w-6 text-primary" />
                    </div>
                    <h3 className="font-bold text-lg mb-2">{f.title}</h3>
                    <p className="text-sm text-muted-foreground">{f.desc}</p>
                  </CardContent>
                </Card>
              </Reveal>
            ))}
          </div>
        </div>
      </section>

      {/* Dashboard Preview */}
      <section className="py-20">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 grid lg:grid-cols-2 gap-12 items-center">
          <Reveal>
            <h2 className="text-3xl sm:text-4xl font-display font-bold mb-6">
              Um painel simples e poderoso
            </h2>
            <p className="text-lg text-muted-foreground mb-8">
              Veja sua agenda, faturamento e desempenho da equipe em uma única tela. Sem complicações.
            </p>
            <Link to="/auth">
              <Button size="lg" className="h-12 px-8 font-semibold">
                Conhecer o sistema
              </Button>
            </Link>
          </Reveal>
          <Reveal delay={200}>
            <div className="rounded-3xl overflow-hidden shadow-2xl ring-1 ring-border">
              <img src="https://images.unsplash.com/photo-1460925895917-afdab827c52f?auto=format&fit=crop&q=80&w=2426" alt="Dashboard Me Agendaê" className="w-full h-auto rounded-xl shadow-lg" />
            </div>
          </Reveal>
        </div>
      </section>

      {/* Testimonials */}
      <section id="depoimentos" className="py-20 bg-secondary/30">
        <div className="mx-auto max-w-7xl px-4 sm:px-6">
          <h2 className="text-3xl sm:text-4xl font-display font-bold text-center mb-16">O que dizem nossos parceiros</h2>
          <div className="grid md:grid-cols-3 gap-8">
            {testimonials.map((t, i) => (
              <Reveal key={i} delay={i * 100}>
                <div className="bg-card p-6 rounded-2xl border border-border/60 shadow-sm h-full flex flex-col">
                  <p className="text-muted-foreground mb-6 flex-1 italic">"{t.quote}"</p>
                  <div className="flex items-center gap-4">
                    <img src={t.image} alt={t.name} className="w-12 h-12 rounded-full object-cover" />
                    <div>
                      <p className="font-bold text-sm">{t.name}</p>
                      <p className="text-xs text-muted-foreground">{t.role}</p>
                    </div>
                  </div>
                </div>
              </Reveal>
            ))}
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-border/60 py-12">
        <div className="mx-auto max-w-7xl px-4 sm:px-6">
          <div className="flex flex-col items-center gap-6 border-t border-border/60 pt-10 md:flex-row md:justify-between md:pt-12">
            <div className="flex flex-col items-center gap-3 md:items-start">
              <p className="font-display font-bold text-foreground">Me Agendaê</p>
              <p className="text-sm text-muted-foreground">O jeito premium de agendar.</p>
            </div>
            <p className="text-xs text-muted-foreground">© {new Date().getFullYear()} Me Agendaê</p>
          </div>
        </div>
      </footer>
    </div>
  );
}
