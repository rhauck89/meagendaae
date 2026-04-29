import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { formatServicesWithDuration } from '@/lib/format-services';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Calendar, Clock, X, User, LogOut } from 'lucide-react';
import { UnifiedAppointmentCard } from '@/components/appointments/UnifiedAppointmentCard';
import { format, parseISO, isPast } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';

const MyAppointments = () => {
  const { user, signOut: authSignOut, isAdmin } = useAuth();
  const navigate = useNavigate();

  // Custom signOut to handle admin vs client sessions
  const signOut = async () => {
    if (isAdmin) {
      // Find any active whatsapp sessions in localStorage
      const keys = Object.keys(localStorage).filter(k => k.startsWith('whatsapp_session_'));
      keys.forEach(id => {
        localStorage.removeItem(id);
      });
      toast.success('Sessão de cliente encerrada');
      window.location.reload();
    } else {
      await authSignOut();
    }
  };
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

    const currentUserId = isAdmin ? null : user?.id;

    // Get user's phone from profile and link any unlinked client records
    // Skip for admins
    if (currentUserId) {
      const { data: profileData } = await supabase
        .from('profiles')
        .select('whatsapp')
        .eq('user_id', currentUserId)
        .single();

      if (profileData?.whatsapp || user!.email) {
        await supabase.rpc('link_client_to_user', {
          p_user_id: currentUserId,
          p_phone: profileData?.whatsapp || '',
          p_email: user!.email || '',
        } as any);
      }
    }

    // Admin context check
    let adminClientContext: any = null;
    if (isAdmin) {
      const keys = Object.keys(localStorage).filter(k => k.startsWith('whatsapp_session_'));
      if (keys.length > 0) {
        try {
          adminClientContext = JSON.parse(localStorage.getItem(keys[0]) || '{}');
        } catch (e) { /* ignore */ }
      }
    }

    // Direct query for isolation
    const { data, error } = await supabase
      .from('appointments')
      .select(`
        *,
        professional:profiles!appointments_professional_id_fkey(full_name),
        company:companies(name),
        appointment_services(*, service:services(name))
      `)
      .or(isAdmin && adminClientContext?.whatsapp ? `whatsapp.eq.${adminClientContext.whatsapp}${adminClientContext.email ? `,client_email.eq.${adminClientContext.email}` : ''}` : `user_id.eq.${currentUserId || '00000000-0000-0000-0000-000000000000'}`)
      .order('start_time', { ascending: false });

    if (error) {
      console.error('[MyAppointments] fetch error:', error);
    }

    if (data) setAppointments(data);
    
    // Check if user has any linked client records at all
    const { data: clientData } = await supabase
      .from('clients')
      .select('id')
      .eq('user_id', user!.id)
      .limit(1);

    if (!clientData || clientData.length === 0) {
      // No linked client → redirect to portal so the user can complete registration
      navigate('/minha-conta?complete=1', { replace: true });
      return;
    }
    
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
            <UnifiedAppointmentCard
              key={apt.id}
              appointment={apt}
              isAdmin={false}
              showCompany={true}
              onCancel={(apt) => cancelAppointment(apt.id)}
            />
          ))
        )}
      </div>
    </div>
  );
};

export default MyAppointments;
