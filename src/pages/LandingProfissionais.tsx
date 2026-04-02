import { Link } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { SEOHead } from '@/components/SEOHead';
import {
  Calendar, Users, BarChart3, Globe, Zap, Clock, Star, Shield,
  CheckCircle2, ArrowRight, Play, TrendingUp, UserCheck, Heart,
  Smartphone, MessageSquare, Target, Gift, DollarSign, Search,
  ChevronRight, Scissors, MapPin, BadgeCheck, Timer, RefreshCw,
  CalendarDays, Megaphone, PieChart, UserPlus, Quote, ArrowRightLeft
} from 'lucide-react';

const LandingProfissionais = () => {
  return (
    <div className="min-h-screen bg-white">
      <SEOHead
        title="MeAgendaê — Sistema de Agendamento para Profissionais de Beleza"
        description="Organize sua agenda, gerencie equipe, receba clientes online e controle seu faturamento. Teste grátis por 7 dias."
        keywords="agendamento online, barbearia, estética, gestão de salão, agenda profissional"
      />

      {/* ─── NAVBAR ─── */}
      <nav className="sticky top-0 z-50 bg-white/80 backdrop-blur-lg border-b border-gray-100">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-3 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-9 h-9 rounded-xl bg-[hsl(var(--primary))] flex items-center justify-center">
              <Scissors className="h-5 w-5 text-white" />
            </div>
            <span className="font-display font-bold text-xl text-[hsl(var(--foreground))]">MeAgendaê</span>
          </div>
          <div className="hidden md:flex items-center gap-6 text-sm font-medium text-[hsl(var(--muted-foreground))]">
            <a href="#funcionalidades" className="hover:text-[hsl(var(--foreground))] transition-colors">Funcionalidades</a>
            <a href="#planos" className="hover:text-[hsl(var(--foreground))] transition-colors">Planos</a>
            <a href="#depoimentos" className="hover:text-[hsl(var(--foreground))] transition-colors">Depoimentos</a>
          </div>
          <div className="flex items-center gap-2">
            <Link to="/auth">
              <Button variant="ghost" size="sm">Entrar</Button>
            </Link>
            <Link to="/auth">
              <Button size="sm" className="bg-[hsl(var(--accent))] text-[hsl(var(--accent-foreground))] hover:bg-[hsl(var(--accent))]/90">
                Criar conta grátis
              </Button>
            </Link>
          </div>
        </div>
      </nav>

      {/* ─── HERO ─── */}
      <section className="relative overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-br from-[hsl(var(--primary))]/3 via-transparent to-[hsl(var(--accent))]/5" />
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-16 md:py-24 relative">
          <div className="grid lg:grid-cols-2 gap-12 items-center">
            {/* Left */}
            <div className="space-y-8">
              <div className="inline-flex items-center gap-2 bg-[hsl(var(--accent))]/10 text-[hsl(var(--accent-foreground))] px-4 py-1.5 rounded-full text-sm font-medium">
                <Zap className="h-4 w-4 text-[hsl(var(--accent))]" />
                Novo: Agenda inteligente com reorganização automática
              </div>
              <h1 className="text-4xl md:text-5xl lg:text-[3.5rem] font-display font-bold leading-[1.1] text-[hsl(var(--foreground))]">
                O sistema que organiza sua agenda, aumenta seus clientes e ajuda você a{' '}
                <span className="text-[hsl(var(--accent))]">faturar mais</span>.
              </h1>
              <p className="text-lg md:text-xl text-[hsl(var(--muted-foreground))] leading-relaxed max-w-xl">
                Pare de depender do WhatsApp para controlar horários. Com o MeAgendaê, seus clientes agendam online, sua agenda se organiza automaticamente e você acompanha o faturamento do seu negócio em tempo real.
              </p>
              <div className="flex flex-col sm:flex-row gap-4">
                <Link to="/auth">
                  <Button size="lg" className="w-full sm:w-auto text-base px-8 bg-[hsl(var(--accent))] text-[hsl(var(--accent-foreground))] hover:bg-[hsl(var(--accent))]/90 shadow-lg shadow-[hsl(var(--accent))]/25">
                    Criar conta grátis
                    <ArrowRight className="h-5 w-5 ml-1" />
                  </Button>
                </Link>
                <Button size="lg" variant="outline" className="w-full sm:w-auto text-base px-8 border-[hsl(var(--border))]">
                  <Play className="h-5 w-5 mr-2" />
                  Assistir demonstração
                </Button>
              </div>
              <p className="text-sm text-[hsl(var(--muted-foreground))]">
                Teste grátis por 7 dias — sem cartão de crédito
              </p>
            </div>
            {/* Right — Mockup */}
            <div className="relative">
              <div className="bg-[hsl(var(--primary))]/5 rounded-3xl p-6 border border-[hsl(var(--border))]">
                <div className="bg-white rounded-2xl shadow-2xl overflow-hidden border border-[hsl(var(--border))]">
                  {/* Mock dashboard header */}
                  <div className="bg-[hsl(var(--primary))] px-4 py-3 flex items-center gap-2">
                    <div className="w-3 h-3 rounded-full bg-white/30" />
                    <div className="w-3 h-3 rounded-full bg-white/30" />
                    <div className="w-3 h-3 rounded-full bg-white/30" />
                    <div className="flex-1 mx-4 h-5 bg-white/10 rounded-full" />
                  </div>
                  <div className="p-6 space-y-4">
                    {/* Mock stats */}
                    <div className="grid grid-cols-3 gap-3">
                      {[
                        { label: 'Receita', value: 'R$ 8.450', color: 'hsl(var(--accent))' },
                        { label: 'Clientes', value: '142', color: 'hsl(var(--primary))' },
                        { label: 'Agendamentos', value: '86', color: 'hsl(var(--warning))' },
                      ].map((s, i) => (
                        <div key={i} className="p-3 rounded-xl bg-[hsl(var(--secondary))] text-center">
                          <p className="text-xs text-[hsl(var(--muted-foreground))]">{s.label}</p>
                          <p className="text-lg font-bold text-[hsl(var(--foreground))]">{s.value}</p>
                        </div>
                      ))}
                    </div>
                    {/* Mock agenda */}
                    <div className="space-y-2">
                      {['09:00 — Corte Degradê', '10:00 — Barba Completa', '11:30 — Corte + Barba'].map((item, i) => (
                        <div key={i} className="flex items-center gap-3 p-2.5 rounded-lg bg-[hsl(var(--secondary))]/50">
                          <div className="w-2 h-2 rounded-full" style={{ backgroundColor: i === 0 ? 'hsl(var(--accent))' : i === 1 ? 'hsl(var(--primary))' : 'hsl(var(--warning))' }} />
                          <span className="text-sm font-medium text-[hsl(var(--foreground))]">{item}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              </div>
              {/* Floating badges */}
              <div className="absolute -top-4 -right-4 bg-white shadow-xl rounded-2xl p-3 border border-[hsl(var(--border))] hidden lg:flex items-center gap-2">
                <div className="w-8 h-8 rounded-full bg-[hsl(var(--accent))]/10 flex items-center justify-center">
                  <TrendingUp className="h-4 w-4 text-[hsl(var(--accent))]" />
                </div>
                <div>
                  <p className="text-xs text-[hsl(var(--muted-foreground))]">Faturamento</p>
                  <p className="text-sm font-bold text-[hsl(var(--accent))]">+32% este mês</p>
                </div>
              </div>
              <div className="absolute -bottom-4 -left-4 bg-white shadow-xl rounded-2xl p-3 border border-[hsl(var(--border))] hidden lg:flex items-center gap-2">
                <div className="w-8 h-8 rounded-full bg-[hsl(var(--primary))]/10 flex items-center justify-center">
                  <UserCheck className="h-4 w-4 text-[hsl(var(--primary))]" />
                </div>
                <div>
                  <p className="text-xs text-[hsl(var(--muted-foreground))]">Novo cliente</p>
                  <p className="text-sm font-bold text-[hsl(var(--foreground))]">João agendou 10:30</p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ─── TRUST BAR ─── */}
      <section className="border-y border-[hsl(var(--border))] bg-[hsl(var(--secondary))]">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          <div className="grid grid-cols-3 gap-8 text-center">
            {[
              { value: '500+', label: 'profissionais usando' },
              { value: '15.000+', label: 'agendamentos realizados' },
              { value: '120+', label: 'cidades atendidas' },
            ].map((s, i) => (
              <div key={i}>
                <p className="text-2xl md:text-3xl font-display font-bold text-[hsl(var(--primary))]">{s.value}</p>
                <p className="text-sm text-[hsl(var(--muted-foreground))] mt-1">{s.label}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ─── VIDEO ─── */}
      <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-20">
        <div className="text-center mb-10">
          <h2 className="text-3xl md:text-4xl font-display font-bold text-[hsl(var(--foreground))]">
            Veja como o MeAgendaê funciona na prática
          </h2>
        </div>
        <div className="max-w-4xl mx-auto aspect-video bg-[hsl(var(--secondary))] rounded-2xl border border-[hsl(var(--border))] flex items-center justify-center">
          <div className="text-center space-y-4">
            <div className="w-20 h-20 rounded-full bg-[hsl(var(--accent))]/10 flex items-center justify-center mx-auto cursor-pointer hover:bg-[hsl(var(--accent))]/20 transition-colors">
              <Play className="h-8 w-8 text-[hsl(var(--accent))] ml-1" />
            </div>
            <p className="text-[hsl(var(--muted-foreground))]">Vídeo demonstrativo em breve</p>
          </div>
        </div>
      </section>

      {/* ─── PROBLEM ─── */}
      <section className="bg-[hsl(var(--primary))]">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-20">
          <div className="grid lg:grid-cols-2 gap-12 items-center">
            <div>
              <h2 className="text-3xl md:text-4xl font-display font-bold text-white leading-tight">
                Se sua agenda depende do WhatsApp, você está{' '}
                <span className="text-[hsl(var(--accent))]">perdendo dinheiro</span>.
              </h2>
              <p className="mt-4 text-white/70 text-lg">
                Profissionais que usam apenas WhatsApp perdem em média 30% dos agendamentos por mês.
              </p>
            </div>
            <div className="space-y-4">
              {[
                { icon: Clock, text: 'Horários duplicados e confusos' },
                { icon: MessageSquare, text: 'Clientes esquecem do atendimento' },
                { icon: Users, text: 'Dificuldade de organizar equipe' },
                { icon: DollarSign, text: 'Falta de controle financeiro' },
                { icon: RefreshCw, text: 'Clientes que nunca voltam' },
              ].map((item, i) => (
                <div key={i} className="flex items-center gap-4 bg-white/5 p-4 rounded-xl border border-white/10">
                  <div className="w-10 h-10 rounded-lg bg-red-500/20 flex items-center justify-center flex-shrink-0">
                    <item.icon className="h-5 w-5 text-red-400" />
                  </div>
                  <p className="text-white font-medium">{item.text}</p>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* ─── FEATURES ANCHOR ─── */}
      <div id="funcionalidades" />

      {/* ─── AGENDA INTELIGENTE ─── */}
      <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-20">
        <div className="grid lg:grid-cols-2 gap-16 items-center">
          <div className="space-y-6">
            <div className="inline-flex items-center gap-2 bg-[hsl(var(--accent))]/10 text-[hsl(var(--accent-foreground))] px-3 py-1 rounded-full text-sm font-medium">
              <Calendar className="h-4 w-4 text-[hsl(var(--accent))]" /> Agenda
            </div>
            <h2 className="text-3xl md:text-4xl font-display font-bold text-[hsl(var(--foreground))]">
              Uma agenda que trabalha <span className="text-[hsl(var(--accent))]">por você</span>
            </h2>
            <div className="space-y-4">
              {[
                'Agendamento online 24 horas',
                'Bloqueio automático de horários',
                'Intervalo entre atendimentos configurável',
                'Reagendamento e cancelamento pelo cliente',
                'Cálculo automático de horários disponíveis',
              ].map((item, i) => (
                <div key={i} className="flex items-start gap-3">
                  <CheckCircle2 className="h-5 w-5 text-[hsl(var(--accent))] mt-0.5 flex-shrink-0" />
                  <p className="text-[hsl(var(--muted-foreground))]">{item}</p>
                </div>
              ))}
            </div>
            <div className="bg-[hsl(var(--accent))]/5 border border-[hsl(var(--accent))]/20 rounded-xl p-4">
              <div className="flex items-start gap-3">
                <Timer className="h-5 w-5 text-[hsl(var(--accent))] mt-0.5 flex-shrink-0" />
                <div>
                  <p className="font-semibold text-[hsl(var(--foreground))]">Reorganização automática de atrasos</p>
                  <p className="text-sm text-[hsl(var(--muted-foreground))] mt-1">
                    Se um atendimento atrasar 10 minutos, todos os próximos horários são reorganizados automaticamente.
                  </p>
                </div>
              </div>
            </div>
          </div>
          {/* Mock */}
          <div className="bg-[hsl(var(--secondary))] rounded-2xl p-6 border border-[hsl(var(--border))]">
            <div className="space-y-3">
              {[
                { time: '09:00', name: 'Carlos Silva', service: 'Corte Degradê', status: 'confirmed' },
                { time: '09:45', name: 'Pedro Santos', service: 'Barba', status: 'confirmed' },
                { time: '10:15', name: 'João Oliveira', service: 'Corte + Barba', status: 'pending' },
                { time: '11:30', name: 'Lucas Mendes', service: 'Corte Social', status: 'confirmed' },
              ].map((a, i) => (
                <div key={i} className="bg-white rounded-xl p-4 flex items-center justify-between border border-[hsl(var(--border))]">
                  <div className="flex items-center gap-3">
                    <span className="text-sm font-mono font-bold text-[hsl(var(--primary))]">{a.time}</span>
                    <div>
                      <p className="font-medium text-sm text-[hsl(var(--foreground))]">{a.name}</p>
                      <p className="text-xs text-[hsl(var(--muted-foreground))]">{a.service}</p>
                    </div>
                  </div>
                  <span className={`text-xs px-2 py-1 rounded-full font-medium ${
                    a.status === 'confirmed'
                      ? 'bg-[hsl(var(--accent))]/10 text-[hsl(var(--accent-foreground))]'
                      : 'bg-[hsl(var(--warning))]/10 text-[hsl(var(--warning))]'
                  }`}>
                    {a.status === 'confirmed' ? 'Confirmado' : 'Pendente'}
                  </span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* ─── TEAM MANAGEMENT ─── */}
      <section className="bg-[hsl(var(--secondary))]">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-20">
          <div className="grid lg:grid-cols-2 gap-16 items-center">
            <div className="order-2 lg:order-1">
              <div className="bg-white rounded-2xl p-6 border border-[hsl(var(--border))] shadow-sm space-y-4">
                {[
                  { name: 'Rafael Costa', type: 'Sócio', revenue: 'R$ 4.200', pct: '50%' },
                  { name: 'Bruno Alves', type: 'Comissionado', revenue: 'R$ 3.100', pct: '40%' },
                  { name: 'Diego Lima', type: 'Independente', revenue: 'R$ 2.800', pct: '—' },
                ].map((m, i) => (
                  <div key={i} className="flex items-center justify-between p-3 rounded-xl bg-[hsl(var(--secondary))]/50">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-full bg-[hsl(var(--primary))]/10 flex items-center justify-center">
                        <span className="text-sm font-bold text-[hsl(var(--primary))]">{m.name[0]}</span>
                      </div>
                      <div>
                        <p className="font-medium text-sm text-[hsl(var(--foreground))]">{m.name}</p>
                        <p className="text-xs text-[hsl(var(--muted-foreground))]">{m.type}</p>
                      </div>
                    </div>
                    <div className="text-right">
                      <p className="text-sm font-bold text-[hsl(var(--foreground))]">{m.revenue}</p>
                      <p className="text-xs text-[hsl(var(--muted-foreground))]">Comissão: {m.pct}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
            <div className="order-1 lg:order-2 space-y-6">
              <div className="inline-flex items-center gap-2 bg-[hsl(var(--primary))]/10 text-[hsl(var(--primary))] px-3 py-1 rounded-full text-sm font-medium">
                <Users className="h-4 w-4" /> Equipe
              </div>
              <h2 className="text-3xl md:text-4xl font-display font-bold text-[hsl(var(--foreground))]">
                Controle completo da sua <span className="text-[hsl(var(--accent))]">equipe</span>
              </h2>
              <p className="text-lg text-[hsl(var(--muted-foreground))]">
                Gerencie sócios, comissionados e independentes em um só lugar. O sistema calcula automaticamente comissões, faturamento e lucro.
              </p>
              <div className="space-y-3">
                {['Sócios com divisão de lucro', 'Comissionados com cálculo automático', 'Independentes (aluguel de cadeira)'].map((item, i) => (
                  <div key={i} className="flex items-center gap-3">
                    <CheckCircle2 className="h-5 w-5 text-[hsl(var(--accent))] flex-shrink-0" />
                    <p className="text-[hsl(var(--muted-foreground))]">{item}</p>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ─── BOOKING PAGE ─── */}
      <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-20">
        <div className="grid lg:grid-cols-2 gap-16 items-center">
          <div className="space-y-6">
            <div className="inline-flex items-center gap-2 bg-[hsl(var(--accent))]/10 text-[hsl(var(--accent-foreground))] px-3 py-1 rounded-full text-sm font-medium">
              <Globe className="h-4 w-4 text-[hsl(var(--accent))]" /> Link de agendamento
            </div>
            <h2 className="text-3xl md:text-4xl font-display font-bold text-[hsl(var(--foreground))]">
              Seu próprio link de <span className="text-[hsl(var(--accent))]">agendamento</span>
            </h2>
            <p className="text-lg text-[hsl(var(--muted-foreground))]">
              Cada profissional ganha uma página pública personalizada para colocar na bio do Instagram.
            </p>
            <div className="space-y-3">
              {[
                { icon: Star, text: 'Avaliações de clientes' },
                { icon: Gift, text: 'Promoções ativas' },
                { icon: Calendar, text: 'Agenda aberta em tempo real' },
                { icon: Smartphone, text: 'Redes sociais integradas' },
                { icon: MapPin, text: 'Endereço no Google Maps' },
              ].map((item, i) => (
                <div key={i} className="flex items-center gap-3">
                  <item.icon className="h-5 w-5 text-[hsl(var(--accent))] flex-shrink-0" />
                  <p className="text-[hsl(var(--muted-foreground))]">{item.text}</p>
                </div>
              ))}
            </div>
          </div>
          {/* Mock phone */}
          <div className="flex justify-center">
            <div className="w-72 bg-[hsl(var(--foreground))] rounded-[2.5rem] p-3 shadow-2xl">
              <div className="bg-white rounded-[2rem] overflow-hidden">
                <div className="h-48 bg-gradient-to-br from-[hsl(var(--primary))] to-[hsl(var(--primary))]/80 flex items-end p-4">
                  <div className="flex items-center gap-3">
                    <div className="w-12 h-12 rounded-full bg-white/20 flex items-center justify-center">
                      <Scissors className="h-6 w-6 text-white" />
                    </div>
                    <div>
                      <p className="text-white font-bold">João Barber</p>
                      <div className="flex gap-1">
                        {[1,2,3,4,5].map(s => <Star key={s} className="h-3 w-3 text-yellow-400 fill-yellow-400" />)}
                      </div>
                    </div>
                  </div>
                </div>
                <div className="p-4 space-y-3">
                  <div className="p-3 rounded-xl bg-[hsl(var(--secondary))]">
                    <p className="text-xs font-medium text-[hsl(var(--foreground))]">Corte Degradê</p>
                    <p className="text-xs text-[hsl(var(--muted-foreground))]">45 min • R$ 35,00</p>
                  </div>
                  <div className="p-3 rounded-xl bg-[hsl(var(--secondary))]">
                    <p className="text-xs font-medium text-[hsl(var(--foreground))]">Barba Completa</p>
                    <p className="text-xs text-[hsl(var(--muted-foreground))]">30 min • R$ 25,00</p>
                  </div>
                  <Button size="sm" className="w-full bg-[hsl(var(--accent))] text-[hsl(var(--accent-foreground))] text-xs">
                    Agendar horário
                  </Button>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ─── OPEN AGENDA ─── */}
      <section className="bg-[hsl(var(--secondary))]">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-20 text-center">
          <div className="inline-flex items-center gap-2 bg-[hsl(var(--primary))]/10 text-[hsl(var(--primary))] px-3 py-1 rounded-full text-sm font-medium mb-6">
            <CalendarDays className="h-4 w-4" /> Agenda Aberta
          </div>
          <h2 className="text-3xl md:text-4xl font-display font-bold text-[hsl(var(--foreground))] mb-4">
            Crie agendas especiais para datas de <span className="text-[hsl(var(--accent))]">grande demanda</span>
          </h2>
          <p className="text-lg text-[hsl(var(--muted-foreground))] max-w-2xl mx-auto mb-12">
            Formaturas, casamentos, Natal, Dia das Mães — crie eventos com vagas limitadas e horários especiais.
          </p>
          <div className="grid sm:grid-cols-3 gap-6 max-w-3xl mx-auto">
            {[
              { icon: Target, title: 'Limite vagas', desc: 'Controle o número máximo de atendimentos' },
              { icon: Clock, title: 'Horários flexíveis', desc: 'Defina horários específicos para o evento' },
              { icon: Scissors, title: 'Serviços exclusivos', desc: 'Escolha quais serviços oferecer' },
            ].map((f, i) => (
              <Card key={i} className="border-[hsl(var(--border))] bg-white">
                <CardContent className="p-6 text-center space-y-3">
                  <div className="w-12 h-12 rounded-xl bg-[hsl(var(--accent))]/10 flex items-center justify-center mx-auto">
                    <f.icon className="h-6 w-6 text-[hsl(var(--accent))]" />
                  </div>
                  <h3 className="font-display font-semibold text-[hsl(var(--foreground))]">{f.title}</h3>
                  <p className="text-sm text-[hsl(var(--muted-foreground))]">{f.desc}</p>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      </section>

      {/* ─── PROMOTIONS ─── */}
      <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-20">
        <div className="grid lg:grid-cols-2 gap-16 items-center">
          <div className="order-2 lg:order-1">
            <div className="bg-gradient-to-br from-[hsl(var(--accent))]/5 to-[hsl(var(--primary))]/5 rounded-2xl p-6 border border-[hsl(var(--border))] space-y-4">
              {[
                { target: 'Clientes inativos', count: '23 clientes', discount: '20% OFF' },
                { target: 'Clientes recorrentes', count: '45 clientes', discount: '10% OFF' },
                { target: 'Top gastadores', count: '12 clientes', discount: '15% OFF' },
              ].map((p, i) => (
                <div key={i} className="bg-white rounded-xl p-4 flex items-center justify-between border border-[hsl(var(--border))]">
                  <div>
                    <p className="font-medium text-sm text-[hsl(var(--foreground))]">{p.target}</p>
                    <p className="text-xs text-[hsl(var(--muted-foreground))]">{p.count}</p>
                  </div>
                  <span className="text-sm font-bold text-[hsl(var(--accent))] bg-[hsl(var(--accent))]/10 px-3 py-1 rounded-full">{p.discount}</span>
                </div>
              ))}
            </div>
          </div>
          <div className="order-1 lg:order-2 space-y-6">
            <div className="inline-flex items-center gap-2 bg-[hsl(var(--accent))]/10 text-[hsl(var(--accent-foreground))] px-3 py-1 rounded-full text-sm font-medium">
              <Megaphone className="h-4 w-4 text-[hsl(var(--accent))]" /> Promoções
            </div>
            <h2 className="text-3xl md:text-4xl font-display font-bold text-[hsl(var(--foreground))]">
              Preencha horários vazios com <span className="text-[hsl(var(--accent))]">promoções estratégicas</span>
            </h2>
            <p className="text-lg text-[hsl(var(--muted-foreground))]">
              Envie promoções segmentadas para trazer clientes de volta e preencher sua agenda nos horários ociosos.
            </p>
          </div>
        </div>
      </section>

      {/* ─── FINANCEIRO ─── */}
      <section className="bg-[hsl(var(--primary))]">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-20">
          <div className="text-center mb-12">
            <div className="inline-flex items-center gap-2 bg-white/10 text-white px-3 py-1 rounded-full text-sm font-medium mb-6">
              <PieChart className="h-4 w-4" /> Financeiro
            </div>
            <h2 className="text-3xl md:text-4xl font-display font-bold text-white">
              Controle o dinheiro do seu negócio
            </h2>
          </div>
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-6">
            {[
              { icon: BarChart3, title: 'Dashboard financeiro', desc: 'Visão completa do faturamento em tempo real' },
              { icon: TrendingUp, title: 'Controle de receitas', desc: 'Todas as entradas organizadas por período' },
              { icon: DollarSign, title: 'Controle de despesas', desc: 'Registre e categorize todas as saídas' },
              { icon: Users, title: 'Comissões automáticas', desc: 'Cálculo automático por profissional' },
              { icon: PieChart, title: 'Relatórios detalhados', desc: 'Faturamento por serviço e profissional' },
              { icon: Target, title: 'Contas a pagar/receber', desc: 'Controle completo de fluxo de caixa' },
            ].map((f, i) => (
              <div key={i} className="bg-white/5 border border-white/10 rounded-xl p-6 space-y-3">
                <div className="w-10 h-10 rounded-lg bg-[hsl(var(--accent))]/20 flex items-center justify-center">
                  <f.icon className="h-5 w-5 text-[hsl(var(--accent))]" />
                </div>
                <h3 className="font-display font-semibold text-white">{f.title}</h3>
                <p className="text-sm text-white/60">{f.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ─── CLIENT HISTORY ─── */}
      <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-20">
        <div className="grid lg:grid-cols-2 gap-16 items-center">
          <div className="space-y-6">
            <div className="inline-flex items-center gap-2 bg-[hsl(var(--primary))]/10 text-[hsl(var(--primary))] px-3 py-1 rounded-full text-sm font-medium">
              <Heart className="h-4 w-4" /> Clientes
            </div>
            <h2 className="text-3xl md:text-4xl font-display font-bold text-[hsl(var(--foreground))]">
              Conheça seus clientes <span className="text-[hsl(var(--accent))]">de verdade</span>
            </h2>
            <div className="space-y-3">
              {[
                'Cliente que mais gasta',
                'Serviços favoritos de cada cliente',
                'Profissional mais agendado',
                'Aniversariantes do mês',
              ].map((item, i) => (
                <div key={i} className="flex items-center gap-3">
                  <CheckCircle2 className="h-5 w-5 text-[hsl(var(--accent))] flex-shrink-0" />
                  <p className="text-[hsl(var(--muted-foreground))]">{item}</p>
                </div>
              ))}
            </div>
          </div>
          <div className="bg-[hsl(var(--secondary))] rounded-2xl p-6 border border-[hsl(var(--border))] space-y-4">
            {[
              { name: 'Lucas Mendes', visits: '24 visitas', spent: 'R$ 2.160', tag: 'Top Cliente' },
              { name: 'Pedro Santos', visits: '18 visitas', spent: 'R$ 1.440', tag: 'Fiel' },
              { name: 'Carlos Silva', visits: '12 visitas', spent: 'R$ 960', tag: 'Aniversariante' },
            ].map((c, i) => (
              <div key={i} className="bg-white rounded-xl p-4 flex items-center justify-between border border-[hsl(var(--border))]">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-full bg-[hsl(var(--accent))]/10 flex items-center justify-center">
                    <span className="text-sm font-bold text-[hsl(var(--accent))]">{c.name[0]}</span>
                  </div>
                  <div>
                    <p className="font-medium text-sm text-[hsl(var(--foreground))]">{c.name}</p>
                    <p className="text-xs text-[hsl(var(--muted-foreground))]">{c.visits} • {c.spent}</p>
                  </div>
                </div>
                <span className="text-xs px-2 py-1 rounded-full bg-[hsl(var(--accent))]/10 text-[hsl(var(--accent-foreground))] font-medium">{c.tag}</span>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ─── MARKETPLACE ─── */}
      <section className="bg-[hsl(var(--secondary))]">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-20 text-center">
          <div className="inline-flex items-center gap-2 bg-[hsl(var(--accent))]/10 text-[hsl(var(--accent-foreground))] px-3 py-1 rounded-full text-sm font-medium mb-6">
            <Search className="h-4 w-4 text-[hsl(var(--accent))]" /> Marketplace
          </div>
          <h2 className="text-3xl md:text-4xl font-display font-bold text-[hsl(var(--foreground))] mb-4">
            Ganhe novos clientes <span className="text-[hsl(var(--accent))]">automaticamente</span>
          </h2>
          <p className="text-lg text-[hsl(var(--muted-foreground))] max-w-2xl mx-auto mb-12">
            Seu perfil aparece no marketplace do MeAgendaê. Clientes da sua cidade encontram você e agendam diretamente.
          </p>
          <div className="grid sm:grid-cols-3 gap-6 max-w-3xl mx-auto">
            {[
              { icon: MapPin, title: 'Busca local', desc: 'Clientes encontram profissionais na sua cidade' },
              { icon: Star, title: 'Avaliações', desc: 'Seus depoimentos atraem novos clientes' },
              { icon: Calendar, title: 'Agendamento direto', desc: 'O cliente agenda sem precisar ligar' },
            ].map((f, i) => (
              <Card key={i} className="border-[hsl(var(--border))] bg-white">
                <CardContent className="p-6 text-center space-y-3">
                  <div className="w-12 h-12 rounded-xl bg-[hsl(var(--primary))]/10 flex items-center justify-center mx-auto">
                    <f.icon className="h-6 w-6 text-[hsl(var(--primary))]" />
                  </div>
                  <h3 className="font-display font-semibold text-[hsl(var(--foreground))]">{f.title}</h3>
                  <p className="text-sm text-[hsl(var(--muted-foreground))]">{f.desc}</p>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      </section>

      {/* ─── TESTIMONIALS ─── */}
      <section id="depoimentos" className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-20">
        <div className="text-center mb-12">
          <h2 className="text-3xl md:text-4xl font-display font-bold text-[hsl(var(--foreground))]">
            O que dizem nossos <span className="text-[hsl(var(--accent))]">profissionais</span>
          </h2>
        </div>
        <div className="grid md:grid-cols-3 gap-6">
          {[
            { name: 'Rafael Barber', role: 'Barbearia Style', text: 'Desde que comecei a usar o MeAgendaê, meu faturamento aumentou 40%. Meus clientes adoram agendar online.' },
            { name: 'Ana Costa', role: 'Estética Ana Costa', text: 'Organizar a equipe era um pesadelo. Agora tudo é automático, comissões, relatórios, tudo no sistema.' },
            { name: 'Marcos Silva', role: 'Barber House', text: 'O sistema de promoções é incrível. Preenchi todos os horários vazios da segunda-feira.' },
          ].map((t, i) => (
            <Card key={i} className="border-[hsl(var(--border))]">
              <CardContent className="p-6 space-y-4">
                <Quote className="h-8 w-8 text-[hsl(var(--accent))]/30" />
                <p className="text-[hsl(var(--muted-foreground))] leading-relaxed">{t.text}</p>
                <div className="flex items-center gap-3 pt-2">
                  <div className="w-10 h-10 rounded-full bg-[hsl(var(--primary))]/10 flex items-center justify-center">
                    <span className="text-sm font-bold text-[hsl(var(--primary))]">{t.name[0]}</span>
                  </div>
                  <div>
                    <p className="font-medium text-sm text-[hsl(var(--foreground))]">{t.name}</p>
                    <p className="text-xs text-[hsl(var(--muted-foreground))]">{t.role}</p>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      </section>

      {/* ─── MIGRATION ─── */}
      <section className="bg-[hsl(var(--secondary))]">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-20">
          <div className="max-w-3xl mx-auto text-center space-y-6">
            <div className="w-16 h-16 rounded-2xl bg-[hsl(var(--accent))]/10 flex items-center justify-center mx-auto">
              <ArrowRightLeft className="h-8 w-8 text-[hsl(var(--accent))]" />
            </div>
            <h2 className="text-3xl md:text-4xl font-display font-bold text-[hsl(var(--foreground))]">
              Já usa outro sistema? <span className="text-[hsl(var(--accent))]">Nós migramos para você.</span>
            </h2>
            <p className="text-lg text-[hsl(var(--muted-foreground))]">
              Nossa equipe ajuda na migração dos seus dados para o MeAgendaê. Sem perder clientes ou histórico.
            </p>
          </div>
        </div>
      </section>

      {/* ─── PLANS ─── */}
      <section id="planos" className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-20">
        <div className="text-center mb-12">
          <h2 className="text-3xl md:text-4xl font-display font-bold text-[hsl(var(--foreground))]">
            Planos para todos os tamanhos de negócio
          </h2>
          <p className="text-lg text-[hsl(var(--muted-foreground))] mt-3">
            Teste grátis por 7 dias — sem cartão de crédito
          </p>
        </div>
        <div className="grid md:grid-cols-3 gap-8 max-w-5xl mx-auto">
          {/* Basic */}
          <Card className="border-[hsl(var(--border))] relative">
            <CardContent className="p-8 space-y-6">
              <div>
                <h3 className="font-display font-bold text-xl text-[hsl(var(--foreground))]">Básico</h3>
                <p className="text-sm text-[hsl(var(--muted-foreground))] mt-1">Para profissionais autônomos</p>
              </div>
              <div>
                <span className="text-4xl font-display font-bold text-[hsl(var(--foreground))]">R$ 49</span>
                <span className="text-[hsl(var(--muted-foreground))]">/mês</span>
              </div>
              <div className="space-y-3">
                {['Agenda online', 'Página de agendamento', 'Cadastro de serviços', 'Notificações para clientes'].map((f, i) => (
                  <div key={i} className="flex items-center gap-2 text-sm">
                    <CheckCircle2 className="h-4 w-4 text-[hsl(var(--accent))] flex-shrink-0" />
                    <span className="text-[hsl(var(--muted-foreground))]">{f}</span>
                  </div>
                ))}
              </div>
              <Link to="/auth" className="block">
                <Button variant="outline" className="w-full border-[hsl(var(--border))]">Começar grátis</Button>
              </Link>
            </CardContent>
          </Card>

          {/* Pro */}
          <Card className="border-[hsl(var(--accent))] border-2 relative shadow-lg shadow-[hsl(var(--accent))]/10">
            <div className="absolute -top-3 left-1/2 -translate-x-1/2">
              <span className="bg-[hsl(var(--accent))] text-[hsl(var(--accent-foreground))] text-xs font-bold px-4 py-1 rounded-full">
                MAIS ESCOLHIDO
              </span>
            </div>
            <CardContent className="p-8 space-y-6">
              <div>
                <h3 className="font-display font-bold text-xl text-[hsl(var(--foreground))]">Profissional</h3>
                <p className="text-sm text-[hsl(var(--muted-foreground))] mt-1">Para equipes em crescimento</p>
              </div>
              <div>
                <span className="text-4xl font-display font-bold text-[hsl(var(--foreground))]">R$ 99</span>
                <span className="text-[hsl(var(--muted-foreground))]">/mês</span>
              </div>
              <div className="space-y-3">
                {['Tudo do Básico', 'Agenda aberta para eventos', 'Promoções inteligentes', 'Gestão de equipe', 'Relatórios financeiros'].map((f, i) => (
                  <div key={i} className="flex items-center gap-2 text-sm">
                    <CheckCircle2 className="h-4 w-4 text-[hsl(var(--accent))] flex-shrink-0" />
                    <span className="text-[hsl(var(--muted-foreground))]">{f}</span>
                  </div>
                ))}
              </div>
              <Link to="/auth" className="block">
                <Button className="w-full bg-[hsl(var(--accent))] text-[hsl(var(--accent-foreground))] hover:bg-[hsl(var(--accent))]/90">Começar grátis</Button>
              </Link>
            </CardContent>
          </Card>

          {/* Premium */}
          <Card className="border-[hsl(var(--border))] relative bg-[hsl(var(--primary))] text-white">
            <CardContent className="p-8 space-y-6">
              <div>
                <h3 className="font-display font-bold text-xl text-white">Premium</h3>
                <p className="text-sm text-white/60 mt-1">Gestão completa</p>
              </div>
              <div>
                <span className="text-4xl font-display font-bold text-white">R$ 199</span>
                <span className="text-white/60">/mês</span>
              </div>
              <div className="space-y-3">
                {['Tudo do Profissional', 'Financeiro completo', 'Domínio próprio', 'White label', 'Automações avançadas'].map((f, i) => (
                  <div key={i} className="flex items-center gap-2 text-sm">
                    <CheckCircle2 className="h-4 w-4 text-[hsl(var(--accent))] flex-shrink-0" />
                    <span className="text-white/80">{f}</span>
                  </div>
                ))}
              </div>
              <Link to="/auth" className="block">
                <Button variant="secondary" className="w-full">Começar grátis</Button>
              </Link>
            </CardContent>
          </Card>
        </div>
      </section>

      {/* ─── FINAL CTA ─── */}
      <section className="bg-gradient-to-br from-[hsl(var(--primary))] to-[hsl(var(--primary))]/90">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-20 text-center">
          <h2 className="text-3xl md:text-4xl font-display font-bold text-white mb-4">
            Comece a organizar seu negócio <span className="text-[hsl(var(--accent))]">hoje</span>
          </h2>
          <p className="text-lg text-white/70 max-w-xl mx-auto mb-8">
            Teste grátis por 7 dias e veja como o MeAgendaê pode transformar sua rotina.
          </p>
          <Link to="/auth">
            <Button size="lg" className="text-base px-10 bg-[hsl(var(--accent))] text-[hsl(var(--accent-foreground))] hover:bg-[hsl(var(--accent))]/90 shadow-lg shadow-[hsl(var(--accent))]/25">
              Criar conta grátis
              <ArrowRight className="h-5 w-5 ml-2" />
            </Button>
          </Link>
          <p className="text-sm text-white/50 mt-4">Sem cartão de crédito • Cancele quando quiser</p>
        </div>
      </section>

      {/* ─── FOOTER ─── */}
      <footer className="border-t border-[hsl(var(--border))] bg-white">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
          <div className="grid md:grid-cols-4 gap-8">
            <div className="space-y-4">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-lg bg-[hsl(var(--primary))] flex items-center justify-center">
                  <Scissors className="h-4 w-4 text-white" />
                </div>
                <span className="font-display font-bold text-lg text-[hsl(var(--foreground))]">MeAgendaê</span>
              </div>
              <p className="text-sm text-[hsl(var(--muted-foreground))]">
                Sistema de gestão e agendamento para profissionais de beleza.
              </p>
            </div>
            <div>
              <h4 className="font-semibold text-sm text-[hsl(var(--foreground))] mb-3">Produto</h4>
              <div className="space-y-2 text-sm text-[hsl(var(--muted-foreground))]">
                <a href="#funcionalidades" className="block hover:text-[hsl(var(--foreground))]">Funcionalidades</a>
                <a href="#planos" className="block hover:text-[hsl(var(--foreground))]">Planos</a>
                <a href="#depoimentos" className="block hover:text-[hsl(var(--foreground))]">Depoimentos</a>
              </div>
            </div>
            <div>
              <h4 className="font-semibold text-sm text-[hsl(var(--foreground))] mb-3">Suporte</h4>
              <div className="space-y-2 text-sm text-[hsl(var(--muted-foreground))]">
                <p>Central de ajuda</p>
                <p>Contato</p>
                <p>Migração</p>
              </div>
            </div>
            <div>
              <h4 className="font-semibold text-sm text-[hsl(var(--foreground))] mb-3">Legal</h4>
              <div className="space-y-2 text-sm text-[hsl(var(--muted-foreground))]">
                <p>Termos de uso</p>
                <p>Política de privacidade</p>
              </div>
            </div>
          </div>
          <div className="border-t border-[hsl(var(--border))] mt-8 pt-8 text-center">
            <p className="text-sm text-[hsl(var(--muted-foreground))]">
              © {new Date().getFullYear()} MeAgendaê. Todos os direitos reservados.
            </p>
          </div>
        </div>
      </footer>
    </div>
  );
};

export default LandingProfissionais;
