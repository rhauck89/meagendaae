import { useEffect, useState, useMemo } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { Search, MoreHorizontal, Eye, Ban, CheckCircle, CreditCard, LogIn, X, Building2, Clock, CalendarPlus } from 'lucide-react';
import { toast } from 'sonner';
import { format, differenceInDays } from 'date-fns';

const statusColors: Record<string, string> = {
  active: 'bg-success/10 text-success border-success/20',
  trial: 'bg-warning/10 text-warning border-warning/20',
  inactive: 'bg-muted text-muted-foreground',
  blocked: 'bg-destructive/10 text-destructive border-destructive/20',
};

const statusLabels: Record<string, string> = {
  active: 'Ativo',
  trial: 'Trial',
  inactive: 'Inativo',
  blocked: 'Suspenso',
};

interface CompanyWithOwner {
  id: string;
  name: string;
  slug: string;
  city: string | null;
  state: string | null;
  subscription_status: string;
  created_at: string;
  owner_id: string | null;
  owner_email?: string;
  phone: string | null;
  whatsapp: string | null;
  business_type: string;
  address: string | null;
  district: string | null;
  instagram: string | null;
  logo_url: string | null;
  plan_id: string | null;
  plan_name?: string;
  billing_cycle: string;
  trial_active: boolean;
  trial_end_date: string | null;
}

interface PlanOption {
  id: string;
  name: string;
}

