import { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { Star, CheckCircle2, Scissors, ExternalLink } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { format, parseISO } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { toast } from 'sonner';

const T = {
  bg: '#0B132B',
  card: '#111827',
  accent: '#F59E0B',
  text: '#FFFFFF',
  textSec: '#9CA3AF',
  border: '#1F2937',
  green: 'rgba(34,197,94,0.15)',
  greenText: '#4ADE80',
};

const ReviewPage = () => {
  const { appointmentId } = useParams<{ appointmentId: string }>();
  const [appointment, setAppointment] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [professionalRating, setProfessionalRating] = useState(0);
  const [barbershopRating, setBarbershopRating] = useState(0);
  const [comment, setComment] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [alreadyReviewed, setAlreadyReviewed] = useState(false);
  const [googleReviewUrl, setGoogleReviewUrl] = useState<string | null>(null);

  useEffect(() => {
    if (appointmentId) fetchAppointment();
  }, [appointmentId]);

  const fetchAppointment = async () => {
    try {
      const { data, error } = await supabase
        .from('appointments')
        .select(`
          *,
          professional:profiles!appointments_professional_id_fkey(full_name, avatar_url),
          company:companies(name, logo_url, google_review_url),
          appointment_services(*, service:services(name))
        `)
        .eq('id', appointmentId!)
        .single();

      if (error || !data) {
        setAppointment(null);
        setLoading(false);
        return;
      }

      setAppointment(data);
      setGoogleReviewUrl((data as any).company?.google_review_url || null);

      const { data: existingReview } = await supabase
        .from('reviews')
        .select('id')
        .eq('appointment_id', appointmentId!)
        .maybeSingle();

      if (existingReview) {
        setAlreadyReviewed(true);
      }
    } catch {
      setAppointment(null);
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async () => {
    if (!appointmentId || professionalRating < 1) return;
    setSubmitting(true);
    try {
      const { error } = await supabase.rpc('submit_review' as any, {
        p_appointment_id: appointmentId,
        p_rating: professionalRating,
        p_barbershop_rating: barbershopRating > 0 ? barbershopRating : null,
        p_comment: comment.trim() || null,
      });
      if (error) throw error;
      setSubmitted(true);
      toast.success('Avaliação enviada com sucesso!');
    } catch (err: any) {
      if (err.message?.includes('already been reviewed')) {
        setAlreadyReviewed(true);
        toast.error('Este atendimento já foi avaliado.');
      } else {
        toast.error(err.message || 'Erro ao enviar avaliação');
      }
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center" style={{ background: T.bg, color: T.text }}>
        <p>Carregando...</p>
      </div>
    );
  }

  if (!appointment) {
    return (
      <div className="min-h-screen flex items-center justify-center" style={{ background: T.bg, color: T.text }}>
        <div className="text-center space-y-3">
          <p className="text-xl font-bold">Agendamento não encontrado</p>
          <p style={{ color: T.textSec }}>O link de avaliação é inválido ou expirou.</p>
        </div>
      </div>
    );
  }

  const professionalName = appointment.professional?.full_name || 'Profissional';
  const companyName = appointment.company?.name || 'Estabelecimento';
  const serviceNames = appointment.appointment_services
    ?.map((as: any) => as.service?.name)
    .filter(Boolean)
    .join(', ') || '';

  // Post-submission: show thank you + conditional Google review invite
  if (submitted || alreadyReviewed) {
    const showGoogleInvite = submitted && professionalRating >= 4 && googleReviewUrl;

    return (
      <div className="min-h-screen flex items-center justify-center p-4" style={{ background: T.bg, color: T.text }}>
        <div className="max-w-md w-full text-center space-y-6">
          <div className="flex justify-center">
            <div className="w-20 h-20 rounded-full flex items-center justify-center" style={{ background: T.green }}>
              <CheckCircle2 className="h-10 w-10" style={{ color: T.greenText }} />
            </div>
          </div>
          <div>
            <h1 className="text-2xl font-bold">
              {alreadyReviewed && !submitted ? 'Já avaliado!' : 'Obrigado pela avaliação!'}
            </h1>
            <p className="text-sm mt-2" style={{ color: T.textSec }}>
              {alreadyReviewed && !submitted
                ? 'Este atendimento já foi avaliado anteriormente.'
                : 'Sua avaliação ajuda a melhorar nosso atendimento.'}
            </p>
          </div>
          {submitted && (
            <div className="flex justify-center gap-1">
              {[1, 2, 3, 4, 5].map((s) => (
                <Star key={s} className="h-6 w-6" style={{ color: s <= professionalRating ? T.accent : T.border, fill: s <= professionalRating ? T.accent : 'none' }} />
              ))}
            </div>
          )}

          {/* Google Review Invite — only for positive ratings (>= 4 stars) */}
          {showGoogleInvite && (
            <div className="rounded-2xl p-6 space-y-4 animate-fade-in" style={{ background: T.card, border: `1px solid ${T.border}` }}>
              <p className="text-lg font-semibold">Que bom que você gostou! 🙌</p>
              <p className="text-sm" style={{ color: T.textSec }}>
                Você poderia deixar essa avaliação no Google?{'\n'}
                Isso ajuda muito nossa barbearia.
              </p>
              <button
                onClick={() => window.open(googleReviewUrl!, '_blank')}
                className="w-full flex items-center justify-center gap-2 py-4 rounded-xl text-base font-semibold transition-all hover:scale-[1.02] hover:shadow-lg"
                style={{ background: T.accent, color: '#000' }}
              >
                <Star className="h-5 w-5 fill-current" /> Avaliar no Google
                <ExternalLink className="h-4 w-4 ml-1" />
              </button>
            </div>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen p-4" style={{ background: T.bg, color: T.text }}>
      <div className="max-w-md mx-auto space-y-6 pt-8">
        {/* Header */}
        <div className="text-center space-y-2">
          {appointment.company?.logo_url ? (
            <img src={appointment.company.logo_url} alt={companyName} className="h-16 w-16 mx-auto rounded-2xl object-cover" />
          ) : (
            <div className="w-16 h-16 mx-auto rounded-2xl flex items-center justify-center" style={{ background: `${T.accent}20` }}>
              <Scissors className="h-8 w-8" style={{ color: T.accent }} />
            </div>
          )}
          <h1 className="text-xl font-bold">Como foi seu atendimento?</h1>
          <p className="text-sm" style={{ color: T.textSec }}>{companyName}</p>
        </div>

        {/* Appointment details */}
        <div className="rounded-2xl p-4 space-y-3" style={{ background: T.card, border: `1px solid ${T.border}` }}>
          <div className="flex items-center gap-3">
            {appointment.professional?.avatar_url ? (
              <img src={appointment.professional.avatar_url} alt={professionalName} className="w-12 h-12 rounded-full object-cover" />
            ) : (
              <div className="w-12 h-12 rounded-full flex items-center justify-center text-lg font-bold" style={{ background: `${T.accent}20`, color: T.accent }}>
                {professionalName.charAt(0).toUpperCase()}
              </div>
            )}
            <div>
              <p className="font-semibold">{professionalName}</p>
              <p className="text-xs" style={{ color: T.textSec }}>{serviceNames}</p>
            </div>
          </div>
          <div className="text-xs" style={{ color: T.textSec }}>
            {format(parseISO(appointment.start_time), "dd 'de' MMMM, yyyy 'às' HH:mm", { locale: ptBR })}
          </div>
        </div>

        {/* Professional rating */}
        <div className="rounded-2xl p-5 space-y-4" style={{ background: T.card, border: `1px solid ${T.border}` }}>
          <p className="font-semibold text-center">Avalie o profissional</p>
          <p className="text-xs text-center" style={{ color: T.textSec }}>{professionalName}</p>
          <div className="flex justify-center gap-2">
            {[1, 2, 3, 4, 5].map((s) => (
              <button key={s} onClick={() => setProfessionalRating(s)} className="transition-all hover:scale-110">
                <Star className="h-10 w-10" style={{ color: s <= professionalRating ? T.accent : T.border, fill: s <= professionalRating ? T.accent : 'none' }} />
              </button>
            ))}
          </div>
        </div>

        {/* Barbershop rating */}
        <div className="rounded-2xl p-5 space-y-4" style={{ background: T.card, border: `1px solid ${T.border}` }}>
          <p className="font-semibold text-center">Avalie o estabelecimento</p>
          <p className="text-xs text-center" style={{ color: T.textSec }}>{companyName}</p>
          <div className="flex justify-center gap-2">
            {[1, 2, 3, 4, 5].map((s) => (
              <button key={s} onClick={() => setBarbershopRating(s)} className="transition-all hover:scale-110">
                <Star className="h-10 w-10" style={{ color: s <= barbershopRating ? T.accent : T.border, fill: s <= barbershopRating ? T.accent : 'none' }} />
              </button>
            ))}
          </div>
        </div>

        {/* Comment */}
        <div className="rounded-2xl p-5 space-y-3" style={{ background: T.card, border: `1px solid ${T.border}` }}>
          <p className="font-semibold text-sm">Deixe um comentário (opcional)</p>
          <textarea
            placeholder="Como foi sua experiência?"
            value={comment}
            onChange={(e) => setComment(e.target.value.slice(0, 500))}
            maxLength={500}
            rows={3}
            className="w-full rounded-xl px-4 py-3 text-sm resize-none outline-none placeholder:opacity-50"
            style={{ background: T.bg, border: `1px solid ${T.border}`, color: T.text }}
          />
          <p className="text-xs text-right" style={{ color: T.textSec }}>{comment.length}/500</p>
        </div>

        {/* Submit */}
        <Button
          disabled={submitting || professionalRating < 1}
          onClick={handleSubmit}
          className="w-full rounded-xl py-6 font-semibold text-base transition-all"
          style={{ background: professionalRating > 0 ? T.accent : T.border, color: professionalRating > 0 ? '#000' : T.textSec }}
        >
          {submitting ? 'Enviando...' : '⭐ Enviar avaliação'}
        </Button>
      </div>
    </div>
  );
};

export default ReviewPage;
