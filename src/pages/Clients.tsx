import { useState, useMemo, useEffect } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { useUserRole } from '@/hooks/useUserRole';
import { useRefreshData } from '@/hooks/useRefreshData';
import { supabase } from '@/integrations/supabase/client';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from '@/components/ui/table';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Calendar as DateCalendar } from '@/components/ui/calendar';
import { Search, MessageCircle, Users, ArrowLeft, Calendar, DollarSign, Star, Scissors, Cake, Pencil, UserPlus, Ban, ShieldCheck, ArrowUpDown, ArrowUp, ArrowDown, CalendarCheck, Crown, Info, CreditCard, Activity, CheckCircle2, AlertCircle, Clock, Upload } from 'lucide-react';
import { format, parseISO, isSameMonth, isSameDay, differenceInCalendarDays } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { displayWhatsApp, formatWhatsApp, openWhatsApp, normalizePhone } from '@/lib/whatsapp';
import { toast } from 'sonner';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { ClientImportModal } from '@/components/clients/ClientImportModal';
import { ClientProfile } from '@/components/ClientProfile';

interface ClientRow {
  id: string;
  name: string;
  whatsapp: string | null;
  email: string | null;
  birth_date: string | null;
  next_recommended_visit: string | null;
  created_at: string;
  is_blocked: boolean;
}

