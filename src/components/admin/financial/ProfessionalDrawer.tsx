import { useState, useEffect } from 'react';
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
import { useFinancialPrivacy } from '@/contexts/FinancialPrivacyContext';
import { supabase } from '@/integrations/supabase/client';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { TrendingUp, Users, History, DollarSign, Wallet } from 'lucide-react';
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
  const [details, setDetails] = useState<any>({
    topServices: [],
    topClients: [],
    history: [],
  });

  useEffect(() => {
    if (isOpen && professional?.id) {
      fetchProfessionalDetails();
    }
  }, [isOpen, professional, startDate, endDate]);

  const fetchProfessionalDetails = async () => {
    setLoading(true);
    try {
      let query = supabase
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
          client:clients!appointments_client_id_fkey(name),
          appointment_services(
            service:services(name)
          )
        `)
        .eq('professional_id', professional.id)
        .eq('company_id', companyId)
        .gte('start_time', startDate.toISOString())
        .lte('start_time', endDate.toISOString());

      if (status !== 'all') {
        query = query.eq('status', status as any);
      }

      const { data: appointments, error } = await query.order('start_time', { ascending: false });

      if (error) throw error;

      // Top Services
      const servicesMap: Record<string, { count: number; revenue: number }> = {};
      const clientsMap: Record<string, { count: number; revenue: number }> = {};

      appointments?.forEach((a: any) => {
        const serviceNames = a.appointment_services?.map((as: any) => as.service?.name).filter(Boolean) || [];
        const displayServiceName = serviceNames.join(', ') || 'Serviço s/ nome';
        const clientName = (Array.isArray(a.client) ? a.client[0]?.name : a.client?.name) || a.client_name || 'Cliente s/ nome';
        const price = getAppointmentRevenue(a);

        // Calculate financials for this specific appointment
        const fin = calculateFinancials(
          price,
          1, // Using 1 for fixed commission per appointment, or we could use serviceNames.length
          professional.type,
          professional.commType,
          professional.value
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
        
        // Adicionamos os dados calculados para o histórico
        a.displayServiceName = displayServiceName;
        a.displayClientName = clientName;
        a.professionalValue = fin.professionalValue;
        a.companyValue = fin.companyValue;
        a.revenue = price;
      });

      setDetails({
        topServices: Object.entries(servicesMap)
          .map(([name, stats]) => ({ name, ...stats }))
          .sort((a, b) => b.revenue - a.revenue)
          .slice(0, 5),
        topClients: Object.entries(clientsMap)
          .map(([name, stats]) => ({ name, ...stats }))
          .sort((a, b) => b.revenue - a.revenue)
          .slice(0, 5),
        history: appointments || [],
      });
    } catch (err) {
      console.error('Error fetching professional details:', err);
    } finally {
      setLoading(false);
    }
  };

  if (!professional) return null;

  return (
    <Sheet open={isOpen} onOpenChange={onClose}>
      <SheetContent className="sm:max-w-xl w-full p-0">
        <ScrollArea className="h-full">
          <div className="p-6">
            <SheetHeader className="mb-6">
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

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mb-8">
              <Card className="bg-primary/5 border-none shadow-none">
                <CardContent className="p-3">
                  <p className="text-[10px] text-muted-foreground mb-1 uppercase tracking-wider font-bold">Faturado</p>
                  <p className="text-lg font-display font-bold text-primary">{maskValue(professional.revenue)}</p>
                </CardContent>
              </Card>
              <Card className="bg-warning/5 border-none shadow-none">
                <CardContent className="p-3">
                  <p className="text-[10px] text-muted-foreground mb-1 uppercase tracking-wider font-bold">Comissão Total</p>
                  <p className="text-lg font-display font-bold text-warning">{maskValue(professional.professionalValue)}</p>
                </CardContent>
              </Card>
              <Card className="bg-green-500/5 border-none shadow-none">
                <CardContent className="p-3">
                  <p className="text-[10px] text-muted-foreground mb-1 uppercase tracking-wider font-bold">Net Empresa</p>
                  <p className="text-lg font-display font-bold text-green-600">{maskValue(professional.companyValue)}</p>
                </CardContent>
              </Card>
            </div>

            <div className="space-y-8">
              {/* Detalhamento dos Atendimentos */}
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
                
                <div className="rounded-md border overflow-hidden hidden md:block">
                  <Table>
                    <TableHeader className="bg-muted/50">
                      <TableRow>
                        <TableHead className="text-[10px] uppercase font-bold">Cliente</TableHead>
                        <TableHead className="text-[10px] uppercase font-bold">Serviço</TableHead>
                        <TableHead className="text-[10px] uppercase font-bold">Data</TableHead>
                        <TableHead className="text-[10px] uppercase font-bold text-right">Valor</TableHead>
                        <TableHead className="text-[10px] uppercase font-bold text-center">Com.</TableHead>
                        <TableHead className="text-[10px] uppercase font-bold text-right">Com. R$</TableHead>
                        <TableHead className="text-[10px] uppercase font-bold text-right">Empresa</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {details.history.length === 0 ? (
                        <TableRow>
                          <TableCell colSpan={7} className="text-center text-xs py-8 text-muted-foreground">
                            Nenhum registro encontrado no período
                          </TableCell>
                        </TableRow>
                      ) : (
                        details.history.map((h: any) => (
                          <TableRow key={h.id} className="hover:bg-muted/30">
                            <TableCell className="text-[11px] font-medium py-2">
                              {h.displayClientName}
                            </TableCell>
                            <TableCell className="text-[11px] py-2">
                              <span className="truncate max-w-[100px] block" title={h.displayServiceName}>
                                {h.displayServiceName}
                              </span>
                            </TableCell>
                            <TableCell className="text-[10px] py-2 whitespace-nowrap">
                              {format(new Date(h.start_time), 'dd/MM/yy HH:mm')}
                            </TableCell>
                            <TableCell className="text-[11px] text-right py-2">
                              {maskValue(h.revenue)}
                            </TableCell>
                            <TableCell className="text-[10px] text-center py-2 text-muted-foreground">
                              {commissionLabel(professional.commType, professional.value)}
                            </TableCell>
                            <TableCell className="text-[11px] text-right py-2 font-medium text-warning">
                              {maskValue(h.professionalValue)}
                            </TableCell>
                            <TableCell className="text-[11px] text-right py-2 font-medium text-green-600">
                              {maskValue(h.companyValue)}
                            </TableCell>
                          </TableRow>
                        ))
                      )}
                    </TableBody>
                  </Table>
                </div>

                {/* Mobile View - Cards */}
                <div className="md:hidden space-y-3">
                  {details.history.length === 0 ? (
                    <div className="text-center py-8 text-sm text-muted-foreground border rounded-lg">
                      Nenhum registro encontrado
                    </div>
                  ) : (
                    details.history.map((h: any) => (
                      <div key={h.id} className="p-3 border rounded-lg bg-card space-y-2">
                        <div className="flex justify-between items-start">
                          <div>
                            <p className="text-xs font-bold text-primary uppercase tracking-tight">{h.displayClientName}</p>
                            <p className="text-[11px] text-muted-foreground">{h.displayServiceName}</p>
                          </div>
                          <p className="text-[10px] font-medium bg-muted px-1.5 py-0.5 rounded">
                            {format(new Date(h.start_time), 'dd/MM/yy HH:mm')}
                          </p>
                        </div>
                        <Separator className="opacity-50" />
                        <div className="grid grid-cols-3 gap-2 text-center">
                          <div>
                            <p className="text-[9px] uppercase text-muted-foreground">Valor</p>
                            <p className="text-[11px] font-bold">{maskValue(h.revenue)}</p>
                          </div>
                          <div>
                            <p className="text-[9px] uppercase text-muted-foreground">Comissão</p>
                            <p className="text-[11px] font-bold text-warning">{maskValue(h.professionalValue)}</p>
                          </div>
                          <div>
                            <p className="text-[9px] uppercase text-muted-foreground">Empresa</p>
                            <p className="text-[11px] font-bold text-green-600">{maskValue(h.companyValue)}</p>
                          </div>
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </section>

              <Separator />

              {/* Ranking de Serviços */}
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
          </div>
        </ScrollArea>
      </SheetContent>
    </Sheet>
  );
};
