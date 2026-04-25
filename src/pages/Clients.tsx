import { useState, useMemo } from 'react';
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
import { Search, MessageCircle, Users, ArrowLeft, Calendar, DollarSign, Star, Scissors, Cake, Pencil, UserPlus, Ban, ShieldCheck, ArrowUpDown, ArrowUp, ArrowDown, CalendarCheck, Crown, Info } from 'lucide-react';
import { format, parseISO, startOfMonth, isSameMonth } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { displayWhatsApp, formatWhatsApp, openWhatsApp } from '@/lib/whatsapp';
import { toast } from 'sonner';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';

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

interface AppointmentRow {
  id: string;
  start_time: string;
  total_price: number;
  status: string;
  professional_id: string;
  professional_name?: string;
  services: { name: string; price: number }[];
}

type SortColumn = 'name' | 'lastVisit' | 'totalVisits' | 'totalSpent';
type SortDirection = 'asc' | 'desc';

const Clients = () => {
  const { companyId } = useAuth();
  const { isAdmin, profileId } = useUserRole();
  const queryClient = useQueryClient();
  const { refresh } = useRefreshData();
  const [search, setSearch] = useState('');
  const [selectedClientId, setSelectedClientId] = useState<string | null>(null);
  const [showAllBirthdays, setShowAllBirthdays] = useState(false);
  const [sortColumn, setSortColumn] = useState<SortColumn>('name');
  const [sortDirection, setSortDirection] = useState<SortDirection>('asc');
  const [profFilter, setProfFilter] = useState<string>('all');

  // Manual client registration state
  const [addClientOpen, setAddClientOpen] = useState(false);
  const [addClientSaving, setAddClientSaving] = useState(false);
  const [addClientForm, setAddClientForm] = useState({ name: '', whatsapp: '', email: '', birth_date: '', notes: '' });
  const [duplicateClient, setDuplicateClient] = useState<any>(null);
  const [duplicateDialogOpen, setDuplicateDialogOpen] = useState(false);

  const handleAddClient = async () => {
    const name = addClientForm.name.trim();
    const whatsapp = addClientForm.whatsapp.trim();
    if (!name || !whatsapp) {
      toast.error('Nome e WhatsApp são obrigatórios');
      return;
    }
    if (name.length > 100) { toast.error('Nome deve ter no máximo 100 caracteres'); return; }
    if (whatsapp.length > 20) { toast.error('WhatsApp inválido'); return; }

    setAddClientSaving(true);
    try {
      const normalizedWa = whatsapp.replace(/\D/g, '');
      const { data: existing } = await supabase
        .from('clients')
        .select('id, name, whatsapp')
        .eq('company_id', companyId!)
        .or(`whatsapp.eq.${normalizedWa},whatsapp.eq.55${normalizedWa},whatsapp.ilike.%${normalizedWa}%`)
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
    });
    if (error) throw error;
    refresh('clients');
    toast.success('Cliente cadastrado com sucesso!');
    setAddClientOpen(false);
    setAddClientForm({ name: '', whatsapp: '', email: '', birth_date: '', notes: '' });
  };

  // Fetch all appointments for stats (professional-scoped if not admin)
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

  // Derive client IDs from appointments for professional view
  const professionalClientIds = useMemo(() => {
    if (isAdmin) return null;
    return new Set(appointments.map(a => a.client_id).filter(Boolean));
  }, [isAdmin, appointments]);

  // Fetch all clients
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

  // Filter clients for professionals (only those they served)
  const visibleClients = useMemo(() => {
    if (isAdmin || !professionalClientIds) return clients;
    return clients.filter(c => professionalClientIds.has(c.id));
  }, [clients, isAdmin, professionalClientIds]);

  // Fetch profiles for professional names
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

  // Calculate stats per client
  const clientStatsMap = useMemo(() => {
    const map: Record<string, { totalVisits: number; totalSpent: number; lastVisit: string | null; favProfName: string; favProfId: string | null; cancelledCount: number }> = {};
    
    visibleClients.forEach(client => {
      const clientAppts = appointments.filter(a => a.client_id === client.id);
      const completedAppts = clientAppts.filter(a => a.status === 'completed');
      const totalVisits = completedAppts.length;
      const totalSpent = completedAppts.reduce((sum, a) => sum + Number(a.total_price), 0);
      const lastVisit = completedAppts.length > 0
        ? completedAppts.sort((a, b) => b.start_time.localeCompare(a.start_time))[0]?.start_time
        : null;

      const profCount: Record<string, number> = {};
      completedAppts.forEach(a => {
        profCount[a.professional_id] = (profCount[a.professional_id] || 0) + 1;
      });
      const favProfId = Object.entries(profCount).sort((a, b) => b[1] - a[1])[0]?.[0] || null;
      const favProfName = favProfId ? profileMap[favProfId] || 'Desconhecido' : '-';
      
      const cancelledCount = clientAppts.filter(a => a.status === 'cancelled').length;

      map[client.id] = { totalVisits, totalSpent, lastVisit, favProfName, favProfId, cancelledCount };
    });
    
    return map;
  }, [visibleClients, appointments, profileMap]);

  // Analytics metrics - respects professional filter
  const metrics = useMemo(() => {
    const now = new Date();
    
    // 1. All client first visits (to the COMPANY)
    // Used to determine if a client is "new" regardless of which professional they are seeing now
    const clientFirstVisitMap: Record<string, string> = {};
    appointments
      .filter(a => a.status === 'completed' || a.status === 'confirmed')
      .forEach(a => {
        if (a.client_id && (!clientFirstVisitMap[a.client_id] || a.start_time < clientFirstVisitMap[a.client_id])) {
          clientFirstVisitMap[a.client_id] = a.start_time;
        }
      });

    // 2. Filter appointments by selected professional
    const filteredAppts = (isAdmin && profFilter !== 'all')
      ? appointments.filter(a => a.professional_id === profFilter)
      : appointments;

    // 3. Relevant appointments for "Attended" count (completed or confirmed)
    const activeAppts = filteredAppts.filter(a => a.status === 'completed' || a.status === 'confirmed');
    
    // 4. Client IDs who have at least one active appointment in the current filter
    const filteredClientIds = new Set(activeAppts.map(a => a.client_id).filter(Boolean));
    
    // 5. Total de clientes (Unique in filter)
    const totalClients = filteredClientIds.size;
    
    // 6. Clientes no mês - clients in CURRENT FILTER whose FIRST visit to the COMPANY is this month
    const newClientsMonth = Array.from(filteredClientIds).filter(cid => {
      const firstVisit = clientFirstVisitMap[cid!];
      return firstVisit && isSameMonth(parseISO(firstVisit), now);
    }).length;
    
    // 7. Total de agendamentos
    const totalAppointments = activeAppts.length;
    
    // 8. Top cliente do mês (in current filter)
    const monthAppts = activeAppts.filter(a => isSameMonth(parseISO(a.start_time), now));
    const clientMonthCount: Record<string, number> = {};
    monthAppts.forEach(a => {
      if (a.client_id) clientMonthCount[a.client_id] = (clientMonthCount[a.client_id] || 0) + 1;
    });
    const topEntry = Object.entries(clientMonthCount).sort((a, b) => b[1] - a[1])[0];
    const topClientMonth = topEntry
      ? { name: clients.find(c => c.id === topEntry[0])?.name || 'Desconhecido', count: topEntry[1] }
      : null;

    return { totalClients, newClientsMonth, totalAppointments, topClientMonth, filteredClientIds };
  }, [clients, appointments, isAdmin, profFilter]);

  // Unique professionals for filter
  const uniqueProfessionals = useMemo(() => {
    const profIds = new Set<string>();
    appointments.forEach(a => { if (a.professional_id) profIds.add(a.professional_id); });
    return Array.from(profIds).map(id => ({ id, name: profileMap[id] || 'Desconhecido' })).sort((a, b) => a.name.localeCompare(b.name));
  }, [appointments, profileMap]);

  // Filter and sort for the Table
  const filtered = useMemo(() => {
    // Start with visible clients (already filtered if not admin)
    let result = visibleClients;

    // Filter by Search
    if (search) {
      const searchLower = search.toLowerCase();
      result = result.filter(c =>
        c.name.toLowerCase().includes(searchLower) ||
        (c.whatsapp && c.whatsapp.includes(search))
      );
    }

    // Filter by professional (Synchronized with metrics.totalClients)
    if (isAdmin && profFilter !== 'all') {
      result = result.filter(c => metrics.filteredClientIds.has(c.id));
    }

    // Sort
    result.sort((a, b) => {
      const statsA = clientStatsMap[a.id] || { totalVisits: 0, totalSpent: 0, lastVisit: null, favProfName: '-' };
      const statsB = clientStatsMap[b.id] || { totalVisits: 0, totalSpent: 0, lastVisit: null, favProfName: '-' };
      
      let cmp = 0;
      switch (sortColumn) {
        case 'name':
          cmp = a.name.localeCompare(b.name);
          break;
        case 'lastVisit':
          cmp = (statsA.lastVisit || '').localeCompare(statsB.lastVisit || '');
          break;
        case 'totalVisits':
          cmp = statsA.totalVisits - statsB.totalVisits;
          break;
        case 'totalSpent':
          cmp = statsA.totalSpent - statsB.totalSpent;
          break;
      }
      return sortDirection === 'asc' ? cmp : -cmp;
    });

    return result;
  }, [visibleClients, search, sortColumn, sortDirection, profFilter, clientStatsMap, metrics.filteredClientIds, isAdmin]);

  const toggleSort = (col: SortColumn) => {
    if (sortColumn === col) {
      setSortDirection(d => d === 'asc' ? 'desc' : 'asc');
    } else {
      setSortColumn(col);
      setSortDirection(col === 'name' ? 'asc' : 'desc');
    }
  };

  const SortIcon = ({ col }: { col: SortColumn }) => {
    if (sortColumn !== col) return <ArrowUpDown className="h-3 w-3 ml-1 opacity-40" />;
    return sortDirection === 'asc'
      ? <ArrowUp className="h-3 w-3 ml-1 text-primary" />
      : <ArrowDown className="h-3 w-3 ml-1 text-primary" />;
  };

  // Birthday calculations
  const clientsWithBirthdays = visibleClients
    .filter(c => c.birth_date)
    .map(c => {
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      const birth = parseISO(c.birth_date!);
      let nextBirthday = new Date(today.getFullYear(), birth.getMonth(), birth.getDate());
      if (nextBirthday < today) {
        nextBirthday = new Date(today.getFullYear() + 1, birth.getMonth(), birth.getDate());
      }
      const diffTime = nextBirthday.getTime() - today.getTime();
      const daysRemaining = Math.round(diffTime / (1000 * 60 * 60 * 24));
      return { ...c, daysRemaining, nextBirthday };
    })
    .sort((a, b) => a.daysRemaining - b.daysRemaining);

  const displayBirthdays = showAllBirthdays ? clientsWithBirthdays : clientsWithBirthdays.slice(0, 5);

  const daysLabel = (days: number) => {
    if (days === 0) return 'Hoje 🎂';
    if (days === 1) return 'Amanhã';
    return `${days} dias`;
  };

  const selectedClient = visibleClients.find(c => c.id === selectedClientId);

  if (selectedClient) {
    return (
      <ClientProfile
        client={selectedClient}
        companyId={companyId!}
        profileMap={profileMap}
        onBack={() => setSelectedClientId(null)}
      />
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h2 className="text-xl sm:text-2xl font-display font-bold">Clientes</h2>
          <p className="text-muted-foreground text-sm">{filtered.length} {filtered.length === 1 ? 'cliente encontrado' : 'clientes encontrados'}</p>
        </div>
        {isAdmin && (
          <Button className="gap-2 w-full sm:w-auto" onClick={() => setAddClientOpen(true)}>
            <UserPlus className="h-4 w-4" /> Cadastrar cliente
          </Button>
        )}
      </div>

      {/* Add Client Dialog */}
      <Dialog open={addClientOpen} onOpenChange={(v) => { setAddClientOpen(v); if (!v) setAddClientForm({ name: '', whatsapp: '', email: '', birth_date: '', notes: '' }); }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Cadastrar novo cliente</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Nome *</Label>
              <Input value={addClientForm.name} onChange={e => setAddClientForm(f => ({ ...f, name: e.target.value }))} maxLength={100} placeholder="Nome do cliente" />
            </div>
            <div className="space-y-2">
              <Label>WhatsApp *</Label>
              <Input value={addClientForm.whatsapp} onChange={e => {
                const digits = e.target.value.replace(/\D/g, '').slice(0, 11);
                let masked = digits;
                if (digits.length > 7) masked = `(${digits.slice(0,2)}) ${digits.slice(2,7)}-${digits.slice(7)}`;
                else if (digits.length > 2) masked = `(${digits.slice(0,2)}) ${digits.slice(2)}`;
                setAddClientForm(f => ({ ...f, whatsapp: masked }));
              }} maxLength={15} placeholder="(31) 99999-9999" />
            </div>
            <div className="space-y-2">
              <Label>Email (opcional)</Label>
              <Input type="email" value={addClientForm.email} onChange={e => setAddClientForm(f => ({ ...f, email: e.target.value }))} maxLength={255} placeholder="email@exemplo.com" />
            </div>
            <div className="space-y-2">
              <Label>Data de nascimento (opcional)</Label>
              <Input type="date" value={addClientForm.birth_date} onChange={e => setAddClientForm(f => ({ ...f, birth_date: e.target.value }))} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setAddClientOpen(false)}>Cancelar</Button>
            <Button onClick={handleAddClient} disabled={addClientSaving}>
              {addClientSaving ? 'Salvando...' : 'Cadastrar'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Duplicate Client Dialog */}
      <Dialog open={duplicateDialogOpen} onOpenChange={setDuplicateDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Cliente já cadastrado</DialogTitle>
          </DialogHeader>
          <p className="text-sm text-muted-foreground">
            Já existe um cliente cadastrado com este número de WhatsApp:
          </p>
          {duplicateClient && (
            <div className="p-3 rounded-lg border bg-muted/30">
              <p className="font-medium">{duplicateClient.name}</p>
              <p className="text-sm text-muted-foreground">{duplicateClient.whatsapp}</p>
            </div>
          )}
          <p className="text-sm text-muted-foreground">Deseja utilizar esse cliente?</p>
          <DialogFooter>
            <Button variant="outline" onClick={() => { setDuplicateDialogOpen(false); setDuplicateClient(null); }}>Cancelar</Button>
            <Button onClick={() => {
              setDuplicateDialogOpen(false);
              setAddClientOpen(false);
              setAddClientForm({ name: '', whatsapp: '', email: '', birth_date: '', notes: '' });
              if (duplicateClient) setSelectedClientId(duplicateClient.id);
              setDuplicateClient(null);
            }}>
              Usar cliente existente
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <div className="relative max-w-sm">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input
          placeholder="Buscar por nome ou WhatsApp..."
          value={search}
          onChange={e => setSearch(e.target.value)}
          className="pl-10"
        />
      </div>

      {/* Analytics Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <Card>
          <CardContent className="p-4 flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center shrink-0">
              <Users className="h-5 w-5 text-primary" />
            </div>
            <div className="min-w-0">
              <p className="text-xs text-muted-foreground">Total de Clientes</p>
              <p className="text-2xl font-bold">{metrics.totalClients}</p>
              <p className="text-xs text-muted-foreground">acumulado</p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4 flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-green-500/10 flex items-center justify-center shrink-0">
              <UserPlus className="h-5 w-5 text-green-500" />
            </div>
            <div className="min-w-0">
              <p className="text-xs text-muted-foreground">Clientes no mês</p>
              <p className="text-2xl font-bold">{metrics.newClientsMonth}</p>
              <p className="text-xs text-muted-foreground">novos este mês</p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4 flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-blue-500/10 flex items-center justify-center shrink-0">
              <CalendarCheck className="h-5 w-5 text-blue-500" />
            </div>
            <div className="min-w-0">
              <p className="text-xs text-muted-foreground">Total de Agendamentos</p>
              <p className="text-2xl font-bold">{metrics.totalAppointments}</p>
              <p className="text-xs text-muted-foreground">realizados</p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4 flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-amber-500/10 flex items-center justify-center shrink-0">
              <Crown className="h-5 w-5 text-amber-500" />
            </div>
            <div className="min-w-0">
              <p className="text-xs text-muted-foreground">Top Cliente do mês</p>
              {metrics.topClientMonth ? (
                <>
                  <p className="text-sm font-bold truncate">{metrics.topClientMonth.name}</p>
                  <p className="text-xs text-muted-foreground">{metrics.topClientMonth.count} atendimentos</p>
                </>
              ) : (
                <p className="text-sm text-muted-foreground">Sem dados</p>
              )}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Upcoming Birthdays */}
      {clientsWithBirthdays.length > 0 && (
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base flex items-center gap-2">
              <Cake className="h-4 w-4 text-pink-500" /> Próximos aniversariantes
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {displayBirthdays.map(c => (
                <div key={c.id} className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div>
                      <p className="font-medium text-sm">{c.name}</p>
                      <p className="text-xs text-muted-foreground">
                        {format(parseISO(c.birth_date!), "dd/MM", { locale: ptBR })}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <Badge variant={c.daysRemaining === 0 ? 'default' : 'secondary'} className="text-xs">
                      {daysLabel(c.daysRemaining)}
                    </Badge>
                    {c.whatsapp && (
                      <Button
                        size="icon"
                        variant="ghost"
                        className="h-7 w-7 text-green-600"
                        onClick={() => openWhatsApp(c.whatsapp!, { source: 'clients' })}
                      >
                        <MessageCircle className="h-3.5 w-3.5" />
                      </Button>
                    )}
                  </div>
                </div>
              ))}
            </div>
            {clientsWithBirthdays.length > 5 && (
              <Button
                variant="ghost"
                size="sm"
                className="mt-3 w-full text-xs"
                onClick={() => setShowAllBirthdays(!showAllBirthdays)}
              >
                {showAllBirthdays ? 'Ver menos' : `Ver todos (${clientsWithBirthdays.length})`}
              </Button>
            )}
          </CardContent>
        </Card>
      )}

      {isLoading ? (
        <p className="text-muted-foreground">Carregando...</p>
      ) : filtered.length === 0 ? (
        <Card>
          <CardContent className="text-center text-muted-foreground py-8">
            Nenhum cliente encontrado
          </CardContent>
        </Card>
      ) : (
        <>
          {/* Desktop table */}
          <div className="hidden md:block">
            <Card>
              <CardContent className="p-0">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>
                        <button
                          className="flex items-center gap-0.5 hover:text-foreground transition-colors font-medium"
                          onClick={() => toggleSort('name')}
                        >
                          Nome <SortIcon col="name" />
                        </button>
                      </TableHead>
                      <TableHead>WhatsApp</TableHead>
                      <TableHead>
                        <button
                          className="flex items-center gap-0.5 hover:text-foreground transition-colors font-medium"
                          onClick={() => toggleSort('lastVisit')}
                        >
                          Última visita <SortIcon col="lastVisit" />
                        </button>
                      </TableHead>
                      <TableHead className="text-center">
                        <button
                          className="flex items-center gap-0.5 hover:text-foreground transition-colors font-medium mx-auto"
                          onClick={() => toggleSort('totalVisits')}
                        >
                          Agendamentos <SortIcon col="totalVisits" />
                        </button>
                      </TableHead>
                      <TableHead>
                        <Select value={profFilter} onValueChange={setProfFilter}>
                          <SelectTrigger className="h-auto border-0 p-0 shadow-none font-medium text-muted-foreground hover:text-foreground text-xs gap-1 w-auto">
                            <SelectValue placeholder="Profissional favorito" />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="all">Todos profissionais</SelectItem>
                            {uniqueProfessionals.map(p => (
                              <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </TableHead>
                      <TableHead className="text-right">
                        <button
                          className="flex items-center gap-0.5 hover:text-foreground transition-colors font-medium ml-auto"
                          onClick={() => toggleSort('totalSpent')}
                        >
                          Total gasto <SortIcon col="totalSpent" />
                        </button>
                      </TableHead>
                      <TableHead />
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filtered.map(client => {
                      const stats = clientStatsMap[client.id] || { totalVisits: 0, totalSpent: 0, lastVisit: null, favProfName: '-' };
                      return (
                        <TableRow
                          key={client.id}
                          className="cursor-pointer"
                          onClick={() => setSelectedClientId(client.id)}
                        >
                          <TableCell className="font-medium">
                            <div className="flex items-center gap-2">
                              {client.name}
                              {client.is_blocked && (
                                <Badge variant="destructive" className="text-[10px] px-1.5 py-0">
                                  <Ban className="h-3 w-3 mr-0.5" /> Bloqueado
                                </Badge>
                              )}
                            </div>
                          </TableCell>
                          <TableCell>
                            {client.whatsapp ? displayWhatsApp(client.whatsapp) : '-'}
                          </TableCell>
                          <TableCell>
                            {stats.lastVisit
                              ? format(parseISO(stats.lastVisit), "dd/MM/yyyy", { locale: ptBR })
                              : '-'}
                          </TableCell>
                          <TableCell className="text-center">
                            <Badge variant="secondary">{stats.totalVisits}</Badge>
                          </TableCell>
                          <TableCell>{stats.favProfName}</TableCell>
                          <TableCell className="text-right">
                            R$ {stats.totalSpent.toFixed(2)}
                          </TableCell>
                          <TableCell>
                            {client.whatsapp && (
                              <Button
                                size="icon"
                                variant="ghost"
                                className="text-green-600"
                                onClick={e => {
                                  e.stopPropagation();
                                  openWhatsApp(client.whatsapp!, { source: 'clients' });
                                }}
                              >
                                <MessageCircle className="h-4 w-4" />
                              </Button>
                            )}
                          </TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          </div>

          {/* Mobile cards */}
          <div className="md:hidden space-y-3">
            {filtered.map(client => {
              const stats = clientStatsMap[client.id] || { totalVisits: 0, totalSpent: 0, lastVisit: null, favProfName: '-' };
              return (
                <Card
                  key={client.id}
                  className="cursor-pointer active:bg-muted/50 transition-colors"
                  onClick={() => setSelectedClientId(client.id)}
                >
                  <CardContent className="p-4 space-y-2">
                    <div className="flex items-center justify-between">
                      <p className="font-medium text-sm flex items-center gap-2">
                        {client.name}
                        {client.is_blocked && (
                          <Badge variant="destructive" className="text-[10px] px-1.5 py-0">
                            <Ban className="h-3 w-3 mr-0.5" /> Bloqueado
                          </Badge>
                        )}
                      </p>
                      <div className="flex items-center gap-1">
                        <Badge variant="secondary" className="text-xs">{stats.totalVisits} visitas</Badge>
                        {client.whatsapp && (
                          <Button
                            size="icon"
                            variant="ghost"
                            className="h-7 w-7 text-green-600"
                            onClick={e => {
                              e.stopPropagation();
                              openWhatsApp(client.whatsapp!, { source: 'clients' });
                            }}
                          >
                            <MessageCircle className="h-3.5 w-3.5" />
                          </Button>
                        )}
                      </div>
                    </div>
                    <div className="grid grid-cols-2 gap-x-4 gap-y-1 text-xs text-muted-foreground">
                      <span>WhatsApp: {client.whatsapp ? displayWhatsApp(client.whatsapp) : '-'}</span>
                      <span>Última visita: {stats.lastVisit ? format(parseISO(stats.lastVisit), "dd/MM/yy", { locale: ptBR }) : '-'}</span>
                      <span>Favorito: {stats.favProfName}</span>
                      <span className="font-medium text-foreground">R$ {stats.totalSpent.toFixed(2)}</span>
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        </>
      )}
    </div>
  );
};

// --- Client Profile Sub-component ---

interface ClientProfileProps {
  client: ClientRow;
  companyId: string;
  profileMap: Record<string, string>;
  onBack: () => void;
}

const ClientProfile = ({ client, companyId, profileMap, onBack }: ClientProfileProps) => {
  const { refresh } = useRefreshData();
  const [editOpen, setEditOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [editForm, setEditForm] = useState({
    name: client.name,
    whatsapp: client.whatsapp || '',
    email: client.email || '',
    birth_date: client.birth_date || '',
    notes: '',
  });

  // Fetch appointments for this client
  const { data: appointments = [] } = useQuery({
    queryKey: ['client-detail-appointments', client.id, companyId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('appointments')
        .select('id, start_time, total_price, status, professional_id')
        .eq('company_id', companyId)
        .eq('client_id', client.id)
        .order('start_time', { ascending: false });
      if (error) throw error;
      return data;
    },
  });

  // Fetch appointment services
  const appointmentIds = appointments.map(a => a.id);
  const { data: apptServices = [] } = useQuery({
    queryKey: ['client-appt-services', appointmentIds],
    queryFn: async () => {
      if (appointmentIds.length === 0) return [];
      const { data, error } = await supabase
        .from('appointment_services')
        .select('appointment_id, service_id, price, duration_minutes')
        .in('appointment_id', appointmentIds);
      if (error) throw error;
      return data;
    },
    enabled: appointmentIds.length > 0,
  });

  // Fetch services for names
  const { data: services = [] } = useQuery({
    queryKey: ['services-for-client', companyId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('services')
        .select('id, name')
        .eq('company_id', companyId);
      if (error) throw error;
      return data;
    },
  });

  // Fetch cashback credits
  const { data: cashbackCredits = [] } = useQuery({
    queryKey: ['client-cashback', client.id, companyId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('client_cashback')
        .select('id, amount, status, expires_at, created_at, promotion:promotions(title)')
        .eq('client_id', client.id)
        .eq('company_id', companyId)
        .order('created_at', { ascending: false });
      if (error) throw error;
      return data || [];
    },
  });

  const activeCashback = cashbackCredits.filter((c: any) => c.status === 'active' && new Date(c.expires_at) > new Date());
  const cashbackTotal = activeCashback.reduce((sum: number, c: any) => sum + Number(c.amount), 0);

  const serviceMap = Object.fromEntries(services.map(s => [s.id, s.name]));

  const completedAppts = appointments.filter(a => a.status === 'completed');
  const totalVisits = completedAppts.length;
  const totalSpent = completedAppts.reduce((sum, a) => sum + Number(a.total_price), 0);
  const firstVisit = completedAppts.length > 0
    ? completedAppts[completedAppts.length - 1]?.start_time
    : null;

  // Favorite professional
  const profCount: Record<string, number> = {};
  completedAppts.forEach(a => {
    profCount[a.professional_id] = (profCount[a.professional_id] || 0) + 1;
  });
  const favProfId = Object.entries(profCount).sort((a, b) => b[1] - a[1])[0]?.[0];
  const favProfName = favProfId ? profileMap[favProfId] || 'Desconhecido' : '-';

  // Service breakdown
  const serviceCount: Record<string, number> = {};
  apptServices.forEach(as => {
    const name = serviceMap[as.service_id] || 'Desconhecido';
    serviceCount[name] = (serviceCount[name] || 0) + 1;
  });

  const statusLabel: Record<string, string> = {
    completed: 'Concluído',
    confirmed: 'Confirmado',
    pending: 'Pendente',
    cancelled: 'Cancelado',
    no_show: 'Não compareceu',
  };

  const statusColor: Record<string, string> = {
    completed: 'bg-green-100 text-green-800',
    confirmed: 'bg-primary/10 text-primary',
    pending: 'bg-yellow-100 text-yellow-800',
    cancelled: 'bg-red-100 text-red-800',
    no_show: 'bg-muted text-muted-foreground',
  };

  const handleSaveClient = async () => {
    if (!editForm.name.trim()) {
      toast.error('Nome é obrigatório');
      return;
    }
    if (editForm.name.length > 100) {
      toast.error('Nome deve ter no máximo 100 caracteres');
      return;
    }
    if (editForm.whatsapp && editForm.whatsapp.length > 20) {
      toast.error('WhatsApp inválido');
      return;
    }

    setSaving(true);
    try {
      const updateData = {
        name: editForm.name.trim(),
        whatsapp: editForm.whatsapp.trim() ? formatWhatsApp(editForm.whatsapp.trim()) : null,
        email: editForm.email.trim() || null,
        birth_date: editForm.birth_date || null,
      };

      const { error } = await supabase
        .from('clients')
        .update(updateData as any)
        .eq('id', client.id)
        .eq('company_id', companyId);

      if (error) throw error;

      client.name = editForm.name.trim();
      client.whatsapp = editForm.whatsapp.trim() || null;
      client.email = editForm.email.trim() || null;
      client.birth_date = editForm.birth_date || null;

      refresh('clients');
      toast.success('Cliente atualizado com sucesso');
      setEditOpen(false);
    } catch (err) {
      toast.error('Erro ao atualizar cliente');
    } finally {
      setSaving(false);
    }
  };

  const handleToggleBlock = async () => {
    const newBlocked = !client.is_blocked;
    try {
      const { error } = await supabase
        .from('clients')
        .update({ is_blocked: newBlocked } as any)
        .eq('id', client.id)
        .eq('company_id', companyId);
      if (error) throw error;
      client.is_blocked = newBlocked;
      refresh('clients');
      toast.success(newBlocked ? 'Cliente bloqueado' : 'Cliente desbloqueado');
    } catch {
      toast.error('Erro ao atualizar status do cliente');
    }
  };

  return (
    <div className="space-y-6">
      <Button variant="ghost" onClick={onBack} className="gap-2">
        <ArrowLeft className="h-4 w-4" /> Voltar
      </Button>

      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <h2 className="text-xl sm:text-2xl font-display font-bold truncate">{client.name}</h2>
            {client.is_blocked && (
              <Badge variant="destructive" className="text-xs gap-1">
                <Ban className="h-3 w-3" /> Bloqueado
              </Badge>
            )}
          </div>
          <p className="text-muted-foreground text-sm break-words">
            {client.whatsapp ? displayWhatsApp(client.whatsapp) : 'Sem WhatsApp'}
            {client.email && ` • ${client.email}`}
            {client.birth_date && ` • 🎂 ${format(parseISO(client.birth_date), 'dd/MM/yyyy', { locale: ptBR })}`}
          </p>
        </div>
        <div className="flex gap-2 shrink-0 flex-wrap">
          <Button
            variant={client.is_blocked ? 'outline' : 'destructive'}
            size="sm"
            className="gap-2"
            onClick={handleToggleBlock}
          >
            {client.is_blocked ? <ShieldCheck className="h-4 w-4" /> : <Ban className="h-4 w-4" />}
            <span className="hidden sm:inline">{client.is_blocked ? 'Desbloquear cliente' : 'Bloquear cliente'}</span>
            <span className="sm:hidden">{client.is_blocked ? 'Desbloquear' : 'Bloquear'}</span>
          </Button>
          <Button
            variant="outline"
            size="sm"
            className="gap-2"
            onClick={() => {
              setEditForm({
                name: client.name,
                whatsapp: client.whatsapp || '',
                email: client.email || '',
                birth_date: client.birth_date || '',
                notes: '',
              });
              setEditOpen(true);
            }}
          >
            <Pencil className="h-4 w-4" /> <span className="hidden sm:inline">Editar cliente</span><span className="sm:hidden">Editar</span>
          </Button>
          {client.whatsapp && (
            <Button
              size="sm"
              className="bg-green-600 hover:bg-green-700 gap-2"
              onClick={() => openWhatsApp(client.whatsapp!, { source: 'clients' })}
            >
              <MessageCircle className="h-4 w-4" /> <span className="hidden sm:inline">WhatsApp</span>
            </Button>
          )}
        </div>
      </div>

      {/* Edit Client Modal */}
      <Dialog open={editOpen} onOpenChange={setEditOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Editar cliente</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Nome *</Label>
              <Input
                value={editForm.name}
                onChange={e => setEditForm(f => ({ ...f, name: e.target.value }))}
                maxLength={100}
              />
            </div>
            <div className="space-y-2">
              <Label>WhatsApp</Label>
              <Input
                value={editForm.whatsapp}
                onChange={e => {
                  const digits = e.target.value.replace(/\D/g, '').slice(0, 11);
                  let masked = digits;
                  if (digits.length > 7) masked = `(${digits.slice(0,2)}) ${digits.slice(2,7)}-${digits.slice(7)}`;
                  else if (digits.length > 2) masked = `(${digits.slice(0,2)}) ${digits.slice(2)}`;
                  setEditForm(f => ({ ...f, whatsapp: masked }));
                }}
                maxLength={15}
                placeholder="5511999999999"
              />
            </div>
            <div className="space-y-2">
              <Label>Email</Label>
              <Input
                type="email"
                value={editForm.email}
                onChange={e => setEditForm(f => ({ ...f, email: e.target.value }))}
                maxLength={255}
              />
            </div>
            <div className="space-y-2">
              <Label>Data de nascimento (opcional)</Label>
              <Input
                type="date"
                value={editForm.birth_date}
                onChange={e => setEditForm(f => ({ ...f, birth_date: e.target.value }))}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditOpen(false)}>Cancelar</Button>
            <Button onClick={handleSaveClient} disabled={saving}>
              {saving ? 'Salvando...' : 'Salvar'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Stats cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-2 text-muted-foreground text-sm mb-1">
              <Calendar className="h-4 w-4" /> Total de visitas
            </div>
            <p className="text-2xl font-bold">{totalVisits}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-2 text-muted-foreground text-sm mb-1">
              <DollarSign className="h-4 w-4" /> Total gasto
            </div>
            <p className="text-2xl font-bold">R$ {totalSpent.toFixed(2)}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-2 text-muted-foreground text-sm mb-1">
              <Calendar className="h-4 w-4" /> Primeira visita
            </div>
            <p className="text-2xl font-bold">
              {firstVisit ? format(parseISO(firstVisit), 'dd/MM/yy', { locale: ptBR }) : '-'}
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-2 text-muted-foreground text-sm mb-1">
              <Star className="h-4 w-4" /> Profissional favorito
            </div>
            <p className="text-lg font-bold truncate">{favProfName}</p>
          </CardContent>
        </Card>
      </div>

      {/* Cashback credits */}
      {cashbackCredits.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              💰 Cashback
              {cashbackTotal > 0 && (
                <Badge className="bg-green-100 text-green-800 ml-2">
                  Disponível: R$ {cashbackTotal.toFixed(2)}
                </Badge>
              )}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {cashbackCredits.map((credit: any) => {
                const isActive = credit.status === 'active' && new Date(credit.expires_at) > new Date();
                const daysLeft = isActive ? Math.ceil((new Date(credit.expires_at).getTime() - Date.now()) / (1000 * 60 * 60 * 24)) : 0;
                const promoTitle = (credit.promotion as any)?.title || 'Promoção';
                return (
                  <div key={credit.id} className={`flex items-center justify-between p-3 rounded-lg border ${isActive ? 'bg-green-50 border-green-200' : 'bg-muted/30 border-border'}`}>
                    <div className="min-w-0">
                      <p className={`font-semibold text-sm ${isActive ? 'text-green-800' : 'text-muted-foreground line-through'}`}>
                        R$ {Number(credit.amount).toFixed(2)}
                      </p>
                      <p className="text-xs text-muted-foreground truncate">{promoTitle}</p>
                    </div>
                    <div className="text-right shrink-0">
                      {isActive ? (
                        <Badge variant="outline" className="text-xs text-green-700 border-green-300">
                          {daysLeft} dias restantes
                        </Badge>
                      ) : (
                        <Badge variant="secondary" className="text-xs">
                          {credit.status === 'used' ? 'Usado' : 'Expirado'}
                        </Badge>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Service breakdown */}
      {Object.keys(serviceCount).length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <Scissors className="h-4 w-4" /> Serviços realizados
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex flex-wrap gap-2">
              {Object.entries(serviceCount)
                .sort((a, b) => b[1] - a[1])
                .map(([name, count]) => (
                  <Badge key={name} variant="secondary" className="text-sm">
                    {name} × {count}
                  </Badge>
                ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Appointment history */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Histórico de agendamentos</CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Data</TableHead>
                <TableHead>Serviço</TableHead>
                <TableHead>Profissional</TableHead>
                <TableHead className="text-right">Preço</TableHead>
                <TableHead>Status</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {appointments.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={5} className="text-center text-muted-foreground py-6">
                    Nenhum agendamento encontrado
                  </TableCell>
                </TableRow>
              ) : (
                appointments.map(appt => {
                  const apptSvcs = apptServices
                    .filter(s => s.appointment_id === appt.id)
                    .map(s => serviceMap[s.service_id] || 'Serviço');
                  return (
                    <TableRow key={appt.id}>
                      <TableCell>
                        {format(parseISO(appt.start_time), "dd/MM/yyyy HH:mm", { locale: ptBR })}
                      </TableCell>
                      <TableCell>{apptSvcs.join(', ') || '-'}</TableCell>
                      <TableCell>{profileMap[appt.professional_id] || '-'}</TableCell>
                      <TableCell className="text-right">
                        R$ {Number(appt.total_price).toFixed(2)}
                      </TableCell>
                      <TableCell>
                        <span className={`px-2 py-1 rounded-full text-xs font-medium ${statusColor[appt.status] || ''}`}>
                          {statusLabel[appt.status] || appt.status}
                        </span>
                      </TableCell>
                    </TableRow>
                  );
                })
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
};

export default Clients;
