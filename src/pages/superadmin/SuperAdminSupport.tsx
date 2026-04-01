import { useEffect, useState } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { ScrollArea } from '@/components/ui/scroll-area';
import { MessageSquare, Send, Filter } from 'lucide-react';
import { toast } from 'sonner';
import { format } from 'date-fns';

interface Ticket {
  id: string;
  title: string;
  description: string;
  category: string;
  status: string;
  priority: string;
  created_at: string;
  company_id: string;
  user_id: string;
  company?: { name: string } | null;
  profile?: { full_name: string; email: string } | null;
}

interface Message {
  id: string;
  message: string;
  is_admin: boolean;
  created_at: string;
}

const statusOptions = [
  { value: 'all', label: 'Todos' },
  { value: 'open', label: 'Aberto' },
  { value: 'in_progress', label: 'Em andamento' },
  { value: 'answered', label: 'Respondido' },
  { value: 'resolved', label: 'Resolvido' },
  { value: 'closed', label: 'Fechado' },
];

const statusMap: Record<string, { label: string; variant: 'default' | 'secondary' | 'destructive' | 'outline' }> = {
  open: { label: 'Aberto', variant: 'destructive' },
  in_progress: { label: 'Em andamento', variant: 'default' },
  answered: { label: 'Respondido', variant: 'secondary' },
  resolved: { label: 'Resolvido', variant: 'outline' },
  closed: { label: 'Fechado', variant: 'outline' },
};

const categoryMap: Record<string, string> = {
  general: 'Geral',
  billing: 'Cobrança',
  technical: 'Técnico',
  feature: 'Funcionalidade',
  bug: 'Bug',
};

const priorityMap: Record<string, string> = {
  low: 'Baixa',
  medium: 'Média',
  high: 'Alta',
  urgent: 'Urgente',
};

