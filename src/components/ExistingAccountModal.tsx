import { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { LogIn, MessageCircle, Mail, RotateCcw, X, AlertTriangle, KeyRound, ArrowRight, ShieldCheck, UserX, CheckCircle2 } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';
import { OTPInput } from './auth/OTPInput';
import { useAuth } from '@/contexts/AuthContext';

interface ExistingAccountModalProps {
  isOpen: boolean;
  onClose: () => void;
  email?: string;
  whatsapp?: string;
  companyId: string;
  onLoginSuccess: () => void;
  onUseDifferentEmail: () => void;
  mode?: 'email_exists' | 'whatsapp_exists' | 'both_exists';
}

export function ExistingAccountModal({ 
  isOpen, 
  onClose, 
  email: initialEmail, 
  whatsapp: initialWhatsapp,
  companyId,
  onLoginSuccess,
  onUseDifferentEmail,
  mode = 'email_exists',
}: ExistingAccountModalProps) {
  const { updateAuthState } = useAuth();
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [view, setView] = useState<'options' | 'password' | 'otp' | 'forgot' | 'identify'>('options');
  const [email, setEmail] = useState(initialEmail || '');
  const [whatsapp, setWhatsapp] = useState(initialWhatsapp || '');
  const [password, setPassword] = useState('');
  const [otpCode, setOtpCode] = useState('');
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);
  const [attempts, setAttempts] = useState(0);
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
      setIsAuthenticated(false); // Reset authentication state when modal opens
    }
  }, [isOpen, initialEmail, initialWhatsapp]);

  useEffect(() => {
    let interval: any;
    if (timer > 0) {
      interval = setInterval(() => setTimer(prev => prev - 1), 1000);
    }
    return () => clearInterval(interval);
  }, [timer]);

  const handleLogout = async () => {
    setLoading(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (session?.user) {
        const { data: profile } = await supabase
          .from('profiles')
          .select('role')
          .eq('user_id', session.user.id)
          .single();
        
        if (profile?.role === 'client') {
          await supabase.auth.signOut();
        }
      }

      localStorage.removeItem(`client_id_${companyId}`);
      localStorage.removeItem(`client_data_${companyId}`);
      localStorage.removeItem('meagendae_client_data');
      localStorage.removeItem('booking_session_id');
      localStorage.removeItem('booking_client_session');
      
      setEmail('');
      setWhatsapp('');
      setPassword('');
      setOtpCode('');
      
      toast.success('Identificação limpa');
      onUseDifferentEmail();
      onClose();
    } catch (err) {
      toast.error('Erro ao sair');
    } finally {
      setLoading(false);
    }
  };

  const handleLogin = async () => {
    if (!email || !password) return;
    setLoading(true);
    setSuccess(false);
    try {
      const { data, error } = await supabase.auth.signInWithPassword({
        email: email.trim().toLowerCase(),
        password,
      });

      if (error) {
        if (error.message.includes('Invalid login credentials')) {
          toast.error('Senha incorreta. Tente novamente ou recupere sua senha.');
        } else {
          toast.error(error.message);
        }
      } else if (data.session) {
        setSuccess(true);
        setIsAuthenticated(true);
        toast.success('Bem-vindo de volta! 👋');
        
        await supabase.auth.setSession({
          access_token: data.session.access_token,
          refresh_token: data.session.refresh_token
        });

        // OBRIGATÓRIO: Manual update
        const { data: { session: confirmedSession } } = await supabase.auth.getSession();
        if (confirmedSession) {
          await updateAuthState(confirmedSession);
        }

        setTimeout(() => {
          onLoginSuccess();
          onClose();
        }, 800);
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
          email: email || null
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

  const handleVerifyOTP = async (codeValue?: string) => {
    const codeToVerify = codeValue || otpCode;
    if (codeToVerify.length !== 6) return;
    
    setLoading(true);
    try {
      const phoneToUse = whatsapp || initialWhatsapp;
      const { data, error } = await supabase.functions.invoke('whatsapp-integration', {
        body: {
          action: 'verify-otp',
          phone: phoneToUse,
          email: email || null,
          code: codeToVerify,
          companyId,
          redirectTo: window.location.href
        }
      });

      if (error || (data && data.error)) {
        const newAttempts = attempts + 1;
        setAttempts(newAttempts);
        setOtpCode('');
        
        if (newAttempts >= 3) {
          toast.error('Muitas tentativas. Enviando novo código...');
          setAttempts(0);
          handleSendOTP();
          return;
        }
        
        throw new Error(data?.error || 'Código inválido ou expirado.');
      }

      setSuccess(true);
      setIsAuthenticated(true);
      toast.success('Código confirmado! 👋');

      if (data.session) {
        await supabase.auth.setSession({
          access_token: data.session.access_token,
          refresh_token: data.session.refresh_token
        });
        
        // OBRIGATÓRIO: Manual update
        const { data: { session: confirmedSession } } = await supabase.auth.getSession();
        if (confirmedSession) {
          await updateAuthState(confirmedSession);
        }
        
        setTimeout(() => {
          onLoginSuccess();
          onClose();
        }, 800);
      } else if (data.loginUrl) {
        window.location.href = data.loginUrl;
      } else if (data.success) {
        setTimeout(() => {
          onLoginSuccess();
          onClose();
        }, 800);
      }
    } catch (err: any) {
      toast.error(err.message || 'Erro ao verificar código');
    } finally {
      setLoading(false);
    }
  };

  const handleForgotPassword = async () => {
    if (!email) return;
    setLoading(true);
    try {
      const { error } = await supabase.auth.resetPasswordForEmail(email.trim().toLowerCase(), {
        redirectTo: `${window.location.origin}/reset-password`,
      });
      if (error) throw error;
      toast.success('E-mail de recuperação enviado!');
      setView('options');
    } catch (err: any) {
      toast.error(err.message || 'Erro ao enviar e-mail de recuperação');
    } finally {
      setLoading(false);
    }
  };

  const getTitle = () => {
    if (view === 'identify') return 'Localizar Cadastro';
    if (view === 'otp') return 'Verificação WhatsApp';
    return 'Conta encontrada 👋';
  };

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="sm:max-w-[420px] rounded-[2.5rem] bg-[#0B132B] border-white/10 text-white p-0 overflow-hidden border-2 shadow-2xl">
        {success ? (
          <div className="p-12 flex flex-col items-center justify-center space-y-6 animate-in fade-in zoom-in duration-500">
            <div className="w-24 h-24 bg-emerald-500 rounded-full flex items-center justify-center shadow-[0_0_50px_rgba(16,185,129,0.4)]">
              <ShieldCheck className="w-12 h-12 text-zinc-950" />
            </div>
            <h1 className="text-4xl font-black tracking-tighter text-center">LOGIN OK</h1>
            <p className="text-emerald-400 font-bold uppercase tracking-widest text-xs">REDIRECIONANDO...</p>
          </div>
        ) : (
          <div className="p-8">
            <DialogHeader className="mb-8 bg-transparent border-none p-0 flex flex-col items-center">
              <div className="w-20 h-20 bg-emerald-500/10 rounded-[2rem] flex items-center justify-center mb-6 border border-emerald-500/20 shadow-[0_0_30px_rgba(16,185,129,0.1)]">
                {view === 'otp' ? (
                  <ShieldCheck className="w-10 h-10 text-emerald-500" />
                ) : view === 'password' ? (
                  <LogIn className="w-10 h-10 text-blue-500" />
                ) : (
                  <KeyRound className="w-10 h-10 text-amber-500" />
                )}
              </div>
              <DialogTitle className="text-3xl font-black tracking-tight text-center text-white">
                {getTitle()}
              </DialogTitle>
              <DialogDescription className="text-slate-400 text-center text-base font-medium mt-3 px-4 leading-relaxed">
                {view === 'otp' ? 'Digite o código de 6 dígitos que enviamos para você.' : 'Escolha como entrar para continuar seu agendamento.'}
              </DialogDescription>
            </DialogHeader>

            {view === 'identify' && (
              <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-300">
                <div className="space-y-2">
                  <Label className="text-[10px] font-black uppercase tracking-[0.2em] opacity-40 ml-4">Seu WhatsApp</Label>
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
                    className="rounded-2xl h-16 bg-white/5 border-white/10 text-white font-bold text-lg px-6 focus:border-emerald-500/50"
                    autoFocus
                  />
                </div>
                <Button 
                  onClick={handleSendOTP}
                  disabled={loading || whatsapp.length < 14}
                  className="w-full h-16 rounded-full bg-emerald-500 hover:bg-emerald-600 text-zinc-950 font-black text-lg transition-all shadow-lg shadow-emerald-500/20"
                >
                  {loading ? "Buscando..." : "Receber código no WhatsApp"}
                </Button>
                <button 
                  onClick={onClose}
                  className="w-full text-[10px] font-black uppercase tracking-[0.2em] text-slate-400 hover:text-white py-2 transition-colors"
                >
                  Voltar
                </button>
              </div>
            )}

            {view === 'options' && (
              <div className="space-y-4">
                <Button 
                  onClick={handleSendOTP}
                  disabled={loading}
                  className="w-full h-20 rounded-2xl bg-white/5 hover:bg-white/10 border border-white/10 text-white font-bold flex items-center justify-start gap-5 px-6 transition-all group"
                >
                  <div className="w-12 h-12 bg-emerald-500/20 rounded-xl flex items-center justify-center group-hover:scale-110 transition-transform">
                    <MessageCircle className="w-6 h-6 text-emerald-400" />
                  </div>
                  <div className="text-left">
                    <p className="text-base font-black">Receber código no WhatsApp</p>
                    <p className="text-[10px] opacity-40 uppercase tracking-widest font-black">Acesso rápido sem senha</p>
                  </div>
                  <ArrowRight className="w-5 h-5 ml-auto opacity-20 group-hover:opacity-100 group-hover:translate-x-1 transition-all" />
                </Button>

                <Button 
                  onClick={() => setView('password')}
                  className="w-full h-20 rounded-2xl bg-white/5 hover:bg-white/10 border border-white/10 text-white font-bold flex items-center justify-start gap-5 px-6 transition-all group"
                >
                  <div className="w-12 h-12 bg-blue-500/20 rounded-xl flex items-center justify-center group-hover:scale-110 transition-transform">
                    <LogIn className="w-6 h-6 text-blue-400" />
                  </div>
                  <div className="text-left">
                    <p className="text-base font-black">Entrar com Senha</p>
                    <p className="text-[10px] opacity-40 uppercase tracking-widest font-black">Usar senha cadastrada</p>
                  </div>
                  <ArrowRight className="w-5 h-5 ml-auto opacity-20 group-hover:opacity-100 group-hover:translate-x-1 transition-all" />
                </Button>

                <div className="pt-6 grid grid-cols-2 gap-4">
                  <Button 
                    variant="ghost" 
                    onClick={handleLogout}
                    className="h-12 rounded-xl bg-white/5 border border-white/5 hover:bg-red-500/10 hover:text-red-400 text-[10px] uppercase tracking-widest font-black text-slate-400 group"
                  >
                    <UserX className="w-3 h-3 mr-2 opacity-50 group-hover:opacity-100" />
                    Trocar Conta
                  </Button>
                  <Button 
                    variant="ghost" 
                    onClick={onClose}
                    className="h-12 rounded-xl bg-white/5 border border-white/5 hover:bg-white/10 text-[10px] uppercase tracking-widest font-black text-slate-400"
                  >
                    Voltar
                  </Button>
                </div>
              </div>
            )}

            {view === 'otp' && (
              <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-300">
                <OTPInput 
                  value={otpCode}
                  onChange={setOtpCode}
                  onComplete={(val) => handleVerifyOTP(val)}
                  disabled={loading || success}
                />
                <Button 
                  onClick={() => handleVerifyOTP()}
                  disabled={loading || success || otpCode.length !== 6}
                  className="w-full h-16 rounded-full font-black text-lg transition-all shadow-lg bg-emerald-500 hover:bg-emerald-600 text-zinc-950 shadow-emerald-500/20"
                >
                  {loading ? "Verificando..." : "Verificar Código"}
                </Button>
                <div className="text-center">
                  {timer > 0 ? (
                    <p className="text-xs font-black uppercase tracking-widest text-slate-500">
                      Reenviar em <span className="text-emerald-500">{timer}s</span>
                    </p>
                  ) : (
                    <button onClick={handleSendOTP} className="text-xs font-black uppercase tracking-widest text-emerald-500 hover:text-emerald-400">
                      Reenviar código
                    </button>
                  )}
                </div>
              </div>
            )}

            {view === 'password' && (
              <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-300">
                <div className="space-y-2">
                  <Label className="text-[10px] font-black uppercase tracking-[0.2em] opacity-40 ml-4">Sua Senha</Label>
                  <Input 
                    type="password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="••••••••"
                    className="rounded-2xl h-16 bg-white/5 border-white/10 text-white font-bold text-lg px-6 focus:border-blue-500/50"
                    autoFocus
                  />
                </div>
                <Button 
                  onClick={handleLogin}
                  disabled={loading || success || !password}
                  className="w-full h-16 rounded-full font-black text-lg transition-all shadow-lg bg-blue-500 hover:bg-blue-600 text-white shadow-blue-500/20"
                >
                  {loading ? "Entrando..." : "Confirmar e Entrar"}
                </Button>
                <div className="flex flex-col gap-2">
                  <button onClick={() => setView('forgot')} className="text-[10px] font-black uppercase tracking-widest text-slate-500 hover:text-white">
                    Esqueci minha senha
                  </button>
                  <button onClick={() => setView('options')} className="text-[10px] font-black uppercase tracking-widest text-slate-400 hover:text-white">
                    Voltar
                  </button>
                </div>
              </div>
            )}
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}