const Clients = () => {
  const { companyId } = useAuth();
  const { isAdmin, profileId } = useUserRole();
  const queryClient = useQueryClient();
  const { refresh } = useRefreshData();
  const [search, setSearch] = useState('');
  const [selectedClientId, setSelectedClientId] = useState<string | null>(null);
  const [showAllBirthdays, setShowAllBirthdays] = useState(false);
  const [sortColumn, setSortColumn] = useState<'name' | 'lastVisit' | 'totalVisits' | 'totalSpent'>('name');
  const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('asc');
  const [profFilter, setProfFilter] = useState<string>('all');
  const [addClientOpen, setAddClientOpen] = useState(false);
  const [addClientSaving, setAddClientSaving] = useState(false);
  const [addClientForm, setAddClientForm] = useState({ name: '', whatsapp: '', email: '', birth_date: '', notes: '' });
  const [duplicateClient, setDuplicateClient] = useState<any>(null);
  const [duplicateDialogOpen, setDuplicateDialogOpen] = useState(false);
  const [importModalOpen, setImportModalOpen] = useState(false);

  const handleAddClient = async () => {
    const name = addClientForm.name.trim();
    const whatsapp = addClientForm.whatsapp.trim();
    if (!name || !whatsapp) {
      toast.error('Nome e WhatsApp são obrigatórios');
      return;
    }
    setAddClientSaving(true);
    try {
      const normalizedWa = normalizePhone(whatsapp);
      const { data: existing } = await supabase
        .from('clients')
        .select('id, name, whatsapp')
        .eq('company_id', companyId!)
        .or(`whatsapp.eq.${normalizedWa},whatsapp.eq.55${normalizedWa}`)
        .limit(1);

      if (existing && existing.length > 0) {
        setDuplicateClient(existing[0]);
        setDuplicateDialogOpen(true);
        setAddClientSaving(false);
        return;
      }
      await insertClient();
    } catch (err) {
      toast.error('Erro ao cadastrar cliente');
    } finally {
      setAddClientSaving(false);
    }
  };

  const insertClient = async () => {
    const { error } = await supabase.from('clients').insert({
      company_id: companyId!,
      name: addClientForm.name.trim(),
      whatsapp: formatWhatsApp(addClientForm.whatsapp.trim()),
      email: addClientForm.email.trim() || null,
      birth_date: addClientForm.birth_date || null,
      notes: addClientForm.notes.trim() || null,
    });
    if (error) throw error;
    refresh('clients');
    toast.success('Cliente cadastrado com sucesso!');
    setAddClientOpen(false);
    setAddClientForm({ name: '', whatsapp: '', email: '', birth_date: '', notes: '' });
  };

  const { data: appointments = [] } = useQuery({
    queryKey: ['client-appointments-stats', companyId, isAdmin, profileId],
    queryFn: async () => {
      if (!companyId) return [];
      let query = supabase
        .from('appointments')
        .select('id, client_id, professional_id, start_time, total_price, status')
        .eq('company_id', companyId)
        .in('status', ['completed', 'confirmed', 'pending', 'cancelled']);
      if (!isAdmin && profileId) {
        query = query.eq('professional_id', profileId);
      }
      const { data, error } = await query;
      if (error) throw error;
      return data;
    },
    enabled: !!companyId,
  });

  const professionalClientIds = useMemo(() => {
    if (isAdmin) return null;
    return new Set(
      appointments
        .filter(a => ['completed', 'confirmed', 'pending'].includes(a.status))
        .map(a => a.client_id)
        .filter(Boolean)
    );
  }, [isAdmin, appointments]);

  const { data: subscriberStatuses = {} } = useQuery({
    queryKey: ['client-subscriber-statuses', companyId],
    queryFn: async () => {
      if (!companyId) return {};
      const { data, error } = await supabase
        .from('client_subscriptions')
        .select('client_id, status')
        .eq('company_id', companyId);
      if (error) throw error;
      const statusMap: Record<string, string> = {};
      data?.forEach(sub => statusMap[sub.client_id] = sub.status);
      return statusMap;
    },
    enabled: !!companyId,
  });

  const { data: clients = [], isLoading } = useQuery({
    queryKey: ['clients', companyId],
    queryFn: async () => {
      if (!companyId) return [];
      const { data, error } = await supabase
        .from('clients')
        .select('*')
        .eq('company_id', companyId)
        .order('name');
      if (error) throw error;
      return data as ClientRow[];
    },
    enabled: !!companyId,
  });

  const visibleClients = useMemo(() => {
    if (isAdmin || !professionalClientIds) return clients;
    return clients.filter(c => professionalClientIds.has(c.id));
  }, [clients, isAdmin, professionalClientIds]);

  const { data: profiles = [] } = useQuery({
    queryKey: ['profiles-for-clients', companyId],
    queryFn: async () => {
      if (!companyId) return [];
      const { data, error } = await supabase
        .from('profiles')
        .select('id, full_name')
        .eq('company_id', companyId);
      if (error) throw error;
      return data;
    },
    enabled: !!companyId,
  });

  const profileMap = Object.fromEntries(profiles.map(p => [p.id, p.full_name]));

  const clientStatsMap = useMemo(() => {
    const map: Record<string, { totalVisits: number; totalSpent: number; lastVisit: string | null; favProfName: string; favProfId: string | null; cancelledCount: number }> = {};
    const filteredApptsForStats = (isAdmin && profFilter !== 'all')
      ? appointments.filter(a => a.professional_id === profFilter)
      : appointments;
    visibleClients.forEach(client => {
      const clientAppts = filteredApptsForStats.filter(a => a.client_id === client.id);
      const completedAppts = clientAppts.filter(a => a.status === 'completed' || a.status === 'confirmed');
      const totalVisits = completedAppts.length;
      const totalSpent = completedAppts.reduce((sum, a) => sum + Number(a.total_price), 0);
      const lastVisit = completedAppts.length > 0 ? completedAppts.sort((a, b) => b.start_time.localeCompare(a.start_time))[0]?.start_time : null;
      const profCount: Record<string, number> = {};
      completedAppts.forEach(a => profCount[a.professional_id] = (profCount[a.professional_id] || 0) + 1);
      const favProfId = Object.entries(profCount).sort((a, b) => b[1] - a[1])[0]?.[0] || null;
      const favProfName = favProfId ? profileMap[favProfId] || 'Desconhecido' : '-';
      const cancelledCount = clientAppts.filter(a => a.status === 'cancelled').length;
      map[client.id] = { totalVisits, totalSpent, lastVisit, favProfName, favProfId, cancelledCount };
    });
    return map;
  }, [visibleClients, appointments, profileMap, isAdmin, profFilter]);

  const { data: serverMetrics } = useQuery({
    queryKey: ['client-dashboard-stats', companyId, isAdmin, profileId, profFilter],
    queryFn: async () => {
      if (!companyId) return null;
      const { data, error } = await supabase.rpc('get_company_dashboard_stats', {
        p_company_id: companyId,
        p_professional_id: !isAdmin ? profileId : (profFilter === 'all' ? null : profFilter)
      });
      if (error) throw error;
      return data[0];
    },
    enabled: !!companyId,
  });

  const metrics = useMemo(() => ({
    totalClients: Number(serverMetrics?.total_clients || 0),
    newClientsMonth: Number(serverMetrics?.new_clients_month || 0),
    totalAppointments: Number(serverMetrics?.total_appointments || 0),
    topClientMonth: serverMetrics?.top_client_name ? { name: serverMetrics.top_client_name, count: Number(serverMetrics.top_client_count) } : null,
    filteredClientIds: new Set(isAdmin && profFilter !== 'all' ? appointments.filter(a => a.professional_id === profFilter && ['completed', 'confirmed'].includes(a.status)).map(a => a.client_id) : [])
  }), [serverMetrics, isAdmin, profFilter, appointments]);

  const uniqueProfessionals = useMemo(() => {
    const profIds = new Set(appointments.map(a => a.professional_id).filter(Boolean));
    return Array.from(profIds).map(id => ({ id, name: profileMap[id] || 'Desconhecido' })).sort((a, b) => a.name.localeCompare(b.name));
  }, [appointments, profileMap]);

  const filtered = useMemo(() => {
    let result = visibleClients;
    if (search) {
      const s = search.toLowerCase();
      result = result.filter(c => c.name.toLowerCase().includes(s) || (c.whatsapp && c.whatsapp.includes(search)));
    }
    if (isAdmin && profFilter !== 'all') {
      result = result.filter(c => metrics.filteredClientIds.has(c.id));
    }
    result.sort((a, b) => {
      const sA = clientStatsMap[a.id] || { totalVisits: 0, totalSpent: 0, lastVisit: null, favProfName: '-' };
      const sB = clientStatsMap[b.id] || { totalVisits: 0, totalSpent: 0, lastVisit: null, favProfName: '-' };
      let cmp = 0;
      switch (sortColumn) {
        case 'name': cmp = a.name.localeCompare(b.name); break;
        case 'lastVisit': cmp = (sA.lastVisit || '').localeCompare(sB.lastVisit || ''); break;
        case 'totalVisits': cmp = sA.totalVisits - sB.totalVisits; break;
        case 'totalSpent': cmp = sA.totalSpent - sB.totalSpent; break;
      }
      return sortDirection === 'asc' ? cmp : -cmp;
    });
    return result;
  }, [visibleClients, search, sortColumn, sortDirection, profFilter, clientStatsMap, metrics.filteredClientIds, isAdmin]);

  const toggleSort = (col: typeof sortColumn) => {
    if (sortColumn === col) setSortDirection(d => d === 'asc' ? 'desc' : 'asc');
    else { setSortColumn(col); setSortDirection('asc'); }
  };

  const SortIcon = ({ col }: { col: typeof sortColumn }) => {
    if (sortColumn !== col) return <ArrowUpDown className="h-3 w-3 ml-1 opacity-40" />;
    return sortDirection === 'asc' ? <ArrowUp className="h-3 w-3 ml-1 text-primary" /> : <ArrowDown className="h-3 w-3 ml-1 text-primary" />;
  };

  const clientsWithBirthdays = useMemo(() => {
    const today = new Date(); today.setHours(0, 0, 0, 0);
    return visibleClients.filter(c => c.birth_date).map(c => {
      const birth = parseISO(c.birth_date!);
      let next = new Date(today.getFullYear(), birth.getMonth(), birth.getDate());
      if (next < today) next = new Date(today.getFullYear() + 1, birth.getMonth(), birth.getDate());
      return { ...c, daysRemaining: Math.round((next.getTime() - today.getTime()) / 86400000) };
    }).sort((a, b) => a.daysRemaining - b.daysRemaining);
  }, [visibleClients]);

  const displayBirthdays = showAllBirthdays ? clientsWithBirthdays : clientsWithBirthdays.slice(0, 5);

  const daysLabel = (d: number) => d === 0 ? 'Hoje 🎂' : d === 1 ? 'Amanhã' : `${d} dias`;

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h2 className="text-xl sm:text-2xl font-display font-bold">Clientes</h2>
          <p className="text-muted-foreground text-sm">{filtered.length} {filtered.length === 1 ? 'cliente encontrado' : 'clientes encontrados'}</p>
        </div>
        <div className="flex flex-col sm:flex-row gap-2 w-full sm:w-auto">
          {isAdmin && (
            <>
              <Button variant="outline" className="gap-2" onClick={() => setImportModalOpen(true)}>
                <Upload className="h-4 w-4" /> Importar clientes
              </Button>
              <Button className="gap-2" onClick={() => setAddClientOpen(true)}>
                <UserPlus className="h-4 w-4" /> Cadastrar cliente
              </Button>
            </>
          )}
        </div>
      </div>

      <ClientImportModal 
        open={importModalOpen} 
        onOpenChange={setImportModalOpen} 
        companyId={companyId || ''} 
        onImportSuccess={() => queryClient.invalidateQueries({ queryKey: ['clients'] })}
      />
      
      <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
        <div className="lg:col-span-3 space-y-4">
          <div className="flex gap-2">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Buscar por nome ou WhatsApp..."
                className="pl-9"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
            </div>
            {isAdmin && (
              <Select value={profFilter} onValueChange={setProfFilter}>
                <SelectTrigger className="w-[200px]">
                  <SelectValue placeholder="Filtrar por profissional" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todos profissionais</SelectItem>
                  {uniqueProfessionals.map(p => <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>)}
                </SelectContent>
              </Select>
            )}
          </div>

          <Card>
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="cursor-pointer" onClick={() => toggleSort('name')}>Nome <SortIcon col="name" /></TableHead>
                    <TableHead>WhatsApp</TableHead>
                    <TableHead className="cursor-pointer" onClick={() => toggleSort('totalVisits')}>Visitas <SortIcon col="totalVisits" /></TableHead>
                    <TableHead className="cursor-pointer" onClick={() => toggleSort('totalSpent')}>Gasto Total <SortIcon col="totalSpent" /></TableHead>
                    <TableHead className="cursor-pointer" onClick={() => toggleSort('lastVisit')}>Última Visita <SortIcon col="lastVisit" /></TableHead>
                    <TableHead>Status</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {isLoading ? (
                    <TableRow><TableCell colSpan={6} className="text-center py-10">Carregando...</TableCell></TableRow>
                  ) : filtered.length === 0 ? (
                    <TableRow><TableCell colSpan={6} className="text-center py-10 text-muted-foreground">Nenhum cliente encontrado</TableCell></TableRow>
                  ) : (
                    filtered.map(c => {
                      const stats = clientStatsMap[c.id] || { totalVisits: 0, totalSpent: 0, lastVisit: null, favProfName: '-' };
                      return (
                        <TableRow key={c.id} className="cursor-pointer hover:bg-muted/50" onClick={() => setSelectedClientId(c.id)}>
                          <TableCell className="font-medium">{c.name}</TableCell>
                          <TableCell>{c.whatsapp ? displayWhatsApp(c.whatsapp) : '-'}</TableCell>
                          <TableCell>{stats.totalVisits}</TableCell>
                          <TableCell>R$ {stats.totalSpent.toFixed(2)}</TableCell>
                          <TableCell>{stats.lastVisit ? format(parseISO(stats.lastVisit), 'dd/MM/yyyy') : '-'}</TableCell>
                          <TableCell>
                            {subscriberStatuses[c.id] === 'active' && <Badge className="bg-green-500">Assinante</Badge>}
                          </TableCell>
                        </TableRow>
                      );
                    })
                  )}
                </TableBody>
              </Table>
            </div>
          </Card>
        </div>

        <div className="space-y-6">
          <Card>
            <CardHeader><CardTitle className="text-sm font-medium">Aniversariantes próximos</CardTitle></CardHeader>
            <CardContent className="space-y-3">
              {displayBirthdays.length === 0 ? (
                <p className="text-xs text-muted-foreground">Nenhum aniversário nos próximos 7 dias.</p>
              ) : (
                <>
                  {displayBirthdays.map(c => (
                    <div key={c.id} className="flex items-center justify-between text-sm">
                      <span className="truncate">{c.name}</span>
                      <Badge variant="outline">{daysLabel(c.daysRemaining)}</Badge>
                    </div>
                  ))}
                  {clientsWithBirthdays.length > 5 && (
                    <Button variant="ghost" size="sm" className="w-full text-xs" onClick={() => setShowAllBirthdays(!showAllBirthdays)}>
                      {showAllBirthdays ? 'Ver menos' : 'Ver todos'}
                    </Button>
                  )}
                </>
              )}
            </CardContent>
          </Card>
        </div>
      </div>

      <Dialog open={addClientOpen} onOpenChange={setAddClientOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>Cadastrar novo cliente</DialogTitle></DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Nome</Label>
              <Input value={addClientForm.name} onChange={e => setAddClientForm({...addClientForm, name: e.target.value})} />
            </div>
            <div className="space-y-2">
              <Label>WhatsApp</Label>
              <Input value={addClientForm.whatsapp} onChange={e => setAddClientForm({...addClientForm, whatsapp: e.target.value})} placeholder="(00) 00000-0000" />
            </div>
            <div className="space-y-2">
              <Label>Email</Label>
              <Input value={addClientForm.email} onChange={e => setAddClientForm({...addClientForm, email: e.target.value})} />
            </div>
            <div className="space-y-2">
              <Label>Data de Nascimento</Label>
              <Input type="date" value={addClientForm.birth_date} onChange={e => setAddClientForm({...addClientForm, birth_date: e.target.value})} />
            </div>
            <div className="space-y-2">
              <Label>Observações</Label>
              <Textarea value={addClientForm.notes} onChange={e => setAddClientForm({...addClientForm, notes: e.target.value})} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setAddClientOpen(false)}>Cancelar</Button>
            <Button onClick={handleAddClient} disabled={addClientSaving}>Salvar</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={duplicateDialogOpen} onOpenChange={setDuplicateDialogOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>Cliente já cadastrado</DialogTitle></DialogHeader>
          <p>Já existe um cliente com este WhatsApp: <strong>{duplicateClient?.name}</strong></p>
          <DialogFooter>
            <Button onClick={() => setDuplicateDialogOpen(false)}>Fechar</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <ClientProfile 
        clientId={selectedClientId} 
        open={!!selectedClientId} 
        onOpenChange={(open) => !open && setSelectedClientId(null)} 
      />
    </div>
  );
};

export default Clients;
