import { useEffect, useState } from 'react';
import { useParams, useSearchParams } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { CheckCircle2, XCircle, Clock, Calendar, Scissors, User, Loader2, AlertTriangle, Building2 } from 'lucide-react';
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
  red: 'rgba(239,68,68,0.15)',
  redText: '#F87171',
};

const RequestConfirmation = () => {
  const { requestId } = useParams<{ requestId: string }>();
  const [searchParams] = useSearchParams();
  const autoAction = searchParams.get('action');
  
  const [request, setRequest] = useState<any>(null);
  const [company, setCompany] = useState<any>(null);
  const [service, setService] = useState<any>(null);
  const [professional, setProfessional] = useState<any>(null);
  
  const [loading, setLoading] = useState(true);
  const [processing, setProcessing] = useState(false);
  const [result, setResult] = useState<{ success: boolean; message: string; alreadyProcessed?: boolean } | null>(null);

  useEffect(() => {
    if (requestId) {
      fetchRequestDetails();
    }
  }, [requestId]);

  const fetchRequestDetails = async () => {
    try {
      // Get basic request data (using direct query as it's public insert/select partially handled by RLS)
      // Actually we need a safe way to read this. Let's use a small RPC or just select if RLS allows.
      // Based on my RLS check, anon can insert but not necessarily select everything.
      // I'll add a small RPC to get public request info safely if needed, 
      // but let's try selecting first as some tables have public select.
      
      const { data: reqData, error: reqError } = await supabase
        .from('appointment_requests' as any)
        .select('*')
        .eq('id', requestId)
        .maybeSingle();

      if (reqError || !reqData) {
        setLoading(false);
        return;
      }

      setRequest(reqData);

      // Fetch related info
      const [compRes, svcRes, profRes] = await Promise.all([
        supabase.from('companies').select('name, phone, logo_url').eq('id', reqData.company_id).maybeSingle(),
        supabase.from('services').select('name').eq('id', reqData.service_id).maybeSingle(),
        supabase.from('profiles').select('full_name').eq('id', reqData.professional_id).maybeSingle()
      ]);

      setCompany(compRes.data);
      setService(svcRes.data);
      setProfessional(profRes.data);

      // Handle auto-action from URL
      if (reqData.status === 'suggested' && autoAction) {
        if (autoAction === 'confirm') {
          handleConfirm(reqData.id);
        } else if (autoAction === 'reject') {
          handleReject(reqData.id);
        }
      } else if (reqData.status !== 'suggested') {
        setResult({ 
          success: reqData.status === 'accepted', 
          message: reqData.status === 'accepted' ? 'Esta solicitação já foi confirmada.' : 'Esta solicitação já foi processada ou recusada.',
          alreadyProcessed: true
        });
      }
    } catch (err) {
      console.error('Error fetching details:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleConfirm = async (id: string) => {
    setProcessing(true);
    try {
      const { data, error } = await supabase.rpc('confirm_suggested_request', {
        p_request_id: id
      });

      if (error) throw error;

      const res = data as any;
      if (res.success) {
        setResult({ success: true, message: 'Horário confirmado com sucesso! Seu agendamento já está na nossa agenda.' });
        toast.success('Horário confirmado!');
      } else {
        setResult({ success: false, message: res.error || 'Erro ao confirmar horário.' });
      }
    } catch (err: any) {
      toast.error(err.message || 'Erro ao processar confirmação');
    } finally {
      setProcessing(false);
    }
  };

  const handleReject = async (id: string) => {
    setProcessing(true);
    try {
      const { data, error } = await supabase.rpc('reject_suggested_request', {
        p_request_id: id
      });

      if (error) throw error;

      const res = data as any;
      if (res.success) {
        setResult({ success: false, message: 'Você recusou a sugestão de horário. Sinta-se à vontade para solicitar um novo horário ou escolher outro na agenda.' });
        toast.info('Sugestão recusada');
      } else {
        toast.error(res.error || 'Erro ao recusar sugestão');
      }
    } catch (err: any) {
      toast.error(err.message || 'Erro ao processar recusa');
    } finally {
      setProcessing(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center" style={{ background: T.bg, color: T.text }}>
        <Loader2 className="h-8 w-8 animate-spin" style={{ color: T.accent }} />
      </div>
    );
  }

  if (!request) {
    return (
      <div className="min-h-screen flex items-center justify-center p-4" style={{ background: T.bg, color: T.text }}>
        <div className="text-center space-y-4 max-w-sm">
          <XCircle className="h-16 w-16 mx-auto" style={{ color: T.redText }} />
          <h1 className="text-xl font-bold">Solicitação não encontrada</h1>
          <p style={{ color: T.textSec }}>Este link pode estar expirado ou é inválido.</p>
          <Button onClick={() => window.location.href = '/'} variant="outline" className="w-full">Voltar ao início</Button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center p-4" style={{ background: T.bg, color: T.text }}>
      <div className="w-full max-w-md space-y-6">
        
        {/* Header / Logo */}
        <div className="text-center space-y-2">
          {company?.logo_url && (
            <img src={company.logo_url} alt={company.name} className="h-16 mx-auto mb-4 rounded-full object-cover" />
          )}
          <h1 className="text-2xl font-bold tracking-tight">Solicitação de Horário</h1>
          <p className="text-sm" style={{ color: T.textSec }}>{company?.name || 'Carregando...'}</p>
        </div>

        {result ? (
          <div className="text-center space-y-6 animate-in fade-in zoom-in duration-300">
            <div className={`w-20 h-20 rounded-full mx-auto flex items-center justify-center ${result.success ? '' : 'bg-opacity-20'}`} 
                 style={{ background: result.success ? T.green : T.red }}>
              {result.success ? (
                <CheckCircle2 className="h-10 w-10" style={{ color: T.greenText }} />
              ) : (
                <AlertTriangle className="h-10 w-10" style={{ color: T.redText }} />
              )}
            </div>
            <div className="space-y-2">
              <h2 className="text-xl font-bold">{result.success ? 'Tudo pronto!' : 'Processado'}</h2>
              <p className="text-sm px-4" style={{ color: T.textSec }}>{result.message}</p>
            </div>
            
            <Button 
              onClick={() => window.location.href = '/'} 
              className="w-full rounded-xl py-6 font-semibold"
              style={{ background: T.accent, color: T.bg }}
            >
              Ir para o Início
            </Button>
          </div>
        ) : (
          <>
            <div className="rounded-2xl overflow-hidden" style={{ background: T.card, border: `1px solid ${T.border}` }}>
              <div className="p-5 border-b" style={{ borderColor: T.border, background: 'rgba(245,158,11,0.05)' }}>
                <div className="flex items-center gap-2 text-amber-500 mb-1">
                  <Clock className="h-4 w-4" />
                  <span className="text-xs font-bold uppercase tracking-wider">Sugestão do Profissional</span>
                </div>
                <p className="text-lg font-bold">
                  {format(parseISO(request.suggested_date), "dd 'de' MMMM", { locale: ptBR })} às {request.suggested_time.slice(0, 5)}
                </p>
              </div>
              
              <div className="p-5 space-y-4">
                <div className="flex items-center gap-3">
                  <Building2 className="h-5 w-5 shrink-0" style={{ color: T.accent }} />
                  <div>
                    <p className="text-[10px] uppercase tracking-widest font-bold" style={{ color: T.textSec }}>Empresa</p>
                    <p className="font-semibold text-sm">{company?.name}</p>
                  </div>
                </div>

                <div className="flex items-center gap-3">
                  <User className="h-5 w-5 shrink-0" style={{ color: T.accent }} />
                  <div>
                    <p className="text-[10px] uppercase tracking-widest font-bold" style={{ color: T.textSec }}>Profissional</p>
                    <p className="font-semibold text-sm">{professional?.full_name || 'Qualquer profissional'}</p>
                  </div>
                </div>

                <div className="flex items-center gap-3">
                  <Scissors className="h-5 w-5 shrink-0" style={{ color: T.accent }} />
                  <div>
                    <p className="text-[10px] uppercase tracking-widest font-bold" style={{ color: T.textSec }}>Serviço</p>
                    <p className="font-semibold text-sm">{service?.name || 'Serviço personalizado'}</p>
                  </div>
                </div>
              </div>
            </div>

            <div className="space-y-3 pt-2">
              <Button
                onClick={() => handleConfirm(request.id)}
                disabled={processing}
                className="w-full rounded-xl py-7 font-bold text-lg shadow-lg shadow-amber-500/20"
                style={{ background: T.accent, color: T.bg }}
              >
                {processing ? <Loader2 className="h-5 w-5 animate-spin" /> : 'Confirmar este horário'}
              </Button>
              
              <Button
                onClick={() => handleReject(request.id)}
                disabled={processing}
                variant="ghost"
                className="w-full rounded-xl py-6"
                style={{ color: T.textSec }}
              >
                Não posso neste horário
              </Button>
            </div>
          </>
        )}

        <div className="text-center pt-8">
          <p className="text-[10px] uppercase tracking-widest opacity-30">Desenvolvido por Lovable</p>
        </div>
      </div>
    </div>
  );
};

export default RequestConfirmation;
