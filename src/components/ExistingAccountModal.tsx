
import { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { LogIn, MessageCircle, Mail, RotateCcw, X, AlertTriangle, KeyRound, ArrowRight, ShieldCheck } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

interface ExistingAccountModalProps {
  isOpen: boolean;
  onClose: () => void;
  email?: string;
  whatsapp?: string;
  companyId: string;
  onLoginSuccess: () => void;
  onUseDifferentEmail: () => void;
}

export function ExistingAccountModal({ 
  isOpen, 
  onClose, 
  email: initialEmail, 
  whatsapp: initialWhatsapp,
  companyId,
  onLoginSuccess,
  onUseDifferentEmail 
}: ExistingAccountModalProps) {
  const [view, setView] = useState<'options' | 'password' | 'otp' | 'forgot' | 'whatsapp-sent' | 'identify'>('options');
  const [email, setEmail] = useState(initialEmail || '');
  const [whatsapp, setWhatsapp] = useState(initialWhatsapp || '');
  const [password, setPassword] = useState('');
  const [otpCode, setOtpCode] = useState('');
  const [loading, setLoading] = useState(false);
  const [timer, setTimer] = useState(0);

  useEffect(() => {
    if (initialEmail) setEmail(initialEmail);
    if (initialWhatsapp) setWhatsapp(initialWhatsapp);
  }, [initialEmail, initialWhatsapp]);

  useEffect(() => {
    if (isOpen && !initialEmail && !initialWhatsapp) {
      setView('identify');
    } else if (isOpen) {
      setView('options');
    }
  }, [isOpen]);

  useEffect(() => {
    let interval: any;
    if (timer > 0) {
      interval = setInterval(() => setTimer(prev => prev - 1), 1000);
    }
    return () => clearInterval(interval);
  }, [timer]);

  const handleLogin = async () => {
    setLoading(true);
    try {
      const { error } = await supabase.auth.signInWithPassword({
        email: email.trim().toLowerCase(),
        password,
      });

      if (error) {
        if (error.message.includes('Invalid login credentials')) {
          toast.error('Senha incorreta. Tente novamente ou recupere sua senha.');
        } else {
          toast.error(error.message);
        }
      } else {
        toast.success('Bem-vindo de volta!');
        onLoginSuccess();
        onClose();
      }
    } catch (err: any) {
      toast.error('Erro ao realizar login');
    } finally {
      setLoading(false);
    }
  };

  const handleSendOTP = async () => {
    const phoneToUse = whatsapp || initialWhatsapp;
    if (!phoneToUse) {
      setView('identify');
      return;
    }
    setLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke('whatsapp-integration', {
        body: {
          action: 'send-otp',
          companyId,
          phone: phoneToUse,
        }
      });

      if (error || (data && data.error)) {
        throw new Error(data?.error || 'Erro ao enviar código via WhatsApp');
      }

      toast.success('Código enviado com sucesso!');
      setView('otp');
      setTimer(60);
    } catch (err: any) {
      toast.error(err.message || 'Erro ao enviar código');
    } finally {
      setLoading(false);
    }
  };

  const handleVerifyOTP = async () => {
    if (otpCode.length !== 6) return;
    setLoading(true);
    try {
      const phoneToUse = whatsapp || initialWhatsapp;
      const { data, error } = await supabase.functions.invoke('whatsapp-integration', {
        body: {
          action: 'verify-otp',
          phone: phoneToUse,
          code: otpCode,
          redirectTo: window.location.href // Use current URL to return exactly here
        }
      });

      if (error || (data && data.error)) {
        throw new Error(data?.error || 'Código inválido ou expirado.');
      }

      if (data.loginUrl) {
        toast.success('Identidade verificada! Acessando...');
        // Supabase Magic Link will automatically sign in the user
        window.location.href = data.loginUrl;
      }
    } catch (err: any) {
      toast.error(err.message || 'Erro ao verificar código');
    } finally {
      setLoading(false);
    }
  };

  const handleForgotPassword = async () => {
    setLoading(true);
    try {
      const { error } = await supabase.auth.resetPasswordForEmail(email.trim().toLowerCase(), {
        redirectTo: `${window.location.origin}/reset-password`,
      });
      if (error) throw error;
      toast.success('E-mail de recuperação enviado! Verifique sua caixa de entrada.');
      setView('options');
    } catch (err: any) {
      toast.error(err.message || 'Erro ao enviar e-mail de recuperação');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="sm:max-w-[420px] rounded-[2.5rem] bg-[#0B132B] border-white/10 text-white p-0 overflow-hidden border-2 shadow-2xl">
        <div className="p-8">
          <DialogHeader className="mb-6">
            <div className="w-16 h-16 bg-amber-500/10 rounded-2xl flex items-center justify-center mb-4 mx-auto border border-amber-500/20">
              <KeyRound className="w-8 h-8 text-amber-500" />
            </div>
            <DialogTitle className="text-2xl font-black tracking-tight text-center">Identidade Reconhecida</DialogTitle>
            <DialogDescription className="text-slate-400 text-center text-sm font-medium mt-2">
              {view === 'identify' ? 'Informe seu WhatsApp para localizar seu cadastro.' : `O e-mail ${email} já está em nossa rede. Como deseja continuar?`}
            </DialogDescription>
          </DialogHeader>

          {view === 'identify' && (
            <div className="space-y-4 animate-in fade-in slide-in-from-bottom-4 duration-300">
              <div className="space-y-1.5">
                <Label className="text-[10px] font-black uppercase tracking-widest opacity-40 ml-2">Seu WhatsApp</Label>
                <Input 
                  value={whatsapp}
                  onChange={(e) => {
                    const digits = e.target.value.replace(/\D/g, '').slice(0, 11);
                    let masked = digits;
                    if (digits.length > 7) masked = `(${digits.slice(0,2)}) ${digits.slice(2,7)}-${digits.slice(7)}`;
                    else if (digits.length > 2) masked = `(${digits.slice(0,2)}) ${digits.slice(2)}`;
                    setWhatsapp(masked);
                  }}
                  placeholder="(11) 99999-9999"
                  className="rounded-2xl h-16 bg-white/5 border-white/10 text-white font-bold"
                  autoFocus
                />
              </div>
              <Button 
                onClick={handleSendOTP}
                disabled={loading || whatsapp.length < 14}
                className="w-full h-14 rounded-full bg-green-500 hover:bg-green-600 text-black font-black text-lg transition-all"
              >
                {loading ? "Buscando..." : "Continuar via WhatsApp"}
              </Button>
              <button 
                onClick={onClose}
                className="w-full text-[10px] font-black uppercase tracking-widest text-slate-400 hover:text-white py-2"
              >
                Voltar
              </button>
            </div>
          )}

          {view === 'options' && (

          {view === 'options' && (
            <div className="space-y-3">
              <Button 
                onClick={handleSendOTP}
                disabled={loading}
                className="w-full h-16 rounded-2xl bg-white/5 hover:bg-white/10 border border-white/10 text-white font-bold flex items-center justify-start gap-4 px-6 transition-all group"
              >
                <div className="w-11 h-11 bg-green-500/20 rounded-xl flex items-center justify-center group-hover:scale-110 transition-transform">
                  <MessageCircle className="w-5 h-5 text-green-400" />
                </div>
                <div className="text-left">
                  <p className="text-sm font-black">Acesso via WhatsApp</p>
                  <p className="text-[10px] opacity-40 uppercase tracking-widest">Código de 6 dígitos</p>
                </div>
                <ArrowRight className="w-4 h-4 ml-auto opacity-20 group-hover:opacity-100 group-hover:translate-x-1 transition-all" />
              </Button>

              <Button 
                onClick={() => setView('password')}
                className="w-full h-16 rounded-2xl bg-white/5 hover:bg-white/10 border border-white/10 text-white font-bold flex items-center justify-start gap-4 px-6 transition-all group"
              >
                <div className="w-11 h-11 bg-blue-500/20 rounded-xl flex items-center justify-center group-hover:scale-110 transition-transform">
                  <LogIn className="w-5 h-5 text-blue-400" />
                </div>
                <div className="text-left">
                  <p className="text-sm font-black">Entrar com Senha</p>
                  <p className="text-[10px] opacity-40 uppercase tracking-widest">Usar senha cadastrada</p>
                </div>
                <ArrowRight className="w-4 h-4 ml-auto opacity-20 group-hover:opacity-100 group-hover:translate-x-1 transition-all" />
              </Button>

              <div className="grid grid-cols-2 gap-3 mt-6">
                <Button 
                  variant="ghost" 
                  onClick={() => setView('forgot')}
                  className="text-[10px] uppercase tracking-widest font-black text-slate-400 hover:text-white hover:bg-transparent p-0 h-auto"
                >
                  Recuperar senha
                </Button>
                <Button 
                  variant="ghost" 
                  onClick={onUseDifferentEmail}
                  className="text-[10px] uppercase tracking-widest font-black text-slate-400 hover:text-white hover:bg-transparent p-0 h-auto"
                >
                  Usar outro e-mail
                </Button>
              </div>
            </div>
          )}

          {view === 'otp' && (
            <div className="space-y-5 animate-in fade-in slide-in-from-bottom-4 duration-300">
              <div className="text-center space-y-2">
                <ShieldCheck className="w-12 h-12 text-green-500 mx-auto mb-2 opacity-50" />
                <p className="text-sm text-slate-400">Digitou o código de 6 dígitos enviado para seu WhatsApp.</p>
              </div>
              
              <div className="space-y-1.5">
                <Label className="text-[10px] font-black uppercase tracking-widest opacity-40 ml-2">Código de Verificação</Label>
                <Input 
                  value={otpCode}
                  onChange={(e) => {
                    const val = e.target.value.replace(/\D/g, '').slice(0, 6);
                    setOtpCode(val);
                    if (val.length === 6) {
                      // Trigger automatic verification if 6 digits reached
                    }
                  }}
                  placeholder="0 0 0 0 0 0"
                  className="rounded-2xl h-16 bg-white/5 border-white/10 text-white font-black text-center text-3xl tracking-[0.5em] placeholder:tracking-normal placeholder:text-sm"
                  autoFocus
                />
              </div>

              <Button 
                onClick={handleVerifyOTP}
                disabled={loading || otpCode.length !== 6}
                className="w-full h-14 rounded-full bg-green-500 hover:bg-green-600 text-black font-black text-lg transition-all"
              >
                {loading ? "Verificando..." : "Verificar Código"}
              </Button>

              <div className="text-center">
                {timer > 0 ? (
                  <p className="text-[10px] font-black uppercase tracking-widest text-slate-500">Reenviar em {timer}s</p>
                ) : (
                  <button 
                    onClick={handleSendOTP}
                    className="text-[10px] font-black uppercase tracking-widest text-amber-500 hover:text-amber-400"
                  >
                    Não recebi o código
                  </button>
                )}
              </div>

              <button 
                onClick={() => setView('options')}
                className="w-full text-[10px] font-black uppercase tracking-widest text-slate-400 hover:text-white py-2"
              >
                Voltar às opções
              </button>
            </div>
          )}

          {view === 'password' && (
            <div className="space-y-4 animate-in fade-in slide-in-from-bottom-4 duration-300">
              <div className="space-y-1.5">
                <Label className="text-[10px] font-black uppercase tracking-widest opacity-40 ml-2">Sua Senha</Label>
                <Input 
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="Digite sua senha"
                  className="rounded-2xl h-16 bg-white/5 border-white/10 text-white font-bold"
                  autoFocus
                  onKeyDown={(e) => e.key === 'Enter' && handleLogin()}
                />
              </div>
              <Button 
                onClick={handleLogin}
                disabled={loading || !password}
                className="w-full h-14 rounded-full bg-amber-500 hover:bg-amber-600 text-black font-black text-lg transition-all"
              >
                {loading ? "Entrando..." : "Confirmar e Entrar"}
              </Button>
              <button 
                onClick={() => setView('options')}
                className="w-full text-[10px] font-black uppercase tracking-widest text-slate-400 hover:text-white py-2"
              >
                Voltar às opções
              </button>
            </div>
          )}

          {view === 'forgot' && (
            <div className="space-y-4 animate-in fade-in slide-in-from-bottom-4 duration-300 text-center">
              <div className="w-12 h-12 bg-purple-500/10 rounded-full flex items-center justify-center mx-auto mb-2">
                <RotateCcw className="w-6 h-6 text-purple-400" />
              </div>
              <p className="text-sm text-slate-400 leading-relaxed">
                Enviaremos um link de redefinição para <span className="text-white font-bold">{email}</span>
              </p>
              <Button 
                onClick={handleForgotPassword}
                disabled={loading}
                className="w-full h-14 rounded-full bg-white text-black font-black text-lg transition-all"
              >
                {loading ? "Enviando..." : "Enviar E-mail"}
              </Button>
              <button 
                onClick={() => setView('options')}
                className="w-full text-[10px] font-black uppercase tracking-widest text-slate-400 hover:text-white py-2"
              >
                Cancelar
              </button>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
