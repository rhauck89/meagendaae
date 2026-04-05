import { useEffect, useState } from 'react';
import { formatServicesWithDuration } from '@/lib/format-services';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Calendar, Clock, X } from 'lucide-react';
import { format, parseISO, isPast } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';

const statusColors: Record<string, string> = {
  pending: 'bg-warning/10 text-warning',
  confirmed: 'bg-primary/10 text-primary',
  cancelled: 'bg-destructive/10 text-destructive',
  completed: 'bg-success/10 text-success',
  no_show: 'bg-muted text-muted-foreground',
};

const statusLabels: Record<string, string> = {
  pending: 'Pendente',
  confirmed: 'Confirmado',
  cancelled: 'Cancelado',
  completed: 'Concluído',
  no_show: 'Não compareceu',
};

const MyAppointments = () => {
  const { user } = useAuth();
  const [appointments, setAppointments] = useState<any[]>([]);

  useEffect(() => {
    if (user) fetchAppointments();
  }, [user]);

  const fetchAppointments = async () => {
    const { data: profile } = await supabase
      .from('profiles')
      .select('id')
      .eq('user_id', user!.id)
      .single();

    if (!profile) return;

    const { data } = await supabase
      .from('appointments')
      .select(`
        *,
        professional:profiles!appointments_professional_id_fkey(full_name),
        company:companies(name),
        appointment_services(*, service:services(name))
      `)
      .eq('client_id', profile.id)
      .order('start_time', { ascending: false });

    if (data) setAppointments(data);
  };

  const cancelAppointment = async (id: string) => {
    await supabase.from('appointments').update({ status: 'cancelled' as any }).eq('id', id);
    toast.success('Agendamento cancelado');
    fetchAppointments();
  };

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b bg-card">
        <div className="max-w-2xl mx-auto px-4 py-4">
          <h1 className="font-display font-bold text-xl">Meus Agendamentos</h1>
        </div>
      </header>
      <div className="max-w-2xl mx-auto px-4 py-6 space-y-4">
        {appointments.length === 0 ? (
          <div className="text-center py-12 text-muted-foreground">
            <Calendar className="h-12 w-12 mx-auto mb-3 opacity-40" />
            <p>Nenhum agendamento encontrado</p>
          </div>
        ) : (
          appointments.map((apt) => (
            <Card key={apt.id}>
              <CardContent className="p-4 space-y-3">
                <div className="flex items-center justify-between">
                  <p className="font-display font-bold">{apt.company?.name}</p>
                  <Badge variant="outline" className={cn('text-xs', statusColors[apt.status])}>
                    {statusLabels[apt.status]}
                  </Badge>
                </div>
                <div className="text-sm space-y-1">
                  <p className="flex items-center gap-2">
                    <Calendar className="h-4 w-4 text-muted-foreground" />
                    {format(parseISO(apt.start_time), "dd 'de' MMMM, yyyy", { locale: ptBR })}
                  </p>
                  <p className="flex items-center gap-2">
                    <Clock className="h-4 w-4 text-muted-foreground" />
                    {format(parseISO(apt.start_time), 'HH:mm')} - {format(parseISO(apt.end_time), 'HH:mm')}
                  </p>
                  <p className="text-muted-foreground">
                    com {apt.professional?.full_name}
                  </p>
                  <p className="text-muted-foreground">
                    {formatServicesWithDuration(apt.appointment_services)}
                  </p>
                </div>
                <div className="flex items-center justify-between pt-2 border-t">
                  <span className="font-display font-bold">R$ {Number(apt.total_price).toFixed(2)}</span>
                  {!isPast(parseISO(apt.start_time)) && apt.status !== 'cancelled' && apt.status !== 'completed' && (
                    <Button variant="ghost" size="sm" className="text-destructive" onClick={() => cancelAppointment(apt.id)}>
                      <X className="h-4 w-4 mr-1" /> Cancelar
                    </Button>
                  )}
                </div>
              </CardContent>
            </Card>
          ))
        )}
      </div>
    </div>
  );
};

export default MyAppointments;
