import { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { Star, CheckCircle2, Scissors, ExternalLink, Sparkles } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { format, parseISO } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { toast } from 'sonner';

const T = {
  bg: '#0B132B',
  card: '#111827',
  cardSoft: '#0F1A33',
  accent: '#F59E0B',
  accentSoft: 'rgba(245,158,11,0.12)',
  text: '#FFFFFF',
  textSec: '#9CA3AF',
  border: '#1F2937',
  green: 'rgba(34,197,94,0.15)',
  greenText: '#4ADE80',
};

const StarRow = ({
  value,
  onChange,
  size = 40,
}: {
  value: number;
  onChange?: (v: number) => void;
  size?: number;
}) => (
  <div className="flex justify-center gap-2">
    {[1, 2, 3, 4, 5].map((s) => (
      <button
        key={s}
        type="button"
        onClick={() => onChange?.(s)}
        disabled={!onChange}
        className="transition-transform hover:scale-110 active:scale-95 disabled:cursor-default disabled:hover:scale-100"
        aria-label={`${s} estrela${s > 1 ? 's' : ''}`}
      >
        <Star
          style={{
            color: s <= value ? T.accent : T.border,
            fill: s <= value ? T.accent : 'none',
            height: size,
            width: size,
          }}
        />
      </button>
    ))}
  </div>
);

const ReviewPage = () => {
  const { appointmentId } = useParams<{ appointmentId: string }>();
  const [appointment, setAppointment] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [professionalRating, setProfessionalRating] = useState(0);
  const [barbershopRating, setBarbershopRating] = useState(0);
  const [comment, setComment] = useState('');
  const [barbershopComment, setBarbershopComment] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [alreadyReviewed, setAlreadyReviewed] = useState(false);
  const [googleReviewUrl, setGoogleReviewUrl] = useState<string | null>(null);

  useEffect(() => {
    if (appointmentId) fetchAppointment();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [appointmentId]);

  const fetchAppointment = async () => {
    try {
      // Use SECURITY DEFINER RPC so anonymous review links work regardless of RLS / auth state
      const { data, error } = await supabase.rpc('get_appointment_public', {
        p_appointment_id: appointmentId!,
      });

      if (error) {
        console.error('[ReviewPage] RPC get_appointment_public error:', error);
      }

      if (!data) {
        console.warn('[ReviewPage] No appointment returned for id:', appointmentId);
        setAppointment(null);
        setLoading(false);
        return;
      }

      setAppointment(data);
      setGoogleReviewUrl((data as any).company?.google_review_url || null);

      // Best-effort: check existing review, but never fail the page if this errors
      try {
        const { data: existingReview } = await supabase
          .from('reviews')
          .select('id')
          .eq('appointment_id', appointmentId!)
          .maybeSingle();
        if (existingReview) setAlreadyReviewed(true);
      } catch (innerErr) {
        console.warn('[ReviewPage] Existing-review lookup failed (non-fatal):', innerErr);
      }
    } catch (err) {
      console.error('[ReviewPage] Unexpected error loading appointment:', err);
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
        p_comment: comment.trim() || null,
        p_barbershop_rating: barbershopRating > 0 ? barbershopRating : null,
        p_barbershop_comment: barbershopComment.trim() || null,
      });
      if (error) throw error;
      setSubmitted(true);
      toast.success('Avaliação enviada com sucesso!');
    } catch (err: any) {
      if (err.message?.includes('already been reviewed')) {
        setAlreadyReviewed(true);
        toast.error('Esta visita já foi avaliada.');
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
        <div className="flex flex-col items-center gap-3">
          <div className="w-10 h-10 rounded-full border-2 animate-spin" style={{ borderColor: T.border, borderTopColor: T.accent }} />
          <p className="text-sm" style={{ color: T.textSec }}>Carregando...</p>
        </div>
      </div>
    );
  }

  if (!appointment) {
    return (
      <div className="min-h-screen flex items-center justify-center p-4" style={{ background: T.bg, color: T.text }}>
        <div className="text-center space-y-3 max-w-sm">
          <p className="text-xl font-bold">Agendamento não encontrado</p>
          <p style={{ color: T.textSec }}>O link de avaliação é inválido ou expirou.</p>
        </div>
      </div>
    );
  }

  const professionalName = appointment.professional?.full_name || 'Profissional';
  const companyName = appointment.company?.name || 'Estabelecimento';
  const serviceNames =
    appointment.appointment_services
      ?.map((as: any) => as.service?.name)
      .filter(Boolean)
      .join(', ') || '';

  // Post-submission view
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
              {alreadyReviewed && !submitted ? 'Esta visita já foi avaliada 💛' : 'Obrigado! 🙏'}
            </h1>
            <p className="text-sm mt-2" style={{ color: T.textSec }}>
              {alreadyReviewed && !submitted
                ? 'Recebemos sua opinião anteriormente. Agradecemos por compartilhar.'
                : 'Sua opinião ajuda muito a melhorar nosso atendimento.'}
            </p>
          </div>

          {submitted && (
            <div className="flex justify-center gap-1">
              {[1, 2, 3, 4, 5].map((s) => (
                <Star
                  key={s}
                  className="h-6 w-6"
                  style={{
                    color: s <= professionalRating ? T.accent : T.border,
                    fill: s <= professionalRating ? T.accent : 'none',
                  }}
                />
              ))}
            </div>
          )}

          {showGoogleInvite && (
            <div
              className="rounded-2xl p-6 space-y-4 animate-fade-in"
              style={{ background: T.card, border: `1px solid ${T.border}` }}
            >
              <p className="text-lg font-semibold">Que bom que você gostou! 🙌</p>
              <p className="text-sm" style={{ color: T.textSec }}>
                Você poderia deixar essa avaliação também no Google? Isso ajuda muito o {companyName}.
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

  // Progress indicator: 0 (nada) -> 50 (prof) -> 100 (prof + empresa)
  const progress =
    professionalRating > 0 && barbershopRating > 0 ? 100 : professionalRating > 0 ? 60 : 0;

  return (
    <div className="min-h-screen p-4 pb-24" style={{ background: T.bg, color: T.text }}>
      <div className="max-w-md mx-auto space-y-5 pt-6">
        {/* Header — premium welcome */}
        <div className="text-center space-y-3">
          {appointment.company?.logo_url ? (
            <img
              src={appointment.company.logo_url}
              alt={companyName}
              className="h-16 w-16 mx-auto rounded-2xl object-cover shadow-lg"
            />
          ) : (
            <div
              className="w-16 h-16 mx-auto rounded-2xl flex items-center justify-center"
              style={{ background: T.accentSoft }}
            >
              <Scissors className="h-8 w-8" style={{ color: T.accent }} />
            </div>
          )}
          <div className="space-y-1">
            <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-medium" style={{ background: T.accentSoft, color: T.accent }}>
              <Sparkles className="h-3 w-3" /> Sua opinião importa
            </div>
            <h1 className="text-2xl font-bold leading-tight pt-1">Obrigado pela sua visita 💛</h1>
            <p className="text-sm" style={{ color: T.textSec }}>
              Você foi atendido por <span className="font-semibold" style={{ color: T.text }}>{professionalName}</span>{' '}
              no <span className="font-semibold" style={{ color: T.text }}>{companyName}</span>.
            </p>
          </div>
        </div>

        {/* Progress bar */}
        <div className="space-y-1.5">
          <div className="flex justify-between items-center text-xs" style={{ color: T.textSec }}>
            <span>Leva menos de 30 segundos</span>
            <span>{progress}%</span>
          </div>
          <div className="h-1.5 w-full rounded-full overflow-hidden" style={{ background: T.border }}>
            <div
              className="h-full rounded-full transition-all duration-500"
              style={{ width: `${progress}%`, background: T.accent }}
            />
          </div>
        </div>

        {/* Appointment summary */}
        <div className="rounded-2xl p-4 flex items-center gap-3" style={{ background: T.card, border: `1px solid ${T.border}` }}>
          {appointment.professional?.avatar_url ? (
            <img
              src={appointment.professional.avatar_url}
              alt={professionalName}
              className="w-14 h-14 rounded-full object-cover ring-2"
              style={{ boxShadow: `0 0 0 2px ${T.accent}` } as any}
            />
          ) : (
            <div
              className="w-14 h-14 rounded-full flex items-center justify-center text-xl font-bold ring-2"
              style={{ background: T.accentSoft, color: T.accent }}
            >
              {professionalName.charAt(0).toUpperCase()}
            </div>
          )}
          <div className="flex-1 min-w-0">
            <p className="font-semibold truncate">{professionalName}</p>
            {serviceNames && (
              <p className="text-xs truncate" style={{ color: T.textSec }}>
                {serviceNames}
              </p>
            )}
            <p className="text-xs mt-0.5" style={{ color: T.textSec }}>
              {format(parseISO(appointment.start_time), "dd 'de' MMM, yyyy 'às' HH:mm", { locale: ptBR })}
            </p>
          </div>
        </div>

        {/* BLOCO 1 — Profissional */}
        <div className="rounded-2xl p-5 space-y-4" style={{ background: T.card, border: `1px solid ${T.border}` }}>
          <div className="text-center space-y-1">
            <div className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[10px] font-semibold uppercase tracking-wide" style={{ background: T.accentSoft, color: T.accent }}>
              Etapa 1
            </div>
            <p className="font-semibold">Como foi seu atendimento?</p>
            <p className="text-xs" style={{ color: T.textSec }}>
              Avalie {professionalName}
            </p>
          </div>
          <StarRow value={professionalRating} onChange={setProfessionalRating} />
          <textarea
            placeholder="Conte como foi seu atendimento (opcional)"
            value={comment}
            onChange={(e) => setComment(e.target.value.slice(0, 500))}
            maxLength={500}
            rows={3}
            className="w-full rounded-xl px-4 py-3 text-sm resize-none outline-none placeholder:opacity-50 focus:ring-2"
            style={{ background: T.cardSoft, border: `1px solid ${T.border}`, color: T.text }}
          />
          <p className="text-[11px] text-right -mt-2" style={{ color: T.textSec }}>
            {comment.length}/500
          </p>
        </div>

        {/* BLOCO 2 — Empresa */}
        <div className="rounded-2xl p-5 space-y-4" style={{ background: T.card, border: `1px solid ${T.border}` }}>
          <div className="text-center space-y-1">
            <div className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[10px] font-semibold uppercase tracking-wide" style={{ background: T.accentSoft, color: T.accent }}>
              Etapa 2
            </div>
            <p className="font-semibold">E a sua experiência geral?</p>
            <p className="text-xs" style={{ color: T.textSec }}>
              Avalie {companyName}
            </p>
          </div>
          <StarRow value={barbershopRating} onChange={setBarbershopRating} />
          <textarea
            placeholder="Ambiente, recepção, pontualidade, experiência geral..."
            value={barbershopComment}
            onChange={(e) => setBarbershopComment(e.target.value.slice(0, 500))}
            maxLength={500}
            rows={3}
            className="w-full rounded-xl px-4 py-3 text-sm resize-none outline-none placeholder:opacity-50 focus:ring-2"
            style={{ background: T.cardSoft, border: `1px solid ${T.border}`, color: T.text }}
          />
          <p className="text-[11px] text-right -mt-2" style={{ color: T.textSec }}>
            {barbershopComment.length}/500
          </p>
        </div>

        {/* Submit */}
        <Button
          disabled={submitting || professionalRating < 1}
          onClick={handleSubmit}
          className="w-full rounded-xl py-6 font-semibold text-base transition-all shadow-lg"
          style={{
            background: professionalRating > 0 ? T.accent : T.border,
            color: professionalRating > 0 ? '#000' : T.textSec,
          }}
        >
          {submitting ? 'Enviando...' : '⭐ Enviar avaliação'}
        </Button>
        {professionalRating < 1 && (
          <p className="text-center text-[11px]" style={{ color: T.textSec }}>
            Selecione ao menos 1 estrela para o profissional
          </p>
        )}
      </div>
    </div>
  );
};

export default ReviewPage;
