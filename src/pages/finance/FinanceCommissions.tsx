import { useEffect, useState, useMemo } from 'react';
import { useLocation } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { useFinancialPrivacy } from '@/contexts/FinancialPrivacyContext';
import { useUserRole } from '@/hooks/useUserRole';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Calendar } from '@/components/ui/calendar';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { CalendarIcon, RotateCcw, Search, Download, FileText, ArrowUpDown, Filter, DollarSign, Users, Scissors, TrendingUp } from 'lucide-react';
import { startOfMonth, startOfDay, endOfDay, format } from 'date-fns';
import { calculateFinancials, collaboratorTypeLabel, commissionLabel, getAppointmentRevenue, remunerationLabel } from '@/lib/financial-engine';
import { ProfessionalDrawer } from '@/components/admin/financial/ProfessionalDrawer';
import { toast } from 'sonner';

const FinanceCommissions = () => {
  const { companyId } = useAuth();
  const { maskValue } = useFinancialPrivacy();
  const { isAdmin, profileId } = useUserRole();
  const location = useLocation();
  const showAdminView = isAdmin && !location.pathname.startsWith('/dashboard/my-finance');
  const [startDate, setStartDate] = useState<Date>(startOfMonth(new Date()));
  const [endDate, setEndDate] = useState<Date>(new Date());
  const [rows, setRows] = useState<any[]>([]);
  const [detailedRows, setDetailedRows] = useState<any[]>([]);
  const [summary, setSummary] = useState({
    totalBilled: 0,
    totalAppointments: 0,
    totalCommission: 0,
    companyNet: 0,
    avgTicket: 0
  });
  const [loading, setLoading] = useState(false);
  
  // Filtros
  const [searchTerm, setSearchTerm] = useState('');
  const [filterType, setFilterType] = useState('all');
  const [selectedProfessional, setSelectedProfessional] = useState('all');
  const [filterStatus, setFilterStatus] = useState('completed');
  
  // Ordenação
  const [sortConfig, setSortConfig] = useState({ key: 'revenue', direction: 'desc' });
  
  // Drawer
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [activeProfessional, setActiveProfessional] = useState<any>(null);

  useEffect(() => {
    if (companyId) fetchData();
  }, [companyId, profileId, showAdminView, startDate, endDate, filterStatus]);

  const fetchData = async () => {
    setLoading(true);
    const start = startOfDay(startDate);
    const end = endOfDay(endDate);

    try {
      // Fetch Collaborator info for the professional if in professional mode
      let collaboratorInfo: any = null;
      if (!showAdminView && profileId) {
        const { data: coll } = await supabase
          .from('collaborators')
          .select('collaborator_type, commission_type, commission_value, commission_percent, profile:profiles(full_name)')
          .eq('profile_id', profileId)
          .eq('company_id', companyId!)
          .maybeSingle();
        collaboratorInfo = coll;
      }

      const [appointmentsRes, commissionsRes] = await Promise.all([
        supabase
          .from('appointments')
          .select(`
            id, 
            professional_id, 
            final_price, 
            total_price, 
            status, 
            start_time,
            client_name,
            is_subscription_covered,
            client:clients!appointments_client_id_fkey(name),
            appointment_services(
              service:services(name)
            )
          `)
          .eq('company_id', companyId!)
          .gte('start_time', start.toISOString())
          .lte('start_time', end.toISOString()),
        supabase
          .from('professional_commissions')
          .select(`
            id,
            professional_id,
            gross_amount,
            commission_amount,
            company_net_amount,
            paid_at,
            description,
            source_type,
            client:clients!professional_commissions_client_id_fkey(name)
          `)
          .eq('company_id', companyId!)
          .gte('paid_at', start.toISOString())
          .lte('paid_at', end.toISOString())
      ]);

      const { data: appointmentsRaw, error: appError } = appointmentsRes;
      const { data: commissionsRaw, error: commError } = commissionsRes;

      if (appError) throw appError;
      if (commError) throw commError;

      // Filter appointments by status if needed
      const appointments = (appointmentsRaw || []).filter(a => {
        if (filterStatus === 'all') return true;
        return a.status === filterStatus;
      });

      // Filter by professional if in professional mode
      const filteredAppointments = !showAdminView && profileId 
        ? appointments.filter(a => a.professional_id === profileId)
        : appointments;
      
      const filteredCommissions = !showAdminView && profileId
        ? (commissionsRaw || []).filter(c => c.professional_id === profileId)
        : (commissionsRaw || []);

      // Se for Admin, mantém a lógica de agrupamento por profissional
      if (showAdminView) {
        const professionalIds = Array.from(new Set([
          ...filteredAppointments.map((a: any) => a.professional_id),
          ...filteredCommissions.map((c: any) => c.professional_id)
        ].filter(Boolean)));

        const profileMap: Record<string, string> = {};
        if (professionalIds.length > 0) {
          const { data: profiles, error: profilesError } = await supabase
            .from('profiles')
            .select('id, full_name')
            .in('id', professionalIds);
          if (profilesError) throw profilesError;
          profiles?.forEach((p: any) => {
            profileMap[p.id] = p.full_name || 'Sem nome';
          });
        }

        const { data: collaborators, error: collError } = await supabase
          .from('collaborators')
          .select('profile_id, collaborator_type, commission_type, commission_value, commission_percent')
          .eq('company_id', companyId!);
        if (collError) throw collError;

        const collabMap: Record<string, any> = {};
        collaborators?.forEach(c => {
          collabMap[c.profile_id] = { 
            type: c.collaborator_type, 
            commType: c.commission_type, 
            value: c.commission_value ?? c.commission_percent ?? 0 
          };
        });

        const grouped: Record<string, { name: string; revenue: number; count: number; professionalValue: number; companyValue: number }> = {};
        
        filteredAppointments.forEach(a => {
          const pid = a.professional_id;
          if (!pid) return;
          if (!grouped[pid]) grouped[pid] = { name: profileMap[pid] || 'Sem nome', revenue: 0, count: 0, professionalValue: 0, companyValue: 0 };
          
          const revenue = getAppointmentRevenue(a);
          const collab = collabMap[pid] || { type: 'commissioned', commType: 'none', value: 0 };
          const fin = calculateFinancials(revenue, 1, collab.type, collab.commType, collab.value, a.is_subscription_covered);
          
          grouped[pid].revenue += revenue;
          grouped[pid].count += 1;
          grouped[pid].professionalValue += fin.professionalValue;
          grouped[pid].companyValue += fin.companyValue;
        });

        filteredCommissions.forEach(c => {
          const pid = c.professional_id;
          if (!pid) return;
          if (!grouped[pid]) grouped[pid] = { name: profileMap[pid] || 'Sem nome', revenue: 0, count: 0, professionalValue: 0, companyValue: 0 };
          
          grouped[pid].revenue += Number(c.gross_amount);
          grouped[pid].professionalValue += Number(c.commission_amount);
          grouped[pid].companyValue += Number(c.company_net_amount);
        });

        const result = Object.entries(grouped).map(([id, g]) => {
          const collab = collabMap[id] || { type: 'commissioned', commType: 'none', value: 0 };
          return { id, ...g, ...collab };
        });

        setRows(result);
      } else {
        // Se for Profissional, cria a lista detalhada
        const collab = collaboratorInfo || { collaborator_type: 'commissioned', commission_type: 'none', commission_value: 0 };
        
        const detailedApp = filteredAppointments.map(a => {
          const revenue = getAppointmentRevenue(a);
          const fin = calculateFinancials(
            revenue, 
            1, 
            collab.collaborator_type, 
            collab.commission_type, 
            collab.commission_value ?? collab.commission_percent ?? 0,
            a.is_subscription_covered
          );
          
          const serviceNames = a.appointment_services?.map((as: any) => as.service?.name).filter(Boolean).join(', ') || 'Sem serviço';
          const clientName = (Array.isArray(a.client) ? a.client[0]?.name : (a.client as any)?.name) || a.client_name || 'Cliente';

          return {
            id: a.id,
            date: a.start_time,
            clientName,
            serviceName: serviceNames,
            revenue,
            commType: collab.commission_type,
            commValue: collab.commission_value ?? collab.commission_percent ?? 0,
            collaboratorType: collab.collaborator_type,
            professionalValue: fin.professionalValue,
            companyValue: fin.companyValue,
            status: a.status,
            origin: a.is_subscription_covered ? 'Assinatura (Uso)' : 'Serviço'
          };
        });

        const detailedComm = filteredCommissions.map(c => ({
          id: c.id,
          date: c.paid_at,
          clientName: (Array.isArray(c.client) ? c.client[0]?.name : c.client?.name) || 'Assinante',
          serviceName: c.description || 'Assinatura',
          revenue: Number(c.gross_amount),
          commType: 'percentage',
          commValue: 70, // This could be dynamic from DB
          collaboratorType: collab.collaborator_type,
          professionalValue: Number(c.commission_amount),
          companyValue: Number(c.company_net_amount),
          status: 'paid',
          origin: 'Assinatura'
        }));

        const detailed = [...detailedApp, ...detailedComm].sort((a, b) => 
          new Date(b.date).getTime() - new Date(a.date).getTime()
        );

        setDetailedRows(detailed);
        
        // Calcular sumário
        const totalBilled = detailed.reduce((acc, r) => acc + r.revenue, 0);
        const totalCommission = detailed.reduce((acc, r) => acc + r.professionalValue, 0);
        const companyNet = detailed.reduce((acc, r) => acc + r.companyValue, 0);
        
        setSummary({
          totalBilled,
          totalAppointments: detailedApp.length,
          totalCommission,
          companyNet,
          avgTicket: detailedApp.length > 0 ? detailedApp.reduce((acc, r) => acc + r.revenue, 0) / detailedApp.length : 0
        });
      }
    } catch (error) {
      console.error('Error fetching data:', error);
      toast.error(error instanceof Error ? error.message : 'Erro ao carregar dados');
    } finally {
      setLoading(false);
    }
  };

  const filteredAndSortedRows = useMemo(() => {
    if (showAdminView) {
      let result = [...rows];

      // Busca por nome
      if (searchTerm) {
        result = result.filter(r => r.name.toLowerCase().includes(searchTerm.toLowerCase()));
      }

      // Filtro por tipo
      if (filterType !== 'all') {
        result = result.filter(r => r.type === filterType);
      }

      // Filtro por profissional específico
      if (selectedProfessional !== 'all') {
        result = result.filter(r => r.id === selectedProfessional);
      }

      // Ordenação
      result.sort((a, b) => {
        const aValue = a[sortConfig.key];
        const bValue = b[sortConfig.key];
        if (sortConfig.direction === 'asc') {
          return aValue > bValue ? 1 : -1;
        }
        return aValue < bValue ? 1 : -1;
      });

      return result;
    } else {
      let result = [...detailedRows];

      // Busca por cliente
      if (searchTerm) {
        result = result.filter(r => 
          r.clientName.toLowerCase().includes(searchTerm.toLowerCase()) ||
          r.serviceName.toLowerCase().includes(searchTerm.toLowerCase())
        );
      }

      // Filtro por status (já feito na query, mas garante consistência)
      if (filterStatus !== 'all') {
        result = result.filter(r => r.status === filterStatus);
      }

      // Ordenação
      result.sort((a, b) => {
        let aValue = a[sortConfig.key === 'revenue' ? 'revenue' : sortConfig.key];
        let bValue = b[sortConfig.key === 'revenue' ? 'revenue' : sortConfig.key];
        
        if (sortConfig.key === 'date') {
          aValue = new Date(a.date).getTime();
          bValue = new Date(b.date).getTime();
        }

        if (sortConfig.direction === 'asc') {
          return aValue > bValue ? 1 : -1;
        }
        return aValue < bValue ? 1 : -1;
      });

      return result;
    }
  }, [rows, detailedRows, searchTerm, filterType, selectedProfessional, filterStatus, sortConfig, showAdminView]);

  const requestSort = (key: string) => {
    let direction = 'desc';
    if (sortConfig.key === key && sortConfig.direction === 'desc') {
      direction = 'asc';
    }
    setSortConfig({ key, direction });
  };

  const exportToCSV = () => {
    let headers = [];
    let data = [];

    if (showAdminView) {
      headers = ['Profissional', 'Tipo', 'Serviços', 'Faturado', 'Comissão', 'Valor Prof.', 'Valor Empresa'];
      data = filteredAndSortedRows.map(r => [
        r.name,
        collaboratorTypeLabel(r.type),
        r.count,
        r.revenue.toFixed(2),
        commissionLabel(r.commType, r.value),
        r.professionalValue.toFixed(2),
        r.companyValue.toFixed(2)
      ]);
    } else {
      headers = ['Data', 'Cliente', 'Serviço', 'Valor', 'Comissão %', 'Vlr Comissão', 'Vlr Prof.', 'Vlr Empresa', 'Status', 'Origem'];
      data = filteredAndSortedRows.map(r => [
        format(new Date(r.date), 'dd/MM/yyyy HH:mm'),
        r.clientName,
        r.serviceName,
        r.revenue.toFixed(2),
        r.commValue,
        (r.revenue - r.companyValue).toFixed(2),
        r.professionalValue.toFixed(2),
        r.companyValue.toFixed(2),
        r.status,
        r.origin
      ]);
    }

    const csvContent = [headers, ...data].map(e => e.join(',')).join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.setAttribute('href', url);
    link.setAttribute('download', `comissoes_${format(new Date(), 'ddMMyyyy')}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const openProfessionalDetail = (professional: any) => {
    setActiveProfessional(professional);
    setDrawerOpen(true);
  };

  return (
    <div className="space-y-6 max-w-7xl mx-auto">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl font-display font-bold">Relatório de Comissões</h2>
          <p className="text-sm text-muted-foreground">Analise o desempenho e faturamento da sua equipe.</p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={() => window.print()} className="hidden sm:flex">
            <FileText className="h-4 w-4 mr-2" /> PDF
          </Button>
          <Button variant="outline" size="sm" onClick={exportToCSV}>
            <Download className="h-4 w-4 mr-2" /> CSV
          </Button>
        </div>
      </div>

      {!showAdminView && (
        <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
          <Card className="bg-primary/5">
            <CardContent className="p-4">
              <p className="text-[10px] text-muted-foreground uppercase tracking-wider">Faturado</p>
              <p className="text-lg font-bold">{maskValue(summary.totalBilled)}</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4">
              <p className="text-[10px] text-muted-foreground uppercase tracking-wider">Atendimentos</p>
              <p className="text-lg font-bold">{summary.totalAppointments}</p>
            </CardContent>
          </Card>
          <Card className="bg-warning/5">
            <CardContent className="p-4">
              <p className="text-[10px] text-muted-foreground uppercase tracking-wider">Sua Comissão</p>
              <p className="text-lg font-bold">{maskValue(summary.totalCommission)}</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4">
              <p className="text-[10px] text-muted-foreground uppercase tracking-wider">Net Empresa</p>
              <p className="text-lg font-bold">{maskValue(summary.companyNet)}</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4">
              <p className="text-[10px] text-muted-foreground uppercase tracking-wider">Ticket Médio</p>
              <p className="text-lg font-bold">{maskValue(summary.avgTicket)}</p>
            </CardContent>
          </Card>
        </div>
      )}

      <Card className="border-none shadow-sm bg-muted/30 print:hidden">
        <CardContent className="p-4 space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 xl:grid-cols-6 gap-3">
            {/* Busca */}
            <div className="relative">
              <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder={showAdminView ? "Buscar profissional..." : "Buscar cliente/serviço..."}
                className="pl-9 h-9"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
              />
            </div>

            {/* Profissional */}
            {showAdminView && (
              <Select value={selectedProfessional} onValueChange={setSelectedProfessional}>
                <SelectTrigger className="h-9">
                  <SelectValue placeholder="Profissional" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todos Profissionais</SelectItem>
                  {rows.map(r => (
                    <SelectItem key={r.id} value={r.id}>{r.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}

            {/* Status */}
            <Select value={filterStatus} onValueChange={setFilterStatus}>
              <SelectTrigger className="h-9">
                <SelectValue placeholder="Status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos os Status</SelectItem>
                <SelectItem value="completed">Concluídos</SelectItem>
                <SelectItem value="confirmed">Confirmados</SelectItem>
                <SelectItem value="cancelled">Cancelados</SelectItem>
              </SelectContent>
            </Select>

            {/* Tipo (Só admin ou profissional) */}
            {showAdminView && (
              <Select value={filterType} onValueChange={setFilterType}>
                <SelectTrigger className="h-9">
                  <SelectValue placeholder="Tipo" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todos os Tipos</SelectItem>
                  <SelectItem value="commissioned">Comissionado</SelectItem>
                  <SelectItem value="partner">Sócio</SelectItem>
                  <SelectItem value="freelancer">Freelancer</SelectItem>
                </SelectContent>
              </Select>
            )}

            {/* Período */}
            <div className="flex items-center gap-2 lg:col-span-2">
              <Popover>
                <PopoverTrigger asChild>
                  <Button variant="outline" size="sm" className="w-full justify-start h-9">
                    <CalendarIcon className="mr-2 h-4 w-4" />
                    {format(startDate, 'dd/MM/yy')}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0" align="start">
                  <Calendar
                    mode="single"
                    selected={startDate}
                    onSelect={(d) => d && setStartDate(d)}
                    initialFocus
                  />
                </PopoverContent>
              </Popover>
              <span className="text-muted-foreground">—</span>
              <Popover>
                <PopoverTrigger asChild>
                  <Button variant="outline" size="sm" className="w-full justify-start h-9">
                    <CalendarIcon className="mr-2 h-4 w-4" />
                    {format(endDate, 'dd/MM/yy')}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0" align="start">
                  <Calendar
                    mode="single"
                    selected={endDate}
                    onSelect={(d) => d && setEndDate(d)}
                    initialFocus
                  />
                </PopoverContent>
              </Popover>
              <Button variant="ghost" size="icon" className="h-9 w-9 shrink-0" onClick={() => { setStartDate(startOfMonth(new Date())); setEndDate(new Date()); }}>
                <RotateCcw className="h-4 w-4" />
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      <Card className="border-none shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          {showAdminView ? (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="cursor-pointer" onClick={() => requestSort('name')}>
                    <div className="flex items-center gap-1">Profissional <ArrowUpDown className="h-3 w-3" /></div>
                  </TableHead>
                  <TableHead className="text-center">Tipo</TableHead>
                  <TableHead className="text-center cursor-pointer" onClick={() => requestSort('count')}>
                    <div className="flex items-center justify-center gap-1">Serviços <ArrowUpDown className="h-3 w-3" /></div>
                  </TableHead>
                  <TableHead className="text-right cursor-pointer" onClick={() => requestSort('revenue')}>
                    <div className="flex items-center justify-end gap-1">Faturado <ArrowUpDown className="h-3 w-3" /></div>
                  </TableHead>
                  <TableHead className="text-right">Comissão</TableHead>
                  <TableHead className="text-right cursor-pointer" onClick={() => requestSort('professionalValue')}>
                    <div className="flex items-center justify-end gap-1">Vlr Prof. <ArrowUpDown className="h-3 w-3" /></div>
                  </TableHead>
                  <TableHead className="text-right cursor-pointer" onClick={() => requestSort('companyValue')}>
                    <div className="flex items-center justify-end gap-1">Vlr Empresa <ArrowUpDown className="h-3 w-3" /></div>
                  </TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {loading ? (
                  <TableRow><TableCell colSpan={7} className="text-center py-10">Carregando...</TableCell></TableRow>
                ) : filteredAndSortedRows.length === 0 ? (
                  <TableRow><TableCell colSpan={7} className="text-center py-10 text-muted-foreground">Nenhum profissional encontrado no período</TableCell></TableRow>
                ) : (
                  filteredAndSortedRows.map((r) => (
                    <TableRow key={r.id} className="cursor-pointer hover:bg-muted/50 transition-colors" onClick={() => openProfessionalDetail(r)}>
                      <TableCell className="font-medium">{r.name}</TableCell>
                      <TableCell className="text-center"><Badge variant="outline">{collaboratorTypeLabel(r.type)}</Badge></TableCell>
                      <TableCell className="text-center">{r.count}</TableCell>
                      <TableCell className="text-right font-semibold">{maskValue(r.revenue)}</TableCell>
                      <TableCell className="text-right text-muted-foreground">{commissionLabel(r.commType, r.value)}</TableCell>
                      <TableCell className="text-right font-bold text-warning">{maskValue(r.professionalValue)}</TableCell>
                      <TableCell className="text-right font-bold text-green-600">{maskValue(r.companyValue)}</TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="cursor-pointer" onClick={() => requestSort('date')}>
                    <div className="flex items-center gap-1">Data <ArrowUpDown className="h-3 w-3" /></div>
                  </TableHead>
                  <TableHead>Origem</TableHead>
                  <TableHead>Cliente</TableHead>
                  <TableHead>Serviço / Plano</TableHead>
                  <TableHead className="text-right cursor-pointer" onClick={() => requestSort('revenue')}>
                    <div className="flex items-center justify-end gap-1">Valor <ArrowUpDown className="h-3 w-3" /></div>
                  </TableHead>
                  <TableHead className="text-center">Comissão</TableHead>
                  <TableHead className="text-right">Sua Parte</TableHead>
                  <TableHead className="text-right">Empresa</TableHead>
                  <TableHead className="text-center">Status</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {loading ? (
                  <TableRow><TableCell colSpan={9} className="text-center py-10">Carregando...</TableCell></TableRow>
                ) : filteredAndSortedRows.length === 0 ? (
                  <TableRow><TableCell colSpan={9} className="text-center py-10 text-muted-foreground">Nenhum atendimento encontrado no período</TableCell></TableRow>
                ) : (
                  filteredAndSortedRows.map((r) => (
                    <TableRow key={r.id}>
                      <TableCell className="text-xs text-muted-foreground">{format(new Date(r.date), 'dd/MM/yy HH:mm')}</TableCell>
                      <TableCell>
                        <Badge variant="outline" className={`text-[10px] ${r.origin === 'Assinatura' ? 'bg-primary/5 text-primary border-primary/20' : ''}`}>
                          {r.origin}
                        </Badge>
                      </TableCell>
                      <TableCell className="font-medium">{r.clientName}</TableCell>
                      <TableCell className="text-sm">{r.serviceName}</TableCell>
                      <TableCell className="text-right font-medium">{maskValue(r.revenue)}</TableCell>
                      <TableCell className="text-center text-xs text-muted-foreground">
                        {r.origin === 'Assinatura' ? '70%' : commissionLabel(r.commType, r.commValue)}
                      </TableCell>
                      <TableCell className="text-right font-bold text-warning">{maskValue(r.professionalValue)}</TableCell>
                      <TableCell className="text-right font-bold text-green-600">{maskValue(r.companyValue)}</TableCell>
                      <TableCell className="text-center">
                        <Badge variant={r.status === 'completed' || r.status === 'paid' ? 'default' : 'secondary'} className="text-[10px] uppercase">
                          {r.status === 'completed' || r.status === 'paid' ? 'Pago' : r.status}
                        </Badge>
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          )}
        </div>
      </Card>

      <ProfessionalDrawer
        professional={activeProfessional}
        isOpen={drawerOpen}
        onClose={() => setDrawerOpen(false)}
        startDate={startDate}
        endDate={endDate}
        companyId={companyId!}
        status={filterStatus}
      />
    </div>
  );
};

export default FinanceCommissions;
