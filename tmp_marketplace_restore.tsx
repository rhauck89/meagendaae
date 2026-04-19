import { Link } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Separator } from '@/components/ui/separator';
import { SEOHead } from '@/components/SEOHead';
import { PlatformLogo } from '@/components/PlatformLogo';
import { Reveal } from '@/components/landing/Reveal';
import { AnimatedCounter } from '@/components/landing/AnimatedCounter';
import heroBarber from '@/assets/hero-barber.jpg';
import worriedOwner from '@/assets/worried-owner.jpg';
import teamSalon from '@/assets/team-salon.jpg';
import manicure from '@/assets/manicure.jpg';
import happyClient from '@/assets/happy-client.jpg';
import ownerFinance from '@/assets/owner-finance.jpg';
import testimonial1 from '@/assets/testimonial-1.jpg';
import testimonial2 from '@/assets/testimonial-2.jpg';
import testimonial3 from '@/assets/testimonial-3.jpg';
import {
  ArrowRight,
  Calendar,
  Check,
  Clock3,
  Heart,
  MapPin,
  MessageCircle,
  Scissors,
  ShieldCheck,
  Sparkles,
  Star,
  TrendingUp,
  Users,
  Wallet,
} from 'lucide-react';

const proofStats = [
  { value: 500, suffix: '+', label: 'profissionais usando hoje' },
  { value: 15000, suffix: '+', label: 'agendamentos realizados' },
  { value: 120, suffix: '+', label: 'cidades atendidas' },
];

const painPoints = [
  'Horários duplicados e confusos no WhatsApp',
  'Clientes esquecem e deixam sua agenda vazia',
  'Falta de controle financeiro e da equipe',
  'Perda de tempo confirmando agendamentos manualmente',
];

const featureBullets = [
  'Agendamento online 24 horas por dia',
  'Lembretes automáticos para reduzir faltas',
  'Controle financeiro simples e visual',
  'Página profissional para divulgar na bio',
  'Gestão da equipe com visão de desempenho',
  'Promoções e fidelidade para fazer o cliente voltar',
];

const plans = [
  {
    name: 'Solo',
    price: 'R$49,90',
    description: 'Perfeito para profissionais autônomos.',
    features: ['1 profissional', 'Agenda online', 'Clientes ilimitados', 'Lembretes automáticos', 'Teste grátis 7 dias'],
    featured: false,
    cta: 'Começar grátis',
  },
  {
    name: 'Studio',
    price: 'R$69,90',
    description: 'O mais vendido para crescer com organização.',
    features: ['Até 3 profissionais', 'Financeiro completo', 'Promoções e fidelidade', 'WhatsApp automático', 'Teste grátis 7 dias'],
    featured: true,
    cta: 'Testar 7 dias grátis',
  },
  {
    name: 'Elite',
    price: 'R$89,90',
    description: 'Para operações que querem escala e mais controle.',
    features: ['Profissionais ilimitados', 'Domínio próprio', 'Prioridade no marketplace', 'Relatórios avançados', 'Teste grátis 7 dias'],
    featured: false,
    cta: 'Quero o Elite',
  },
];

const testimonials = [
  {
    image: testimonial1,
    name: 'Rafael Souza',
    role: 'Barbeiro • São Paulo',
    quote: 'Depois que comecei a usar o MeAgendaê, minha agenda parou de depender do WhatsApp e meu faturamento subiu.',
  },
  {
    image: testimonial2,
    name: 'Camila Ribeiro',
    role: 'Cabeleireira • Rio de Janeiro',
    quote: 'Hoje eu tenho controle da equipe, do financeiro e dos horários em um só lugar. Ficou muito mais profissional.',
  },
  {
    image: testimonial3,
    name: 'Aline Pereira',
    role: 'Manicure • Belo Horizonte',
    quote: 'Os clientes agendam sozinhos, recebem lembrete e voltam mais vezes. Virou outro negócio.',
  },
];

const humanizedGallery = [
  {
    image: teamSalon,
    title: 'Equipe que transmite confiança',
    description: 'Mostre profissionalismo logo no primeiro contato.',
  },
  {
    image: happyClient,
    title: 'Experiência mais humana',
    description: 'Seu cliente sente organização antes mesmo de chegar.',
  },
  {
    image: manicure,
    title: 'Rotina mais bonita e leve',
    description: 'Agenda, atendimento e vendas com mais fluidez.',
  },
];