const SuperAdminSupport = () => {
  const { user } = useAuth();
  const [tickets, setTickets] = useState<Ticket[]>([]);
  const [companies, setCompanies] = useState<{ id: string; name: string }[]>([]);
  const [loading, setLoading] = useState(true);
  const [filterStatus, setFilterStatus] = useState('all');
  const [filterCompany, setFilterCompany] = useState('all');
  const [filterCategory, setFilterCategory] = useState('all');

  const [viewTicket, setViewTicket] = useState<Ticket | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [newMessage, setNewMessage] = useState('');
  const [sending, setSending] = useState(false);

  const fetchTickets = async () => {
    // Fetch tickets then enrich with company/profile data
    let query = supabase
      .from('support_tickets')
      .select('*')
      .order('created_at', { ascending: false });

    if (filterStatus !== 'all') query = query.eq('status', filterStatus);
    if (filterCompany !== 'all') query = query.eq('company_id', filterCompany);
    if (filterCategory !== 'all') query = query.eq('category', filterCategory);

    const { data } = await query;
    if (!data) { setLoading(false); return; }

    // Enrich with company names
    const companyIds = [...new Set(data.map((t: any) => t.company_id))];
    const { data: comps } = await supabase.from('companies').select('id, name').in('id', companyIds);
    const compMap = new Map((comps || []).map((c: any) => [c.id, c.name]));

    // Enrich with profile names
    const userIds = [...new Set(data.map((t: any) => t.user_id))];
    const { data: profiles } = await supabase.from('profiles').select('user_id, full_name, email').in('user_id', userIds);
    const profMap = new Map((profiles || []).map((p: any) => [p.user_id, p]));

    const enriched = data.map((t: any) => ({
      ...t,
      company: compMap.has(t.company_id) ? { name: compMap.get(t.company_id)! } : null,
      profile: profMap.has(t.user_id) ? profMap.get(t.user_id) : null,
    }));

    setTickets(enriched);
    setLoading(false);
  };

  const fetchCompanies = async () => {
    const { data } = await supabase.from('companies').select('id, name').order('name');
    if (data) setCompanies(data);
  };

  const fetchMessages = async (ticketId: string) => {
    const { data } = await supabase
      .from('support_messages')
      .select('*')
      .eq('ticket_id', ticketId)
      .order('created_at', { ascending: true });
    if (data) setMessages(data as Message[]);
  };

  useEffect(() => {
    fetchCompanies();
  }, []);

  useEffect(() => {
    fetchTickets();
  }, [filterStatus, filterCompany, filterCategory]);

  const openTicket = (t: Ticket) => {
    setViewTicket(t);
    fetchMessages(t.id);
  };

  const sendAdminMessage = async () => {
    if (!newMessage.trim() || !viewTicket) return;
    setSending(true);
    await supabase.from('support_messages').insert({
      ticket_id: viewTicket.id,
      user_id: user!.id,
      message: newMessage,
      is_admin: true,
    } as any);

    // Update ticket status to answered
    await supabase.from('support_tickets').update({ status: 'answered', updated_at: new Date().toISOString() } as any).eq('id', viewTicket.id);
    setViewTicket(prev => prev ? { ...prev, status: 'answered' } : null);

    setNewMessage('');
    fetchMessages(viewTicket.id);
    setSending(false);
  };

  const updateTicketStatus = async (ticketId: string, newStatus: string) => {
    await supabase.from('support_tickets').update({ status: newStatus, updated_at: new Date().toISOString() } as any).eq('id', ticketId);
    setViewTicket(prev => prev ? { ...prev, status: newStatus } : null);
    fetchTickets();
    toast.success('Status atualizado');
  };

  const stats = {
    open: tickets.filter(t => t.status === 'open').length,
    in_progress: tickets.filter(t => t.status === 'in_progress').length,
    answered: tickets.filter(t => t.status === 'answered').length,
    total: tickets.length,
  };

  if (loading) return <div className="flex items-center justify-center py-12"><p className="text-muted-foreground">Carregando...</p></div>;

  return (
    <div className="space-y-6">
      <h2 className="text-xl font-display font-semibold">🎫 Suporte</h2>

      {/* Stats */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        <Card><CardContent className="p-4 text-center"><p className="text-xs text-muted-foreground">Total</p><p className="text-2xl font-display font-bold">{stats.total}</p></CardContent></Card>
        <Card><CardContent className="p-4 text-center"><p className="text-xs text-muted-foreground">Abertos</p><p className="text-2xl font-display font-bold text-destructive">{stats.open}</p></CardContent></Card>
        <Card><CardContent className="p-4 text-center"><p className="text-xs text-muted-foreground">Em andamento</p><p className="text-2xl font-display font-bold text-primary">{stats.in_progress}</p></CardContent></Card>
        <Card><CardContent className="p-4 text-center"><p className="text-xs text-muted-foreground">Respondidos</p><p className="text-2xl font-display font-bold text-success">{stats.answered}</p></CardContent></Card>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-2 items-center">
        <Filter className="h-4 w-4 text-muted-foreground" />
        <Select value={filterStatus} onValueChange={setFilterStatus}>
          <SelectTrigger className="w-[150px]"><SelectValue placeholder="Status" /></SelectTrigger>
          <SelectContent>
            {statusOptions.map(s => <SelectItem key={s.value} value={s.value}>{s.label}</SelectItem>)}
          </SelectContent>
        </Select>
        <Select value={filterCompany} onValueChange={setFilterCompany}>
          <SelectTrigger className="w-[180px]"><SelectValue placeholder="Empresa" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todas as empresas</SelectItem>
            {companies.map(c => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}
          </SelectContent>
        </Select>
        <Select value={filterCategory} onValueChange={setFilterCategory}>
          <SelectTrigger className="w-[150px]"><SelectValue placeholder="Categoria" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todas</SelectItem>
            {Object.entries(categoryMap).map(([k, v]) => <SelectItem key={k} value={k}>{v}</SelectItem>)}
          </SelectContent>
        </Select>
      </div>

      {/* Tickets Table */}
      <Card>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Título</TableHead>
                  <TableHead>Empresa</TableHead>
                  <TableHead>Usuário</TableHead>
                  <TableHead>Categoria</TableHead>
                  <TableHead>Prioridade</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="hidden md:table-cell">Data</TableHead>
                  <TableHead className="w-[60px]" />
                </TableRow>
              </TableHeader>
              <TableBody>
                {tickets.length === 0 ? (
                  <TableRow><TableCell colSpan={8} className="text-center py-8 text-muted-foreground">Nenhum ticket encontrado</TableCell></TableRow>
                ) : tickets.map(t => {
                  const s = statusMap[t.status] || statusMap.open;
                  return (
                    <TableRow key={t.id} className="cursor-pointer" onClick={() => openTicket(t)}>
                      <TableCell className="font-medium text-sm max-w-[180px] truncate">{t.title}</TableCell>
                      <TableCell className="text-sm">{t.company?.name || '—'}</TableCell>
                      <TableCell className="text-sm">{t.profile?.full_name || '—'}</TableCell>
                      <TableCell><Badge variant="outline" className="text-xs">{categoryMap[t.category] || t.category}</Badge></TableCell>
                      <TableCell className="text-xs">{priorityMap[t.priority] || t.priority}</TableCell>
                      <TableCell><Badge variant={s.variant} className="text-xs">{s.label}</Badge></TableCell>
                      <TableCell className="hidden md:table-cell text-xs text-muted-foreground">{format(new Date(t.created_at), 'dd/MM/yyyy HH:mm')}</TableCell>
                      <TableCell>
                        <Button variant="ghost" size="sm"><MessageSquare className="h-4 w-4" /></Button>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>

      {/* Ticket Detail Dialog */}
      <Dialog open={!!viewTicket} onOpenChange={() => setViewTicket(null)}>
        <DialogContent className="max-w-lg max-h-[85vh] flex flex-col">
          <DialogHeader>
            <DialogTitle className="text-base">{viewTicket?.title}</DialogTitle>
            <div className="flex flex-wrap gap-2 mt-1">
              {viewTicket && <Badge variant={statusMap[viewTicket.status]?.variant || 'outline'} className="text-xs">{statusMap[viewTicket.status]?.label}</Badge>}
              {viewTicket && <Badge variant="outline" className="text-xs">{categoryMap[viewTicket.category] || viewTicket.category}</Badge>}
              {viewTicket && <span className="text-xs text-muted-foreground">• {viewTicket.company?.name}</span>}
            </div>
          </DialogHeader>

          {viewTicket && (
            <p className="text-sm text-muted-foreground border-b pb-3">{viewTicket.description}</p>
          )}

          {/* Status change */}
          {viewTicket && (
            <div className="flex items-center gap-2 border-b pb-3">
              <span className="text-xs text-muted-foreground">Alterar status:</span>
              <Select value={viewTicket.status} onValueChange={v => updateTicketStatus(viewTicket.id, v)}>
                <SelectTrigger className="w-[160px] h-8 text-xs"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {statusOptions.filter(s => s.value !== 'all').map(s => <SelectItem key={s.value} value={s.value}>{s.label}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
          )}

          <ScrollArea className="flex-1 min-h-0 max-h-[250px] pr-2">
            <div className="space-y-3 py-2">
              {messages.map(m => (
                <div key={m.id} className={`flex ${m.is_admin ? 'justify-end' : 'justify-start'}`}>
                  <div className={`max-w-[80%] rounded-lg p-3 text-sm ${m.is_admin ? 'bg-primary text-primary-foreground' : 'bg-muted'}`}>
                    {m.is_admin && <p className="text-xs font-semibold mb-1 opacity-70">Admin</p>}
                    <p className="whitespace-pre-wrap">{m.message}</p>
                    <p className={`text-xs mt-1 ${m.is_admin ? 'opacity-70' : 'text-muted-foreground'}`}>
                      {format(new Date(m.created_at), 'dd/MM HH:mm')}
                    </p>
                  </div>
                </div>
              ))}
              {messages.length === 0 && <p className="text-center text-sm text-muted-foreground py-4">Nenhuma mensagem</p>}
            </div>
          </ScrollArea>

          <div className="flex gap-2 pt-2 border-t">
            <Input
              placeholder="Responder..."
              value={newMessage}
              onChange={e => setNewMessage(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && !e.shiftKey && sendAdminMessage()}
              className="flex-1"
            />
            <Button size="icon" onClick={sendAdminMessage} disabled={sending || !newMessage.trim()}>
              <Send className="h-4 w-4" />
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default SuperAdminSupport;
