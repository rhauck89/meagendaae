import { Link } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  Calendar, Users, Globe, Zap, BarChart3, Scissors, Check, Star,
  ArrowRight, Sparkles, ShieldCheck, TrendingUp, Clock, Heart, Gift,
  MapPin, MessageCircle, DollarSign, CalendarHeart, X, Play,
} from 'lucide-react';
import { Reveal } from '@/components/landing/Reveal';
import { AnimatedCounter } from '@/components/landing/AnimatedCounter';
import heroBarber from '@/assets/hero-barber.jpg';
import worriedOwner from '@/assets/worried-owner.jpg';
import teamSalon from '@/assets/team-salon.jpg';
import manicure from '@/assets/manicure.jpg';
import ownerFinance from '@/assets/owner-finance.jpg';
import happyClient from '@/assets/happy-client.jpg';
import t1 from '@/assets/testimonial-1.jpg';
import t2 from '@/assets/testimonial-2.jpg';
import t3 from '@/assets/testimonial-3.jpg';

const Index = () => {
  return (
    <div className="min-h-screen bg-background overflow-x-hidden">
      {/* NAV */}
      <nav className="border-b border-border/40 bg-background/80 backdrop-blur-lg sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 py-3 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-9 h-9 bg-primary rounded-xl flex items-center justify-center shadow-lg shadow-primary/20">
              <Calendar className="h-5 w-5 text-primary-foreground" />
            </div>
            <span className="font-display font-bold text-xl text-foreground">Me Agendaê</span>
          </div>
          <div className="hidden md:flex items-center gap-8 text-sm font-medium text-muted-foreground">
            <a href="#funcionalidades" className="hover:text-foreground transition-colors">Funcionalidades</a>
            <a href="#planos" className="hover:text-foreground transition-colors">Planos</a>
            <a href="#depoimentos" className="hover:text-foreground transition-colors">Depoimentos</a>
          </div>
          <div className="flex gap-2">
            <Link to="/auth" className="hidden sm:block">
              <Button variant="ghost" size="sm">Entrar</Button>
            </Link>
            <Link to="/auth">
              <Button size="sm" className="bg-accent text-accent-foreground hover:bg-accent/90 shadow-lg shadow-accent/20 font-semibold">
                Testar 7 dias grátis
              </Button>
            </Link>
          </div>
        </div>
      </nav>

      {/* HERO */}
      <section className="relative max-w-7xl mx-auto px-4 sm:px-6 pt-16 pb-24 lg:pt-24 lg:pb-32">
        {/* bg blobs */}
        <div className="absolute -top-32 -right-32 w-[500px] h-[500px] bg-accent/20 rounded-full blur-3xl pointer-events-none" />
        <div className="absolute top-40 -left-32 w-[400px] h-[400px] bg-primary/10 rounded-full blur-3xl pointer-events-none" />

        <div className="grid lg:grid-cols-2 gap-12 lg:gap-16 items-center relative">
          <div className="animate-fade-in-up">
            <Badge className="mb-6 bg-accent/10 text-accent-foreground border border-accent/30 hover:bg-accent/15 px-3 py-1.5 font-semibold">
              <Sparkles className="h-3.5 w-3.5 mr-1.5 text-accent" />
              +500 profissionais já usam
            </Badge>

            <h1 className="text-4xl sm:text-5xl lg:text-6xl font-display font-bold leading-[1.05] tracking-tight text-foreground mb-6">
              O sistema que organiza sua agenda,{' '}
              <span className="relative inline-block">
                <span className="relative z-10 text-accent">aumenta clientes</span>
                <span className="absolute bottom-1 left-0 right-0 h-3 bg-accent/20 -z-0 rounded" />
              </span>{' '}
              e ajuda você a faturar mais.
            </h1>

            <p className="text-lg text-muted-foreground mb-8 max-w-xl leading-relaxed">
              Pare de depender do WhatsApp para controlar horários. Seus clientes agendam online,
              sua agenda se organiza sozinha e você acompanha tudo em tempo real.
            </p>

            <div className="flex flex-col sm:flex-row gap-3 mb-6">
              <Link to="/auth">
                <Button size="lg" className="bg-accent text-accent-foreground hover:bg-accent/90 shadow-xl shadow-accent/30 font-semibold text-base px-7 h-12 w-full sm:w-auto group">
                  Testar 7 dias grátis
                  <ArrowRight className="h-4 w-4 ml-1 group-hover:translate-x-1 transition-transform" />
                </Button>
              </Link>
              <a href="#solucao">
                <Button size="lg" variant="outline" className="font-semibold text-base px-7 h-12 w-full sm:w-auto border-2">
                  <Play className="h-4 w-4 mr-1" />
                  Ver demonstração
                </Button>
              </a>
            </div>

            <p className="text-sm text-muted-foreground flex items-center gap-2">
              <ShieldCheck className="h-4 w-4 text-accent" />
              Sem cartão de crédito • Cancele quando quiser
            </p>
          </div>

          {/* Hero image */}
          <div className="relative animate-fade-in-up" style={{ animationDelay: '200ms' }}>
            <div className="relative rounded-3xl overflow-hidden shadow-2xl shadow-primary/20 ring-1 ring-border/50">
              <img
                src={heroBarber}
                alt="Barbeiro brasileiro usando o Me Agendaê"
                className="w-full h-[520px] object-cover"
                width={1024}
                height={1024}
              />
            </div>

            {/* floating dashboard card */}
            <div className="absolute -left-4 sm:-left-8 bottom-12 bg-card rounded-2xl shadow-2xl p-4 ring-1 ring-border w-56 animate-float-slow">
              <div className="flex items-center gap-2 mb-2">
                <div className="w-8 h-8 rounded-lg bg-accent/15 flex items-center justify-center">
                  <TrendingUp className="h-4 w-4 text-accent" />
                </div>
                <div>
                  <p className="text-[11px] text-muted-foreground font-medium">Faturamento</p>
                  <p className="text-sm font-bold">Este mês</p>
                </div>
              </div>
              <div className="flex items-end justify-between">
                <p className="text-2xl font-display font-bold text-foreground">+32%</p>
                <div className="flex items-end gap-0.5 h-8">
                  {[40, 55, 35, 70, 60, 85, 100].map((h, i) => (
                    <div key={i} className="w-1.5 bg-accent rounded-sm" style={{ height: `${h}%` }} />
                  ))}
                </div>
              </div>
            </div>

            {/* floating notif */}
            <div className="absolute -right-2 sm:-right-4 top-8 bg-card rounded-2xl shadow-2xl p-3 ring-1 ring-border flex items-center gap-3 animate-float-slow" style={{ animationDelay: '1.5s' }}>
              <div className="w-9 h-9 rounded-full bg-accent/15 flex items-center justify-center">
                <Calendar className="h-4 w-4 text-accent" />
              </div>
              <div>
                <p className="text-xs font-bold text-foreground">Novo agendamento</p>
                <p className="text-[11px] text-muted-foreground">Lucas • 14h30</p>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* SOCIAL PROOF */}
      <section className="bg-secondary/40 border-y border-border">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 py-12">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-8 text-center">
            {[
              { num: 500, suffix: '+', label: 'Profissionais usando' },
              { num: 15000, suffix: '+', label: 'Agendamentos realizados' },
              { num: 120, suffix: '+', label: 'Cidades atendidas' },
            ].map((s, i) => (
              <Reveal key={i} delay={i * 120}>
                <div>
                  <p className="text-4xl sm:text-5xl font-display font-bold text-primary mb-1">
                    <AnimatedCounter end={s.num} suffix={s.suffix} />
                  </p>
                  <p className="text-sm text-muted-foreground font-medium">{s.label}</p>
                </div>
              </Reveal>
            ))}
          </div>
        </div>
      </section>

      {/* PAIN POINTS */}
      <section className="bg-primary text-primary-foreground py-20 lg:py-28 relative overflow-hidden">
        <div className="absolute top-0 right-0 w-96 h-96 bg-accent/10 rounded-full blur-3xl" />
        <div className="max-w-7xl mx-auto px-4 sm:px-6 grid lg:grid-cols-2 gap-12 items-center relative">
          <Reveal>
            <Badge className="mb-5 bg-destructive/20 text-destructive-foreground border border-destructive/40">
              O problema
            </Badge>
            <h2 className="text-3xl sm:text-4xl lg:text-5xl font-display font-bold leading-tight mb-8">
              Se sua agenda depende do WhatsApp, você está{' '}
              <span className="text-accent">perdendo dinheiro.</span>
            </h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {[
                'Horários duplicados',
                'Cliente esquece atendimento',
                'Bagunça na equipe',
                'Sem controle financeiro',
                'Clientes que nunca voltam',
                'Tempo perdido no WhatsApp',
              ].map((p, i) => (
                <div key={i} className="flex items-center gap-3 bg-primary-foreground/5 backdrop-blur-sm rounded-xl px-4 py-3 border border-primary-foreground/10">
                  <div className="w-7 h-7 rounded-full bg-destructive/20 flex items-center justify-center flex-shrink-0">
                    <X className="h-4 w-4 text-destructive-foreground" />
                  </div>
                  <span className="text-sm font-medium">{p}</span>
                </div>
              ))}
            </div>
          </Reveal>
          <Reveal delay={200}>
            <div className="relative rounded-3xl overflow-hidden shadow-2xl ring-1 ring-primary-foreground/20">
              <img src={worriedOwner} alt="Dona de salão preocupada" className="w-full h-[480px] object-cover" loading="lazy" width={1024} height={1024} />
              <div className="absolute inset-0 bg-gradient-to-t from-primary/60 to-transparent" />
            </div>
          </Reveal>
        </div>
      </section>

      {/* SOLUTION */}
      <section id="solucao" className="py-20 lg:py-28">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 grid lg:grid-cols-2 gap-12 lg:gap-16 items-center">
          <Reveal>
            <Badge className="mb-5 bg-accent/15 text-accent-foreground border border-accent/30">
              <Sparkles className="h-3.5 w-3.5 mr-1.5 text-accent" /> A solução
            </Badge>
            <h2 className="text-3xl sm:text-4xl lg:text-5xl font-display font-bold leading-tight mb-6">
              Uma agenda que <span className="text-accent">trabalha por você</span>
            </h2>
            <p className="text-lg text-muted-foreground mb-8">
              Tecnologia inteligente que cuida da bagunça enquanto você foca no seu cliente.
            </p>
            <ul className="space-y-3">
              {[
                'Agendamento online 24h',
                'Bloqueio automático de horários',
                'Intervalo entre clientes',
                'Reagendamento online',
                'Sugestão inteligente de horários vagos',
                'Reorganização automática em atrasos',
              ].map((item, i) => (
                <li key={i} className="flex items-start gap-3">
                  <div className="w-6 h-6 rounded-full bg-accent flex items-center justify-center flex-shrink-0 mt-0.5">
                    <Check className="h-3.5 w-3.5 text-accent-foreground" strokeWidth={3} />
                  </div>
                  <span className="text-foreground font-medium">{item}</span>
                </li>
              ))}
            </ul>
          </Reveal>

          {/* Mock dashboard */}
          <Reveal delay={150}>
            <div className="relative">
              <div className="bg-card rounded-3xl shadow-2xl ring-1 ring-border p-6 lg:p-7">
                <div className="flex items-center justify-between mb-5">
                  <div>
                    <p className="text-xs text-muted-foreground font-medium">Quinta, 12 dez</p>
                    <h3 className="font-display font-bold text-xl">Sua agenda</h3>
                  </div>
                  <Badge className="bg-accent/15 text-accent-foreground border border-accent/30 hover:bg-accent/15">
                    8 hoje
                  </Badge>
                </div>
                <div className="space-y-2.5">
                  {[
                    { time: '09:00', name: 'Lucas Silva', svc: 'Corte + Barba', status: 'done' },
                    { time: '10:30', name: 'Beatriz M.', svc: 'Hidratação', status: 'now' },
                    { time: '11:30', name: 'Ricardo P.', svc: 'Corte simples', status: 'next' },
                    { time: '14:00', name: 'Amanda R.', svc: 'Manicure', status: 'next' },
                    { time: '15:30', name: 'Disponível', svc: '—', status: 'free' },
                  ].map((a, i) => (
                    <div
                      key={i}
                      className={`flex items-center gap-4 rounded-xl px-4 py-3 border ${
                        a.status === 'now'
                          ? 'bg-accent/10 border-accent/40'
                          : a.status === 'free'
                          ? 'bg-secondary/60 border-dashed border-border'
                          : 'bg-secondary/40 border-border'
                      }`}
                    >
                      <span className="text-sm font-bold text-foreground w-12">{a.time}</span>
                      <div className="flex-1">
                        <p className={`text-sm font-semibold ${a.status === 'free' ? 'text-muted-foreground' : 'text-foreground'}`}>
                          {a.name}
                        </p>
                        <p className="text-xs text-muted-foreground">{a.svc}</p>
                      </div>
                      {a.status === 'now' && (
                        <span className="text-[10px] font-bold uppercase bg-accent text-accent-foreground px-2 py-0.5 rounded-full">
                          Agora
                        </span>
                      )}
                    </div>
                  ))}
                </div>
              </div>
              <div className="absolute -bottom-4 -right-4 w-24 h-24 bg-accent/20 rounded-full blur-2xl pointer-events-none" />
            </div>
          </Reveal>
        </div>
      </section>

      {/* FUNCIONALIDADES — TEAM */}
      <section id="funcionalidades" className="bg-secondary/40 py-20 lg:py-28">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 grid lg:grid-cols-2 gap-12 lg:gap-16 items-center">
          <Reveal>
            <div className="rounded-3xl overflow-hidden shadow-2xl ring-1 ring-border">
              <img src={teamSalon} alt="Equipe brasileira de salão" className="w-full h-[480px] object-cover" loading="lazy" width={1024} height={1024} />
            </div>
          </Reveal>
          <Reveal delay={150}>
            <Badge className="mb-5 bg-primary/10 text-primary border border-primary/20"><Users className="h-3.5 w-3.5 mr-1.5" /> Gestão de Equipe</Badge>
            <h2 className="text-3xl sm:text-4xl lg:text-5xl font-display font-bold leading-tight mb-5">
              Controle completo da sua <span className="text-accent">equipe</span>
            </h2>
            <p className="text-lg text-muted-foreground mb-7">
              Gerencie sócios, comissionados e profissionais independentes em um só lugar.
            </p>
            <div className="grid grid-cols-2 gap-3">
              {[
                { icon: DollarSign, t: 'Comissão automática' },
                { icon: BarChart3, t: 'Faturamento por profissional' },
                { icon: TrendingUp, t: 'Ranking da equipe' },
                { icon: Clock, t: 'Relatórios individuais' },
              ].map((c, i) => (
                <div key={i} className="bg-card rounded-2xl p-4 ring-1 ring-border hover:shadow-lg hover:-translate-y-0.5 transition-all">
                  <c.icon className="h-5 w-5 text-accent mb-2" />
                  <p className="text-sm font-semibold">{c.t}</p>
                </div>
              ))}
            </div>
          </Reveal>
        </div>
      </section>

      {/* LINK DE AGENDAMENTO + AGENDA ABERTA + PROMOÇÕES (3 cards grid) */}
      <section className="py-20 lg:py-28">
        <div className="max-w-7xl mx-auto px-4 sm:px-6">
          <Reveal className="text-center mb-14">
            <Badge className="mb-4 bg-accent/15 text-accent-foreground border border-accent/30">
              <Heart className="h-3.5 w-3.5 mr-1.5 text-accent" /> Tudo num só lugar
            </Badge>
            <h2 className="text-3xl sm:text-4xl lg:text-5xl font-display font-bold leading-tight max-w-3xl mx-auto">
              Ferramentas que fazem clientes <span className="text-accent">voltarem</span>
            </h2>
          </Reveal>

          <div className="grid lg:grid-cols-3 gap-6">
            {/* Link agendamento */}
            <Reveal>
              <div className="group bg-card rounded-3xl p-7 ring-1 ring-border hover:ring-accent/40 hover:shadow-xl transition-all h-full">
                <div className="w-12 h-12 rounded-2xl bg-primary/10 flex items-center justify-center mb-5 group-hover:scale-110 transition-transform">
                  <Globe className="h-6 w-6 text-primary" />
                </div>
                <h3 className="font-display font-bold text-2xl mb-2">Seu próprio link de agendamento</h3>
                <p className="text-muted-foreground mb-5">
                  Receba clientes pelo Instagram, WhatsApp e Google.
                </p>
                <div className="bg-secondary/60 rounded-xl p-3 font-mono text-xs text-foreground border border-border flex items-center gap-2">
                  <Globe className="h-3.5 w-3.5 text-accent flex-shrink-0" />
                  meagendae.com.br/<span className="text-accent font-bold">seu-nome</span>
                </div>
              </div>
            </Reveal>

            {/* Agenda Aberta */}
            <Reveal delay={120}>
              <div className="group bg-card rounded-3xl p-7 ring-1 ring-border hover:ring-accent/40 hover:shadow-xl transition-all h-full">
                <div className="w-12 h-12 rounded-2xl bg-primary/10 flex items-center justify-center mb-5 group-hover:scale-110 transition-transform">
                  <CalendarHeart className="h-6 w-6 text-primary" />
                </div>
                <h3 className="font-display font-bold text-2xl mb-2">Agenda Aberta para datas especiais</h3>
                <p className="text-muted-foreground mb-5">
                  Crie agendas para Natal, Noivas, Formatura, Dia das Mães…
                </p>
                <div className="flex flex-wrap gap-2">
                  {['Natal', 'Ano Novo', 'Noivas', 'Formaturas', 'Dia das Mães'].map((t) => (
                    <span key={t} className="text-xs font-semibold bg-accent/15 text-accent-foreground px-2.5 py-1 rounded-full border border-accent/30">
                      {t}
                    </span>
                  ))}
                </div>
              </div>
            </Reveal>

            {/* Promoções + fidelidade */}
            <Reveal delay={240}>
              <div className="group bg-card rounded-3xl p-7 ring-1 ring-border hover:ring-accent/40 hover:shadow-xl transition-all h-full">
                <div className="w-12 h-12 rounded-2xl bg-primary/10 flex items-center justify-center mb-5 group-hover:scale-110 transition-transform">
                  <Gift className="h-6 w-6 text-primary" />
                </div>
                <h3 className="font-display font-bold text-2xl mb-2">Promoções e fidelidade</h3>
                <p className="text-muted-foreground mb-5">
                  Preencha horários vazios e faça clientes voltarem.
                </p>
                <ul className="space-y-2 text-sm">
                  {['Cashback automático', 'Aniversariante do mês', 'Programa de pontos'].map((t) => (
                    <li key={t} className="flex items-center gap-2">
                      <Check className="h-4 w-4 text-accent" strokeWidth={3} />
                      {t}
                    </li>
                  ))}
                </ul>
              </div>
            </Reveal>
          </div>
        </div>
      </section>

      {/* FINANCEIRO — DARK */}
      <section className="bg-primary text-primary-foreground py-20 lg:py-28 relative overflow-hidden">
        <div className="absolute -bottom-32 -left-32 w-96 h-96 bg-accent/15 rounded-full blur-3xl" />
        <div className="max-w-7xl mx-auto px-4 sm:px-6 grid lg:grid-cols-2 gap-12 lg:gap-16 items-center relative">
          <Reveal>
            <Badge className="mb-5 bg-accent/20 text-accent border border-accent/30">
              <DollarSign className="h-3.5 w-3.5 mr-1.5" /> Financeiro
            </Badge>
            <h2 className="text-3xl sm:text-4xl lg:text-5xl font-display font-bold leading-tight mb-6">
              Controle o dinheiro do seu <span className="text-accent">negócio</span>
            </h2>
            <p className="text-lg text-primary-foreground/80 mb-8">
              Saiba exatamente quanto entra, quanto sai e quanto sobra. Sem planilha, sem dor de cabeça.
            </p>
            <div className="grid grid-cols-2 gap-3">
              {[
                'Dashboard financeiro',
                'Entradas e saídas',
                'Contas a pagar',
                'Fluxo de caixa',
                'Comissão automática',
                'Lucro mensal',
              ].map((c, i) => (
                <div key={i} className="bg-primary-foreground/5 backdrop-blur-sm rounded-xl px-4 py-3 border border-primary-foreground/10 flex items-center gap-2">
                  <Check className="h-4 w-4 text-accent flex-shrink-0" strokeWidth={3} />
                  <span className="text-sm font-medium">{c}</span>
                </div>
              ))}
            </div>
          </Reveal>
          <Reveal delay={200}>
            <div className="rounded-3xl overflow-hidden shadow-2xl ring-1 ring-primary-foreground/20">
              <img src={ownerFinance} alt="Dono de salão analisando faturamento" className="w-full h-[480px] object-cover" loading="lazy" width={1024} height={1024} />
            </div>
          </Reveal>
        </div>
      </section>

      {/* MARKETPLACE */}
      <section className="py-20 lg:py-28">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 grid lg:grid-cols-2 gap-12 lg:gap-16 items-center">
          <Reveal>
            <div className="rounded-3xl overflow-hidden shadow-2xl ring-1 ring-border">
              <img src={manicure} alt="Estúdio de manicure" className="w-full h-[420px] object-cover" loading="lazy" width={1280} height={1024} />
            </div>
          </Reveal>
          <Reveal delay={150}>
            <Badge className="mb-5 bg-accent/15 text-accent-foreground border border-accent/30">
              <MapPin className="h-3.5 w-3.5 mr-1.5 text-accent" /> Marketplace
            </Badge>
            <h2 className="text-3xl sm:text-4xl lg:text-5xl font-display font-bold leading-tight mb-5">
              Ganhe novos clientes <span className="text-accent">automaticamente</span>
            </h2>
            <p className="text-lg text-muted-foreground mb-7">
              Seu perfil aparece para pessoas buscando profissionais na sua cidade.
            </p>
            <div className="grid grid-cols-2 gap-3">
              {[
                { icon: MapPin, t: 'Busca local' },
                { icon: Star, t: 'Avaliações reais' },
                { icon: Calendar, t: 'Agendamento direto' },
                { icon: Sparkles, t: 'Destaque premium' },
              ].map((c, i) => (
                <div key={i} className="bg-card rounded-2xl p-4 ring-1 ring-border hover:shadow-lg hover:-translate-y-0.5 transition-all">
                  <c.icon className="h-5 w-5 text-accent mb-2" />
                  <p className="text-sm font-semibold">{c.t}</p>
                </div>
              ))}
            </div>
          </Reveal>
        </div>
      </section>

      {/* DEPOIMENTOS */}
      <section id="depoimentos" className="bg-secondary/40 py-20 lg:py-28">
        <div className="max-w-7xl mx-auto px-4 sm:px-6">
          <Reveal className="text-center mb-14">
            <Badge className="mb-4 bg-accent/15 text-accent-foreground border border-accent/30">
              <Heart className="h-3.5 w-3.5 mr-1.5 text-accent" /> Depoimentos
            </Badge>
            <h2 className="text-3xl sm:text-4xl lg:text-5xl font-display font-bold max-w-3xl mx-auto leading-tight">
              Profissionais que <span className="text-accent">transformaram</span> seu negócio
            </h2>
          </Reveal>

          <div className="grid md:grid-cols-3 gap-6">
            {[
              { img: t1, name: 'Rafael Souza', role: 'Barbeiro • SP', text: 'Depois que comecei a usar o Me Agendaê meu faturamento subiu 40%. A agenda nunca mais ficou bagunçada.' },
              { img: t2, name: 'Camila Ribeiro', role: 'Cabeleireira • RJ', text: 'Hoje minha equipe inteira trabalha organizada. As comissões saem automáticas, sem briga.' },
              { img: t3, name: 'Aline Pereira', role: 'Manicure • BH', text: 'Parei de perder clientes no WhatsApp. Eles agendam sozinhos pelo link e ainda recebem lembrete.' },
            ].map((t, i) => (
              <Reveal key={i} delay={i * 120}>
                <div className="bg-card rounded-3xl p-6 ring-1 ring-border hover:shadow-xl hover:-translate-y-1 transition-all h-full flex flex-col">
                  <div className="flex gap-0.5 mb-4">
                    {[...Array(5)].map((_, j) => (
                      <Star key={j} className="h-4 w-4 fill-accent text-accent" />
                    ))}
                  </div>
                  <p className="text-foreground leading-relaxed mb-6 flex-1">"{t.text}"</p>
                  <div className="flex items-center gap-3">
                    <img src={t.img} alt={t.name} className="w-12 h-12 rounded-full object-cover ring-2 ring-accent/20" loading="lazy" width={64} height={64} />
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

      {/* PLANOS */}
      <section id="planos" className="py-20 lg:py-28">
        <div className="max-w-7xl mx-auto px-4 sm:px-6">
          <Reveal className="text-center mb-14">
            <Badge className="mb-4 bg-accent/15 text-accent-foreground border border-accent/30">
              Planos & Preços
            </Badge>
            <h2 className="text-3xl sm:text-4xl lg:text-5xl font-display font-bold mb-4">
              Escolha o plano ideal para o seu negócio
            </h2>
            <p className="text-muted-foreground text-lg">7 dias grátis em qualquer plano. Sem cartão.</p>
          </Reveal>

          <div className="grid md:grid-cols-3 gap-6 lg:gap-5 items-stretch">
            {/* SOLO */}
            <Reveal>
              <div className="bg-card rounded-3xl p-7 ring-1 ring-border h-full flex flex-col hover:shadow-xl transition-all">
                <p className="font-display font-bold text-xl mb-1">Solo</p>
                <p className="text-sm text-muted-foreground mb-5">Perfeito para começar</p>
                <div className="flex items-baseline gap-1 mb-6">
                  <span className="text-4xl font-display font-bold">R$ 49,90</span>
                  <span className="text-muted-foreground text-sm">/mês</span>
                </div>
                <ul className="space-y-2.5 mb-7 flex-1 text-sm">
                  {['1 profissional', 'Agenda online', 'Clientes ilimitados', 'Financeiro básico', 'Marketplace básico'].map((f) => (
                    <li key={f} className="flex items-start gap-2">
                      <Check className="h-4 w-4 text-accent mt-0.5 flex-shrink-0" strokeWidth={3} />
                      <span>{f}</span>
                    </li>
                  ))}
                </ul>
                <Link to="/auth">
                  <Button variant="outline" className="w-full font-semibold border-2">Começar grátis</Button>
                </Link>
              </div>
            </Reveal>

            {/* STUDIO — destaque */}
            <Reveal delay={150}>
              <div className="relative bg-primary text-primary-foreground rounded-3xl p-7 ring-2 ring-accent shadow-2xl shadow-primary/30 h-full flex flex-col scale-100 lg:scale-105">
                <span className="absolute -top-3 left-1/2 -translate-x-1/2 bg-accent text-accent-foreground text-[11px] font-bold uppercase tracking-wider px-3 py-1 rounded-full shadow-lg">
                  Mais escolhido
                </span>
                <p className="font-display font-bold text-xl mb-1">Studio</p>
                <p className="text-sm text-primary-foreground/70 mb-5">Para quem quer crescer</p>
                <div className="flex items-baseline gap-1 mb-6">
                  <span className="text-4xl font-display font-bold">R$ 69,90</span>
                  <span className="text-primary-foreground/70 text-sm">/mês</span>
                </div>
                <ul className="space-y-2.5 mb-7 flex-1 text-sm">
                  {['Até 3 profissionais', 'Promoções', 'Cashback', 'Fidelidade', 'Agenda Aberta', 'Financeiro completo', 'WhatsApp automático'].map((f) => (
                    <li key={f} className="flex items-start gap-2">
                      <Check className="h-4 w-4 text-accent mt-0.5 flex-shrink-0" strokeWidth={3} />
                      <span>{f}</span>
                    </li>
                  ))}
                </ul>
                <Link to="/auth">
                  <Button className="w-full bg-accent text-accent-foreground hover:bg-accent/90 font-semibold shadow-lg shadow-accent/20">
                    Testar 7 dias grátis
                  </Button>
                </Link>
              </div>
            </Reveal>

            {/* ELITE */}
            <Reveal delay={300}>
              <div className="bg-card rounded-3xl p-7 ring-1 ring-border h-full flex flex-col hover:shadow-xl transition-all relative">
                <span className="absolute -top-3 right-6 bg-foreground text-background text-[11px] font-bold uppercase tracking-wider px-3 py-1 rounded-full">
                  Premium
                </span>
                <p className="font-display font-bold text-xl mb-1">Elite</p>
                <p className="text-sm text-muted-foreground mb-5">Para grandes operações</p>
                <div className="flex items-baseline gap-1 mb-6">
                  <span className="text-4xl font-display font-bold">R$ 89,90</span>
                  <span className="text-muted-foreground text-sm">/mês</span>
                </div>
                <ul className="space-y-2.5 mb-7 flex-1 text-sm">
                  {['Profissionais ilimitados', 'Prioridade marketplace', 'Domínio próprio', 'Marca personalizada', 'Relatórios avançados', 'Suporte prioritário'].map((f) => (
                    <li key={f} className="flex items-start gap-2">
                      <Check className="h-4 w-4 text-accent mt-0.5 flex-shrink-0" strokeWidth={3} />
                      <span>{f}</span>
                    </li>
                  ))}
                </ul>
                <Link to="/auth">
                  <Button variant="outline" className="w-full font-semibold border-2">Testar grátis</Button>
                </Link>
              </div>
            </Reveal>
          </div>
        </div>
      </section>

      {/* FINAL CTA */}
      <section className="px-4 sm:px-6 py-12 lg:py-20">
        <div className="max-w-7xl mx-auto relative overflow-hidden rounded-[2rem] bg-gradient-to-br from-primary via-primary to-accent p-10 lg:p-16 text-center text-primary-foreground shadow-2xl shadow-primary/30">
          <div className="absolute top-0 right-0 w-96 h-96 bg-accent/30 rounded-full blur-3xl" />
          <div className="absolute -bottom-20 -left-20 w-72 h-72 bg-primary-foreground/10 rounded-full blur-3xl" />
          <div className="relative">
            <Reveal>
              <h2 className="text-3xl sm:text-4xl lg:text-5xl font-display font-bold mb-4 leading-tight max-w-2xl mx-auto">
                Comece hoje a profissionalizar seu negócio.
              </h2>
              <p className="text-lg text-primary-foreground/85 mb-8 max-w-xl mx-auto">
                Teste grátis por 7 dias. Sem cartão de crédito.
              </p>
              <Link to="/auth">
                <Button size="lg" className="bg-accent text-accent-foreground hover:bg-accent/90 font-bold text-base px-8 h-14 shadow-2xl shadow-accent/30 group">
                  Criar conta grátis
                  <ArrowRight className="h-5 w-5 ml-1 group-hover:translate-x-1 transition-transform" />
                </Button>
              </Link>
              <p className="text-sm text-primary-foreground/70 mt-5 flex items-center justify-center gap-4 flex-wrap">
                <span className="flex items-center gap-1.5"><ShieldCheck className="h-4 w-4" /> Sem cartão</span>
                <span>•</span>
                <span className="flex items-center gap-1.5"><Heart className="h-4 w-4" /> Cancele quando quiser</span>
                <span>•</span>
                <span className="flex items-center gap-1.5"><MessageCircle className="h-4 w-4" /> Suporte humano</span>
              </p>
            </Reveal>
          </div>
        </div>
      </section>

      {/* FOOTER */}
      <footer className="border-t border-border py-12">
        <div className="max-w-7xl mx-auto px-4 sm:px-6">
          <div className="flex flex-col md:flex-row items-center justify-between gap-6">
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 bg-primary rounded-lg flex items-center justify-center">
                <Calendar className="h-4 w-4 text-primary-foreground" />
              </div>
              <span className="font-display font-bold text-lg">Me Agendaê</span>
            </div>
            <div className="flex flex-wrap items-center justify-center gap-x-6 gap-y-2 text-sm text-muted-foreground">
              <a href="#funcionalidades" className="hover:text-foreground transition-colors">Funcionalidades</a>
              <a href="#planos" className="hover:text-foreground transition-colors">Planos</a>
              <a href="#" className="hover:text-foreground transition-colors">Contato</a>
              <a href="#" className="hover:text-foreground transition-colors">Termos</a>
              <a href="#" className="hover:text-foreground transition-colors">Privacidade</a>
            </div>
            <p className="text-xs text-muted-foreground">© {new Date().getFullYear()} Me Agendaê</p>
          </div>
        </div>
      </footer>
    </div>
  );
};

export default Index;