const SuperAdminCompanies = () => {
  const [companies, setCompanies] = useState<CompanyWithOwner[]>([]);
  const [search, setSearch] = useState('');
  const [filterState, setFilterState] = useState('all');
  const [filterCity, setFilterCity] = useState('all');
  const [filterPlan, setFilterPlan] = useState('all');
  const [filterStatus, setFilterStatus] = useState('all');
  const [filterBusinessType, setFilterBusinessType] = useState('all');
  const [loading, setLoading] = useState(true);
  const [selectedCompany, setSelectedCompany] = useState<CompanyWithOwner | null>(null);
  const [detailOpen, setDetailOpen] = useState(false);
  const [planDialogOpen, setPlanDialogOpen] = useState(false);
  const [planTarget, setPlanTarget] = useState<CompanyWithOwner | null>(null);
  const [newPlanId, setNewPlanId] = useState('');
  const [newBillingCycle, setNewBillingCycle] = useState('monthly');
  const [newStatus, setNewStatus] = useState('active');
  const [planOptions, setPlanOptions] = useState<PlanOption[]>([]);
  const [extendDays, setExtendDays] = useState(7);
  const [extendDialogOpen, setExtendDialogOpen] = useState(false);
  const [extendTarget, setExtendTarget] = useState<CompanyWithOwner | null>(null);

  const fetchCompanies = async () => {
    const { data: companiesData } = await supabase
      .from('companies')
      .select('id, name, slug, city, state, subscription_status, created_at, owner_id, phone, whatsapp, business_type, address, district, instagram, logo_url, plan_id, billing_cycle, trial_active, trial_end_date')
      .order('created_at', { ascending: false });

    if (!companiesData) { setLoading(false); return; }

    const ownerIds = companiesData.map(c => c.owner_id).filter(Boolean) as string[];
    let ownerMap: Record<string, string> = {};
    if (ownerIds.length > 0) {
      const { data: profiles } = await supabase
        .from('profiles')
        .select('user_id, email')
        .in('user_id', ownerIds);
      if (profiles) {
        ownerMap = Object.fromEntries(profiles.map(p => [p.user_id, p.email || '']));
      }
    }

    // Fetch plan names
    const planIds = [...new Set(companiesData.map(c => c.plan_id).filter(Boolean))] as string[];
    let planMap: Record<string, string> = {};
    if (planIds.length > 0) {
      const { data: plans } = await supabase.from('plans').select('id, name').in('id', planIds);
      if (plans) planMap = Object.fromEntries(plans.map(p => [p.id, p.name]));
    }

    setCompanies(companiesData.map(c => ({
      ...c,
      owner_email: c.owner_id ? ownerMap[c.owner_id] || '' : '',
      plan_name: c.plan_id ? planMap[c.plan_id] || '—' : '—',
      billing_cycle: (c as any).billing_cycle || 'monthly',
      trial_active: (c as any).trial_active ?? false,
      trial_end_date: (c as any).trial_end_date ?? null,
    })));
    setLoading(false);
  };

  const fetchPlanOptions = async () => {
    const { data } = await supabase.from('plans').select('id, name').eq('active', true).order('sort_order');
    if (data) setPlanOptions(data);
  };

  useEffect(() => { fetchCompanies(); fetchPlanOptions(); }, []);

  const states = useMemo(() => {
    const s = [...new Set(companies.map(c => c.state).filter(Boolean))] as string[];
    return s.sort();
  }, [companies]);

  const cities = useMemo(() => {
    let subset = companies;
    if (filterState !== 'all') subset = subset.filter(c => c.state === filterState);
    const c = [...new Set(subset.map(co => co.city).filter(Boolean))] as string[];
    return c.sort();
  }, [companies, filterState]);

  const filtered = useMemo(() => {
    return companies.filter(c => {
      if (search && !c.name?.toLowerCase().includes(search.toLowerCase()) && !c.slug?.toLowerCase().includes(search.toLowerCase()) && !c.owner_email?.toLowerCase().includes(search.toLowerCase())) return false;
      if (filterState !== 'all' && c.state !== filterState) return false;
      if (filterCity !== 'all' && c.city !== filterCity) return false;
      if (filterPlan !== 'all' && c.subscription_status !== filterPlan) return false;
      if (filterStatus !== 'all' && c.subscription_status !== filterStatus) return false;
      if (filterBusinessType !== 'all' && c.business_type !== filterBusinessType) return false;
      return true;
    });
  }, [companies, search, filterState, filterCity, filterPlan, filterStatus, filterBusinessType]);

  const updateStatus = async (id: string, status: string) => {
    await supabase.from('companies').update({ subscription_status: status as any }).eq('id', id);
    toast.success(status === 'blocked' ? 'Empresa suspensa' : status === 'active' ? 'Empresa ativada' : 'Status atualizado');
    fetchCompanies();
  };

  const handleChangePlan = async () => {
    if (!planTarget) return;
    const updateData: any = {
      subscription_status: newStatus as any,
      billing_cycle: newBillingCycle,
    };
    if (newPlanId) updateData.plan_id = newPlanId;
    if (newStatus === 'active') updateData.trial_active = false;
    
    await supabase.from('companies').update(updateData).eq('id', planTarget.id);
    toast.success('Plano alterado com sucesso');
    setPlanDialogOpen(false);
    setPlanTarget(null);
    fetchCompanies();
  };

  const handleExtendTrial = async () => {
    if (!extendTarget) return;
    const currentEnd = extendTarget.trial_end_date ? new Date(extendTarget.trial_end_date) : new Date();
    const newEnd = new Date(Math.max(currentEnd.getTime(), Date.now()));
    newEnd.setDate(newEnd.getDate() + extendDays);
    
    await supabase.from('companies').update({
      trial_end_date: newEnd.toISOString(),
      trial_active: true,
      subscription_status: 'trial' as any,
    } as any).eq('id', extendTarget.id);
    
    toast.success(`Trial estendido por ${extendDays} dias`);
    setExtendDialogOpen(false);
    setExtendTarget(null);
    fetchCompanies();
  };

  const handleLoginAs = async (company: CompanyWithOwner) => {
    if (!company.owner_id) {
      toast.error('Empresa não possui um proprietário cadastrado');
      return;
    }
    toast.loading('Gerando acesso...', { id: 'impersonate' });
    try {
      const { data, error } = await supabase.functions.invoke('impersonate-company', {
        body: { company_id: company.id },
      });
      if (error || !data?.action_link) {
        toast.error('Erro ao gerar acesso.', { id: 'impersonate' });
        return;
      }
      toast.success(`Abrindo como ${data.owner_name || data.owner_email}...`, { id: 'impersonate' });
      window.open(data.action_link, '_blank');
    } catch {
      toast.error('Erro ao conectar com o servidor', { id: 'impersonate' });
    }
  };

  const resetFilters = () => {
    setSearch(''); setFilterState('all'); setFilterCity('all'); setFilterPlan('all'); setFilterStatus('all'); setFilterBusinessType('all');
  };

  const hasActiveFilters = search || filterState !== 'all' || filterCity !== 'all' || filterPlan !== 'all' || filterStatus !== 'all' || filterBusinessType !== 'all';

  const getTrialInfo = (c: CompanyWithOwner) => {
    if (!c.trial_active || !c.trial_end_date) return null;
    const days = differenceInDays(new Date(c.trial_end_date), new Date());
    return days;
  };

  if (loading) {
    return <div className="flex items-center justify-center py-12"><p className="text-muted-foreground">Carregando...</p></div>;
  }

  return (
    <div className="space-y-6">
      {/* Search + Filters */}
      <div className="flex flex-col gap-3">
        <div className="flex flex-wrap items-center gap-3">
          <div className="relative flex-1 min-w-[200px] max-w-md">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input placeholder="Buscar por nome, slug ou email..." value={search} onChange={(e) => setSearch(e.target.value)} className="pl-9" />
          </div>
          <Badge variant="outline">{filtered.length} de {companies.length} empresas</Badge>
          {hasActiveFilters && (
            <Button variant="ghost" size="sm" onClick={resetFilters} className="text-muted-foreground">
              <X className="h-4 w-4 mr-1" /> Limpar filtros
            </Button>
          )}
        </div>
        <div className="flex flex-wrap gap-3">
          <Select value={filterState} onValueChange={(v) => { setFilterState(v); setFilterCity('all'); }}>
            <SelectTrigger className="w-[150px]"><SelectValue placeholder="Estado" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todos estados</SelectItem>
              {states.map(s => <SelectItem key={s} value={s}>{s}</SelectItem>)}
            </SelectContent>
          </Select>
          <Select value={filterCity} onValueChange={setFilterCity}>
            <SelectTrigger className="w-[150px]"><SelectValue placeholder="Cidade" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todas cidades</SelectItem>
              {cities.map(c => <SelectItem key={c} value={c}>{c}</SelectItem>)}
            </SelectContent>
          </Select>
          <Select value={filterStatus} onValueChange={setFilterStatus}>
            <SelectTrigger className="w-[150px]"><SelectValue placeholder="Status" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todos status</SelectItem>
              <SelectItem value="active">Ativo</SelectItem>
              <SelectItem value="trial">Trial</SelectItem>
              <SelectItem value="blocked">Suspenso</SelectItem>
              <SelectItem value="inactive">Inativo</SelectItem>
            </SelectContent>
          </Select>
          <Select value={filterBusinessType} onValueChange={setFilterBusinessType}>
            <SelectTrigger className="w-[160px]"><SelectValue placeholder="Categoria" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todas categorias</SelectItem>
              <SelectItem value="barbershop">Barbearia</SelectItem>
              <SelectItem value="esthetic">Estética</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      {/* Table */}
      <Card>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Empresa</TableHead>
                  <TableHead className="hidden md:table-cell">Email do dono</TableHead>
                  <TableHead>Plano</TableHead>
                  <TableHead className="hidden md:table-cell">Ciclo</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="hidden lg:table-cell">Trial</TableHead>
                  <TableHead className="hidden lg:table-cell">Cidade</TableHead>
                  <TableHead className="hidden md:table-cell">Criada em</TableHead>
                  <TableHead className="w-[50px]"></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filtered.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={9} className="text-center py-8 text-muted-foreground">
                      Nenhuma empresa encontrada
                    </TableCell>
                  </TableRow>
                ) : filtered.map((c) => {
                  const trialDays = getTrialInfo(c);
                  return (
                    <TableRow key={c.id}>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          {c.logo_url ? (
                            <img src={c.logo_url} className="h-8 w-8 rounded-lg object-cover" alt="" />
                          ) : (
                            <div className="h-8 w-8 rounded-lg bg-muted flex items-center justify-center">
                              <Building2 className="h-4 w-4 text-muted-foreground" />
                            </div>
                          )}
                          <div>
                            <p className="font-medium text-sm">{c.name}</p>
                            <p className="text-xs text-muted-foreground">/{c.slug}</p>
                          </div>
                        </div>
                      </TableCell>
                      <TableCell className="hidden md:table-cell">
                        <span className="text-sm text-muted-foreground">{c.owner_email || '—'}</span>
                      </TableCell>
                      <TableCell>
                        <span className="text-sm font-medium">{c.plan_name || '—'}</span>
                      </TableCell>
                      <TableCell className="hidden md:table-cell">
                        <span className="text-xs text-muted-foreground">{c.billing_cycle === 'yearly' ? 'Anual' : 'Mensal'}</span>
                      </TableCell>
                      <TableCell>
                        <Badge variant="outline" className={`text-xs ${statusColors[c.subscription_status] || ''}`}>
                          {statusLabels[c.subscription_status] || c.subscription_status}
                        </Badge>
                      </TableCell>
                      <TableCell className="hidden lg:table-cell">
                        {trialDays !== null ? (
                          <div className="flex items-center gap-1">
                            <Clock className="h-3 w-3 text-warning" />
                            <span className={`text-xs ${trialDays <= 0 ? 'text-destructive' : trialDays <= 3 ? 'text-warning' : 'text-muted-foreground'}`}>
                              {trialDays <= 0 ? 'Expirado' : `${trialDays}d restantes`}
                            </span>
                          </div>
                        ) : (
                          <span className="text-xs text-muted-foreground">—</span>
                        )}
                      </TableCell>
                      <TableCell className="hidden lg:table-cell text-sm text-muted-foreground">
                        {c.city || '—'}
                      </TableCell>
                      <TableCell className="hidden md:table-cell text-sm text-muted-foreground">
                        {format(new Date(c.created_at), 'dd/MM/yyyy')}
                      </TableCell>
                      <TableCell>
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button variant="ghost" size="icon" className="h-8 w-8">
                              <MoreHorizontal className="h-4 w-4" />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end">
                            <DropdownMenuItem onClick={() => { setSelectedCompany(c); setDetailOpen(true); }}>
                              <Eye className="h-4 w-4 mr-2" /> Ver detalhes
                            </DropdownMenuItem>
                            {c.subscription_status !== 'blocked' ? (
                              <DropdownMenuItem onClick={() => updateStatus(c.id, 'blocked')} className="text-destructive">
                                <Ban className="h-4 w-4 mr-2" /> Suspender
                              </DropdownMenuItem>
                            ) : (
                              <DropdownMenuItem onClick={() => updateStatus(c.id, 'active')}>
                                <CheckCircle className="h-4 w-4 mr-2" /> Ativar
                              </DropdownMenuItem>
                            )}
                            <DropdownMenuItem onClick={() => {
                              setPlanTarget(c);
                              setNewPlanId(c.plan_id || '');
                              setNewBillingCycle(c.billing_cycle);
                              setNewStatus(c.subscription_status);
                              setPlanDialogOpen(true);
                            }}>
                              <CreditCard className="h-4 w-4 mr-2" /> Alterar plano
                            </DropdownMenuItem>
                            <DropdownMenuItem onClick={() => { setExtendTarget(c); setExtendDays(7); setExtendDialogOpen(true); }}>
                              <CalendarPlus className="h-4 w-4 mr-2" /> Estender trial
                            </DropdownMenuItem>
                            <DropdownMenuItem onClick={() => handleLoginAs(c)}>
                              <LogIn className="h-4 w-4 mr-2" /> Login como admin
                            </DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>

      {/* Detail Dialog */}
      <Dialog open={detailOpen} onOpenChange={setDetailOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              {selectedCompany?.logo_url ? (
                <img src={selectedCompany.logo_url} className="h-8 w-8 rounded-lg object-cover" alt="" />
              ) : (
                <Building2 className="h-5 w-5" />
              )}
              {selectedCompany?.name}
            </DialogTitle>
          </DialogHeader>
          {selectedCompany && (
            <div className="space-y-3 text-sm">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <p className="text-muted-foreground text-xs">Slug</p>
                  <p className="font-medium">/{selectedCompany.slug}</p>
                </div>
                <div>
                  <p className="text-muted-foreground text-xs">Tipo</p>
                  <p className="font-medium">{selectedCompany.business_type}</p>
                </div>
                <div>
                  <p className="text-muted-foreground text-xs">Email do dono</p>
                  <p className="font-medium">{selectedCompany.owner_email || '—'}</p>
                </div>
                <div>
                  <p className="text-muted-foreground text-xs">Status</p>
                  <Badge variant="outline" className={statusColors[selectedCompany.subscription_status] || ''}>
                    {statusLabels[selectedCompany.subscription_status] || selectedCompany.subscription_status}
                  </Badge>
                </div>
                <div>
                  <p className="text-muted-foreground text-xs">Plano</p>
                  <p className="font-medium">{selectedCompany.plan_name || '—'}</p>
                </div>
                <div>
                  <p className="text-muted-foreground text-xs">Ciclo</p>
                  <p className="font-medium">{selectedCompany.billing_cycle === 'yearly' ? 'Anual' : 'Mensal'}</p>
                </div>
                {selectedCompany.trial_active && selectedCompany.trial_end_date && (
                  <>
                    <div>
                      <p className="text-muted-foreground text-xs">Trial até</p>
                      <p className="font-medium">{format(new Date(selectedCompany.trial_end_date), 'dd/MM/yyyy')}</p>
                    </div>
                    <div>
                      <p className="text-muted-foreground text-xs">Dias restantes</p>
                      <p className="font-medium">{Math.max(0, differenceInDays(new Date(selectedCompany.trial_end_date), new Date()))}</p>
                    </div>
                  </>
                )}
                <div>
                  <p className="text-muted-foreground text-xs">Cidade</p>
                  <p className="font-medium">{selectedCompany.city || '—'}</p>
                </div>
                <div>
                  <p className="text-muted-foreground text-xs">Estado</p>
                  <p className="font-medium">{selectedCompany.state || '—'}</p>
                </div>
                <div>
                  <p className="text-muted-foreground text-xs">Criada em</p>
                  <p className="font-medium">{format(new Date(selectedCompany.created_at), 'dd/MM/yyyy HH:mm')}</p>
                </div>
              </div>
              <div className="flex flex-wrap gap-2 pt-3 border-t">
                {selectedCompany.subscription_status !== 'blocked' ? (
                  <Button variant="destructive" size="sm" onClick={() => { updateStatus(selectedCompany.id, 'blocked'); setDetailOpen(false); }}>
                    <Ban className="h-4 w-4 mr-1" /> Suspender
                  </Button>
                ) : (
                  <Button size="sm" onClick={() => { updateStatus(selectedCompany.id, 'active'); setDetailOpen(false); }}>
                    <CheckCircle className="h-4 w-4 mr-1" /> Ativar
                  </Button>
                )}
                <Button variant="outline" size="sm" onClick={() => {
                  setPlanTarget(selectedCompany);
                  setNewPlanId(selectedCompany.plan_id || '');
                  setNewBillingCycle(selectedCompany.billing_cycle);
                  setNewStatus(selectedCompany.subscription_status);
                  setPlanDialogOpen(true);
                  setDetailOpen(false);
                }}>
                  <CreditCard className="h-4 w-4 mr-1" /> Alterar plano
                </Button>
                <Button variant="outline" size="sm" onClick={() => { setExtendTarget(selectedCompany); setExtendDays(7); setExtendDialogOpen(true); setDetailOpen(false); }}>
                  <CalendarPlus className="h-4 w-4 mr-1" /> Estender trial
                </Button>
                <Button variant="outline" size="sm" onClick={() => handleLoginAs(selectedCompany)}>
                  <LogIn className="h-4 w-4 mr-1" /> Login como admin
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Change Plan Dialog */}
      <Dialog open={planDialogOpen} onOpenChange={setPlanDialogOpen}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>Alterar Plano — {planTarget?.name}</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <div className="space-y-1">
              <Label className="text-xs">Plano</Label>
              <Select value={newPlanId} onValueChange={setNewPlanId}>
                <SelectTrigger><SelectValue placeholder="Selecionar plano" /></SelectTrigger>
                <SelectContent>
                  {planOptions.map(p => <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Ciclo de cobrança</Label>
              <Select value={newBillingCycle} onValueChange={setNewBillingCycle}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="monthly">Mensal</SelectItem>
                  <SelectItem value="yearly">Anual</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Status</Label>
              <Select value={newStatus} onValueChange={setNewStatus}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="active">Ativo</SelectItem>
                  <SelectItem value="trial">Trial</SelectItem>
                  <SelectItem value="inactive">Inativo</SelectItem>
                  <SelectItem value="blocked">Suspenso</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setPlanDialogOpen(false)}>Cancelar</Button>
            <Button onClick={handleChangePlan}>Salvar</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Extend Trial Dialog */}
      <Dialog open={extendDialogOpen} onOpenChange={setExtendDialogOpen}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>Estender Trial — {extendTarget?.name}</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <div className="space-y-1">
              <Label className="text-xs">Dias para estender</Label>
              <Input type="number" min={1} max={90} value={extendDays} onChange={(e) => setExtendDays(parseInt(e.target.value) || 7)} />
            </div>
            {extendTarget?.trial_end_date && (
              <p className="text-xs text-muted-foreground">
                Trial atual até: {format(new Date(extendTarget.trial_end_date), 'dd/MM/yyyy')}
              </p>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setExtendDialogOpen(false)}>Cancelar</Button>
            <Button onClick={handleExtendTrial}>Estender</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default SuperAdminCompanies;
