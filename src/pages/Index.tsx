import { Link } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Scissors, Calendar, Users, Zap, BarChart3, Globe } from 'lucide-react';

const features = [
  { icon: Calendar, title: 'Agenda Inteligente', desc: 'Cálculo automático de horários disponíveis baseado na sua rotina' },
  { icon: Users, title: 'Gestão de Equipe', desc: 'Controle colaboradores, sócios e comissões em um só lugar' },
  { icon: Globe, title: 'Página de Agendamento', desc: 'Link personalizado para seus clientes agendarem online' },
  { icon: Zap, title: 'Automações', desc: 'Webhooks para integrar com WhatsApp, email e mais' },
  { icon: BarChart3, title: 'Relatórios', desc: 'Faturamento por período e por profissional em tempo real' },
  { icon: Scissors, title: 'Multi-Serviços', desc: 'Seus clientes podem agendar múltiplos serviços de uma vez' },
];

const Index = () => (
  <div className="min-h-screen bg-background">
    {/* Nav */}
    <nav className="border-b bg-card/80 backdrop-blur-sm sticky top-0 z-50">
      <div className="max-w-6xl mx-auto px-4 py-3 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className="w-9 h-9 bg-primary rounded-xl flex items-center justify-center">
            <Scissors className="h-5 w-5 text-primary-foreground" />
          </div>
          <span className="font-display font-bold text-xl">AgendaPro</span>
        </div>
        <div className="flex gap-2">
          <Link to="/auth">
            <Button variant="ghost">Entrar</Button>
          </Link>
          <Link to="/auth">
            <Button>Começar Grátis</Button>
          </Link>
        </div>
      </div>
    </nav>

    {/* Hero */}
    <section className="max-w-6xl mx-auto px-4 py-20 text-center">
      <h1 className="text-4xl md:text-6xl font-display font-bold leading-tight mb-6">
        Agendamento inteligente para{' '}
        <span className="text-primary">profissionais de beleza</span>
      </h1>
      <p className="text-lg text-muted-foreground max-w-2xl mx-auto mb-8">
        Organize sua agenda, gerencie equipe, receba clientes online e automatize lembretes — tudo em uma plataforma simples e poderosa.
      </p>
      <div className="flex gap-3 justify-center">
        <Link to="/auth">
          <Button size="lg" className="text-base px-8">
            Criar Conta Grátis
          </Button>
        </Link>
      </div>
    </section>

    {/* Features */}
    <section className="max-w-6xl mx-auto px-4 py-16">
      <h2 className="text-3xl font-display font-bold text-center mb-12">
        Tudo que você precisa
      </h2>
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {features.map((f, i) => (
          <div key={i} className="p-6 rounded-2xl border bg-card hover:shadow-lg transition-shadow">
            <div className="w-12 h-12 bg-primary/10 rounded-xl flex items-center justify-center mb-4">
              <f.icon className="h-6 w-6 text-primary" />
            </div>
            <h3 className="font-display font-semibold text-lg mb-2">{f.title}</h3>
            <p className="text-muted-foreground text-sm">{f.desc}</p>
          </div>
        ))}
      </div>
    </section>

    {/* CTA */}
    <section className="max-w-6xl mx-auto px-4 py-16">
      <div className="bg-primary rounded-3xl p-10 text-center">
        <h2 className="text-3xl font-display font-bold text-primary-foreground mb-4">
          Comece a agendar hoje mesmo
        </h2>
        <p className="text-primary-foreground/80 mb-6">
          Teste grátis por 14 dias. Sem cartão de crédito.
        </p>
        <Link to="/auth">
          <Button size="lg" variant="secondary" className="text-base px-8">
            Criar Conta Grátis
          </Button>
        </Link>
      </div>
    </section>

    {/* Footer */}
    <footer className="border-t py-8">
      <div className="max-w-6xl mx-auto px-4 text-center text-sm text-muted-foreground">
        <p>© {new Date().getFullYear()} AgendaPro. Todos os direitos reservados.</p>
      </div>
    </footer>
  </div>
);

export default Index;
