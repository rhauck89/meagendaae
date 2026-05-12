import { useState, useEffect, useMemo } from 'react';
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { useFinancialPrivacy } from '@/contexts/FinancialPrivacyContext';
import { supabase } from '@/integrations/supabase/client';
import { format, parseISO, startOfDay, endOfDay } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { TrendingUp, Users, History, DollarSign, Wallet, ChevronLeft, ChevronRight, CalendarDays, FilterX, Search } from 'lucide-react';
import { getAppointmentRevenue, calculateFinancials, commissionLabel, collaboratorTypeLabel, remunerationLabel } from '@/lib/financial-engine';

interface ProfessionalDrawerProps {
  professional: any;
  isOpen: boolean;
  onClose: () => void;
  startDate: Date;
  endDate: Date;
  companyId: string;
  status?: string;
}

export const ProfessionalDrawer = ({
  professional,
  isOpen,
  onClose,
  startDate,
  endDate,
  companyId,
  status = 'completed',
}: ProfessionalDrawerProps) => {
  const { maskValue } = useFinancialPrivacy();
  const [loading, setLoading] = useState(true);
  
  // Local filter states
  const [localStartDate, setLocalStartDate] = useState(format(startDate, 'yyyy-MM-dd'));
  const [localEndDate, setLocalEndDate] = useState(format(endDate, 'yyyy-MM-dd'));
  const [appliedStartDate, setAppliedStartDate] = useState(startDate);
  const [appliedEndDate, setAppliedEndDate] = useState(endDate);
  
  // Pagination state
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 10;

  const [details, setDetails] = useState<any>({
    topServices: [],
    topClients: [],
    history: [],
  });

  // Reset local dates when the drawer opens or the main filter changes
  useEffect(() => {
    if (isOpen) {
      setLocalStartDate(format(startDate, 'yyyy-MM-dd'));
      setLocalEndDate(format(endDate, 'yyyy-MM-dd'));
      setAppliedStartDate(startDate);
      setAppliedEndDate(endDate);
      setCurrentPage(1);
    }
  }, [isOpen, startDate, endDate]);

  useEffect(() => {
    if (isOpen && professional?.id) {
      fetchProfessionalDetails();
    }
  }, [isOpen, professional?.id, appliedStartDate, appliedEndDate]);

  const fetchProfessionalDetails = async () => {
    setLoading(true);
    try {
      const [appointmentsResponse, commissionsResponse] = await Promise.all([
        supabase
          .from('appointments')
          .select(`
            id,
            total_price,
            original_price,
            promotion_discount,
            cashback_used,
            manual_discount,
            final_price,
            start_time,
            status,
            client_name,
            is_subscription_covered,
            client:clients!appointments_client_id_fkey(name),
            appointment_services(
              service:services(name)
            )
          `)
          .eq('professional_id', professional.id)
          .eq('company_id', companyId)
          .gte('start_time', startOfDay(appliedStartDate).toISOString())
          .lte('start_time', endOfDay(appliedEndDate).toISOString()),
        supabase
          .from('professional_commissions')
          .select(`
            id,
            description,
            gross_amount,
            commission_amount,
            company_net_amount,
            paid_at,
            source_type,
            client:clients!professional_commissions_client_id_fkey(name)
          `)
          .eq('professional_id', professional.id)
          .eq('company_id', companyId)
          .gte('paid_at', startOfDay(appliedStartDate).toISOString())
          .lte('paid_at', endOfDay(appliedEndDate).toISOString())
      ]);

      const { data: appointments, error: appError } = appointmentsResponse;
      const { data: subscriptionCommissions, error: commError } = commissionsResponse;

      if (appError) throw appError;
      if (commError) throw commError;

      // Top Services
      const servicesMap: Record<string, { count: number; revenue: number }> = {};
      const clientsMap: Record<string, { count: number; revenue: number }> = {};

      const mappedAppointments = (appointments || [])
        .filter(a => status === 'all' || a.status === status)
        .map((a: any) => {
          const serviceNames = a.appointment_services?.map((as: any) => as.service?.name).filter(Boolean) || [];
          const displayServiceName = serviceNames.join(', ') || 'Serviço s/ nome';
          const clientName = (Array.isArray(a.client) ? a.client[0]?.name : a.client?.name) || a.client_name || 'Cliente s/ nome';
          const price = getAppointmentRevenue(a);

          // Calculate financials for this specific appointment
          const fin = calculateFinancials(
            price,
            serviceNames.length || 1,
            professional.type,
            professional.commType,
            professional.value,
            a.is_subscription_covered
          );

          // Contabilizar cada serviço individualmente no ranking
          serviceNames.forEach((sName: string) => {
            if (!servicesMap[sName]) servicesMap[sName] = { count: 0, revenue: 0 };
            servicesMap[sName].count += 1;
            servicesMap[sName].revenue += price / (serviceNames.length || 1);
          });

          if (!clientsMap[clientName]) clientsMap[clientName] = { count: 0, revenue: 0 };
          clientsMap[clientName].count += 1;
          clientsMap[clientName].revenue += price;
          
          return {
            ...a,
            displayServiceName,
            displayClientName: clientName,
            professionalValue: fin.professionalValue,
            companyValue: fin.companyValue,
            revenue: price,
            origin: 'Serviço'
          };
        });

      const mappedSubscriptions = (subscriptionCommissions || []).map((sc: any) => ({
        id: sc.id,
        displayClientName: (Array.isArray(sc.client) ? sc.client[0]?.name : sc.client?.name) || 'Assinante',
        displayServiceName: sc.description || 'Assinatura',
        start_time: sc.paid_at,
        revenue: Number(sc.gross_amount),
        professionalValue: Number(sc.commission_amount),
        companyValue: Number(sc.company_net_amount),
        origin: 'Assinatura',
        status: 'paid'
      }));

      const combinedHistory = [...mappedAppointments, ...mappedSubscriptions].sort((a, b) => 
        new Date(b.start_time).getTime() - new Date(a.start_time).getTime()
      );

      setDetails({
        topServices: Object.entries(servicesMap)
          .map(([name, stats]) => ({ name, ...stats }))
          .sort((a, b) => b.revenue - a.revenue)
          .slice(0, 5),
        topClients: Object.entries(clientsMap)
          .map(([name, stats]) => ({ name, ...stats }))
          .sort((a, b) => b.revenue - a.revenue)
          .slice(0, 5),
        history: combinedHistory,
      });
    } catch (err) {
      console.error('Error fetching professional details:', err);
    } finally {
      setLoading(false);
    }
  };


  const handleApplyFilter = () => {
    setAppliedStartDate(parseISO(localStartDate));
    setAppliedEndDate(parseISO(localEndDate));
    setCurrentPage(1);
  };

  const handleClearFilter = () => {
    const start = startDate;
    const end = endDate;
    setLocalStartDate(format(start, 'yyyy-MM-dd'));
    setLocalEndDate(format(end, 'yyyy-MM-dd'));
    setAppliedStartDate(start);
    setAppliedEndDate(end);
    setCurrentPage(1);
  };

  // Derived data for the period summary (always based on full filtered history)
  const periodSummary = useMemo(() => {
    return details.history.reduce((acc: any, h: any) => ({
      revenue: acc.revenue + h.revenue,
      professionalValue: acc.professionalValue + h.professionalValue,
      companyValue: acc.companyValue + h.companyValue,
    }), { revenue: 0, professionalValue: 0, companyValue: 0 });
  }, [details.history]);

  // Paginated history
  const totalPages = Math.ceil(details.history.length / itemsPerPage);
  const paginatedHistory = details.history.slice(
    (currentPage - 1) * itemsPerPage,
    currentPage * itemsPerPage
  );

  if (!professional) return null;

  return (
    <Sheet open={isOpen} onOpenChange={onClose}>
      <SheetContent className="sm:max-w-3xl md:max-w-4xl lg:max-w-[50vw] w-full p-0">
        <ScrollArea className="h-full">
          <div className="p-4 md:p-8">
            {/* 1. Cabeçalho do profissional */}
            <SheetHeader className="mb-8">
              <div className="flex items-center justify-between">
                <div>
                  <SheetTitle className="text-2xl font-display font-bold">{professional.name}</SheetTitle>
                  <p className="text-sm text-muted-foreground">
                    {collaboratorTypeLabel(professional.type)} • {professional.count} serviços realizados
                  </p>
                </div>
                <Badge variant="outline" className="px-3 py-1 font-semibold text-primary border-primary/20 bg-primary/5">
                  {remunerationLabel(professional.type, professional.commType, professional.value)}
                </Badge>
              </div>
            </SheetHeader>


            <div className="space-y-8">
              {/* 3. Filtro por data da drawer */}
              <section className="p-4 bg-muted/30 rounded-xl border border-muted-foreground/10">
                <div className="flex items-center gap-2 mb-4">
                  <CalendarDays className="h-4 w-4 text-primary" />
                  <h4 className="text-sm font-bold uppercase tracking-tight">Filtrar Detalhamento</h4>
                </div>
                <div className="flex flex-col sm:flex-row gap-3 items-end">
                  <div className="grid w-full items-center gap-1.5">
                    <label className="text-[10px] uppercase font-bold text-muted-foreground ml-1">Data Inicial</label>
                    <Input 
                      type="date" 
                      value={localStartDate} 
                      onChange={(e) => setLocalStartDate(e.target.value)}
                      className="bg-background"
                    />
                  </div>
                  <div className="grid w-full items-center gap-1.5">
                    <label className="text-[10px] uppercase font-bold text-muted-foreground ml-1">Data Final</label>
                    <Input 
                      type="date" 
                      value={localEndDate} 
                      onChange={(e) => setLocalEndDate(e.target.value)}
                      className="bg-background"
                    />
                  </div>
                  <div className="flex gap-2 w-full sm:w-auto">
                    <Button onClick={handleApplyFilter} className="flex-1 sm:flex-none">
                      <Search className="h-4 w-4 mr-2" />
                      Aplicar
                    </Button>
                    <Button variant="outline" onClick={handleClearFilter} className="flex-1 sm:flex-none">
                      <FilterX className="h-4 w-4 mr-2" />
                      Limpar
                    </Button>
                  </div>
                </div>
              </section>

              {/* 4. Resumo do período filtrado */}
              <section className="bg-primary/5 rounded-xl p-5 border border-primary/10">
                <h4 className="text-xs font-bold uppercase text-primary/70 mb-4 tracking-widest">Resumo do Período Filtrado</h4>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-6">
                  <div className="space-y-1">
                    <p className="text-[10px] text-muted-foreground uppercase font-bold">Total em Serviços</p>
                    <p className="text-lg font-display font-bold text-foreground">{maskValue(periodSummary.revenue)}</p>
                  </div>
                  <div className="space-y-1">
                    <p className="text-[10px] text-muted-foreground uppercase font-bold">Comissão</p>
                    <p className="text-lg font-display font-bold text-warning">{maskValue(periodSummary.professionalValue)}</p>
                  </div>
                  <div className="space-y-1">
                    <p className="text-[10px] text-muted-foreground uppercase font-bold">Empresa</p>
                    <p className="text-lg font-display font-bold text-green-600">{maskValue(periodSummary.companyValue)}</p>
                  </div>
                </div>
              </section>

              {/* 5. Detalhamento com tabela paginada */}
              <section>
                <div className="flex items-center justify-between mb-4">
                  <div className="flex items-center gap-2">
                    <History className="h-5 w-5 text-primary" />
                    <h3 className="font-display font-bold text-lg">Detalhamento</h3>
                  </div>
                  <Badge variant="secondary" className="text-[10px] uppercase font-bold">
                    {status === 'all' ? 'Todos' : status === 'completed' ? 'Concluídos' : status}
                  </Badge>
                </div>
                
                <div className="rounded-md border overflow-hidden hidden md:block w-full bg-card">
                  <div className="overflow-x-auto">
                    <Table className="w-full">
                      <TableHeader className="bg-muted/50">
                        <TableRow>
                          <TableHead className="text-[10px] uppercase font-bold px-4 py-3">Cliente</TableHead>
                          <TableHead className="text-[10px] uppercase font-bold px-4 py-3">Serviço</TableHead>
                          <TableHead className="text-[10px] uppercase font-bold px-4 py-3">Data</TableHead>
                          <TableHead className="text-[10px] uppercase font-bold text-right px-4 py-3">Valor</TableHead>
                          <TableHead className="text-[10px] uppercase font-bold text-center px-4 py-3">Com.</TableHead>
                          <TableHead className="text-[10px] uppercase font-bold text-right px-4 py-3">Com. R$</TableHead>
                          <TableHead className="text-[10px] uppercase font-bold text-right px-4 py-3">Empresa</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {loading ? (
                          <TableRow>
                            <TableCell colSpan={7} className="text-center py-12 text-muted-foreground">
                              Carregando detalhes...
                            </TableCell>
                          </TableRow>
                        ) : paginatedHistory.length === 0 ? (
                          <TableRow>
                            <TableCell colSpan={7} className="text-center text-xs py-12 text-muted-foreground">
                              Nenhum registro encontrado no período
                            </TableCell>
                          </TableRow>
                        ) : (
                          paginatedHistory.map((h: any) => (
                            <TableRow key={h.id} className="hover:bg-muted/30">
                              <TableCell className="text-[12px] font-medium py-4 px-4">
                                <span className="block max-w-[140px] leading-tight">
                                  {h.displayClientName}
                                </span>
                              </TableCell>
                              <TableCell className="text-[12px] py-4 px-4">
                                <span className="block max-w-[180px] leading-tight" title={h.displayServiceName}>
                                  {h.displayServiceName}
                                </span>
                              </TableCell>
                              <TableCell className="text-[11px] py-4 px-4 whitespace-nowrap text-muted-foreground">
                                {format(new Date(h.start_time), 'dd/MM/yy HH:mm')}
                              </TableCell>
                              <TableCell className="text-[12px] text-right py-4 px-4 font-medium">
                                {maskValue(h.revenue)}
                              </TableCell>
                              <TableCell className="text-[11px] text-center py-4 px-4 text-muted-foreground whitespace-nowrap">
                                {commissionLabel(professional.commType, professional.value)}
                              </TableCell>
                              <TableCell className="text-[12px] text-right py-4 px-4 font-bold text-warning">
                                {maskValue(h.professionalValue)}
                              </TableCell>
                              <TableCell className="text-[12px] text-right py-4 px-4 font-bold text-green-600">
                                {maskValue(h.companyValue)}
                              </TableCell>
                            </TableRow>
                          ))
                        )}
                      </TableBody>
                    </Table>
                  </div>
                </div>

                {/* Mobile View - Cards */}
                <div className="md:hidden space-y-3">
                  {loading ? (
                    <div className="text-center py-8 text-sm text-muted-foreground">Carregando...</div>
                  ) : paginatedHistory.length === 0 ? (
                    <div className="text-center py-8 text-sm text-muted-foreground border rounded-lg">
                      Nenhum registro encontrado
                    </div>
                  ) : (
                    paginatedHistory.map((h: any) => (
                      <div key={h.id} className="p-4 border rounded-xl bg-card space-y-3 shadow-sm">
                        <div className="flex justify-between items-start">
                          <div>
                            <p className="text-xs font-bold text-primary uppercase tracking-tight">{h.displayClientName}</p>
                            <p className="text-[11px] text-muted-foreground leading-snug mt-0.5">{h.displayServiceName}</p>
                          </div>
                          <p className="text-[10px] font-medium bg-muted px-2 py-0.5 rounded text-muted-foreground">
                            {format(new Date(h.start_time), 'dd/MM/yy HH:mm')}
                          </p>
                        </div>
                        <Separator className="opacity-50" />
                        <div className="grid grid-cols-3 gap-2 text-center">
                          <div className="bg-muted/30 p-2 rounded-lg">
                            <p className="text-[9px] uppercase text-muted-foreground font-bold mb-1">Valor</p>
                            <p className="text-[11px] font-bold">{maskValue(h.revenue)}</p>
                          </div>
                          <div className="bg-warning/5 p-2 rounded-lg">
                            <p className="text-[9px] uppercase text-muted-foreground font-bold mb-1">Comissão</p>
                            <p className="text-[11px] font-bold text-warning">{maskValue(h.professionalValue)}</p>
                          </div>
                          <div className="bg-green-500/5 p-2 rounded-lg">
                            <p className="text-[9px] uppercase text-muted-foreground font-bold mb-1">Empresa</p>
                            <p className="text-[11px] font-bold text-green-600">{maskValue(h.companyValue)}</p>
                          </div>
                        </div>
                      </div>
                    ))
                  )}
                </div>

                {/* Paginação */}
                {totalPages > 1 && (
                  <div className="flex items-center justify-between mt-6 bg-muted/20 p-3 rounded-lg border border-muted-foreground/10">
                    <p className="text-xs text-muted-foreground font-medium">
                      Página <span className="text-foreground font-bold">{currentPage}</span> de <span className="text-foreground font-bold">{totalPages}</span>
                    </p>
                    <div className="flex gap-2">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => setCurrentPage(prev => Math.max(1, prev - 1))}
                        disabled={currentPage === 1}
                        className="h-8 w-8 p-0"
                      >
                        <ChevronLeft className="h-4 w-4" />
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => setCurrentPage(prev => Math.min(totalPages, prev + 1))}
                        disabled={currentPage === totalPages}
                        className="h-8 w-8 p-0"
                      >
                        <ChevronRight className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                )}
              </section>

              <Separator />

              {/* 6. Ranking de Serviços */}
              <section>
                <div className="flex items-center gap-2 mb-4">
                  <TrendingUp className="h-5 w-5 text-primary" />
                  <h3 className="font-display font-bold text-lg">Ranking de Serviços</h3>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  {details.topServices.map((s: any, i: number) => (
                    <div key={i} className="flex items-center justify-between p-3 rounded-lg border bg-card/50">
                      <div className="flex items-center gap-3">
                        <div className="flex items-center justify-center h-8 w-8 rounded-full bg-primary/10 text-primary font-bold text-xs">
                          #{i + 1}
                        </div>
                        <div>
                          <p className="font-medium text-xs truncate max-w-[120px]">{s.name}</p>
                          <p className="text-[10px] text-muted-foreground">{s.count} vezes</p>
                        </div>
                      </div>
                      <p className="font-bold text-xs">{maskValue(s.revenue)}</p>
                    </div>
                  ))}
                </div>
              </section>

              <Separator />

              <section className="pb-10">
                <div className="flex items-center gap-2 mb-4">
                  <Users className="h-5 w-5 text-primary" />
                  <h3 className="font-display font-bold text-lg">Top Clientes</h3>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  {details.topClients.map((c: any, i: number) => (
                    <div key={i} className="flex items-center justify-between p-3 rounded-lg border bg-card/50">
                      <div className="flex items-center gap-3">
                        <div className="flex items-center justify-center h-8 w-8 rounded-full bg-secondary/10 text-secondary-foreground font-bold text-xs">
                          {c.name.charAt(0)}
                        </div>
                        <div>
                          <p className="font-medium text-xs">{c.name}</p>
                          <p className="text-[10px] text-muted-foreground">{c.count} atendimentos</p>
                        </div>
                      </div>
                      <p className="font-bold text-xs">{maskValue(c.revenue)}</p>
                    </div>
                  ))}
                </div>
              </section>
            </div>
          </div>
        </ScrollArea>
      </SheetContent>
    </Sheet>
  );
};
