import { useEffect, useState, useMemo } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell, Legend, LineChart, Line } from 'recharts';
import { format, subMonths, startOfMonth, endOfMonth, eachMonthOfInterval } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { MessageSquare, Building2, AlertTriangle, CalendarDays } from 'lucide-react';

interface Ticket {
  id: string;
  category: string;
  priority: string;
  status: string;
  company_id: string;
  created_at: string;
}

interface Company {
  id: string;
  name: string;
}

const COLORS = [
  'hsl(var(--primary))',
  'hsl(var(--destructive))',
  'hsl(var(--warning))',
  'hsl(var(--success))',
  'hsl(var(--accent-foreground))',
  'hsl(var(--muted-foreground))',
];

const categoryLabels: Record<string, string> = {
  general: 'Geral',
  billing: 'Cobrança',
  technical: 'Técnico',
  feature: 'Funcionalidade',
  bug: 'Bug',
  other: 'Outro',
};

const priorityLabels: Record<string, string> = {
  low: 'Baixa',
  medium: 'Média',
  high: 'Alta',
  urgent: 'Urgente',
};

const SuperAdminSupportReports = () => {
  const [tickets, setTickets] = useState<Ticket[]>([]);
  const [companies, setCompanies] = useState<Company[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchAll = async () => {
      const [ticketRes, compRes] = await Promise.all([
        supabase.from('support_tickets').select('id, category, priority, status, company_id, created_at').order('created_at', { ascending: true }),
        supabase.from('companies').select('id, name'),
      ]);
      if (ticketRes.data) setTickets(ticketRes.data);
      if (compRes.data) setCompanies(compRes.data);
      setLoading(false);
    };
    fetchAll();
  }, []);

  const companyMap = useMemo(() => {
    const map: Record<string, string> = {};
    companies.forEach(c => { map[c.id] = c.name; });
    return map;
  }, [companies]);

  // By category
  const byCategoryData = useMemo(() => {
    const counts: Record<string, number> = {};
    tickets.forEach(t => { counts[t.category] = (counts[t.category] || 0) + 1; });
    return Object.entries(counts).map(([key, value]) => ({ name: categoryLabels[key] || key, value }));
  }, [tickets]);

  // By company (top 10)
  const byCompanyData = useMemo(() => {
    const counts: Record<string, number> = {};
    tickets.forEach(t => { counts[t.company_id] = (counts[t.company_id] || 0) + 1; });
    return Object.entries(counts)
      .map(([id, value]) => ({ name: companyMap[id] || id.slice(0, 8), value }))
      .sort((a, b) => b.value - a.value)
      .slice(0, 10);
  }, [tickets, companyMap]);

  // By priority
  const byPriorityData = useMemo(() => {
    const counts: Record<string, number> = {};
    tickets.forEach(t => { counts[t.priority] = (counts[t.priority] || 0) + 1; });
    return Object.entries(counts).map(([key, value]) => ({ name: priorityLabels[key] || key, value }));
  }, [tickets]);

  // By date (last 6 months)
  const byDateData = useMemo(() => {
    const now = new Date();
    const sixMonthsAgo = subMonths(startOfMonth(now), 5);
    const months = eachMonthOfInterval({ start: sixMonthsAgo, end: now });
    return months.map(m => {
      const ms = startOfMonth(m);
      const me = endOfMonth(m);
      const count = tickets.filter(t => {
        const d = new Date(t.created_at);
        return d >= ms && d <= me;
      }).length;
      return { name: format(m, 'MMM/yy', { locale: ptBR }), tickets: count };
    });
  }, [tickets]);

  if (loading) {
    return <div className="flex items-center justify-center py-12"><p className="text-muted-foreground">Carregando...</p></div>;
  }

  return (
    <div className="space-y-6">
      <h2 className="text-xl font-display font-semibold">📊 Relatórios de Suporte</h2>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* By Category */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <MessageSquare className="h-5 w-5" /> Tickets por Categoria
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="h-[300px]">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie data={byCategoryData} cx="50%" cy="50%" labelLine={false} outerRadius={100} dataKey="value" label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}>
                    {byCategoryData.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
                  </Pie>
                  <Tooltip />
                  <Legend />
                </PieChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>

        {/* By Priority */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <AlertTriangle className="h-5 w-5" /> Tickets por Prioridade
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="h-[300px]">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie data={byPriorityData} cx="50%" cy="50%" labelLine={false} outerRadius={100} dataKey="value" label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}>
                    {byPriorityData.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
                  </Pie>
                  <Tooltip />
                  <Legend />
                </PieChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>

        {/* By Company */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <Building2 className="h-5 w-5" /> Tickets por Empresa (Top 10)
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="h-[300px]">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={byCompanyData} layout="vertical">
                  <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
                  <XAxis type="number" />
                  <YAxis dataKey="name" type="category" width={120} className="text-xs" />
                  <Tooltip />
                  <Bar dataKey="value" name="Tickets" fill="hsl(var(--primary))" radius={[0, 4, 4, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>

        {/* By Date */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <CalendarDays className="h-5 w-5" /> Tickets por Mês
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="h-[300px]">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={byDateData}>
                  <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
                  <XAxis dataKey="name" className="text-xs" />
                  <YAxis className="text-xs" />
                  <Tooltip />
                  <Line type="monotone" dataKey="tickets" name="Tickets" stroke="hsl(var(--primary))" strokeWidth={2} dot={{ r: 4 }} />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default SuperAdminSupportReports;
