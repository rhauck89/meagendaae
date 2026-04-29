import { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { CheckCircle2, XCircle, AlertTriangle, Clock, Calendar, Scissors, User, Loader2 } from 'lucide-react';
import { format, parseISO } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { openWhatsApp } from '@/lib/whatsapp';
const T = {
  bg: '#0B132B',
  card: '#111827',
  accent: '#F59E0B',
  text: '#FFFFFF',
  textSec: '#9CA3AF',
  border: '#1F2937',
  green: 'rgba(34,197,94,0.15)',
  greenText: '#4ADE80',
  red: 'rgba(239,68,68,0.15)',
  redText: '#F87171',
};

const CancelAppointment = () => {
  const { appointmentId } = useParams<{ appointmentId: string }>();
  const navigate = useNavigate();
  const [appointment, setAppointment] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [cancelling, setCancelling] = useState(false);
  const [result, setResult] = useState<'success' | 'too_late' | 'already' | null>(null);
  const [companyPhone, setCompanyPhone] = useState<string | null>(null);

  useEffect(() => {
    if (appointmentId) fetchAppointment();
  }, [appointmentId]);

  const fetchAppointment = async () => {
    const { data, error } = await supabase.rpc('get_appointment_public', {
      p_appointment_id: appointmentId!,
    });

    if (data && !error) {
      setAppointment(data);
      setCompanyPhone((data as any).company?.phone || null);
      const status = (data as any).status;
      if (status === 'cancelled' || status === 'completed' || status === 'no_show') {
        setResult('already');
      }
    }
    setLoading(false);
  };

  const handleCancel = async () => {
    setCancelling(true);
    try {
      const { data, error } = await supabase.rpc('cancel_appointment_public', {
        p_appointment_id: appointmentId!,
      });

      if (error) {
        setResult('already');
        return;
      }

      const res = data as any;
      if (res.success) {
        setResult('success');

        // Notificação push agora é disparada automaticamente pelo backend via trigger
        console.log('Cancel push notification scheduled via backend');

        // Trigger waitlist check
        try {
          await supabase.functions.invoke('check-waitlist', {
            body: {
              company_id: res.company_id,
              professional_id: res.professional_id,
              cancelled_start: res.start_time,
              cancelled_end: res.end_time,
              cancelled_date: res.cancelled_date,
            },
          });
        } catch (e) {
          console.error('Waitlist check failed:', e);
        }
      } else if (res.reason === 'too_late') {
        setResult('too_late');
      }
    } catch {
      setResult('already');
    } finally {
      setCancelling(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center" style={{ background: T.bg, color: T.text }}>
        <Loader2 className="h-8 w-8 animate-spin" style={{ color: T.accent }} />
      </div>
    );
  }

  if (!appointment) {
    return (
      <div className="min-h-screen flex items-center justify-center" style={{ background: T.bg, color: T.text }}>
        <div className="text-center space-y-4">
          <XCircle className="h-16 w-16 mx-auto" style={{ color: T.redText }} />
          <h1 className="text-xl font-bold">Agendamento não encontrado</h1>
          <p style={{ color: T.textSec }}>Este link pode estar expirado ou inválido.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center p-4" style={{ background: T.bg, color: T.text }}>
      <div className="w-full max-w-md space-y-6">
        {/* Already cancelled/completed */}
        {result === 'already' && (
          <div className="text-center space-y-4">
            <div className="w-20 h-20 rounded-full mx-auto flex items-center justify-center" style={{ background: T.red }}>
              <AlertTriangle className="h-10 w-10" style={{ color: T.redText }} />
            </div>
            <h1 className="text-xl font-bold">Agendamento indisponível</h1>
            <p style={{ color: T.textSec }}>Este agendamento já foi cancelado, concluído ou não pode mais ser alterado.</p>
          </div>
        )}

        {/* Too late to cancel */}
        {result === 'too_late' && (
          <div className="text-center space-y-4">
            <div className="w-20 h-20 rounded-full mx-auto flex items-center justify-center" style={{ background: 'rgba(251,191,36,0.15)' }}>
              <Clock className="h-10 w-10" style={{ color: T.accent }} />
            </div>
            <h1 className="text-xl font-bold">Cancelamento não permitido</h1>
            <p style={{ color: T.textSec }}>
              O cancelamento deve ser feito com pelo menos <strong>1 hora de antecedência</strong>.
            </p>
            <p style={{ color: T.textSec }}>
              Entre em contato com a barbearia para solicitar o cancelamento.
            </p>
            {companyPhone && (
              <Button
                onClick={() => {
                  const phone = companyPhone.replace(/\D/g, '');
                  openWhatsApp(phone.startsWith('55') ? phone : '55' + phone, { source: 'cancel-appointment' });
                }}
                className="w-full rounded-xl py-5 font-semibold"
                style={{ background: '#25D366', color: '#fff' }}
              >
                📲 Contatar pelo WhatsApp
              </Button>
            )}
          </div>
        )}

        {/* Success */}
        {result === 'success' && (
          <div className="text-center space-y-4">
            <div className="w-20 h-20 rounded-full mx-auto flex items-center justify-center" style={{ background: T.green }}>
              <CheckCircle2 className="h-10 w-10" style={{ color: T.greenText }} />
            </div>
            <h1 className="text-xl font-bold">Cancelamento Confirmado</h1>
            <p style={{ color: T.textSec }}>Seu agendamento foi cancelado com sucesso.</p>

            <div className="rounded-2xl p-4 text-left space-y-2" style={{ background: T.card, border: `1px solid ${T.border}` }}>
              <p className="text-sm" style={{ color: T.textSec }}>Agendamento cancelado:</p>
              <p className="font-semibold text-sm">
                {format(parseISO(appointment.start_time), "dd 'de' MMMM, yyyy", { locale: ptBR })} às{' '}
                {format(parseISO(appointment.start_time), 'HH:mm')}
              </p>
              <p className="text-sm" style={{ color: T.textSec }}>
                Serviço: {appointment.appointment_services?.map((s: any) => s.service?.name).join(', ')}
              </p>
            </div>

            <Button
              onClick={() => {
                const profWhatsapp = appointment.professional?.whatsapp;
                const companyWhatsapp = appointment.company?.whatsapp;
                const rawPhone = (profWhatsapp || companyWhatsapp || '').replace(/\D/g, '');
                const phone = rawPhone.startsWith('55') ? rawPhone : '55' + rawPhone;
                const clientName = appointment.client_name || appointment.client?.name || 'Cliente';
                const services = appointment.appointment_services?.map((s: any) => s.service?.name).join(', ') || '';
                const dateStr = format(parseISO(appointment.start_time), "dd/MM/yyyy");
                const timeStr = format(parseISO(appointment.start_time), 'HH:mm');
                const msg = `Olá!\n\nUm cliente cancelou um horário.\n\nCliente: ${clientName}\n\nServiço: ${services}\n\nData:\n${dateStr} às ${timeStr}`;
                openWhatsApp(phone, { source: 'cancel-appointment', message: msg });
              }}
              className="w-full rounded-xl py-5 font-semibold"
              style={{ background: '#25D366', color: '#fff' }}
            >
              📲 Avisar o profissional
            </Button>

            <Button
              onClick={() => window.location.href = '/'}
              variant="ghost"
              className="w-full rounded-xl py-5"
              style={{ color: T.textSec }}
            >
              Voltar ao início
            </Button>
          </div>
        )}

        {/* Confirm cancellation */}
        {!result && (
          <>
            <div className="text-center">
              <h1 className="text-xl font-bold">Cancelar Agendamento</h1>
              <p className="text-sm mt-1" style={{ color: T.textSec }}>Tem certeza que deseja cancelar?</p>
            </div>

            <div className="rounded-2xl p-5 space-y-4" style={{ background: T.card, border: `1px solid ${T.border}` }}>
              <div className="flex items-center gap-3">
                <User className="h-5 w-5 shrink-0" style={{ color: T.accent }} />
                <div>
                  <p className="text-xs" style={{ color: T.textSec }}>Profissional</p>
                  <p className="font-semibold text-sm">{appointment.professional?.full_name}</p>
                </div>
              </div>
              <div className="flex items-center gap-3">
                <Scissors className="h-5 w-5 shrink-0" style={{ color: T.accent }} />
                <div>
                  <p className="text-xs" style={{ color: T.textSec }}>Serviços</p>
                  <p className="font-semibold text-sm">
                    {appointment.appointment_services?.map((s: any) => s.service?.name).join(', ')}
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-3">
                <Calendar className="h-5 w-5 shrink-0" style={{ color: T.accent }} />
                <div>
                  <p className="text-xs" style={{ color: T.textSec }}>Data e horário</p>
                  <p className="font-semibold text-sm">
                    {format(parseISO(appointment.start_time), "dd 'de' MMMM, yyyy", { locale: ptBR })} às{' '}
                    {format(parseISO(appointment.start_time), 'HH:mm')}
                  </p>
                </div>
              </div>
            </div>

            <div className="space-y-3">
              <Button
                onClick={handleCancel}
                disabled={cancelling}
                className="w-full rounded-xl py-5 font-semibold"
                variant="destructive"
              >
                {cancelling ? (
                  <><Loader2 className="h-4 w-4 mr-2 animate-spin" /> Cancelando...</>
                ) : (
                  <><XCircle className="h-4 w-4 mr-2" /> Confirmar Cancelamento</>
                )}
              </Button>
              <Button
                onClick={() => window.history.back()}
                variant="ghost"
                className="w-full rounded-xl py-5"
                style={{ color: T.textSec }}
              >
                Voltar
              </Button>
            </div>
          </>
        )}
      </div>
    </div>
  );
};

export default CancelAppointment;
