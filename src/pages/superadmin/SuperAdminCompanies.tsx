import { useEffect, useState, useMemo } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { Search, MoreHorizontal, Eye, Ban, CheckCircle, CreditCard, LogIn, X, Building2 } from 'lucide-react';
import { toast } from 'sonner';
import { format } from 'date-fns';

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

const planLabels: Record<string, string> = {
  active: 'Pago',
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
}

const SuperAdminCompanies = () => {
  const [companies, setCompanies] = useState<CompanyWithOwner[]>([]);
  const [search, setSearch] = useState('');
  const [filterState, setFilterState] = useState('all');
  const [filterCity, setFilterCity] = useState('all');
  const [filterPlan, setFilterPlan] = useState('all');
  const [filterStatus, setFilterStatus] = useState('all');
  const [loading, setLoading] = useState(true);
  const [selectedCompany, setSelectedCompany] = useState<CompanyWithOwner | null>(null);
  const [detailOpen, setDetailOpen] = useState(false);
  const [planDialogOpen, setPlanDialogOpen] = useState(false);
  const [planTarget, setPlanTarget] = useState<CompanyWithOwner | null>(null);
  const [newPlan, setNewPlan] = useState('active');

  const fetchCompanies = async () => {
    const { data: companiesData } = await supabase
      .from('companies')
      .select('id, name, slug, city, state, subscription_status, created_at, owner_id, phone, whatsapp, business_type, address, district, instagram, logo_url')
      .order('created_at', { ascending: false });

    if (!companiesData) { setLoading(false); return; }

    // Fetch owner emails from profiles
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

    setCompanies(companiesData.map(c => ({
      ...c,
      owner_email: c.owner_id ? ownerMap[c.owner_id] || '' : '',
    })));
    setLoading(false);
  };

  useEffect(() => { fetchCompanies(); }, []);

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
      if (filterStatus !== 'all') {
        if (filterStatus === 'active' && c.subscription_status !== 'active') return false;
        if (filterStatus === 'blocked' && c.subscription_status !== 'blocked') return false;
        if (filterStatus === 'trial' && c.subscription_status !== 'trial') return false;
        if (filterStatus === 'inactive' && c.subscription_status !== 'inactive') return false;
      }
      return true;
    });
  }, [companies, search, filterState, filterCity, filterPlan, filterStatus]);

  const updateStatus = async (id: string, newStatus: string) => {
    await supabase.from('companies').update({ subscription_status: newStatus as any }).eq('id', id);
    toast.success(newStatus === 'blocked' ? 'Empresa suspensa' : newStatus === 'active' ? 'Empresa ativada' : 'Status atualizado');
    fetchCompanies();
  };

  const handleChangePlan = async () => {
    if (!planTarget) return;
    await supabase.from('companies').update({ subscription_status: newPlan as any }).eq('id', planTarget.id);
    toast.success('Plano alterado com sucesso');
    setPlanDialogOpen(false);
    setPlanTarget(null);
    fetchCompanies();
  };

  const handleLoginAs = async (company: CompanyWithOwner) => {
    // For security, this creates a note that the admin wants to impersonate.
    // True impersonation requires a server-side edge function.
    toast.info(`Funcionalidade "Login como" requer implementação via backend function para segurança. Company ID: ${company.id}`);
  };

  const resetFilters = () => {
    setSearch('');
    setFilterState('all');
    setFilterCity('all');
    setFilterPlan('all');
    setFilterStatus('all');
  };

  const hasActiveFilters = search || filterState !== 'all' || filterCity !== 'all' || filterPlan !== 'all' || filterStatus !== 'all';

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
            <Input
              placeholder="Buscar por nome, slug ou email..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-9"
            />
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
            <SelectTrigger className="w-[150px]">
              <SelectValue placeholder="Estado" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todos estados</SelectItem>
              {states.map(s => <SelectItem key={s} value={s}>{s}</SelectItem>)}
            </SelectContent>
          </Select>

          <Select value={filterCity} onValueChange={setFilterCity}>
            <SelectTrigger className="w-[150px]">
              <SelectValue placeholder="Cidade" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todas cidades</SelectItem>
              {cities.map(c => <SelectItem key={c} value={c}>{c}</SelectItem>)}
            </SelectContent>
          </Select>

          <Select value={filterPlan} onValueChange={setFilterPlan}>
            <SelectTrigger className="w-[150px]">
              <SelectValue placeholder="Plano" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todos planos</SelectItem>
              <SelectItem value="active">Pago</SelectItem>
              <SelectItem value="trial">Trial</SelectItem>
              <SelectItem value="inactive">Inativo</SelectItem>
            </SelectContent>
          </Select>

          <Select value={filterStatus} onValueChange={setFilterStatus}>
            <SelectTrigger className="w-[150px]">
              <SelectValue placeholder="Status" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todos status</SelectItem>
              <SelectItem value="active">Ativo</SelectItem>
              <SelectItem value="trial">Trial</SelectItem>
              <SelectItem value="blocked">Suspenso</SelectItem>
              <SelectItem value="inactive">Inativo</SelectItem>
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
                  <TableHead>Status</TableHead>
                  <TableHead className="hidden lg:table-cell">Cidade</TableHead>
                  <TableHead className="hidden lg:table-cell">Estado</TableHead>
                  <TableHead className="hidden md:table-cell">Criada em</TableHead>
                  <TableHead className="w-[50px]"></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filtered.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={8} className="text-center py-8 text-muted-foreground">
                      Nenhuma empresa encontrada
                    </TableCell>
                  </TableRow>
                ) : filtered.map((c) => (
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
                      <Badge variant="outline" className="text-xs">
                        {planLabels[c.subscription_status] || c.subscription_status}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <Badge variant="outline" className={`text-xs ${statusColors[c.subscription_status] || ''}`}>
                        {statusLabels[c.subscription_status] || c.subscription_status}
                      </Badge>
                    </TableCell>
                    <TableCell className="hidden lg:table-cell text-sm text-muted-foreground">
                      {c.city || '—'}
                    </TableCell>
                    <TableCell className="hidden lg:table-cell text-sm text-muted-foreground">
                      {c.state || '—'}
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
                          <DropdownMenuItem onClick={() => { setPlanTarget(c); setNewPlan(c.subscription_status); setPlanDialogOpen(true); }}>
                            <CreditCard className="h-4 w-4 mr-2" /> Alterar plano
                          </DropdownMenuItem>
                          <DropdownMenuItem onClick={() => handleLoginAs(c)}>
                            <LogIn className="h-4 w-4 mr-2" /> Login como admin
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </TableCell>
                  </TableRow>
                ))}
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
                  <p className="text-muted-foreground text-xs">Telefone</p>
                  <p className="font-medium">{selectedCompany.phone || '—'}</p>
                </div>
                <div>
                  <p className="text-muted-foreground text-xs">WhatsApp</p>
                  <p className="font-medium">{selectedCompany.whatsapp || '—'}</p>
                </div>
                <div>
                  <p className="text-muted-foreground text-xs">Cidade</p>
                  <p className="font-medium">{selectedCompany.city || '—'}</p>
                </div>
                <div>
                  <p className="text-muted-foreground text-xs">Estado</p>
                  <p className="font-medium">{selectedCompany.state || '—'}</p>
                </div>
                <div>
                  <p className="text-muted-foreground text-xs">Bairro</p>
                  <p className="font-medium">{selectedCompany.district || '—'}</p>
                </div>
                <div>
                  <p className="text-muted-foreground text-xs">Endereço</p>
                  <p className="font-medium">{selectedCompany.address || '—'}</p>
                </div>
                <div>
                  <p className="text-muted-foreground text-xs">Instagram</p>
                  <p className="font-medium">{selectedCompany.instagram || '—'}</p>
                </div>
                <div>
                  <p className="text-muted-foreground text-xs">Criada em</p>
                  <p className="font-medium">{format(new Date(selectedCompany.created_at), 'dd/MM/yyyy HH:mm')}</p>
                </div>
              </div>

              <div className="flex gap-2 pt-3 border-t">
                {selectedCompany.subscription_status !== 'blocked' ? (
                  <Button variant="destructive" size="sm" onClick={() => { updateStatus(selectedCompany.id, 'blocked'); setDetailOpen(false); }}>
                    <Ban className="h-4 w-4 mr-1" /> Suspender
                  </Button>
                ) : (
                  <Button size="sm" onClick={() => { updateStatus(selectedCompany.id, 'active'); setDetailOpen(false); }}>
                    <CheckCircle className="h-4 w-4 mr-1" /> Ativar
                  </Button>
                )}
                <Button variant="outline" size="sm" onClick={() => { setPlanTarget(selectedCompany); setNewPlan(selectedCompany.subscription_status); setPlanDialogOpen(true); setDetailOpen(false); }}>
                  <CreditCard className="h-4 w-4 mr-1" /> Alterar plano
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
            <Select value={newPlan} onValueChange={setNewPlan}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="active">Pago (Ativo)</SelectItem>
                <SelectItem value="trial">Trial</SelectItem>
                <SelectItem value="inactive">Inativo</SelectItem>
                <SelectItem value="blocked">Suspenso</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setPlanDialogOpen(false)}>Cancelar</Button>
            <Button onClick={handleChangePlan}>Salvar</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default SuperAdminCompanies;
