import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { formatServicesWithDuration } from '@/lib/format-services';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Calendar, Clock, X, User, LogOut } from 'lucide-react';
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
  const { user, signOut } = useAuth();
  const navigate = useNavigate();
  const [appointments, setAppointments] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (user) {
      linkAndFetch();
    } else {
      setLoading(false);
    }
  }, [user]);

  const linkAndFetch = async () => {
    setLoading(true);

    // Get user's phone from profile and link any unlinked client records
    const { data: profileData } = await supabase
      .from('profiles')
      .select('whatsapp')
      .eq('user_id', user!.id)
      .single();

    if (profileData?.whatsapp || user!.email) {
      await supabase.rpc('link_client_to_user', {
        p_user_id: user!.id,
        p_phone: profileData?.whatsapp || '',
        p_email: user!.email || '',
      } as any);
    }

    // Fetch client records linked to this user
    const { data: clientData } = await supabase
      .from('clients')
      .select('id')
      .eq('user_id', user!.id);

    if (!clientData || clientData.length === 0) {
      // No linked client → redirect to portal so the user can complete registration
      navigate('/minha-conta?complete=1', { replace: true });
      return;
    }

    const clientIds = clientData.map(c => c.id);

    const { data } = await supabase
      .from('appointments')
      .select(`
        *,
        professional:profiles!appointments_professional_id_fkey(full_name),
        company:companies(name),
        appointment_services(*, service:services(name))
      `)
      .in('client_id', clientIds)
      .order('start_time', { ascending: false });

    if (data) setAppointments(data);
    setLoading(false);
  };

  const cancelAppointment = async (id: string) => {
    await supabase.from('appointments').update({ status: 'cancelled' as any }).eq('id', id);
    toast.success('Agendamento cancelado');
    linkAndFetch();
  };

  // Unauthenticated state
  if (!user && !loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background p-4">
        <div className="w-full max-w-sm text-center space-y-5">
          <User className="h-16 w-16 mx-auto text-primary/60" />
          <div>
            <h2 className="text-xl font-bold">Seus Agendamentos</h2>
            <p className="text-muted-foreground text-sm mt-2">
              Faça login para ver seus agendamentos e acompanhar seu histórico.
            </p>
          </div>
          <div className="space-y-3">
            <Button onClick={() => navigate('/cliente/auth?tab=login')} className="w-full">
              Fazer login
            </Button>
            <Button variant="outline" onClick={() => navigate('/cliente/auth?tab=signup')} className="w-full">
              Criar conta
            </Button>
          </div>
          <Button variant="ghost" className="w-full text-sm" onClick={() => navigate('/')}>
            Voltar ao início
          </Button>
        </div>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <p className="text-muted-foreground">Carregando...</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b bg-card">
        <div className="max-w-2xl mx-auto px-4 py-4 flex items-center justify-between">
          <h1 className="font-display font-bold text-xl">Meus Agendamentos</h1>
          <Button variant="ghost" size="icon" onClick={signOut}>
            <LogOut className="h-5 w-5" />
          </Button>
        </div>
      </header>
      <div className="max-w-2xl mx-auto px-4 py-6 space-y-4">
        {appointments.length === 0 ? (
          <div className="text-center py-12 text-muted-foreground space-y-4">
            <Calendar className="h-12 w-12 mx-auto mb-3 opacity-40" />
            <p className="font-semibold text-foreground">Você ainda não possui agendamentos</p>
            <p className="text-sm">
              Que tal agendar seu primeiro horário?
            </p>
            <Button onClick={() => navigate('/')}>
              Agendar agora
            </Button>
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