export default function MarketplaceHome() {
  return (
    <div className="min-h-screen bg-background overflow-x-hidden">
      <SEOHead
        title="MeAgendaê — Agendamento online para barbeiros, salões e profissionais da beleza"
        description="Teste grátis por 7 dias. Organize agenda, equipe e faturamento com uma landing premium focada em conversão para o MeAgendaê."
        keywords="agendamento online, barbearia, salão de beleza, manicure, esteticista, sistema de agendamento"
      />

      <nav className="sticky top-0 z-50 border-b border-border/60 bg-background/85 backdrop-blur-xl">
        <div className="mx-auto flex max-w-7xl items-center justify-between px-4 py-3 sm:px-6">
          <Link to="/" className="flex items-center gap-3">
            <PlatformLogo compact className="shrink-0" onDarkBackground={false} />
            <span className="font-display text-lg font-bold text-foreground">MeAgendaê</span>
          </Link>

          <div className="hidden items-center gap-8 text-sm font-medium text-muted-foreground md:flex">
            <a href="#beneficios" className="transition-colors hover:text-foreground">Benefícios</a>
            <a href="#planos" className="transition-colors hover:text-foreground">Planos</a>
            <a href="#depoimentos" className="transition-colors hover:text-foreground">Depoimentos</a>
          </div>

          <div className="flex items-center gap-2">
            <Link to="/auth" className="hidden sm:block">
              <Button variant="ghost" size="sm">Entrar</Button>
            </Link>
            <Link to="/auth">
              <Button size="sm" className="font-semibold shadow-lg shadow-accent/20">
                Testar 7 dias grátis
              </Button>
            </Link>
          </div>
        </div>
      </nav>

      <section className="relative overflow-hidden">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_right,hsl(var(--accent))/0.18,transparent_28%),radial-gradient(circle_at_top_left,hsl(var(--primary))/0.14,transparent_30%)]" />
        <div className="relative mx-auto grid max-w-7xl gap-14 px-4 py-16 sm:px-6 lg:grid-cols-[1.05fr_0.95fr] lg:items-center lg:py-24">
          <Reveal className="max-w-2xl">
            <Badge className="mb-6 border border-accent/25 bg-accent/10 px-4 py-1.5 text-accent-foreground">
              <Sparkles className="mr-1.5 h-3.5 w-3.5 text-accent" />
              Teste grátis por 7 dias • sem cartão de crédito
            </Badge>

            <h1 className="mb-6 font-display text-4xl font-bold leading-[1.02] tracking-tight text-foreground sm:text-5xl lg:text-6xl">
              O jeito premium de <span className="text-accent">profissionalizar</span> sua agenda e vender mais.
            </h1>

            <p className="mb-8 max-w-xl text-lg leading-relaxed text-muted-foreground sm:text-xl">
              Para barbeiros, barbearias, salões, manicures, esteticistas, lash designers e profissionais da beleza que querem organizar a rotina, ganhar tempo e fechar mais agendamentos.
            </p>

            <div className="mb-6 flex flex-col gap-3 sm:flex-row">
              <Link to="/auth">
                <Button size="lg" className="h-12 w-full px-8 text-base font-semibold shadow-xl shadow-accent/25 sm:w-auto">
                  Criar conta grátis
                  <ArrowRight className="ml-1 h-4 w-4" />
                </Button>
              </Link>
              <Link to="/profissionais">
                <Button size="lg" variant="outline" className="h-12 w-full border-2 px-8 text-base font-semibold sm:w-auto">
                  Ver página profissional
                </Button>
              </Link>
            </div>

            <div className="flex flex-wrap items-center gap-4 text-sm text-muted-foreground">
              <span className="inline-flex items-center gap-2"><ShieldCheck className="h-4 w-4 text-accent" /> Sem risco</span>
              <span className="inline-flex items-center gap-2"><Heart className="h-4 w-4 text-accent" /> Cancele quando quiser</span>
              <span className="inline-flex items-center gap-2"><Users className="h-4 w-4 text-accent" /> Profissionais da sua cidade já usam</span>
            </div>
          </Reveal>

          <Reveal delay={120}>
            <div className="relative mx-auto max-w-xl">
              <div className="overflow-hidden rounded-[2rem] border border-border/70 bg-card shadow-[0_30px_90px_-30px_hsl(var(--primary)/0.45)]">
                <img src={heroBarber} alt="Barbeiro brasileiro sorrindo segurando celular" className="h-[560px] w-full object-cover" />
              </div>

              <Card className="absolute -left-4 top-10 border-accent/20 bg-card/95 shadow-2xl backdrop-blur sm:-left-10">
                <CardContent className="flex items-center gap-3 p-4 pt-4">
                  <div className="rounded-xl bg-accent/10 p-2.5">
                    <TrendingUp className="h-5 w-5 text-accent" />
                  </div>
                  <div>
                    <p className="text-xs font-medium text-muted-foreground">Resultado gerado</p>
                    <p className="font-display text-xl font-bold text-foreground">+32% faturamento</p>
                  </div>
                </CardContent>
              </Card>

              <Card className="absolute -right-3 top-28 border-border/80 bg-card/95 shadow-2xl backdrop-blur sm:-right-8">
                <CardContent className="flex items-center gap-3 p-4 pt-4">
                  <div className="rounded-full bg-accent/12 p-2.5">
                    <Calendar className="h-5 w-5 text-accent" />
                  </div>
                  <div>
                    <p className="text-xs font-medium text-muted-foreground">Agora mesmo</p>
                    <p className="font-semibold text-foreground">Novo agendamento confirmado</p>
                  </div>
                </CardContent>
              </Card>

              <Card className="absolute bottom-8 left-8 border-border/80 bg-card/95 shadow-2xl backdrop-blur sm:left-12">
                <CardContent className="flex items-center gap-3 p-4 pt-4">
                  <div className="flex gap-1 text-accent">
                    {Array.from({ length: 5 }).map((_, index) => (
                      <Star key={index} className="h-4 w-4 fill-current" />
                    ))}
                  </div>
                  <p className="font-semibold text-foreground">5 estrelas</p>
                </CardContent>
              </Card>
            </div>
          </Reveal>
        </div>
      </section>

      <section className="border-y border-border bg-secondary/35 py-12">
        <div className="mx-auto grid max-w-7xl gap-8 px-4 text-center sm:px-6 md:grid-cols-3">
          {proofStats.map((stat, index) => (
            <Reveal key={stat.label} delay={index * 120}>
              <div>
                <div className="font-display text-4xl font-bold text-primary sm:text-5xl">
                  <AnimatedCounter end={stat.value} suffix={stat.suffix} />
                </div>
                <p className="mt-2 text-sm font-medium text-muted-foreground">{stat.label}</p>
              </div>
            </Reveal>
          ))}
        </div>
      </section>

      <section id="beneficios" className="py-20 lg:py-24">
        <div className="mx-auto max-w-7xl px-4 sm:px-6">
          <Reveal className="mx-auto mb-12 max-w-3xl text-center">
            <Badge className="mb-4 border border-primary/15 bg-primary/8 text-primary">Sessão humanizada</Badge>
            <h2 className="font-display text-3xl font-bold text-foreground sm:text-4xl lg:text-5xl">
              Tecnologia com cara de negócio real.
            </h2>
            <p className="mt-4 text-lg text-muted-foreground">
              Uma experiência premium pensada para a rotina corrida de quem atende, vende, organiza equipe e quer crescer sem bagunça.
            </p>
          </Reveal>

          <div className="grid gap-6 md:grid-cols-3">
            {humanizedGallery.map((item, index) => (
              <Reveal key={item.title} delay={index * 120}>
                <Card className="overflow-hidden border-border/70 bg-card shadow-sm transition-all hover:-translate-y-1 hover:shadow-2xl">
                  <img src={item.image} alt={item.title} className="h-72 w-full object-cover" />
                  <CardContent className="p-6 pt-6">
                    <h3 className="font-display text-xl font-bold text-foreground">{item.title}</h3>
                    <p className="mt-2 text-sm leading-relaxed text-muted-foreground">{item.description}</p>
                  </CardContent>
                </Card>
              </Reveal>
            ))}
          </div>
        </div>
      </section>

      <section className="relative overflow-hidden bg-primary py-20 text-primary-foreground lg:py-24">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_right,hsl(var(--accent))/0.14,transparent_30%)]" />
        <div className="relative mx-auto grid max-w-7xl gap-12 px-4 sm:px-6 lg:grid-cols-[1fr_0.95fr] lg:items-center">
          <Reveal>
            <Badge className="mb-5 border border-primary-foreground/10 bg-primary-foreground/10 text-primary-foreground">As dores da rotina</Badge>
            <h2 className="mb-6 font-display text-3xl font-bold leading-tight sm:text-4xl lg:text-5xl">
              Seu acesso ao crescimento fica travado quando a agenda vira bagunça.
            </h2>
            <p className="mb-8 max-w-xl text-lg text-primary-foreground/80">
              O MeAgendaê organiza sua operação e tira o caos do dia a dia para você focar no atendimento, no faturamento e na experiência do cliente.
            </p>

            <div className="grid gap-3 sm:grid-cols-2">
              {painPoints.map((pain) => (
                <div key={pain} className="rounded-2xl border border-primary-foreground/10 bg-primary-foreground/6 px-4 py-4 backdrop-blur-sm">
                  <div className="mb-2 inline-flex rounded-full bg-destructive/20 p-2 text-destructive-foreground">
                    <Clock3 className="h-4 w-4" />
                  </div>
                  <p className="text-sm font-medium leading-relaxed">{pain}</p>
                </div>
              ))}
            </div>
          </Reveal>

          <Reveal delay={160}>
            <div className="overflow-hidden rounded-[2rem] border border-primary-foreground/10 shadow-[0_24px_80px_-24px_hsl(var(--accent)/0.55)]">
              <img src={worriedOwner} alt="Profissional preocupado olhando agenda cheia" className="h-[520px] w-full object-cover" />
            </div>
          </Reveal>
        </div>
      </section>

      <section className="py-20 lg:py-24">
        <div className="mx-auto grid max-w-7xl gap-14 px-4 sm:px-6 lg:grid-cols-[0.95fr_1.05fr] lg:items-center">
          <Reveal>
            <div className="overflow-hidden rounded-[2rem] border border-border/70 bg-card shadow-2xl">
              <img src={ownerFinance} alt="Profissional usando dashboard financeiro" className="h-[500px] w-full object-cover" />
            </div>
          </Reveal>

          <Reveal delay={120}>
            <Badge className="mb-4 border border-accent/25 bg-accent/10 text-accent-foreground">A solução premium</Badge>
            <h2 className="mb-5 font-display text-3xl font-bold text-foreground sm:text-4xl lg:text-5xl">
              Agenda, clientes, equipe e faturamento no mesmo lugar.
            </h2>
            <p className="mb-8 text-lg text-muted-foreground">
              Tudo o que você precisa para organizar sua rotina, ganhar mais clientes e transformar atendimento em crescimento previsível.
            </p>

            <div className="grid gap-4 sm:grid-cols-2">
              {featureBullets.map((item) => (
                <div key={item} className="flex gap-3 rounded-2xl border border-border/70 bg-card px-4 py-4 shadow-sm transition-all hover:-translate-y-0.5 hover:shadow-lg">
                  <div className="mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-accent text-accent-foreground">
                    <Check className="h-3.5 w-3.5" strokeWidth={3} />
                  </div>
                  <span className="text-sm font-medium leading-relaxed text-foreground">{item}</span>
                </div>
              ))}
            </div>
          </Reveal>
        </div>
      </section>

      <section className="bg-secondary/35 py-20 lg:py-24">
        <div className="mx-auto max-w-7xl px-4 sm:px-6">
          <Reveal className="mb-12 text-center">
            <Badge className="mb-4 border border-border bg-background text-foreground">Planos</Badge>
            <h2 className="font-display text-3xl font-bold text-foreground sm:text-4xl lg:text-5xl">Escolha o plano ideal para crescer</h2>
            <p className="mt-4 text-lg text-muted-foreground">Todos com teste grátis de 7 dias e sem cartão de crédito.</p>
          </Reveal>

          <div id="planos" className="grid gap-6 lg:grid-cols-3 lg:gap-5">
            {plans.map((plan, index) => (
              <Reveal key={plan.name} delay={index * 120}>
                <Card className={plan.featured ? 'relative overflow-hidden border-accent bg-primary text-primary-foreground shadow-[0_28px_80px_-28px_hsl(var(--primary)/0.6)]' : 'border-border/70 bg-card shadow-sm'}>
                  {plan.featured && (
                    <div className="absolute inset-x-0 top-0 h-1 bg-accent" />
                  )}
                  <CardContent className="flex h-full flex-col p-7 pt-7">
                    <div className="mb-5 flex items-center justify-between gap-3">
                      <div>
                        <h3 className="font-display text-2xl font-bold">{plan.name}</h3>
                        <p className={plan.featured ? 'text-sm text-primary-foreground/75' : 'text-sm text-muted-foreground'}>{plan.description}</p>
                      </div>
                      {plan.featured && (
                        <Badge className="border-0 bg-accent px-3 py-1 text-accent-foreground">Mais vendido</Badge>
                      )}
                    </div>

                    <div className="mb-6 flex items-end gap-1">
                      <span className="font-display text-4xl font-bold">{plan.price}</span>
                      <span className={plan.featured ? 'text-sm text-primary-foreground/70' : 'text-sm text-muted-foreground'}>/mês</span>
                    </div>

                    <div className="mb-6 rounded-2xl border border-accent/20 bg-accent/10 px-4 py-3 text-sm font-medium text-accent-foreground">
                      Teste grátis 7 dias
                    </div>

                    <div className="mb-8 space-y-3">
                      {plan.features.map((feature) => (
                        <div key={feature} className="flex items-start gap-3">
                          <div className={plan.featured ? 'mt-0.5 rounded-full bg-accent/20 p-1 text-accent' : 'mt-0.5 rounded-full bg-accent/10 p-1 text-accent'}>
                            <Check className="h-3.5 w-3.5" strokeWidth={3} />
                          </div>
                          <span className={plan.featured ? 'text-sm text-primary-foreground/88' : 'text-sm text-foreground'}>{feature}</span>
                        </div>
                      ))}
                    </div>

                    <Link to="/auth" className="mt-auto">
                      <Button
                        variant={plan.featured ? 'secondary' : 'outline'}
                        className={plan.featured ? 'w-full font-semibold text-foreground' : 'w-full border-2 font-semibold'}
                      >
                        {plan.cta}
                      </Button>
                    </Link>
                  </CardContent>
                </Card>
              </Reveal>
            ))}
          </div>
        </div>
      </section>

      <section id="depoimentos" className="py-20 lg:py-24">
        <div className="mx-auto max-w-7xl px-4 sm:px-6">
          <Reveal className="mb-12 text-center">
            <Badge className="mb-4 border border-accent/25 bg-accent/10 text-accent-foreground">Prova social</Badge>
            <h2 className="font-display text-3xl font-bold text-foreground sm:text-4xl lg:text-5xl">
              Profissionais brasileiros que já usam e recomendam
            </h2>
          </Reveal>

          <div className="grid gap-6 md:grid-cols-3">
            {testimonials.map((testimonial, index) => (
              <Reveal key={testimonial.name} delay={index * 120}>
                <Card className="h-full border-border/70 bg-card shadow-sm transition-all hover:-translate-y-1 hover:shadow-xl">
                  <CardContent className="flex h-full flex-col p-6 pt-6">
                    <div className="mb-4 flex gap-1 text-accent">
                      {Array.from({ length: 5 }).map((_, starIndex) => (
                        <Star key={starIndex} className="h-4 w-4 fill-current" />
                      ))}
                    </div>

                    <p className="mb-6 flex-1 text-sm leading-relaxed text-muted-foreground">“{testimonial.quote}”</p>

                    <Separator className="mb-5" />

                    <div className="flex items-center gap-3">
                      <Avatar className="h-12 w-12 ring-2 ring-accent/15">
                        <AvatarImage src={testimonial.image} alt={testimonial.name} className="object-cover" />
                        <AvatarFallback>{testimonial.name[0]}</AvatarFallback>
                      </Avatar>
                      <div>
                        <p className="text-sm font-bold text-foreground">{testimonial.name}</p>
                        <p className="text-xs text-muted-foreground">{testimonial.role}</p>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </Reveal>
            ))}
          </div>
        </div>
      </section>

      <section className="bg-secondary/35 py-20 lg:py-24">
        <div className="mx-auto grid max-w-7xl gap-12 px-4 sm:px-6 lg:grid-cols-[1fr_1fr] lg:items-center">
          <Reveal>
            <div className="overflow-hidden rounded-[2rem] border border-border/70 bg-card shadow-xl">
              <img src={happyClient} alt="Profissional da beleza atendendo cliente satisfeita" className="h-[420px] w-full object-cover" />
            </div>
          </Reveal>
          <Reveal delay={120}>
            <Badge className="mb-4 border border-primary/20 bg-primary/8 text-primary">Conversão com confiança</Badge>
            <h2 className="mb-5 font-display text-3xl font-bold text-foreground sm:text-4xl lg:text-5xl">
              Mais organização, mais clientes e uma rotina que realmente flui.
            </h2>
            <p className="mb-8 text-lg text-muted-foreground">
              O visitante entende rápido o valor, sente segurança e entra no teste grátis com muito menos fricção.
            </p>
            <div className="grid gap-4 sm:grid-cols-2">
              <Card className="border-border/70 bg-card shadow-sm">
                <CardContent className="p-5 pt-5">
                  <Wallet className="mb-3 h-6 w-6 text-accent" />
                  <p className="font-semibold text-foreground">Ganhe mais clientes</p>
                  <p className="mt-2 text-sm text-muted-foreground">Seu link profissional trabalha mesmo quando você está atendendo.</p>
                </CardContent>
              </Card>
              <Card className="border-border/70 bg-card shadow-sm">
                <CardContent className="p-5 pt-5">
                  <MessageCircle className="mb-3 h-6 w-6 text-accent" />
                  <p className="font-semibold text-foreground">Economize tempo</p>
                  <p className="mt-2 text-sm text-muted-foreground">Menos mensagens repetidas. Mais foco em vender e atender bem.</p>
                </CardContent>
              </Card>
            </div>
          </Reveal>
        </div>
      </section>

      <section className="px-4 py-12 sm:px-6 lg:py-20">
        <div className="relative mx-auto max-w-7xl overflow-hidden rounded-[2rem] bg-gradient-to-br from-primary via-primary to-accent p-10 text-center text-primary-foreground shadow-[0_30px_100px_-30px_hsl(var(--primary)/0.7)] lg:p-16">
          <div className="absolute -left-12 bottom-0 h-56 w-56 rounded-full bg-primary-foreground/10 blur-3xl" />
          <div className="absolute right-0 top-0 h-72 w-72 rounded-full bg-accent/30 blur-3xl" />
          <Reveal className="relative mx-auto max-w-3xl">
            <h2 className="mb-4 font-display text-3xl font-bold leading-tight sm:text-4xl lg:text-5xl">
              Comece hoje a profissionalizar seu negócio
            </h2>
            <p className="mb-8 text-lg text-primary-foreground/85">
              Teste grátis por 7 dias, sem cartão de crédito, com uma experiência premium para organizar sua rotina e vender mais.
            </p>
            <Link to="/auth">
              <Button size="lg" className="h-14 bg-accent px-8 text-base font-bold text-accent-foreground shadow-2xl shadow-accent/30">
                Criar conta grátis
                <ArrowRight className="ml-1 h-5 w-5" />
              </Button>
            </Link>
            <div className="mt-6 flex flex-wrap items-center justify-center gap-4 text-sm text-primary-foreground/80">
              <span>Mais de 500 profissionais já usam</span>
              <span>•</span>
              <span>Seu acesso será organizado desde o primeiro dia</span>
              <span>•</span>
              <span>Cancele quando quiser</span>
            </div>
          </Reveal>
        </div>
      </section>

      <footer className="border-t border-border py-10">
        <div className="mx-auto flex max-w-7xl flex-col items-center justify-between gap-5 px-4 text-center sm:px-6 md:flex-row md:text-left">
          <div className="flex items-center gap-3">
            <PlatformLogo compact className="shrink-0" onDarkBackground={false} />
            <div>
              <p className="font-display font-bold text-foreground">MeAgendaê</p>
              <p className="text-xs text-muted-foreground">Agendamento online para profissionais da beleza</p>
            </div>
          </div>

          <div className="flex flex-wrap items-center justify-center gap-x-6 gap-y-2 text-sm text-muted-foreground">
            <a href="#beneficios" className="transition-colors hover:text-foreground">Benefícios</a>
            <a href="#planos" className="transition-colors hover:text-foreground">Planos</a>
            <a href="#depoimentos" className="transition-colors hover:text-foreground">Depoimentos</a>
            <Link to="/profissionais" className="transition-colors hover:text-foreground">Para profissionais</Link>
          </div>

          <p className="text-xs text-muted-foreground">© {new Date().getFullYear()} MeAgendaê</p>
        </div>
      </footer>
    </div>
  );
}
