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
import { TrendingUp, Users, Scissors, History, DollarSign } from 'lucide-react';

interface ProfessionalDrawerProps {
  professional: any;
  isOpen: boolean;
  onClose: () => void;
  startDate: Date;
  endDate: Date;
}

export const ProfessionalDrawer = ({
  professional,
  isOpen,
  onClose,
  startDate,
  endDate,
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
      const { data: appointments, error } = await supabase
        .from('appointments')
        .select(`
          id,
          total_price,
          start_time,
          client:profiles!appointments_client_id_fkey(full_name),
          service:services(name)
        `)
        .eq('professional_id', professional.id)
        .eq('status', 'completed')
        .gte('start_time', startDate.toISOString())
        .lte('start_time', endDate.toISOString())
        .order('start_time', { ascending: false });

      if (error) throw error;

      // Top Services
      const servicesMap: Record<string, { count: number; revenue: number }> = {};
      const clientsMap: Record<string, { count: number; revenue: number }> = {};

      appointments?.forEach((a: any) => {
        const serviceName = a.service?.name || 'Serviço s/ nome';
        const clientName = a.client?.full_name || 'Cliente s/ nome';
        const price = Number(a.total_price);

        if (!servicesMap[serviceName]) servicesMap[serviceName] = { count: 0, revenue: 0 };
        servicesMap[serviceName].count += 1;
        servicesMap[serviceName].revenue += price;

        if (!clientsMap[clientName]) clientsMap[clientName] = { count: 0, revenue: 0 };
        clientsMap[clientName].count += 1;
        clientsMap[clientName].revenue += price;
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
                  <p className="text-sm text-muted-foreground capitalize">
                    {professional.type} • {professional.count} serviços realizados
                  </p>
                </div>
                <Badge variant="secondary" className="px-3 py-1">
                  ID: {professional.id.slice(0, 8)}
                </Badge>
              </div>
            </SheetHeader>

            <div className="grid grid-cols-2 gap-4 mb-8">
              <Card className="bg-primary/5 border-none shadow-none">
                <CardContent className="p-4">
                  <p className="text-xs text-muted-foreground mb-1 uppercase tracking-wider font-semibold">Faturado</p>
                  <p className="text-xl font-display font-bold text-primary">{maskValue(professional.revenue)}</p>
                </CardContent>
              </Card>
              <Card className="bg-warning/5 border-none shadow-none">
                <CardContent className="p-4">
                  <p className="text-xs text-muted-foreground mb-1 uppercase tracking-wider font-semibold">Sua Comissão</p>
                  <p className="text-xl font-display font-bold text-warning">{maskValue(professional.professionalValue)}</p>
                </CardContent>
              </Card>
            </div>

            <div className="space-y-8">
              {/* Analytics */}
              <section>
                <div className="flex items-center gap-2 mb-4">
                  <TrendingUp className="h-5 w-5 text-primary" />
                  <h3 className="font-display font-bold text-lg">Ranking de Serviços</h3>
                </div>
                <div className="space-y-3">
                  {details.topServices.map((s: any, i: number) => (
                    <div key={i} className="flex items-center justify-between p-3 rounded-lg border bg-card/50">
                      <div className="flex items-center gap-3">
                        <div className="flex items-center justify-center h-8 w-8 rounded-full bg-primary/10 text-primary font-bold text-xs">
                          #{i + 1}
                        </div>
                        <div>
                          <p className="font-medium text-sm">{s.name}</p>
                          <p className="text-xs text-muted-foreground">{s.count} vezes</p>
                        </div>
                      </div>
                      <p className="font-semibold text-sm">{maskValue(s.revenue)}</p>
                    </div>
                  ))}
                </div>
              </section>

              <Separator />

              <section>
                <div className="flex items-center gap-2 mb-4">
                  <Users className="h-5 w-5 text-primary" />
                  <h3 className="font-display font-bold text-lg">Top Clientes</h3>
                </div>
                <div className="space-y-3">
                  {details.topClients.map((c: any, i: number) => (
                    <div key={i} className="flex items-center justify-between p-3 rounded-lg border bg-card/50">
                      <div className="flex items-center gap-3">
                        <div className="flex items-center justify-center h-8 w-8 rounded-full bg-secondary/10 text-secondary-foreground font-bold text-xs">
                          {c.name.charAt(0)}
                        </div>
                        <div>
                          <p className="font-medium text-sm">{c.name}</p>
                          <p className="text-xs text-muted-foreground">{c.count} atendimentos</p>
                        </div>
                      </div>
                      <p className="font-semibold text-sm">{maskValue(c.revenue)}</p>
                    </div>
                  ))}
                </div>
              </section>

              <Separator />

              <section className="pb-10">
                <div className="flex items-center gap-2 mb-4">
                  <History className="h-5 w-5 text-primary" />
                  <h3 className="font-display font-bold text-lg">Histórico do Período</h3>
                </div>
                <div className="rounded-md border overflow-hidden">
                  <Table>
                    <TableHeader className="bg-muted/50">
                      <TableRow>
                        <TableHead className="text-xs">Data</TableHead>
                        <TableHead className="text-xs">Serviço</TableHead>
                        <TableHead className="text-right text-xs">Valor</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {details.history.length === 0 ? (
                        <TableRow>
                          <TableCell colSpan={3} className="text-center text-xs py-8 text-muted-foreground">
                            Nenhum registro
                          </TableCell>
                        </TableRow>
                      ) : (
                        details.history.map((h: any) => (
                          <TableRow key={h.id}>
                            <TableCell className="text-xs">
                              {format(new Date(h.start_time), 'dd/MM HH:mm')}
                            </TableCell>
                            <TableCell className="text-xs font-medium truncate max-w-[120px]">
                              {h.service?.name}
                            </TableCell>
                            <TableCell className="text-right text-xs font-semibold">
                              {maskValue(h.total_price)}
                            </TableCell>
                          </TableRow>
                        ))
                      )}
                    </TableBody>
                  </Table>
                </div>
              </section>
            </div>
          </div>
        </ScrollArea>
      </SheetContent>
    </Sheet>
  );
};
