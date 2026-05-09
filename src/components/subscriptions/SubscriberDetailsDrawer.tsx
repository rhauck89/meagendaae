import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
} from '@/components/ui/sheet';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Separator } from '@/components/ui/separator';
import { Card, CardContent } from '@/components/ui/card';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import {
  User,
  CreditCard,
  Calendar,
  Clock,
  Scissors,
  DollarSign,
  History,
  Activity,
  CheckCircle2,
  XCircle,
  AlertCircle,
} from 'lucide-react';

interface SubscriberDetailsDrawerProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  subscriber: any;
  onStatusUpdate: (status: string) => void;
  onEdit: () => void;
}

export function SubscriberDetailsDrawer({
  open,
  onOpenChange,
  subscriber,
  onStatusUpdate,
  onEdit,
}: SubscriberDetailsDrawerProps) {
  if (!subscriber) return null;
  const usageRecords = [...(subscriber.usage || [])].sort(
    (a: any, b: any) => new Date(b.usage_date).getTime() - new Date(a.usage_date).getTime()
  );

  const getAppointmentStatusLabel = (status?: string) => {
    switch (status) {
      case 'completed':
        return 'Concluído';
      case 'confirmed':
        return 'Agendado';
      case 'pending':
        return 'Pendente';
      case 'cancelled':
        return 'Cancelado';
      default:
        return status || 'Registrado';
    }
  };

  const getAppointmentStatusClass = (status?: string) => {
    switch (status) {
      case 'completed':
        return 'bg-green-50 text-green-700 border-green-100';
      case 'confirmed':
        return 'bg-blue-50 text-blue-700 border-blue-100';
      case 'pending':
        return 'bg-amber-50 text-amber-700 border-amber-100';
      case 'cancelled':
        return 'bg-red-50 text-red-700 border-red-100';
      default:
        return 'bg-muted text-muted-foreground';
    }
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'active':
        return <Badge className="bg-green-100 text-green-700">Ativo</Badge>;
      case 'suspended':
        return <Badge className="bg-amber-100 text-amber-700">Suspenso</Badge>;
      case 'cancelled':
        return <Badge variant="destructive">Cancelado</Badge>;
      case 'past_due':
        return <Badge className="bg-red-100 text-red-700">Em Atraso</Badge>;
      default:
        return <Badge variant="secondary">{status}</Badge>;
    }
  };

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="sm:max-w-xl overflow-y-auto">
        <SheetHeader className="space-y-4 pr-6">
          <div className="flex justify-between items-start">
            <div className="flex items-center gap-4">
              <div className="h-12 w-12 rounded-full bg-primary/10 flex items-center justify-center">
                <User className="h-6 w-6 text-primary" />
              </div>
              <div>
                <SheetTitle className="text-xl">{subscriber.clients?.name}</SheetTitle>
                <SheetDescription>{subscriber.clients?.whatsapp}</SheetDescription>
              </div>
            </div>
            {getStatusBadge(subscriber.status)}
          </div>
          <div className="flex gap-2">
            <Button variant="outline" size="sm" onClick={onEdit} className="flex-1 gap-2">
              <Activity className="h-4 w-4" /> Editar Assinatura
            </Button>
            {subscriber.status !== 'active' && (
              <Button variant="default" size="sm" onClick={() => onStatusUpdate('active')} className="flex-1 gap-2">
                <CheckCircle2 className="h-4 w-4" /> Ativar
              </Button>
            )}
            {subscriber.status === 'active' && (
              <Button variant="outline" size="sm" onClick={() => onStatusUpdate('suspended')} className="flex-1 gap-2 text-amber-600">
                <XCircle className="h-4 w-4" /> Suspender
              </Button>
            )}
          </div>
        </SheetHeader>

        <div className="mt-8 space-y-6">
          <section className="space-y-3">
            <h3 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground flex items-center gap-2">
              <CreditCard className="h-4 w-4" /> Detalhes do Plano
            </h3>
            <Card className="border-none bg-muted/30 shadow-none">
              <CardContent className="p-4 space-y-3">
                <div className="flex justify-between items-center">
                  <span className="text-sm text-muted-foreground">Plano Atual</span>
                  <span className="font-semibold">{subscriber.subscription_plans?.name}</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-sm text-muted-foreground">Ciclo</span>
                  <Badge variant="outline" className="capitalize">
                    {subscriber.billing_cycle === 'monthly' ? 'Mensal' : 'Anual'}
                  </Badge>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-sm text-muted-foreground">Valor</span>
                  <span className="font-bold text-primary">
                    R$ {Number(subscriber.billing_cycle === 'monthly' ? subscriber.subscription_plans?.price_monthly : subscriber.subscription_plans?.price_yearly).toFixed(2)}
                  </span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-sm text-muted-foreground">Início</span>
                  <span className="text-sm">
                    {format(new Date(subscriber.start_date), "dd 'de' MMMM, yyyy", { locale: ptBR })}
                  </span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-sm text-muted-foreground">Dia de Cobrança</span>
                  <span className="text-sm">Todo dia {subscriber.billing_day}</span>
                </div>
              </CardContent>
            </Card>
          </section>

          <section className="space-y-3">
            <h3 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground flex items-center gap-2">
              <Scissors className="h-4 w-4" /> Gestão & Comissão
            </h3>
            <div className="grid grid-cols-2 gap-4">
              <div className="p-3 border rounded-lg bg-background">
                <p className="text-[10px] text-muted-foreground uppercase mb-1">Responsável</p>
                <p className="text-sm font-medium">{subscriber.professional?.full_name || '-'}</p>
              </div>
              <div className="p-3 border rounded-lg bg-background">
                <p className="text-[10px] text-muted-foreground uppercase mb-1">Comissão</p>
                <p className="text-sm font-medium">{subscriber.professional_commission}%</p>
              </div>
            </div>
          </section>

          <Separator />

          <section className="space-y-3">
            <h3 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground flex items-center gap-2">
              <History className="h-4 w-4" /> Histórico Financeiro
            </h3>
            <div className="space-y-2">
              {subscriber.charges && subscriber.charges.length > 0 ? (
                subscriber.charges.map((charge: any, idx: number) => (
                  <div key={idx} className="flex items-center justify-between p-3 bg-muted/20 rounded-lg border border-transparent hover:border-muted-foreground/10 transition-colors">
                    <div className="flex items-center gap-3">
                      {charge.status === 'paid' ? (
                        <CheckCircle2 className="h-4 w-4 text-green-500" />
                      ) : charge.status === 'overdue' ? (
                        <AlertCircle className="h-4 w-4 text-destructive" />
                      ) : (
                        <Clock className="h-4 w-4 text-amber-500" />
                      )}
                      <div className="flex flex-col">
                        <span className="text-sm font-medium">Parcela {idx + 1}</span>
                        <span className="text-[10px] text-muted-foreground">
                          Venc: {format(new Date(charge.due_date), 'dd/MM/yyyy')}
                        </span>
                      </div>
                    </div>
                    <Badge variant="outline" className={`text-[10px] ${
                      charge.status === 'paid' ? 'bg-green-50 text-green-700 border-green-100' : 
                      charge.status === 'overdue' ? 'bg-red-50 text-red-700 border-red-100' : 
                      'bg-amber-50 text-amber-700 border-amber-100'
                    }`}>
                      {charge.status === 'paid' ? 'Pago' : charge.status === 'overdue' ? 'Atrasado' : 'Pendente'}
                    </Badge>
                  </div>
                ))
              ) : (
                <p className="text-sm text-muted-foreground py-4 text-center border rounded-lg border-dashed">
                  Nenhuma cobrança registrada.
                </p>
              )}
            </div>
          </section>

          <section className="space-y-3">
            <h3 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground flex items-center gap-2">
              <Activity className="h-4 w-4" /> Utilização Recente
            </h3>
            <div className="space-y-2">
              {usageRecords.length === 0 ? (
                <p className="text-sm text-muted-foreground py-4 text-center border rounded-lg border-dashed">
                  Nenhum uso registrado neste ciclo.
                </p>
              ) : (
                usageRecords.slice(0, 8).map((usage: any) => {
                  const appointmentStatus = usage.appointments?.status;
                  return (
                    <div key={usage.id} className="flex items-center justify-between p-3 bg-muted/20 rounded-lg border border-transparent hover:border-muted-foreground/10 transition-colors">
                      <div className="flex items-center gap-3">
                        <Scissors className="h-4 w-4 text-primary" />
                        <div className="flex flex-col">
                          <span className="text-sm font-medium">{usage.services?.name || 'Serviço incluso'}</span>
                          <span className="text-[10px] text-muted-foreground">
                            {format(new Date(usage.usage_date), 'dd/MM/yyyy')}
                          </span>
                        </div>
                      </div>
                      <Badge variant="outline" className={`text-[10px] ${getAppointmentStatusClass(appointmentStatus)}`}>
                        {getAppointmentStatusLabel(appointmentStatus)}
                      </Badge>
                    </div>
                  );
                })
              )}
            </div>
          </section>
        </div>
      </SheetContent>
    </Sheet>
  );
}
