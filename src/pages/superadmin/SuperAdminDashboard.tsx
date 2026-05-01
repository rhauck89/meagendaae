import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Building2, Users, Clock, DollarSign, TrendingUp, MessageSquare, AlertCircle, CheckCircle } from 'lucide-react';
import { format, startOfMonth } from 'date-fns';
import { useNavigate } from 'react-router-dom';

const SuperAdminDashboard = () => {
  const [companies, setCompanies] = useState<any[]>([]);
  const [tickets, setTickets] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const navigate = useNavigate();

  // Trace logs
  useEffect(() => {
    const count = (window as any)._trace_SuperAdminDashboard = ((window as any)._trace_SuperAdminDashboard || 0) + 1;
    console.log('[SUPER_ADMIN_RENDER_TRACE]', { component: "SuperAdminDashboard", count, pathname: window.location.pathname, timestamp: Date.now() });
  });


  useEffect(() => {
    const fetchAll = async () => {
      const [compRes, ticketRes] = await Promise.all([
        supabase.from('companies').select('id, name, slug, subscription_status, created_at, stripe_subscription_id').order('created_at', { ascending: false }),
        supabase.from('support_tickets').select('id, title, status, priority, category, created_at, company_id').order('created_at', { ascending: false }).limit(10),
      ]);
      if (compRes.data) setCompanies(compRes.data);
      if (ticketRes.data) setTickets(ticketRes.data);
      setLoading(false);
    };
    fetchAll();
  }, []);

  const totalCompanies = companies.length;
  const activeCompanies = companies.filter(c => c.subscription_status === 'active').length;
  const trialCompanies = companies.filter(c => c.subscription_status === 'trial').length;
  const blockedCompanies = companies.filter(c => c.subscription_status === 'blocked').length;
  const monthStart = startOfMonth(new Date());
  const newThisMonth = companies.filter(c => new Date(c.created_at) >= monthStart).length;

  const openTickets = tickets.filter(t => t.status === 'open').length;
  const inProgressTickets = tickets.filter(t => t.status === 'in_progress').length;
  const awaitingReply = tickets.filter(t => t.status === 'answered').length;

  const companyMetrics = [
    { label: 'Total Empresas', value: totalCompanies, icon: Building2, color: 'text-primary' },
    { label: 'Ativas', value: activeCompanies, icon: Users, color: 'text-success' },
    { label: 'Trial', value: trialCompanies, icon: Clock, color: 'text-warning' },
    { label: 'Bloqueadas', value: blockedCompanies, icon: DollarSign, color: 'text-destructive' },
    { label: 'Novas este mês', value: newThisMonth, icon: TrendingUp, color: 'text-accent-foreground' },
  ];

  const supportMetrics = [
    { label: 'Tickets Abertos', value: openTickets, icon: AlertCircle, color: 'text-destructive' },
    { label: 'Em Andamento', value: inProgressTickets, icon: Clock, color: 'text-warning' },
    { label: 'Aguardando Resposta', value: awaitingReply, icon: MessageSquare, color: 'text-primary' },
  ];

  const statusLabel: Record<string, string> = { open: 'Aberto', in_progress: 'Em andamento', answered: 'Respondido', resolved: 'Resolvido', closed: 'Fechado' };
  const statusColor: Record<string, string> = { open: 'bg-destructive/10 text-destructive', in_progress: 'bg-warning/10 text-warning', answered: 'bg-primary/10 text-primary', resolved: 'bg-success/10 text-success', closed: 'bg-muted text-muted-foreground' };
  const priorityLabel: Record<string, string> = { low: 'Baixa', medium: 'Média', high: 'Alta', urgent: 'Urgente' };

  if (loading) {
    return <div className="flex items-center justify-center py-12"><p className="text-muted-foreground">Carregando...</p></div>;
  }

  return (
    <div className="space-y-6">
      <h2 className="text-xl font-display font-semibold">📊 Visão Geral</h2>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
        {companyMetrics.map((m) => (
          <Card key={m.label}>
            <CardContent className="p-5 flex items-center gap-4">
              <m.icon className={`h-8 w-8 ${m.color}`} />
              <div>
                <p className="text-sm text-muted-foreground">{m.label}</p>
                <p className="text-2xl font-display font-bold">{m.value}</p>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Support Section */}
      <h2 className="text-xl font-display font-semibold">🎧 Suporte</h2>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        {supportMetrics.map((m) => (
          <Card key={m.label} className="cursor-pointer hover:shadow-md transition-shadow" onClick={() => navigate('/super-admin/support')}>
            <CardContent className="p-5 flex items-center gap-4">
              <m.icon className={`h-8 w-8 ${m.color}`} />
              <div>
                <p className="text-sm text-muted-foreground">{m.label}</p>
                <p className="text-2xl font-display font-bold">{m.value}</p>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {tickets.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <MessageSquare className="h-5 w-5" /> Tickets Recentes
            </CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Título</TableHead>
                  <TableHead>Categoria</TableHead>
                  <TableHead>Prioridade</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Data</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {tickets.slice(0, 5).map((t) => (
                  <TableRow key={t.id} className="cursor-pointer hover:bg-muted/50" onClick={() => navigate('/super-admin/support')}>
                    <TableCell className="font-medium text-sm">{t.title}</TableCell>
                    <TableCell className="text-sm text-muted-foreground">{t.category}</TableCell>
                    <TableCell>
                      <Badge variant="outline" className="text-xs">{priorityLabel[t.priority] || t.priority}</Badge>
                    </TableCell>
                    <TableCell>
                      <span className={`text-xs font-medium px-2 py-1 rounded-full ${statusColor[t.status] || 'bg-muted text-muted-foreground'}`}>
                        {statusLabel[t.status] || t.status}
                      </span>
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground">{format(new Date(t.created_at), 'dd/MM/yyyy')}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}

      <h2 className="text-xl font-display font-semibold">🏢 Últimas Empresas</h2>
      <div className="space-y-2">
        {companies.slice(0, 10).map((c) => (
          <Card key={c.id}>
            <CardContent className="p-4 flex items-center justify-between">
              <div>
                <p className="font-semibold">{c.name}</p>
                <p className="text-sm text-muted-foreground">/{c.slug} · {format(new Date(c.created_at), 'dd/MM/yyyy')}</p>
              </div>
              <span className={`text-xs font-medium px-2 py-1 rounded-full ${
                c.subscription_status === 'active' ? 'bg-success/10 text-success' :
                c.subscription_status === 'trial' ? 'bg-warning/10 text-warning' :
                c.subscription_status === 'blocked' ? 'bg-destructive/10 text-destructive' :
                'bg-muted text-muted-foreground'
              }`}>
                {c.subscription_status}
              </span>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
};

export default SuperAdminDashboard;
