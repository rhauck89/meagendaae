import { useEffect, useState, useMemo } from 'react';
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
import { calculateFinancials, collaboratorTypeLabel, commissionLabel } from '@/lib/financial-engine';
import { ProfessionalDrawer } from '@/components/admin/financial/ProfessionalDrawer';
import { toast } from 'sonner';

const FinanceCommissions = () => {
  const { companyId } = useAuth();
  const { maskValue } = useFinancialPrivacy();
  const { isAdmin, profileId } = useUserRole();
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
  }, [companyId, startDate, endDate]);

  const fetchData = async () => {
    setLoading(true);
    const start = startOfDay(startDate);
    const end = endOfDay(endDate);

    try {
      // Fetch Collaborator info for the professional if in professional mode
      let collaboratorInfo: any = null;
      if (!isAdmin && profileId) {
        const { data: coll } = await supabase
          .from('collaborators')
          .select('collaborator_type, commission_type, commission_value, commission_percent, profile:profiles(full_name)')
          .eq('profile_id', profileId)
          .eq('company_id', companyId!)
          .maybeSingle();
        collaboratorInfo = coll;
      }

      let query = supabase
        .from('appointments')
        .select(`
          id, 
          professional_id, 
          final_price, 
          total_price, 
          status, 
          start_time,
          client_name,
          client:profiles!appointments_client_id_fkey(full_name),
          appointment_services(
            service:services(name)
          )
        `)
        .eq('company_id', companyId!)
        .gte('start_time', start.toISOString())
        .lte('start_time', end.toISOString());

      if (filterStatus !== 'all') {
        query = query.eq('status', filterStatus as any);
      }

      if (!isAdmin && profileId) {
        query = query.eq('professional_id', profileId);
      }

      const { data: appointments, error: appError } = await query;
      if (appError) throw appError;

      // Se for Admin, mantém a lógica de agrupamento por profissional
      if (isAdmin) {
        const professionalIds = Array.from(new Set((appointments || []).map((a: any) => a.professional_id).filter(Boolean)));
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

        const grouped: Record<string, { name: string; revenue: number; count: number }> = {};
        appointments?.forEach(a => {
          const pid = a.professional_id;
          if (!pid) return;
          if (!grouped[pid]) grouped[pid] = { name: profileMap[pid] || 'Sem nome', revenue: 0, count: 0 };
          grouped[pid].revenue += Number(a.final_price || a.total_price || 0);
          grouped[pid].count += 1;
        });

        const result = Object.entries(grouped).map(([id, g]) => {
          const collab = collabMap[id] || { type: 'commissioned', commType: 'none', value: 0 };
          const fin = calculateFinancials(g.revenue, g.count, collab.type, collab.commType, collab.value);
          return { id, ...g, ...collab, professionalValue: fin.professionalValue, companyValue: fin.companyValue };
        });

        setRows(result);
      } else {
        // Se for Profissional, cria a lista detalhada
        const collab = collaboratorInfo || { collaborator_type: 'commissioned', commission_type: 'none', commission_value: 0 };
        const detailed = (appointments || []).map(a => {
          const revenue = Number(a.final_price || a.total_price || 0);
          const fin = calculateFinancials(
            revenue, 
            1, 
            collab.collaborator_type, 
            collab.commission_type, 
            collab.commission_value ?? collab.commission_percent ?? 0
          );
          
          const serviceNames = a.appointment_services?.map((as: any) => as.service?.name).filter(Boolean).join(', ') || 'Sem serviço';
          const clientName = (Array.isArray(a.client) ? a.client[0]?.full_name : (a.client as any)?.full_name) || a.client_name || 'Cliente';

          return {
            id: a.id,
            date: a.start_time,
            clientName,
            serviceName: serviceNames,
            revenue,
            commType: collab.commission_type,
            commValue: collab.commission_value ?? collab.commission_percent ?? 0,
            professionalValue: fin.professionalValue,
            companyValue: fin.companyValue,
            status: a.status
          };
        });

        setDetailedRows(detailed);
        
        // Calcular sumário
        const totalBilled = detailed.reduce((acc, r) => acc + r.revenue, 0);
        const totalCommission = detailed.reduce((acc, r) => acc + r.professionalValue, 0);
        const companyNet = detailed.reduce((acc, r) => acc + r.companyValue, 0);
        
        setSummary({
          totalBilled,
          totalAppointments: detailed.length,
          totalCommission,
          companyNet,
          avgTicket: detailed.length > 0 ? totalBilled / detailed.length : 0
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
    if (isAdmin) {
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
  }, [rows, detailedRows, searchTerm, filterType, selectedProfessional, filterStatus, sortConfig, isAdmin]);

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

    if (isAdmin) {
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
      headers = ['Data', 'Cliente', 'Serviço', 'Valor', 'Comissão %', 'Vlr Comissão', 'Vlr Prof.', 'Vlr Empresa', 'Status'];
      data = filteredAndSortedRows.map(r => [
        format(new Date(r.date), 'dd/MM/yyyy HH:mm'),
        r.clientName,
        r.serviceName,
        r.revenue.toFixed(2),
        r.commValue,
        (r.revenue - r.companyValue).toFixed(2),
        r.professionalValue.toFixed(2),
        r.companyValue.toFixed(2),
        r.status
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

      <Card className="border-none shadow-sm bg-muted/30 print:hidden">
        <CardContent className="p-4 space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 xl:grid-cols-6 gap-3">
            {/* Busca */}
            <div className="relative">
              <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Buscar profissional..."
                className="pl-9 h-9"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
              />
            </div>

            {/* Profissional */}
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

            {/* Tipo */}
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
                  <Calendar mode="single" selected={startDate} onSelect={d => d && setStartDate(d)} className="p-3" />
                </PopoverContent>
              </Popover>
              <span className="text-muted-foreground">até</span>
              <Popover>
                <PopoverTrigger asChild>
                  <Button variant="outline" size="sm" className="w-full justify-start h-9">
                    <CalendarIcon className="mr-2 h-4 w-4" />
                    {format(endDate, 'dd/MM/yy')}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0" align="start">
                  <Calendar mode="single" selected={endDate} onSelect={d => d && setEndDate(d)} disabled={d => d < startDate} className="p-3" />
                </PopoverContent>
              </Popover>
            </div>

            {/* Limpar */}
            <Button 
              variant="ghost" 
              size="sm" 
              className="h-9"
              onClick={() => {
                setStartDate(startOfMonth(new Date()));
                setEndDate(new Date());
                setSearchTerm('');
                setFilterType('all');
                setSelectedProfessional('all');
              }}
            >
              <RotateCcw className="h-4 w-4 mr-2" /> Limpar
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Desktop table */}
      <Card className="hidden md:block border-none shadow-sm overflow-hidden">
        <CardContent className="p-0">
          <Table>
            <TableHeader className="bg-muted/50">
              <TableRow>
                <TableHead className="w-[200px] cursor-pointer" onClick={() => requestSort('name')}>
                  <div className="flex items-center gap-1">Profissional <ArrowUpDown className="h-3 w-3" /></div>
                </TableHead>
                <TableHead className="text-center">Tipo</TableHead>
                <TableHead className="text-center cursor-pointer" onClick={() => requestSort('count')}>
                  <div className="flex items-center justify-center gap-1">Serviços <ArrowUpDown className="h-3 w-3" /></div>
                </TableHead>
                <TableHead className="text-right cursor-pointer" onClick={() => requestSort('revenue')}>
                  <div className="flex items-center justify-end gap-1">Faturado <ArrowUpDown className="h-3 w-3" /></div>
                </TableHead>
                <TableHead className="text-center">Comissão</TableHead>
                <TableHead className="text-right cursor-pointer" onClick={() => requestSort('professionalValue')}>
                  <div className="flex items-center justify-end gap-1">Comissão (R$) <ArrowUpDown className="h-3 w-3" /></div>
                </TableHead>
                <TableHead className="text-right">Empresa (Net)</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {loading ? (
                <TableRow>
                  <TableCell colSpan={7} className="text-center py-20 text-muted-foreground">
                    Carregando dados...
                  </TableCell>
                </TableRow>
              ) : filteredAndSortedRows.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={7} className="text-center py-20 text-muted-foreground">
                    Nenhum dado encontrado para os filtros aplicados.
                  </TableCell>
                </TableRow>
              ) : (
                filteredAndSortedRows.map(r => (
                  <TableRow key={r.id} className="hover:bg-muted/20 transition-colors">
                    <TableCell>
                      <button 
                        onClick={() => openProfessionalDetail(r)}
                        className="font-semibold text-primary hover:underline underline-offset-4 decoration-primary/30 text-left"
                      >
                        {r.name}
                      </button>
                    </TableCell>
                    <TableCell className="text-center">
                      <Badge variant="secondary" className="text-[10px] uppercase font-bold tracking-tight px-2 py-0">
                        {collaboratorTypeLabel(r.type)}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-center font-medium">{r.count}</TableCell>
                    <TableCell className="text-right font-bold">{maskValue(r.revenue)}</TableCell>
                    <TableCell className="text-center">
                      <Badge variant="outline" className="text-[10px] font-medium border-primary/20 text-primary">
                        {commissionLabel(r.commType, r.value)}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-right font-bold text-warning">{maskValue(r.professionalValue)}</TableCell>
                    <TableCell className="text-right font-display font-black text-foreground">
                      {maskValue(r.companyValue)}
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {/* Mobile cards */}
      <div className="md:hidden space-y-4">
        {loading ? (
          <div className="text-center py-10">Carregando...</div>
        ) : filteredAndSortedRows.length === 0 ? (
          <div className="text-center py-10 text-muted-foreground border rounded-lg">Sem dados</div>
        ) : filteredAndSortedRows.map(r => (
          <Card key={r.id} className="border-none shadow-sm overflow-hidden" onClick={() => openProfessionalDetail(r)}>
            <CardContent className="p-4 bg-card hover:bg-muted/10 transition-colors">
              <div className="flex items-center justify-between mb-4">
                <div>
                  <h3 className="font-bold text-lg text-primary">{r.name}</h3>
                  <Badge variant="secondary" className="text-[10px] uppercase">{collaboratorTypeLabel(r.type)}</Badge>
                </div>
                <div className="text-right">
                   <p className="text-[10px] text-muted-foreground uppercase font-semibold">Net Empresa</p>
                   <p className="font-display font-black text-lg leading-tight">{maskValue(r.companyValue)}</p>
                </div>
              </div>
              
              <div className="grid grid-cols-2 gap-4">
                <div className="bg-muted/30 p-2 rounded">
                  <span className="text-[10px] text-muted-foreground uppercase block">Faturado</span>
                  <p className="font-bold">{maskValue(r.revenue)}</p>
                </div>
                <div className="bg-warning/5 p-2 rounded">
                  <span className="text-[10px] text-warning uppercase block">Comissão</span>
                  <p className="font-bold text-warning">{maskValue(r.professionalValue)}</p>
                </div>
              </div>
              
              <div className="mt-3 flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <span className="text-xs text-muted-foreground">{r.count} Serviços</span>
                  <Badge variant="outline" className="text-[10px]">{commissionLabel(r.commType, r.value)}</Badge>
                </div>
                <span className="text-[10px] text-primary font-bold">VER DETALHES →</span>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      <ProfessionalDrawer
        isOpen={drawerOpen}
        onClose={() => setDrawerOpen(false)}
        professional={activeProfessional}
        startDate={startDate}
        endDate={endDate}
      />
      
      <style>{`
        @media print {
          .print\\:hidden { display: none !important; }
          body { background: white !important; }
          .max-w-7xl { max-width: 100% !important; }
        }
      `}</style>
    </div>
  );
};

export default FinanceCommissions;
